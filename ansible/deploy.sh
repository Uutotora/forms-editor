#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SPREADSHEET_ID="13VyG08Ehnayw1066USuEvpPe31HBBosXHlcnGbllR6o"

ansible-playbook \
  -i ansible/inventory/hosts.ini \
  ansible/deploy.yml \
  -e "GOOGLE_SPREADSHEET_ID=${SPREADSHEET_ID}" \
  "$@"
