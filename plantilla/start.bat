@echo off
REM ============================================
REM  Mega Plantilla Flask - arranque rapido
REM  Si no existe .venv, instala todo primero.
REM ============================================
cd /d %~dp0
title Mega Plantilla Flask

if not exist .venv (
    echo No existe .venv - ejecutando instalador...
    call instalar.bat
    if errorlevel 1 exit /b 1
)

call .venv\Scripts\activate.bat

echo.
echo === Iniciando servidor en http://localhost:51793 ===
echo Cierra esta ventana para detener el servidor.
start "" http://localhost:51793
python app.py
pause
