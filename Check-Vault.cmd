@echo off
setlocal
cd /d "%~dp0"
set "PYTHON=python"
where py.exe >nul 2>nul && set "PYTHON=py -3"
%PYTHON% tools\vault_doctor.py
if errorlevel 1 goto :fail
%PYTHON% tools\sync_index_status.py --check
if errorlevel 1 goto :fail
echo Vault check passed.
exit /b 0
:fail
echo Vault check failed. Read the result above.
pause
exit /b 1
