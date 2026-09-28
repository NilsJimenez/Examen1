from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# Asegurar compatibilidad de driver PostgreSQL con psycopg2
db_url = str(settings.DATABASE_URL)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Engine de conexión con pooling optimizado para PostgreSQL
engine = create_engine(
    db_url,
    pool_pre_ping=True,  # Verifica que la conexión a Supabase siga viva antes de usarla
    pool_size=10,
    max_overflow=20
)

# Fábrica de sesiones de base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Generador de sesión de base de datos para inyección de dependencias en FastAPI.
    Abre una conexión al inicio de la petición y la cierra automáticamente al terminar.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
