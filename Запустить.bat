@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Сначала поставьте Node.js 20: https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)
node deploy\start.mjs
echo.
pause
