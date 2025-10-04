#!/usr/bin/env bash
set -euo pipefail

# Load environment (auto-export all vars defined in .env)
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Allow DATABASE_URL to be passed as a 1st arg too
DATABASE_URL="${1:-${DATABASE_URL:-}}"

# Nice error if still missing
: "${DATABASE_URL:?DATABASE_URL is not set. Put it in backend/.env or pass it as the first arg.}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
[ -f db/rls.sql ] && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/rls.sql || true
