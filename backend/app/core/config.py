from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "FashionStore API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Base de datos Supabase (con fallback seguro para despliegue en la nube)
    DATABASE_URL: str = "postgresql://postgres.tdlapakfyboflxawpema:Ficct_Examen@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v
    
    # Seguridad y Token JWT
    SECRET_KEY: str = "supersecretkeyfashionstore2026sistemas2ficct"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas
    
    # Inteligencia Artificial
    GEMINI_API_KEY: str = ""
    
    # Configuración de Correo Electrónico (SMTP para Recuperación de Contraseña)
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    
    # CORS (Permitir peticiones desde Angular / Flutter)
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:4200", "http://localhost:3000", "*"]

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }


settings = Settings()
