@echo off
cd /d "%~dp0"

set "APP_EXE=%~dp0release\win-unpacked\Hours to Qualify.exe"

if not exist "%APP_EXE%" goto missing

start "" "%APP_EXE%"
exit /b 0

:missing
echo Packaged app not found.
echo Expected:
echo %APP_EXE%
echo.
echo Run build-installer.bat first to create the desktop app build.
pause
exit /b 1
