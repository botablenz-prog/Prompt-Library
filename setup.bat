@echo off
setlocal enabledelayedexpansion
title Prompt Library - Setup

echo.
echo  =========================================
echo   Prompt Library - Setup
echo   by Botable NZ
echo  =========================================
echo.

:: ── Check Node.js ──────────────────────────────────────────────
echo [1/4] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Node.js is not installed.
    echo  Please download and install it from:
    echo  https://nodejs.org/en/download
    echo.
    echo  After installing, re-run this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_RAW=%%i
for /f "tokens=1 delims=v" %%i in ('node -v 2^>nul') do set NODE_VER=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VER:~1%") do set NODE_MAJOR=%%i

if %NODE_MAJOR% LSS 18 (
    echo.
    echo  ERROR: Node.js version 18.17 or higher is required.
    echo  You have: !NODE_VER!
    echo.
    echo  Please upgrade at: https://nodejs.org/en/download
    echo.
    pause
    exit /b 1
)

echo  OK - Node.js !NODE_VER! found.
echo.

:: ── Install dependencies ────────────────────────────────────────
echo [2/4] Installing dependencies (this may take a minute)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: npm install failed. See error above.
    echo.
    pause
    exit /b 1
)
echo  OK - Dependencies installed.
echo.

:: ── Create .env.local ───────────────────────────────────────────
echo [3/4] Setting up environment file...
if exist ".env.local" (
    echo  OK - .env.local already exists, skipping.
) else (
    copy ".env.local.example" ".env.local" >nul
    echo  OK - Created .env.local from template.
)
echo.

:: ── Done ────────────────────────────────────────────────────────
echo [4/4] Setup complete!
echo.
echo  =========================================
echo   NEXT STEPS
echo  =========================================
echo.
echo  1. Open ".env.local" in a text editor
echo     and fill in your Supabase + OpenRouter credentials.
echo.
echo  2. Run the database migrations in Supabase SQL Editor.
echo     (see README.md - "Database setup" section)
echo.
echo  3. Start the app:
echo        npm run dev
echo     Then open http://localhost:3001 in your browser.
echo.
echo  4. Sign in with your email, then run:
echo        npm run set-admin -- YOUR-USER-ID
echo        npm run backfill-owner -- YOUR-USER-ID
echo.
echo  For full instructions, see README.md
echo  =========================================
echo.
pause
