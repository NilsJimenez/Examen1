from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class KPIData(BaseModel):
    total_vendido: float
    ticket_promedio: float
    cantidad_ventas: int
    reservas_concretadas_pct: float

class VentasPorDia(BaseModel):
    fecha: str
    total: float

class DashboardReporteOut(BaseModel):
    kpis: KPIData
    ventas_por_dia: List[VentasPorDia]
    mensaje: Optional[str] = None
    resumen_ia: Optional[str] = None

class ReporteGenerativoRequest(BaseModel):
    prompt: str
    sucursales_disponibles: List[dict]  # [{"id": 1, "nombre": "Central"}] - Context for AI

