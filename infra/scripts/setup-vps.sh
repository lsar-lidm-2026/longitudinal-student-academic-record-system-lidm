#!/bin/bash
# ── VPS Setup Script for LSAR Deployment ─────────────────────────────
# Jalankan satu kali di VPS untuk menyiapkan environment.
# Usage: bash setup-vps.sh
set -euo pipefail

echo "🚀 LSAR VPS Setup"
echo "=================="

# ── Prerequisites Check ──────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "❌ Docker tidak ditemukan. Install dulu:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "❌ Docker Compose plugin tidak ditemukan. Install dulu."
  exit 1
fi

echo "✅ Docker: $(docker --version)"
echo "✅ Docker Compose: $(docker compose version --short)"

# ── Setup Directories ────────────────────────────────────────────────
APP_DIR="${1:-/root/lidm}"
echo ""
echo "📁 Target directory: $APP_DIR"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ── Docker Network ───────────────────────────────────────────────────
echo ""
echo "🌐 Setting up Docker network..."
docker network inspect app-shared-net >/dev/null 2>&1 && \
  echo "  ✅ app-shared-net already exists" || \
  { docker network create app-shared-net && echo "  ✅ app-shared-net created"; }

# ── Login GHCR ───────────────────────────────────────────────────────
echo ""
echo "🔑 Login to GitHub Container Registry..."
echo "   Masukkan GitHub Token (classic, with write:packages scope):"
read -rs GHCR_TOKEN
echo ""
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$(whoami)" --password-stdin && \
  echo "  ✅ Logged in to ghcr.io" || \
  echo "  ⚠️  Login failed. Jalankan 'docker login ghcr.io' manual nanti."

# ── Setup .env ───────────────────────────────────────────────────────
echo ""
echo "🔧 Setting up .env..."
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
# Database
DATABASE_URL=postgres://user:password@host:5432/lidm

# JWT
JWT_SECRET=change-this-to-random-secret
JWT_EXPIRES_IN=7d

# LLM (optional)
AI_LLM_API_KEY=
AI_LLM_BASE_URL=
AI_LLM_MODEL=

# S3 (optional)
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_DEFAULT_REGION=us-east-1
S3_BUCKET=lsar

# CORS (frontend origin for production)
CORS_ORIGIN=https://lidm.asepharyana.my.id

# Backend
PORT=3001
ENVEOF
  echo "  ✅ .env created (EDIT with production values!)"
  echo "  ⚠️  WAJIB: nano .env lalu isi DATABASE_URL, JWT_SECRET, dll."
else
  echo "  ✅ .env already exists"
fi

# ── Download compose file ────────────────────────────────────────────
echo ""
echo "📥 Downloading docker-compose.yml..."
if [ ! -f docker-compose.yml ]; then
  echo "  ⚠️  Belum ada docker-compose.yml. Jalankan deploy dari GitHub Actions"
  echo "     atau salin manual dari repo."
else
  echo "  ✅ docker-compose.yml already exists"
fi

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "===================="
echo "✅ VPS Setup Selesai!"
echo "===================="
echo ""
echo "Langkah selanjutnya:"
echo "  1. nano .env              → isi konfigurasi production"
echo "  2. docker compose pull    → tarik image terbaru"
echo "  3. docker compose up -d   → jalankan semua service"
echo ""
echo "Pastikan reverse proxy (Caddy/Nginx) routing:"
echo "  lidm.asepharyana.my.id     → lidm-frontend:3000"
echo "  lidm-api.asepharyana.my.id → lidm-backend:3001"
echo ""
echo "Domain:"
echo "  Frontend: https://lidm.asepharyana.my.id"
echo "  Backend:  https://lidm-api.asepharyana.my.id"
