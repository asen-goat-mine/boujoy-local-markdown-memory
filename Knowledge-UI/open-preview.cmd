@echo off
setlocal
set "BUNDLED_PYTHONW=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\pythonw.exe"

if exist "%BUNDLED_PYTHONW%" (
  "%BUNDLED_PYTHONW%" -c "import sys,http.server;raise SystemExit(sys.version_info.major*100+sys.version_info.minor not in range(309,10000))" >nul 2>nul
  if not errorlevel 1 (
    start "" "%BUNDLED_PYTHONW%" "%~dp0web_preview.pyw"
    exit /b 0
  )
)

where pythonw.exe >nul 2>nul
if not errorlevel 1 (
  pythonw.exe -c "import sys,http.server;raise SystemExit(sys.version_info.major*100+sys.version_info.minor not in range(309,10000))" >nul 2>nul
  if not errorlevel 1 (
    start "" pythonw.exe "%~dp0web_preview.pyw"
    exit /b 0
  )
)

where pyw.exe >nul 2>nul
if not errorlevel 1 (
  pyw.exe -3 -c "import sys,http.server;raise SystemExit(sys.version_info.major*100+sys.version_info.minor not in range(309,10000))" >nul 2>nul
  if not errorlevel 1 (
    start "" pyw.exe -3 "%~dp0web_preview.pyw"
    exit /b 0
  )
)

echo Cannot find Python. Opening browser compatibility mode.
call "%~dp0open-app-mode.cmd"
