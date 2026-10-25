#!/usr/bin/env python3
"""
=============================================================================
SmartFace Pi Device Simulator
=============================================================================

Giả lập Raspberry Pi giao tiếp với Backend SmartFace qua HTTP trực tiếp
(Direct HTTP to /api/attendance/tb-webhook — bỏ qua tầng ThingsBoard MQTT
để test nhanh BE + DB + FE realtime).

Hợp đồng / Contract (POST /api/attendance/tb-webhook):
  Headers:
    X-TB-Webhook-Secret  : TB_WEBHOOK_SECRET trong .env backend (>= 24 chars)
    X-Device-Name        : device_id (phải khớp body.device_id)
  Body JSON:
    device_id            str   tên thiết bị (PI4_FRONT_GATE)
    mode                 str   CHECK_IN | CHECK_OUT
    event_id             str   UUID hex, duy nhất mỗi sự kiện lượt điểm danh
    client_timestamp     int   epoch milliseconds (thời điểm quét thật)
    antispoof_score      float liveness [0..1]; phải >= 0.5
    event_kind           str   VERIFY_ONLY | CONFIRMED_SCAN
    recognition_id       str   UUID hex, khác nhau mỗi lần quét vật lý
    expected_employee_id str   UUID nhân viên (chỉ trong CONFIRMED_SCAN)
    embedding_b64        str   Base64(512 x float32 LE) = 2048 bytes

Protocol xác nhận 2 pha (ATTENDANCE_STABLE_COUNT = N, default 3):
  Scan 1 .. N-1  → event_kind=VERIFY_ONLY  → BE chưa ghi DB
  Scan N (commit)→ event_kind=CONFIRMED_SCAN → BE ghi attendance_log + Socket.IO

Yêu cầu:
  pip install httpx python-dotenv

Sử dụng:
  python scripts/pi_simulator.py                     # chạy toàn bộ
  python scripts/pi_simulator.py --scenarios basic spoof wrong_secret
  python scripts/pi_simulator.py --scenarios multi_device --devices 10
  python scripts/pi_simulator.py --help
=============================================================================
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import math
import os
import struct
import sys
import time
import traceback
import uuid
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

# ─── Dependencies (Zero-dependency fallback) ──────────────────────────────────
import urllib.request
import urllib.error

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

def load_dotenv(filepath: Path | str) -> None:
    """Doc file .env bang standard library (khong can python-dotenv)."""
    p = Path(filepath)
    if not p.is_file():
        return
    try:
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


# ─── Terminal Colors ──────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

# Force UTF-8 stdout on Windows to avoid cp1252 encode errors
if sys.stdout.encoding and sys.stdout.encoding.lower().startswith("cp"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SEP      = "-" * 60
SEP_THIN = "-" * 60

def c_ok(msg: str)   -> str: return f"{GREEN}[PASS] {msg}{RESET}"
def c_fail(msg: str) -> str: return f"{RED}[FAIL] {msg}{RESET}"
def c_warn(msg: str) -> str: return f"{YELLOW}[WARN] {msg}{RESET}"
def c_info(msg: str) -> str: return f"{CYAN}[INFO] {msg}{RESET}"


# ─── Config ───────────────────────────────────────────────────────────────────
def load_config() -> dict:
    """Nap cau hinh tu .env hoac moi truong."""
    here = Path(__file__).resolve().parent
    for candidate in [
        here / ".env",
        here.parent / ".env",
        here.parent.parent / ".env",
        here.parent.parent / "backend" / ".env",
        here.parent / "backend" / ".env",
        here.parent.parent / ".env.compose",
        here.parent / ".env.compose",
    ]:
        if candidate.exists():
            load_dotenv(candidate)
            print(c_info(f"Nap cau hinh tu: {candidate}"))
            break


    cfg = {
        "base_url":              os.getenv("SIMULATOR_BASE_URL", "http://localhost:3000"),
        "webhook_secret":        os.getenv("TB_WEBHOOK_SECRET", ""),
        "device_id":             os.getenv("SIMULATOR_DEVICE_ID", "PI4_FRONT_GATE"),
        "stable_count":          int(os.getenv("ATTENDANCE_STABLE_COUNT", "3")),
        "timeout":               float(os.getenv("SIMULATOR_TIMEOUT_SEC", "10")),
        # UUID nhan vien da co face_embedding active trong DB
        "known_employee_id":     os.getenv("SIMULATOR_EMPLOYEE_ID", ""),
        # Path den file JSON chua vector 512D cua nhan vien do (optional)
        "known_embedding_file":  os.getenv("SIMULATOR_EMBEDDING_FILE", ""),
    }

    return cfg



# ─── Embedding Utilities ──────────────────────────────────────────────────────
def _l2_normalize(v: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in v))
    return [x / norm for x in v] if norm > 0 else v


def make_unit_vector_from_seed(seed_str: str, dim: int = 512) -> list[float]:
    """Sinh vector L2-normalized tái lập được từ string seed (đảm bảo không bao giờ bị NaN/Inf)."""
    h = hashlib.sha256(seed_str.encode()).digest()
    floats: list[float] = []
    counter = 0
    while len(floats) < dim:
        block = hashlib.sha256(h + counter.to_bytes(4, "big")).digest()
        counter += 1
        for i in range(0, 32, 4):
            if len(floats) >= dim:
                break
            val = struct.unpack_from("<i", block, i)[0]
            floats.append(val / 2147483648.0)
    return _l2_normalize(floats)



def load_embedding_from_file(path: str) -> Optional[list[float]]:
    """Nap embedding da luu san tu file JSON (list 512 float)."""
    try:
        with open(path) as f:
            data = json.load(f)
        vec = data if isinstance(data, list) else data.get("embedding", [])
        if len(vec) == 512:
            return _l2_normalize(list(map(float, vec)))
    except Exception as e:
        print(c_warn(f"Khong the nap embedding tu {path}: {e}"))
    return None


def vector_to_b64(vec: list[float]) -> str:
    """Chuyen vector float list sang Base64 Float32 LE (dinh dang Pi that dung)."""
    buf = struct.pack(f"<{len(vec)}f", *vec)
    return base64.b64encode(buf).decode("ascii")


# ─── HTTP Client ──────────────────────────────────────────────────────────────
class PiSimulatorClient:
    """
    HTTP client gia lap Pi gui webhook thang len Backend.
    Su dung dung header auth nhu ThingsBoard Rule Chain.
    """

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.base_url = cfg["base_url"].rstrip("/")
        self.webhook_url = f"{self.base_url}/api/attendance/tb-webhook"
        self.secret = cfg["webhook_secret"]
        self.timeout = cfg["timeout"]

    def _headers(self, device_id: str, secret: Optional[str] = None) -> dict:
        return {
            "Content-Type":        "application/json",
            "X-TB-Webhook-Secret": secret if secret is not None else self.secret,
            "X-Device-Name":       device_id,
        }

    def _send_sync(self, headers: dict, body: dict) -> tuple[int, dict]:
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(self.webhook_url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status_code = resp.status
                raw = resp.read().decode("utf-8")
                try:
                    return status_code, json.loads(raw)
                except Exception:
                    return status_code, {"raw": raw}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            try:
                rj = json.loads(raw)
            except Exception:
                rj = {"raw": raw}
            return e.code, rj
        except urllib.error.URLError as e:
            reason = str(e.reason).lower()
            if "refused" in reason or "10061" in reason:
                return -1, {"error": "Connection refused — backend dang tat?"}
            if "timed out" in reason:
                return -2, {"error": "Timeout"}
            return -1, {"error": str(e.reason)}
        except Exception as e:
            return -3, {"error": str(e)}

    async def send_raw(self, headers: dict, body: dict) -> tuple[int, dict]:
        """Gui request webhook voi body va headers tuy y (ho tro ca urllib va httpx)."""
        if not HAS_HTTPX:
            return await asyncio.to_thread(self._send_sync, headers, body)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                r = await client.post(self.webhook_url, json=body, headers=headers)
                try:
                    rj = r.json()
                except Exception:
                    rj = {"raw": r.text}
                return r.status_code, rj
            except httpx.ConnectError:
                return -1, {"error": "Connection refused — backend dang tat?"}
            except httpx.TimeoutException:
                return -2, {"error": "Timeout"}
            except Exception as e:
                return -3, {"error": str(e)}

    async def send(
        self,
        device_id: str,
        mode: str,
        event_id: str,
        recognition_id: str,
        embedding: list[float],
        antispoof_score: float,
        event_kind: str,
        client_timestamp: Optional[int] = None,
        expected_employee_id: Optional[str] = None,
        override_secret: Optional[str] = None,
    ) -> tuple[int, dict]:
        """
        Gui 1 request webhook.
        Tra ve (status_code, response_json). status_code am = loi mang.
        """
        body: dict[str, Any] = {
            "device_id":        device_id,
            "mode":             mode,
            "event_id":         event_id,
            "client_timestamp": client_timestamp or int(time.time() * 1000),
            "antispoof_score":  antispoof_score,
            "event_kind":       event_kind,
            "recognition_id":   recognition_id,
            "embedding_b64":    vector_to_b64(embedding),
        }
        if expected_employee_id:
            body["expected_employee_id"] = expected_employee_id

        headers = self._headers(device_id, override_secret)
        return await self.send_raw(headers, body)



    async def send_full_scan_session(
        self,
        device_id: str,
        mode: str,
        embedding: list[float],
        antispoof_score: float = 0.92,
        event_id: Optional[str] = None,
        expected_employee_id: Optional[str] = None,
        stable_count: int = 3,
        delay_between_scans: float = 0.1,
        verbose: bool = True,
    ) -> list[tuple[int, dict]]:
        """
        Gia lap 1 phien quet day du theo giao thuc 2 pha:
          - Lan 1 den (stable_count - 1): VERIFY_ONLY
          - Lan stable_count (commit):     CONFIRMED_SCAN voi expected_employee_id

        Tra ve danh sach (status, response) cua tung lan gui.
        """
        event_id = event_id or uuid.uuid4().hex
        results = []

        for i in range(stable_count):
            recognition_id = uuid.uuid4().hex
            is_commit = (i == stable_count - 1) and bool(expected_employee_id)
            event_kind = "CONFIRMED_SCAN" if is_commit else "VERIFY_ONLY"
            emp_arg = expected_employee_id if is_commit else None

            if verbose:
                kind_lbl = f"{BOLD}CONFIRMED_SCAN{RESET}" if is_commit else "VERIFY_ONLY"
                print(f"  [{i+1}/{stable_count}] {kind_lbl} mode={mode} rec={recognition_id[:12]}...")

            status, resp = await self.send(
                device_id=device_id,
                mode=mode,
                event_id=event_id,
                recognition_id=recognition_id,
                embedding=embedding,
                antispoof_score=antispoof_score,
                event_kind=event_kind,
                expected_employee_id=emp_arg,
            )
            results.append((status, resp))

            if verbose:
                _print_response(status, resp, short=True)

            if delay_between_scans > 0 and i < stable_count - 1:
                await asyncio.sleep(delay_between_scans)

        return results


# ─── Response Printer ─────────────────────────────────────────────────────────
def _print_response(status: int, resp: dict, short: bool = False):
    if status == 200:
        if resp.get("verification_only"):
            cnt = resp.get("confirmation_count", "?")
            req = resp.get("confirmation_required", "?")
            print(f"    {YELLOW}-> VERIFY_ONLY {cnt}/{req}{RESET}")
        elif resp.get("matched") and resp.get("success"):
            emp = resp.get("employee", {})
            print(f"    {GREEN}-> MATCH: {emp.get('full_name','?')} ({emp.get('employee_code','?')}){RESET}")
            if not short:
                print(f"       similarity={resp.get('similarity','?')}  mode={resp.get('mode','?')}")
        elif resp.get("matched") is False:
            print(f"    {YELLOW}-> UNKNOWN — khong tim thay nhan vien (similarity={resp.get('similarity','?')}){RESET}")
        elif resp.get("success") is False:
            print(f"    {YELLOW}-> REJECTED: {resp.get('message','?')[:80]}{RESET}")
        else:
            print(f"    -> {resp}")
    elif status == 401:
        print(f"    {RED}-> 401 Unauthorized — sai webhook secret{RESET}")
    elif status == 400:
        print(f"    {RED}-> 400 Bad Request: {resp.get('message', resp)}{RESET}")
    elif status == 409:
        print(f"    {YELLOW}-> 409 Conflict (duplicate / da diem danh): {resp.get('message','?')[:60]}{RESET}")
    elif status < 0:
        print(f"    {RED}-> Network error ({status}): {resp.get('error','?')}{RESET}")
    else:
        print(f"    {YELLOW}-> HTTP {status}: {resp}{RESET}")


# ─── Offline Queue ────────────────────────────────────────────────────────────
@dataclass
class QueuedEvent:
    body: dict
    device_id: str
    created_at: float = field(default_factory=time.time)


class OfflineQueue:
    """
    Hang doi offline: luu su kien khi BE tat, gui bu khi BE len lai.
    Timestamp goc (client_timestamp) duoc giu nguyen khi gui bu.
    """

    def __init__(self, maxsize: int = 500):
        self._q: deque[QueuedEvent] = deque(maxlen=maxsize)

    def push(self, body: dict, device_id: str):
        self._q.append(QueuedEvent(body=body, device_id=device_id))
        print(c_info(f"[Queue] Da xep hang {len(self._q)} su kien (offline)."))

    def __len__(self):
        return len(self._q)

    async def drain(self, client: PiSimulatorClient) -> int:
        """Gui tat ca su kien cho. Tra ve so su kien gui thanh cong."""
        sent = 0
        while self._q:
            evt = self._q[0]
            headers = client._headers(evt.device_id)
            code, _ = await client.send_raw(headers, evt.body)
            if code in (200, 201, 409):
                self._q.popleft()
                sent += 1
                age_s = time.time() - evt.created_at
                print(c_ok(f"[Queue] Gui bu thanh cong (tuoi {age_s:.0f}s): HTTP {code}"))
            elif code < 0:
                print(c_warn(f"[Queue] Loi mang khi gui bu — dung."))
                break
            else:
                print(c_warn(f"[Queue] Gui bu that bai HTTP {code} — dung."))
                break
        return sent



# ─── Test Results ─────────────────────────────────────────────────────────────
@dataclass
class TestResult:
    name: str
    passed: bool
    detail: str = ""
    error: str = ""


# ─── Scenarios ────────────────────────────────────────────────────────────────
class ScenarioRunner:
    """Chay cac kich ban test va thu thap ket qua."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.client = PiSimulatorClient(cfg)
        self.results: list[TestResult] = []
        self.stable_count = cfg["stable_count"]
        self.device_id = cfg["device_id"]

        # Vector nhan vien "da biet" — dung de test match
        # Neu co file embedding that thi dung, nguoc lai sinh tu seed co dinh
        default_file = Path(__file__).resolve().parent / "known_face_embedding.json"
        emb_file = cfg.get("known_embedding_file", "") or (str(default_file) if default_file.exists() else "")
        self._known_vec = (
            load_embedding_from_file(emb_file)
            if emb_file
            else make_unit_vector_from_seed("smartface-known-employee-seed-v1")
        )
        self._known_employee_id: str = cfg.get("known_employee_id", "") or ""
        if not self._known_employee_id and emb_file and Path(emb_file).exists():
            try:
                with open(emb_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    if isinstance(meta, dict) and meta.get("employee_id"):
                        self._known_employee_id = meta["employee_id"]
            except Exception:
                pass
        # Vector nguoi la (similarity thap, thuong bi UNKNOWN)
        self._unknown_vec = make_unit_vector_from_seed("smartface-random-unknown-v99")


    def _record(self, name: str, passed: bool, detail: str = "", error: str = ""):
        r = TestResult(name=name, passed=passed, detail=detail, error=error)
        self.results.append(r)
        icon = c_ok(name) if passed else c_fail(name)
        print(f"\n{'='*60}")
        print(f"{BOLD}[RESULT]{RESET} {icon}")
        if detail:
            print(f"  {DIM}{detail}{RESET}")
        if error:
            print(f"  {RED}{error}{RESET}")
        return r

    # ── Scenario 1: Basic Check-in / Check-out ──────────────────────────────
    async def scenario_basic(self):
        """
        Luong co ban: VERIFY_ONLY (N-1 lan) -> CONFIRMED_SCAN.
        Ky vong:
          - Cac lan VERIFY_ONLY tra verification_only=true
          - CONFIRMED_SCAN tra matched=true, success=true
          - Frontend nhan Socket.IO 'checked-in' / 'checked-out'

        YEU CAU: SIMULATOR_EMPLOYEE_ID phai duoc cau hinh va nhan vien
        do phai co face_embedding active trong DB. Neu khong co embedding
        khop voi self._known_vec trong DB, ket qua se la UNKNOWN.
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 1: Basic Check-in -> Check-out{RESET}")

        if not self._known_employee_id:
            self._record(
                "basic_check_in_out",
                False,
                "Bo qua — can SIMULATOR_EMPLOYEE_ID (UUID nhan vien co face_embedding trong DB).",
                "Dat SIMULATOR_EMPLOYEE_ID trong .env va chay lai.",
            )
            return

        passed = True
        detail_parts = []

        for mode in ["CHECK_IN", "CHECK_OUT"]:
            print(f"\n  {BOLD}-> {mode}{RESET}")
            results = await self.client.send_full_scan_session(
                device_id=self.device_id,
                mode=mode,
                embedding=self._known_vec,
                antispoof_score=0.93,
                expected_employee_id=self._known_employee_id,
                stable_count=self.stable_count,
                verbose=True,
            )

            # Kiem tra cac lan VERIFY_ONLY
            for i, (st, rp) in enumerate(results[:-1]):
                if st != 200 or not rp.get("verification_only"):
                    passed = False
                    detail_parts.append(f"{mode} lan {i+1}: khong tra verification_only (HTTP {st})")

            # Kiem tra lan CONFIRMED_SCAN cuoi
            final_st, final_rp = results[-1]
            if final_st == 200 and final_rp.get("matched") and final_rp.get("success"):
                detail_parts.append(f"{mode} OK — similarity={final_rp.get('similarity','?')}")
            elif final_st in (200, 409) and not final_rp.get("success"):
                # 409 hoac message "da diem danh" la acceptable (duplicate today)
                detail_parts.append(f"{mode} Duplicate (da diem danh hom nay) — accepted")
            else:
                passed = False
                detail_parts.append(f"{mode} FAILED: HTTP {final_st} resp={final_rp}")

            await asyncio.sleep(0.5)

        self._record("basic_check_in_out", passed, " | ".join(detail_parts))

    # ── Scenario 2: Debounce / Idempotent event_id ─────────────────────────
    async def scenario_debounce(self):
        """
        Test: gui cung 1 event_id nhieu lan lien tiep (gia lap Pi retry khi mang yeu).
        Ky vong: Backend chi ghi DB 1 lan (idempotent qua event_id).
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 2: Debounce / Idempotent event_id (5 lan retry cung event){RESET}")

        if not self._known_employee_id:
            self._record(
                "debounce",
                False,
                "Bo qua — can SIMULATOR_EMPLOYEE_ID.",
                "Dat SIMULATOR_EMPLOYEE_ID trong .env.",
            )
            return

        # 1. Gui phien quet day du lan dau
        event_id = uuid.uuid4().hex
        results = await self.client.send_full_scan_session(
            device_id=self.device_id,
            mode="CHECK_IN",
            embedding=self._known_vec,
            antispoof_score=0.88,
            event_id=event_id,
            expected_employee_id=self._known_employee_id,
            stable_count=self.stable_count,
            verbose=False,
        )
        first_st, first_rp = results[-1]
        print(f"  Lan dau CONFIRMED_SCAN: HTTP {first_st} | msg={first_rp.get('message','?')[:60]}")

        # 2. Gui lai cung event_id 5 lan (simulate network retry / Pi gui bung)
        dupe_statuses = []
        for attempt in range(5):
            st, rp = await self.client.send(
                device_id=self.device_id,
                mode="CHECK_IN",
                event_id=event_id,                         # CUNG event_id!
                recognition_id=uuid.uuid4().hex,           # recognition_id moi
                embedding=self._known_vec,
                antispoof_score=0.88,
                event_kind="CONFIRMED_SCAN",
                expected_employee_id=self._known_employee_id,
            )
            dupe_statuses.append(st)
            print(f"  Retry {attempt+1}: HTTP {st} | {rp.get('message','?')[:60]}")
            await asyncio.sleep(0.05)

        # Ky vong: tat ca retry khong crash (2xx hoac 409)
        all_deduped = all(s in (200, 201, 409) for s in dupe_statuses)
        self._record(
            "debounce",
            all_deduped,
            f"Lan dau HTTP {first_st} | 5 retries: {dupe_statuses}",
            "" if all_deduped else "Mot so retry tra HTTP loi bat ngo (khong phai 2xx/409)",
        )

    # ── Scenario 3: Unknown Face (vector nguoi la) ──────────────────────────
    async def scenario_unknown_face(self):
        """
        Gui vector ngau nhien (similarity < 0.45 -> UNKNOWN).
        Ky vong: matched=false, success=false, Socket.IO 'attendance-unknown'.
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 3: Unknown Face (random vector — ky vong UNKNOWN){RESET}")

        st, rp = await self.client.send(
            device_id=self.device_id,
            mode="CHECK_IN",
            event_id=uuid.uuid4().hex,
            recognition_id=uuid.uuid4().hex,
            embedding=self._unknown_vec,
            antispoof_score=0.91,
            event_kind="VERIFY_ONLY",
        )
        _print_response(st, rp)

        passed = st == 200 and rp.get("matched") is False and rp.get("success") is False
        self._record(
            "unknown_face",
            passed,
            f"HTTP {st} | matched={rp.get('matched')} | similarity={rp.get('similarity','?')}",
            "" if passed else "Ky vong matched=false, success=false, HTTP 200",
        )

    # ── Scenario 4: Spoof / Anti-spoofing Rejected ─────────────────────────
    async def scenario_spoof(self):
        """
        Gui antispoof_score thap (< 0.5).
        Ky vong: success=false, message chua 'spoof', Socket.IO 'attendance-spoof-blocked'.
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 4: Anti-Spoofing Rejected (antispoof_score=0.3){RESET}")

        st, rp = await self.client.send(
            device_id=self.device_id,
            mode="CHECK_IN",
            event_id=uuid.uuid4().hex,
            recognition_id=uuid.uuid4().hex,
            embedding=self._known_vec,
            antispoof_score=0.3,    # < 0.5 → bi tu choi
            event_kind="VERIFY_ONLY",
        )
        _print_response(st, rp)

        passed = (
            st == 200
            and rp.get("success") is False
            and "spoof" in rp.get("message", "").lower()
        )
        self._record(
            "spoof_blocked",
            passed,
            f"HTTP {st} | success={rp.get('success')} | msg={rp.get('message','?')[:80]}",
            "" if passed else "Ky vong success=false va message chua 'spoof'",
        )

    # ── Scenario 5: Wrong API Secret → 401 ─────────────────────────────────
    async def scenario_wrong_secret(self):
        """
        Gui sai header X-TB-Webhook-Secret.
        Ky vong: HTTP 401 Unauthorized.
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 5: Sai Webhook Secret -> 401 Unauthorized{RESET}")

        st, rp = await self.client.send(
            device_id=self.device_id,
            mode="CHECK_IN",
            event_id=uuid.uuid4().hex,
            recognition_id=uuid.uuid4().hex,
            embedding=self._known_vec,
            antispoof_score=0.85,
            event_kind="VERIFY_ONLY",
            override_secret="this-is-deliberately-wrong-secret-xxxx",
        )
        _print_response(st, rp)

        passed = st == 401
        self._record(
            "wrong_secret_401",
            passed,
            f"HTTP {st} (ky vong 401)",
            "" if passed else f"Ky vong 401, nhan duoc {st}. Kiem tra TB_WEBHOOK_SECRET trong .env.",
        )

    # ── Scenario 6: Offline Queue & Timestamp bu ────────────────────────────
    async def scenario_offline_queue(self):
        """
        Gia lap: Pi xep hang su kien vao queue khi BE khong the lien lac,
        sau do drain (gui bu) khi BE len lai voi timestamp qua khu goc.

        Test nay khong tat BE that ma chi kiem tra:
          1. Queue luu dung 3 su kien
          2. Drain gui thanh cong ca 3 (Backend xu ly dung timestamp qua khu)
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 6: Offline Queue & Gui bu Timestamp qua khu (5 phut truoc){RESET}")

        queue = OfflineQueue(maxsize=50)
        past_ts = int((time.time() - 300) * 1000)  # 5 phut truoc

        for i in range(3):
            evt_body = {
                "device_id":        self.device_id,
                "mode":             "CHECK_IN",
                "event_id":         uuid.uuid4().hex,
                "client_timestamp": past_ts + i * 60_000,  # cach nhau 1 phut
                "antispoof_score":  0.87,
                "event_kind":       "VERIFY_ONLY",
                "recognition_id":   uuid.uuid4().hex,
                "embedding_b64":    vector_to_b64(self._unknown_vec),
            }
            queue.push(evt_body, self.device_id)
            print(f"  Xep hang su kien {i+1} (ts={past_ts + i*60_000}, cach {5 - i} phut)")

        print(c_info(f"Queue size: {len(queue)}. Bat dau drain..."))
        sent = await queue.drain(self.client)

        passed = sent == 3 and len(queue) == 0
        self._record(
            "offline_queue_drain",
            passed,
            f"Xep hang 3, gui bu duoc {sent}/3, con lai {len(queue)}",
            "" if passed else "Mot so su kien trong queue khong gui duoc — kiem tra Backend logs.",
        )

    # ── Scenario 7: Multi-Device Load Test ─────────────────────────────────
    async def scenario_multi_device(self, num_devices: int = 5):
        """
        Chay N thiet bi song song, moi thiet bi gui 1 phien VERIFY_ONLY.
        Ky vong: tat ca nhan HTTP 200 (UNKNOWN la chap nhan duoc, khong phai crash).
        Do do tre trung binh.
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 7: Multi-Device ({num_devices} thiet bi song song){RESET}")

        async def one_device(dev_idx: int) -> tuple[str, bool, float]:
            dev_id = f"PI4_SIM_{dev_idx:03d}"
            t0 = time.perf_counter()
            st, _rp = await self.client.send(
                device_id=dev_id,
                mode="CHECK_IN",
                event_id=uuid.uuid4().hex,
                recognition_id=uuid.uuid4().hex,
                embedding=make_unit_vector_from_seed(f"device-{dev_idx}-employee"),
                antispoof_score=0.85,
                event_kind="VERIFY_ONLY",
            )
            latency = time.perf_counter() - t0
            ok_flag = st in (200, 201, 409)
            return dev_id, ok_flag, latency

        tasks = [one_device(i) for i in range(num_devices)]
        raw = await asyncio.gather(*tasks, return_exceptions=True)

        successes, latencies = [], []
        for r in raw:
            if isinstance(r, Exception):
                print(f"  {c_fail(f'Exception: {r}')}")
                successes.append(False)
            else:
                dev_id, ok_flag, lat = r
                lbl = c_ok(f"{dev_id}: OK {lat*1000:.0f}ms") if ok_flag else c_fail(f"{dev_id}: FAILED")
                print(f"  {lbl}")
                successes.append(ok_flag)
                latencies.append(lat)

        avg_lat = (sum(latencies) / len(latencies) * 1000) if latencies else 0
        max_lat = max(latencies, default=0) * 1000
        all_ok = all(successes)
        self._record(
            f"multi_device_{num_devices}",
            all_ok,
            f"{sum(successes)}/{num_devices} thanh cong | avg {avg_lat:.0f}ms | max {max_lat:.0f}ms",
        )

    # ── Scenario 8: Bad Payload Rejection ──────────────────────────────────
    async def scenario_bad_payload(self):
        """
        Test payload sai dinh dang. Ky vong: HTTP 4xx, khong phai 500 crash.
        """
        print(f"\n{CYAN}{'─'*60}{RESET}")
        print(f"{BOLD}Scenario 8: Bad Payload (phai bi reject 4xx, khong crash 500){RESET}")

        good_b64 = vector_to_b64(self._known_vec)
        good_event = uuid.uuid4().hex

        cases: list[tuple[str, dict]] = [
            ("Thieu event_id", {
                "device_id": self.device_id, "mode": "CHECK_IN",
                "client_timestamp": int(time.time() * 1000),
                "antispoof_score": 0.9, "event_kind": "VERIFY_ONLY",
                "recognition_id": uuid.uuid4().hex, "embedding_b64": good_b64,
            }),
            ("mode khong hop le", {
                "device_id": self.device_id, "mode": "INVALID_MODE",
                "event_id": good_event, "client_timestamp": int(time.time() * 1000),
                "antispoof_score": 0.9, "event_kind": "VERIFY_ONLY",
                "recognition_id": uuid.uuid4().hex, "embedding_b64": good_b64,
            }),
            ("antispoof_score None", {
                "device_id": self.device_id, "mode": "CHECK_IN",
                "event_id": uuid.uuid4().hex,
                "client_timestamp": int(time.time() * 1000),
                "antispoof_score": None, "event_kind": "VERIFY_ONLY",
                "recognition_id": uuid.uuid4().hex, "embedding_b64": good_b64,
            }),
            ("Khong co event_kind (legacy one-shot)", {
                "device_id": self.device_id, "mode": "CHECK_IN",
                "event_id": uuid.uuid4().hex,
                "client_timestamp": int(time.time() * 1000),
                "antispoof_score": 0.9,
                "recognition_id": uuid.uuid4().hex, "embedding_b64": good_b64,
            }),
        ]

        all_passed = True
        for label, body in cases:
            status_code, _ = await self.client.send_raw(
                self.client._headers(self.device_id),
                body,
            )
            is_4xx = 400 <= status_code < 500
            if status_code < 0:
                print(f"  {c_fail(f'{label}: Loi ket noi mang (backend chua bat?)')}")
                all_passed = False
            elif is_4xx:
                print(f"  {c_ok(f'{label}: HTTP {status_code}')}")
            else:
                print(f"  {c_fail(f'{label}: HTTP {status_code} (ky vong 4xx)')}")
                all_passed = False


        self._record(
            "bad_payload_rejection",
            all_passed,
            f"Kiem tra {len(cases)} loai payload sai dinh dang",
        )

    # ── Summary ──────────────────────────────────────────────────────────────
    def print_summary(self) -> tuple[int, int]:
        print(f"\n\n{'='*60}")
        print(f"{BOLD}{'TONG KET KET QUA TEST':^60}{RESET}")
        print(f"{'='*60}")
        passed_count = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        for r in self.results:
            icon = c_ok("PASS") if r.passed else c_fail("FAIL")
            print(f"  {icon}  {r.name}")
            if r.detail:
                print(f"       {DIM}{r.detail}{RESET}")
            if r.error:
                print(f"       {RED}{r.error[:120]}{RESET}")
        print(f"{'─'*60}")
        color = GREEN if passed_count == total else (YELLOW if passed_count > 0 else RED)
        print(f"{color}{BOLD}  {passed_count}/{total} scenarios passed{RESET}")
        if passed_count < total:
            skipped = sum(1 for r in self.results if not r.passed and "Bo qua" in r.detail)
            failed = (total - passed_count) - skipped
            if skipped:
                print(c_warn(f"  {skipped} scenario bi bo qua (thieu SIMULATOR_EMPLOYEE_ID)."))
            if failed:
                print(c_warn(f"  {failed} scenario that bai. Kiem tra Backend logs va cau hinh .env."))
        print(f"{'='*60}\n")
        return passed_count, total


# ─── CLI ──────────────────────────────────────────────────────────────────────
ALL_SCENARIOS = [
    "basic",
    "debounce",
    "unknown_face",
    "spoof",
    "wrong_secret",
    "offline_queue",
    "multi_device",
    "bad_payload",
]


async def main():
    parser = argparse.ArgumentParser(
        description="SmartFace Pi Device Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Vi du:
  python scripts/pi_simulator.py
  python scripts/pi_simulator.py --scenarios basic spoof wrong_secret
  python scripts/pi_simulator.py --scenarios multi_device --devices 10
  python scripts/pi_simulator.py --base-url http://192.168.1.10:3000

Bien moi truong (.env hoac export):
  SIMULATOR_BASE_URL       URL Backend      (default: http://localhost:3000)
  TB_WEBHOOK_SECRET        Shared secret    (>= 24 chars, bat buoc)
  SIMULATOR_DEVICE_ID      Ten thiet bi gia (default: PI4_FRONT_GATE)
  SIMULATOR_EMPLOYEE_ID    UUID nhan vien co face_embedding active trong DB
  SIMULATOR_EMBEDDING_FILE Path file JSON chua vector 512D cua nhan vien do
  ATTENDANCE_STABLE_COUNT  So lan xac nhan can thiet (default: 3)
  SIMULATOR_TIMEOUT_SEC    HTTP timeout (default: 10)
        """,
    )
    parser.add_argument("--base-url", help="Override SIMULATOR_BASE_URL")
    parser.add_argument("--secret",   help="Override TB_WEBHOOK_SECRET")
    parser.add_argument("--device",   help="Override SIMULATOR_DEVICE_ID")
    parser.add_argument("--employee", help="Override SIMULATOR_EMPLOYEE_ID")
    parser.add_argument(
        "--devices", type=int, default=5,
        help="So thiet bi cho multi_device scenario (default: 5)",
    )
    parser.add_argument(
        "--scenarios", nargs="+", choices=ALL_SCENARIOS, default=None,
        help=f"Chi chay cac scenario duoc chon. Mac dinh: tat ca. Lua chon: {', '.join(ALL_SCENARIOS)}",
    )
    args = parser.parse_args()

    cfg = load_config()
    if args.base_url: cfg["base_url"]           = args.base_url
    if args.secret:   cfg["webhook_secret"]     = args.secret
    if args.device:   cfg["device_id"]          = args.device
    if args.employee: cfg["known_employee_id"]  = args.employee

    if not cfg["webhook_secret"]:
        print(c_warn("TB_WEBHOOK_SECRET chua duoc cau hinh — test xac thuc se that bai."))
        print(c_warn("Dat TB_WEBHOOK_SECRET trong .env hoac dung tham so --secret <SECRET>.\n"))


    scenarios_to_run = args.scenarios or ALL_SCENARIOS

    runner = ScenarioRunner(cfg)

    active_emp_label = runner._known_employee_id or "(khong cau hinh — basic/debounce se bi bo qua)"
    default_meta_file = Path(__file__).resolve().parent / "known_face_embedding.json"
    if default_meta_file.exists():
        try:
            with open(default_meta_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                if d.get("full_name") and d.get("employee_code"):
                    active_emp_label = f"{d['full_name']} ({d['employee_code']}) - {runner._known_employee_id}"
        except Exception:
            pass

    print(f"\n{BOLD}{'SmartFace Pi Device Simulator':^60}{RESET}")
    print(f"{DIM}{'─'*60}{RESET}")
    print(f"  Backend URL    : {cfg['base_url']}")
    print(f"  Webhook URL    : {cfg['base_url'].rstrip('/')}/api/attendance/tb-webhook")
    print(f"  Device ID      : {cfg['device_id']}")
    print(f"  Stable count   : {cfg['stable_count']} (ATTENDANCE_STABLE_COUNT)")
    print(f"  Employee       : {active_emp_label}")
    print(f"  Scenarios      : {', '.join(scenarios_to_run)}")
    print(f"{DIM}{'─'*60}{RESET}\n")


    scenario_map = {
        "basic":         runner.scenario_basic,
        "debounce":      runner.scenario_debounce,
        "unknown_face":  runner.scenario_unknown_face,
        "spoof":         runner.scenario_spoof,
        "wrong_secret":  runner.scenario_wrong_secret,
        "offline_queue": runner.scenario_offline_queue,
        "multi_device":  lambda: runner.scenario_multi_device(args.devices),
        "bad_payload":   runner.scenario_bad_payload,
    }

    for name in scenarios_to_run:
        try:
            await scenario_map[name]()
        except Exception:
            tb = traceback.format_exc()
            runner.results.append(TestResult(name=name, passed=False, error=tb))
            print(c_fail(f"Scenario '{name}' bi loi exception:"))
            print(f"{RED}{tb}{RESET}")

    passed, total = runner.print_summary()
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    asyncio.run(main())
