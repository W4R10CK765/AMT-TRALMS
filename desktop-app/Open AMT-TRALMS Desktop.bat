@echo off
setlocal
cd /d "%~dp0"
if exist "%LocalAppData%\Python\bin\pythonw.exe" (
  start "AMT-TRALMS Desktop" "%LocalAppData%\Python\bin\pythonw.exe" "%~dp0app.py"
  exit /b
)
echo Python was not found at the expected location. Install Python 3 with Tkinter, then run this file again.
pause
