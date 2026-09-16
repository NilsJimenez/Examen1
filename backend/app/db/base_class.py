from typing import Any
from sqlalchemy.orm import DeclarativeBase, declared_attr


class Base(DeclarativeBase):
    """Clase base de SQLAlchemy de la que heredarán todos los modelos de tablas."""
    id: Any
    __name__: str

    # Genera automáticamente el nombre de la tabla en minúsculas si no se especifica
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower()
