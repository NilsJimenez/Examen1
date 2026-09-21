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

class FiltrosInterpretados(BaseModel):
    sucursal_id: Optional[int] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    formato_descarga: Optional[str] = None

class DashboardReporteOut(BaseModel):
    kpis: KPIData
    ventas_por_dia: List[VentasPorDia]
    mensaje: Optional[str] = None
    resumen_ia: Optional[str] = None
    filtros_interpretados: Optional[FiltrosInterpretados] = None

class ReporteGenerativoRequest(BaseModel):
    prompt: str
    sucursales_disponibles: List[dict]  # [{"id": 1, "nombre": "Central"}] - Context for AI
