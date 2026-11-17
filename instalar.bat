@echo off
REM Instalador de un clic para Mini Agente Code.
REM Crea .venv, actualiza pip e instala requirements.txt. Luego usa start.bat.
cd /d "%~dp0"
where python >nul 2>&1 || (echo Python no encontrado. Instalalo desde python.org marcando "Add to PATH". & pause & exit /b 1)
if not exist .venv (
  echo Creando entorno virtual .venv ...
  python -m venv .venv || (echo Error creando .venv & pause & exit /b 1)
)
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt || (echo Error instalando librerias & pause & exit /b 1)
echo.
echo === Instalacion completa. Ejecuta start.bat para arrancar el agente. ===
pause
