#!/usr/bin/env bash
# Backend test suite (CV, ML, API).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"
[ -x ./venv/bin/python ] || { python3 -m venv venv && ./venv/bin/pip install -q -r requirements.txt; }
exec ./venv/bin/python -m pytest -q "$@"
