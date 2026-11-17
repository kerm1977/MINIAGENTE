@echo off
REM ============================================
REM  Mini Agente Code - instalacion y arranque
REM  Doble clic o ejecutar: start.bat
REM ============================================
cd /d %~dp0
title Mini Agente Code

if not defined PORT set PORT=7861
if not defined OLLAMA_MODELS set OLLAMA_MODELS=%~dp0modelos

REM Entorno: preferir .venv312 si existe
set VENV=.venv
if exist .venv312 set VENV=.venv312

echo.
echo === 1/5  Verificando Ollama ===
curl -s -o NUL http://localhost:11434/api/version 2>NUL
if errorlevel 1 (
    echo Ollama apagado; arrancandolo...
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        start "" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        where ollama >NUL 2>NUL && start "" /min ollama serve
    )
) else (
    echo Ollama ya esta corriendo.
)

echo.
echo === 2/5  Creando entorno virtual (%VENV%) ===
if not exist %VENV% (
    python -m venv %VENV%
    if errorlevel 1 (
        echo ERROR: Python no encontrado. Instala Python 3.10+ desde python.org
        pause
        exit /b 1
    )
) else (
    echo %VENV% ya existe, se omite.
)

echo.
echo === 3/5  Activando entorno y actualizando pip ===
call %VENV%\Scripts\activate.bat
python -m pip install --upgrade pip

echo.
echo === 4/5  Instalando todas las librerias ===
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR instalando dependencias.
    pause
    exit /b 1
)

echo.
echo === 5/5  Iniciando el servidor ===
echo Abriendo http://localhost:%PORT% en tu navegador...
echo Cierra esta ventana para detener el servidor.
start "" http://localhost:%PORT%
python app.py
pause
