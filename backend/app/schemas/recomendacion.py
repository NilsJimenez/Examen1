from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

class RecomendacionOut(BaseModel):
    id: int
    producto_id: int
    score: float
    motivo: str
    fecha_generada: datetime

    class Config:
        from_attributes = True

class RecomendacionListOut(BaseModel):
    recomendaciones: List[RecomendacionOut]
    fallback_aplicado: bool
