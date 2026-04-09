#!/usr/bin/env bash
set -e

echo ""
echo " ========================================="
echo "  Prompt Library - Setup"
echo "  by Botable NZ"
echo " ========================================="
echo ""

# ── Check Node.js ──────────────────────────────────────────────
echo "[1/4] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo ""
  echo " ERROR: Node.js is not installed."
  echo " Please download and install it from:"
  echo " https://nodejs.org/en/download"
  echo ""
  exit 1
fi

NODE_MAJOR=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]))" 2>/dev/null; echo $?)
NODE_VER=$(node -v)
NODE_MAJOR_NUM=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')

if [ "$NODE_MAJOR_NUM" -lt 18 ]; then
  echo ""
  echo " ERROR: Node.js version 18.17 or higher is required."
  echo " You have: $NODE_VER"
  echo ""
  echo " Please upgrade at: https://nodejs.org/en/download"
  echo ""
  exit 1
fi

echo " OK - Node.js $NODE_VER found."
echo ""

# ── Install dependencies ────────────────────────────────────────
echo "[2/4] Installing dependencies (this may take a minute)..."
npm install
echo " OK - Dependencies installed."
echo ""

# ── Create .env.local ───────────────────────────────────────────
echo "[3/4] Setting up environment file..."
if [ -f ".env.local" ]; then
  echo " OK - .env.local already exists, skipping."
else
  cp .env.local.example .env.local
  echo " OK - Created .env.local from template."
fi
echo ""

# ── Done ────────────────────────────────────────────────────────
echo "[4/4] Setup complete!"
echo ""
echo " ========================================="
echo "  NEXT STEPS"
echo " ========================================="
echo ""
echo " 1. Open '.env.local' in a text editor"
echo "    and fill in your Supabase + OpenRouter credentials."
echo ""
echo " 2. Run the database migrations in Supabase SQL Editor."
echo "    (see README.md - 'Database setup' section)"
echo ""
echo " 3. Start the app:"
echo "       npm run dev"
echo "    Then open http://localhost:3001 in your browser."
echo ""
echo " 4. Sign in with your email, then run:"
echo "       npm run set-admin -- YOUR-USER-ID"
echo "       npm run backfill-owner -- YOUR-USER-ID"
echo ""
echo " For full instructions, see README.md"
echo " ========================================="
echo ""
