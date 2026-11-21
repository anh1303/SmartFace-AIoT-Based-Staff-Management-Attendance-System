"""Regression tests for Face Auth liveness/readiness, PAD startup states, and VectorDB timeouts."""
import asyncio
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np

from database.vector_db import VectorDB


class AsgiClient:
    def __init__(self, app):
        self.app = app

    def get(self, path, headers=None):
        messages = []

        async def run():
            async def receive():
                return {"type": "http.disconnect"}

            async def send(message):
                messages.append(message)

            raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
            await self.app(
                {
                    "type": "http",
                    "asgi": {"version": "3.0"},
                    "http_version": "1.1",
                    "method": "GET",
                    "scheme": "http",
                    "path": path,
                    "raw_path": path.encode(),
                    "query_string": b"",
                    "headers": raw_headers,
                    "server": ("test", 80),
                    "client": ("127.0.0.1", 1),
                    "root_path": "",
                },
                receive,
                send,
            )

        asyncio.run(run())
        body = b"".join(item.get("body", b"") for item in messages)
        return SimpleNamespace(
            status_code=messages[0]["status"],
            text=body.decode("utf-8", errors="replace"),
            json=lambda: json.loads(body),
        )


class VectorDbTimeoutTests(unittest.TestCase):
    @patch("database.vector_db.ConnectionPool")
    def test_statement_timeout_applied_to_schema_health_search_upsert_and_receipt(self, mock_pool_cls):
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.connection.return_value.__enter__.return_value = mock_conn
        mock_conn.transaction.return_value.__enter__.return_value = None

        schema_rows = [
            ("employees", "id", "uuid"),
            ("employees", "employee_code", "character varying(50)"),
            ("employees", "full_name", "character varying(100)"),
            ("employees", "status", "character varying(20)"),
            ("face_embeddings", "employee_id", "uuid"),
            ("face_embeddings", "embedding", "vector(512)"),
            ("face_embeddings", "model_version", "character varying(50)"),
            ("face_embeddings", "is_active", "boolean"),
            ("face_embeddings", "embedding_type", "character varying(20)"),
        ]

        def execute_side_effect(sql, params=None):
            if "FROM pg_class" in sql:
                return SimpleNamespace(fetchall=lambda: schema_rows)
            if "FROM face_enrollment_receipts" in sql:
                return SimpleNamespace(fetchone=lambda: ({"status": "ok"},))
            if "SELECT id FROM employees" in sql:
                return SimpleNamespace(fetchone=lambda: ("uuid-1",))
            if "FROM background_operations" in sql or "SELECT 1 FROM face_embeddings" in sql:
                return SimpleNamespace(fetchone=lambda: None)
            if "face_embeddings f" in sql:
                return SimpleNamespace(fetchall=lambda: [])
            return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])

        mock_conn.execute.side_effect = execute_side_effect
        mock_pool_cls.return_value = mock_pool

        db = VectorDB("postgresql://u:p@host/db", pool_timeout=5.0, query_timeout_ms=5000)

        def count_timeout_calls():
            return sum(
                1
                for call in mock_conn.execute.call_args_list
                if "set_config('statement_timeout'" in call[0][0]
            )

        # 1. validate_schema during __init__
        self.assertGreaterEqual(count_timeout_calls(), 1)
        after_init = count_timeout_calls()

        # 2. check_connection
        db.check_connection()
        self.assertEqual(count_timeout_calls(), after_init + 1)

        # 3. search
        db.search(np.ones(512, dtype=np.float32), model_version="buffalo_s")
        self.assertEqual(count_timeout_calls(), after_init + 2)

        # 4. enrollment_receipt
        self.assertEqual(db.enrollment_receipt("op-1"), {"status": "ok"})
        self.assertEqual(count_timeout_calls(), after_init + 3)

        # 5. upsert
        db.upsert(employee_code="NV001", mean_embedding=np.ones(512, dtype=np.float32), model_version="buffalo_s")
        self.assertEqual(count_timeout_calls(), after_init + 4)

        # ConnectionPool got timeout + TCP keepalive kwargs
        _, kwargs = mock_pool_cls.call_args
        self.assertEqual(kwargs["timeout"], 5.0)
        self.assertEqual(kwargs["kwargs"]["connect_timeout"], 5)
        self.assertEqual(kwargs["kwargs"]["keepalives"], 1)


