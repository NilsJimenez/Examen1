"""
Esquemas Pydantic para el módulo de Analítica Inteligente con Machine Learning (CU27-CU29).
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class EntrenamientoRequest(BaseModel):
    n_semanas: int = Field(default=104, ge=26, le=260, description="Semanas históricas para ventas")
    n_sucursales: int = Field(default=4, ge=1, le=20, description="Número de sucursales")
    n_clientes: int = Field(default=600, ge=100, le=5000, description="Volumen de clientes sintéticos")
    semilla: int = Field(default=42, description="Semilla aleatoria para reproducibilidad (RN25)")


class MetricasSupervisadoOut(BaseModel):
    MAE: float
    RMSE: float
    R2: float
    tamano_entrenamiento: int
    tamano_prueba: int
    importancia_variables: Dict[str, float]


class MetricasNoSupervisadoOut(BaseModel):
    coeficiente_silueta: float
    cantidad_clusters: int
    total_clientes_analizados: int
    anomalias_detectadas: int
    tasa_anomalias_pct: float


class SegmentoClienteOut(BaseModel):
    cluster_id: int
    nombre: str
    descripcion: str
    cantidad_clientes: int
    porcentaje: float
    recencia_media_dias: float
    frecuencia_media: float
    gasto_medio_bs: float
    ticket_promedio_bs: float


class EntrenamientoResponse(BaseModel):
    mensaje: str
    modelo_supervisado: Dict[str, Any]
    modelo_no_supervisado: Dict[str, Any]
    aclaracion_origen: str = Field(
        default="Modelos entrenados con datos sintéticos siguiendo la regla RN25 del examen.",
        description="Aclaración obligatoria de procedencia sintética"
    )


class PrediccionDemandaRequest(BaseModel):
    sucursal_id: int = Field(default=1, description="ID de la sucursal a proyectar")
    semana_inicio: int = Field(default=1, ge=1, description="Semana de partida")
    semanas_proyeccion: int = Field(default=6, ge=1, le=26, description="Horizonte de predicción")
    tiene_promocion: bool = Field(default=False, description="Considerar campaña promocional")


class PrediccionItem(BaseModel):
    semana_proyeccion: int
    semana_del_anio: int
    sucursal_id: int
    tiene_promocion: bool
    demanda_estimada_unidades: int
    rango_minimo: int
    rango_maximo: int
    ingreso_estimado_bs: float


class PrediccionDemandaResponse(BaseModel):
    sucursal_id: int
    semanas_proyectadas: int
    total_unidades_proyectadas: int
    total_ingreso_proyectado_bs: float
    proyecciones: List[PrediccionItem]
    modelo_version: str


class DashboardAnaliticoResponse(BaseModel):
    mensaje: str
    aclaracion_datos: str
    modelo_supervisado: Dict[str, Any]
    modelo_no_supervisado: Dict[str, Any]
    segmentos_clientes: List[SegmentoClienteOut]
    proyeccion_demanda_muestra: List[PrediccionItem]
