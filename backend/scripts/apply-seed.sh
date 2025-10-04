#!/usr/bin/env bash
set -euo pipefail
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seed.sql