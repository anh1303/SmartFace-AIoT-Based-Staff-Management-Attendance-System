#!/usr/bin/env bash
# Isolated policy DB only. Never source backend/.env into this shell.
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_CONTAINER="smartface-policy-test-$$"
TASK_DB_URL='postgresql://postgres:policy-test-only@127.0.0.1:55439/policy_check'
cleanup() { docker rm -f "$TASK_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
# No volumes; fixed loopback port matches the test suite's refusal guard.
docker run --pull=never --rm -d --name "$TASK_CONTAINER" \
  -e POSTGRES_PASSWORD=policy-test-only -e POSTGRES_DB=policy_check \
  -p 127.0.0.1:55439:5432 pgvector/pgvector:pg16 >/dev/null
for attempt in {1..30}; do
  if docker exec "$TASK_CONTAINER" pg_isready -U postgres -d policy_check >/dev/null 2>&1; then break; fi
  sleep 0.2
done
# Prisma migrate uses DIRECT_URL. Override BOTH even when backend/.env exists.
export DATABASE_URL="$TASK_DB_URL" DIRECT_URL="$TASK_DB_URL" RUN_POLICY_DB_TESTS=1
cd "$TASK_ROOT/backend"
npm run prisma:generate
npm run prisma:migrate
npm test -- --no-file-parallelism validation/attendance.policy.test.ts validation/attendance.integration.test.ts validation/attendance.safety.integration.test.ts
