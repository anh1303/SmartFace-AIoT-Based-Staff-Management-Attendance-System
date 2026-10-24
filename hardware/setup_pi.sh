#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [[ "$(uname -s)" != Linux || "$(uname -m)" != aarch64 ]]; then
  echo 'Cần Raspberry Pi OS 64-bit (aarch64).' >&2
  exit 1
fi
sudo apt-get update
# SCRFD/insightface có thể cần biên dịch extension trên ARM64.
sudo apt-get install -y python3-venv python3-dev build-essential ffmpeg v4l-utils
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip wheel
.venv/bin/python -m pip install -r requirements.txt
if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
fi
echo 'Cài đặt xong. Chạy .venv/bin/python configure.py rồi .venv/bin/python check_connection.py'
