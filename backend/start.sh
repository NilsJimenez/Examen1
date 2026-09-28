#!/bin/sh
set -e
PORT="${PORT:-8000}"
echo "Iniciando FashionStore API en el puerto $PORT..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
