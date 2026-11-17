@echo off
REM ============================================
REM  Mega Plantilla Flask - INSTALADOR DE UN CLIC
REM  Crea .venv e instala TODAS las dependencias.
REM  Portable: solo necesitas Python 3.10+ instalado.
REM ============================================
cd /d %~dp0
title Mega Plantilla Flask - Instalador

echo.
echo === 1/3  Verificando Python ===
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no encontrado. Instalalo desde python.org marcando "Add to PATH".
    pause
    exit /b 1
)
python --version

echo.
echo === 2/3  Creando entorno virtual (.venv) ===
if exist .venv (
    echo .venv ya existe, se omite.
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR creando .venv
        pause
        exit /b 1
    )
)

echo.
echo === 3/3  Instalando TODAS las dependencias ===
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR instalando dependencias.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  INSTALACION COMPLETA. Levantando servidor...
echo  En http://localhost:51793 (puerto improbable)
echo ============================================
echo Cierra esta ventana para detener el servidor.
start "" http://localhost:51793
python app.py
pause
