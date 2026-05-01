@echo off
echo Starting Cloth Survey UI on port 3018...
cd /d "%~dp0UI"
call npx vite --port 3018
pause
