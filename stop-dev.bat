@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do (
  echo Killing PID %%a on port 3001
  taskkill /f /pid %%a
)
echo Done.
pause
