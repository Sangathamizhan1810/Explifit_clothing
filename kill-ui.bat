@echo off
echo Killing process on port 3018...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3018 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Port 3018 is now free.
pause
