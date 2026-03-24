@echo off
cd /d "%~dp0"
call npm install
if errorlevel 1 goto fail
call npm run dev
exit /b 0

:fail
echo Startup failed.
pause
exit /b 1
