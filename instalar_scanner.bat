@echo off
setlocal
set DIR=%~dp0

echo [1/3] Instalando dependencias Python...
pip install pywin32 flask flask-cors > nul 2>&1

echo [2/3] Registrando protocolo itpscan://...
REG ADD "HKCU\Software\Classes\itpscan" /ve /d "URL:ITP Scanner Protocol" /f > nul
REG ADD "HKCU\Software\Classes\itpscan" /v "URL Protocol" /d "" /f > nul
REG ADD "HKCU\Software\Classes\itpscan\shell\open\command" /ve /d "cmd /c \"%DIR%start_scanner.bat\"" /f > nul

echo [3/3] Adicionando ao inicio do Windows...
REG ADD "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ITPScannerAgent" /d "wscript.exe \"%DIR%start_scanner_silent.vbs\"" /f > nul

echo.
echo Pronto! Scanner Agent configurado.
echo - Iniciara automaticamente com o Windows
echo - O botao Scan no sistema o inicia se nao estiver rodando
echo.
echo Iniciando agora...
call "%DIR%start_scanner.bat"
timeout /t 2 > nul
echo Agente rodando em http://localhost:7734
pause
