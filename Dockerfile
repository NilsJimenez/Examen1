FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema requeridas
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requerimientos del backend e instalar dependencias
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente del backend
COPY backend/ .

# Variables de entorno y puerto de Railway
ENV PORT=8000
EXPOSE 8000

# Iniciar Uvicorn enlazando a 0.0.0.0 y al puerto inyectado por Railway
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
