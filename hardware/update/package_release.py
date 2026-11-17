"""Build only the runtime files used by the Pi application."""
import hashlib
import json
import pathlib
import sys
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULES = ("alignment", "antispoof", "detection", "display", "iot", "peripherals", "recognition", "streaming", "tracking")
FILES = ("edge_client.py", "config.py", "event_media.py", "vision_pipeline.py", "attendance_coordinator.py",
         "attendance_feedback.py", "pad_capture.py", "check_runtime.py", "requirements.txt")


def package(version, commit, directory):
    path = directory / "smartface-pi.tar.gz"
    paths = [ROOT / file for file in FILES]
    for module in MODULES:
        paths.extend(p for p in (ROOT / module).rglob("*.py") if "__pycache__" not in p.parts)
    models = ROOT / "models"
    paths.extend(p for p in models.iterdir() if p.suffix in (".onnx", ".json"))
    with tarfile.open(path, "w:gz") as archive:
        for file in sorted(paths):
            if not file.is_file() or file.is_symlink():
                raise ValueError(f"Missing or invalid runtime file: {file}")
            archive.add(file, arcname=file.relative_to(ROOT).as_posix(), recursive=False)
    data = path.read_bytes()
    (directory / "manifest.json").write_text(json.dumps({
        "version": version, "commit": commit, "target": "linux-arm64", "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    package(sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3]))
