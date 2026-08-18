@echo off
setlocal
set "PAGE=%~dp0index.html"
set "PAGE_URL=file:///%PAGE:\=/%"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app="%PAGE_URL%"
  exit /b 0
)

if exist "%CHROME%" (
  start "" "%CHROME%" --app="%PAGE_URL%"
  exit /b 0
)

start "" "%PAGE%"
