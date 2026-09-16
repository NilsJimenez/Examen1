@echo off
title FashionStore - Terminal con Entorno Virtual Activado
echo =========================================================
echo ACTIVANDO ENTORNO VIRTUAL PYTHON (FastAPI)...
echo =========================================================
cd /d "%~dp0backend"
call .\venv\Scripts\activate.bat
echo Entorno virtual activado correctamente!
echo Ahora puedes ejecutar: uvicorn app.main:app --reload --port 8000
echo =========================================================
cmd /k
