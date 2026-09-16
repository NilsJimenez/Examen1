@echo off
title FashionStore - Backend FastAPI (Puerto 8000)
echo ===================================================
echo INICIANDO SERVIDOR BACKEND FASTAPI...
echo Base de datos: Supabase (PostgreSQL en la Nube)
echo ===================================================
cd backend
call .\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
pause
