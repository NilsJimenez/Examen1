from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class SesionVestidorCreate(BaseModel):
    variante_id: int
    imagen_resultado_url: Optional[str] = None
    dispositivo: Optional[str] = None

class SesionVestidorOut(BaseModel):
    id: int
    cliente_id: int
    variante_id: int
    fecha: datetime
    imagen_resultado_url: Optional[str] = None
    dispositivo: Optional[str] = None

    class Config:
        from_attributes = True
