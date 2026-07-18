#!/bin/bash
# ── LSAR Deploy Script ──────────────────────────────────────────────
# Called by CI/CD after source is synced to VPS.
# Builds Docker images and restarts containers.
set -euo pipefail

cd "$(dirname "$0")"

echo "🚀 LSAR Deploy"
echo "=============="

# Create shared network if not exists
docker network inspect app-shared-net >/dev/null 2>&1 || docker network create app-shared-net

# Build and deploy
docker compose build --pull
docker compose up -d --remove-orphans

# Cleanup
docker image prune -f --filter "until=24h" 2>/dev/null || true

echo "✅ Deploy complete"
echo "   Frontend: https://lidm.asepharyana.my.id"
echo "   Backend:  https://lidm-api.asepharyana.my.id"