class ApiServiceLifecycleTests(unittest.TestCase):
    def setUp(self):
        import api_service

        self.api = api_service
        self.client = AsgiClient(api_service.app)
        self._orig_state = (
            api_service.detector,
            api_service.embedder,
            api_service.db,
            api_service.remote_extractor,
            api_service.login_pad,
            getattr(api_service, "pad_state", None),
        )

    def tearDown(self):
        (
            self.api.detector,
            self.api.embedder,
            self.api.db,
            self.api.remote_extractor,
            self.api.login_pad,
            pad_state,
        ) = self._orig_state
        if hasattr(self.api, "pad_state"):
            self.api.pad_state = pad_state

    def _run_startup(self, *, face_login_enabled: bool, pad_loader=None, db_factory=None):
        fake_detector = MagicMock()
        fake_embedder = MagicMock()
        fake_embedder._model = SimpleNamespace(session=MagicMock(), model_file="w600k_mbf.onnx")
        fake_db = MagicMock()
        fake_db.check_connection.return_value = None

        env_patch = {"FACE_LOGIN_ENABLED": "true" if face_login_enabled else "false"}
        with patch.dict(os.environ, env_patch, clear=False), \
             patch.object(self.api, "FaceDetector", return_value=fake_detector), \
             patch.object(self.api, "FaceEmbedder", return_value=fake_embedder), \
             patch.object(self.api, "AlignedFaceExtractor", return_value=MagicMock()), \
             patch.object(self.api, "VectorDB", side_effect=db_factory if db_factory else (lambda **kw: fake_db)) as mock_vdb:
            self.api.login_pad = None
            if pad_loader is not None:
                with patch.object(self.api, "_load_pad_predictor", side_effect=pad_loader):
                    self.api.startup_event()
            else:
                self.api.startup_event()
            return fake_db, mock_vdb

    def test_1_face_login_disabled_live_and_ready_without_pad(self):
        with patch.dict(os.environ, {"FACE_LOGIN_ENABLED": "false"}, clear=False):
            fake_db, mock_vdb = self._run_startup(face_login_enabled=False)
            # Verify VectorDB receives configured timeouts
            _, vdb_kwargs = mock_vdb.call_args
            self.assertIsNotNone(vdb_kwargs.get("pool_timeout"))
            self.assertIsNotNone(vdb_kwargs.get("query_timeout_ms"))

            live = self.client.get("/health/live")
            self.assertEqual(live.status_code, 200)
            fake_db.check_connection.assert_not_called()

            ready = self.client.get("/health/ready")
            self.assertEqual(ready.status_code, 200)
            self.assertEqual(ready.json()["pad_state"], "disabled")
            fake_db.check_connection.assert_called_once()

    def test_2_face_login_enabled_pad_ok_ready_does_not_reload_pad(self):
        load_calls = []

        def fake_loader():
            load_calls.append(1)
            return MagicMock()

        with patch.dict(os.environ, {"FACE_LOGIN_ENABLED": "true"}, clear=False):
            fake_db, _ = self._run_startup(face_login_enabled=True, pad_loader=fake_loader)
            r1 = self.client.get("/health/ready")
            r2 = self.client.get("/health/ready")
            self.assertEqual(r1.status_code, 200)
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r1.json()["pad_state"], "ready")
            # PAD was loaded only once at startup, never reloaded on /health/ready
            self.assertEqual(len(load_calls), 1)

            # DB fails after startup -> live still 200 (no DB check), ready 503 (no DSN leaked), then recovers
            fake_db.check_connection.reset_mock()
            fake_db.check_connection.side_effect = RuntimeError("postgresql://secret_user:secret_pass@neon/db down")
            live_down = self.client.get("/health/live")
            self.assertEqual(live_down.status_code, 200)
            fake_db.check_connection.assert_not_called()

            ready_down = self.client.get("/health/ready")
            self.assertEqual(ready_down.status_code, 503)
            self.assertNotIn("secret_pass", ready_down.text)
            self.assertNotIn("postgresql://", ready_down.text)

            fake_db.check_connection.side_effect = None
            ready_up = self.client.get("/health/ready")
            self.assertEqual(ready_up.status_code, 200)
            self.assertEqual(len(load_calls), 1)

    def test_3_face_login_enabled_pad_missing_fails_ready_with_503_without_leaking_paths(self):
        def broken_loader():
            raise FileNotFoundError("/app/login-models/secret_pad.onnx not found")

        with patch.dict(os.environ, {"FACE_LOGIN_ENABLED": "true"}, clear=False):
            self._run_startup(face_login_enabled=True, pad_loader=broken_loader)
            live = self.client.get("/health/live")
            self.assertEqual(live.status_code, 200)
            self.assertEqual(live.json()["pad_state"], "failed")

            ready = self.client.get("/health/ready")
            self.assertEqual(ready.status_code, 503)
            self.assertNotIn("/app/login-models", ready.text)
            self.assertNotIn("secret_pad.onnx", ready.text)

    def test_4_db_failure_during_startup_fails_fast(self):
        def failing_db(**_kw):
            raise RuntimeError("Neon unreachable at startup")

        with self.assertRaisesRegex(RuntimeError, "Neon unreachable"):
            self._run_startup(face_login_enabled=False, db_factory=failing_db)


if __name__ == "__main__":
    unittest.main()
