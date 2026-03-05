#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SPREADSHEET_ID="1Q-zzdZcdZuZH6hdyDQHTl6E7LQxXhfbnUkgMCxC8zW0"

ansible-playbook \
  -i ansible/inventory/hosts.ini \
  ansible/deploy.yml \
  -e "GOOGLE_SPREADSHEET_ID=${SPREADSHEET_ID}" \
  "$@"
