@echo off
echo Starting Cloth Survey API on port 5018...
cd /d "%~dp0API"
set PORT=5018
call npm run dev
pause
