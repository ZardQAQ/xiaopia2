@echo off
title 3D Receipt - Local Server
cd /d "%~dp0"

echo.
echo ============================================
echo   3D Receipt - Local Server
echo ============================================
echo.
echo   Open in browser: http://localhost:8000/
echo   Press Ctrl+C to stop
echo.

python -m http.server 8000

pause
