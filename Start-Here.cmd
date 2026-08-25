@echo off
setlocal
cd /d "%~dp0"
where py.exe >nul 2>nul
if not errorlevel 1 (
  py -3 tools\initialize_vault.py
) else (
  python tools\initialize_vault.py
)
if errorlevel 1 (
  pause
  exit /b 1
)
call open-preview.cmd
