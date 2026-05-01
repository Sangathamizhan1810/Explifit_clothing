@echo off
echo Killing process on port 5018...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5018 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Port 5018 is now free.
pause
