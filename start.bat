@echo off
title SAN Orders Admin
cd /d "%~dp0"

echo.
echo Building frontend into Laravel public folder...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Starting server at http://127.0.0.1:8000
echo Press Ctrl+C to stop.
echo.
php backend\artisan serve --host=127.0.0.1 --port=8000
pause
