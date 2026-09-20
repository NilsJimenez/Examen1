from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.schemas.producto import ProductoOut

class RecomendacionOut(BaseModel):
    id: int
    producto_id: int
    score: float
    motivo: str
    fecha_generada: datetime
    producto: Optional[ProductoOut] = None

    class Config:
        from_attributes = True

class RecomendacionListOut(BaseModel):
    recomendaciones: List[RecomendacionOut]
    fallback_aplicado: bool
