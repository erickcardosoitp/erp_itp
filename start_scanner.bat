@echo off
netstat -ano | findstr ":7734 " > nul 2>&1
if %errorlevel% == 0 exit /b 0
cd /d "%~dp0"
start "" /min pythonw scanner_agent.py
