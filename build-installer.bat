@echo off
cd /d "%~dp0"
echo Installing packages...
call npm install
if errorlevel 1 goto fail

echo Building one-click Windows installer...
call npm run dist
if errorlevel 1 goto fail

echo.
echo Done.
echo Installer should be in the release folder.
pause
exit /b 0

:fail
echo.
echo Build failed.
pause
exit /b 1
