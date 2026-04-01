@echo off
echo Stopping any existing server on port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING" 2^>nul') do taskkill /f /pid %%a 2>nul
timeout /t 2 /nobreak >nul
cd /d d:\PromptLibrary
echo Starting dev server...
start "Prompt Library Dev" cmd /k "set NODE_OPTIONS=--max-old-space-size=2048 && npm run dev"
