from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class VarianteAlertaInfo(BaseModel):
    id: int
    talla: str
    color: str
    producto_nombre: str

class SucursalAlertaInfo(BaseModel):
    id: int
    nombre: str

class AlertaOut(BaseModel):
    id: int
    variante_id: int
    sucursal_id: int
    cantidad_actual: int
    stock_minimo_usado: int
    cantidad_sugerida: int
    resuelta: bool
    fecha_creacion: datetime
    fecha_resolucion: Optional[datetime]
    proveedor_sugerido: str
    
    variante: VarianteAlertaInfo
    sucursal: SucursalAlertaInfo

    class Config:
        orm_mode = True

class AtenderAlertaRequest(BaseModel):
    cantidad_ingresada: int
    observaciones: Optional[str] = "Reabastecimiento atendido mediante alerta"
