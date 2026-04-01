@echo off
echo Killing all node.exe processes...
taskkill /f /im node.exe 2>nul
timeout /t 3 /nobreak >nul
cd /d d:\PromptLibrary
echo Starting dev server (this takes ~30s on first run)...
start "Prompt Library Dev" cmd /k "set NODE_OPTIONS=--max-old-space-size=1536 && npm run dev"
echo Done. Check the new window for "Ready" message before using the app.
