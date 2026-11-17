@echo off
REM ============================================
REM  Mini Agente Code - instalacion y arranque
REM  Doble clic o ejecutar: start.bat
REM ============================================
cd /d %~dp0
title Mini Agente Code

echo.
echo === 1/4  Creando entorno virtual (.venv) ===
if not exist .venv (
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Python no encontrado. Instala Python 3.10+ desde python.org
        pause
        exit /b 1
    )
) else (
    echo .venv ya existe, se omite.
)

echo.
echo === 2/4  Activando entorno y actualizando pip ===
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip

echo.
echo === 3/4  Instalando todas las librerias ===
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR instalando dependencias.
    pause
    exit /b 1
)

echo.
echo === 4/4  Iniciando el servidor ===
echo Abriendo http://localhost:7860 en tu navegador...
echo Cierra esta ventana para detener el servidor.
start "" http://localhost:7860
python app.py
pause
