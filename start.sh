#!/bin/sh
set -e
PORT="${PORT:-8000}"
echo "Iniciando FashionStore API en el puerto $PORT..."
if [ -d "app" ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
elif [ -d "backend/app" ]; then
    export PYTHONPATH="${PYTHONPATH}:$(pwd)/backend"
    exec uvicorn backend.app.main:app --host 0.0.0.0 --port "$PORT"
else
    exec uvicorn main:app --host 0.0.0.0 --port "$PORT"
fi
