@echo off
cd /d "%~dp0"
echo AQUA TRIAX -- local server on http://127.0.0.1:8000
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py -m http.server 8000 --bind 127.0.0.1
) else (
  python -m http.server 8000 --bind 127.0.0.1
)
pause
