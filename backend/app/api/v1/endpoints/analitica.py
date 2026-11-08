"""
Endpoints de la API REST para Analítica Inteligente con Machine Learning (CU27, CU28, CU29).
Cumple:
  - RF61 a RF66: Generación sintética, entrenamiento supervisado/no supervisado, métricas MAE/RMSE/R2/Silueta,
    persistencia versionada en ml_modelos y visualización en dashboard analítico.
  - RN25: Aclaración explícita de procedencia sintética de los datos.
  - Seguridad y Aislamiento: Endpoints protegidos por roles y suscripción.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import require_roles, get_current_user
from app.models.saas import MlModelo
from app.ml.training_service import MLTrainingService
from app.schemas.analitica import (
    EntrenamientoRequest,
    EntrenamientoResponse,
    PrediccionDemandaRequest,
    PrediccionDemandaResponse,
    SegmentoClienteOut,
    DashboardAnaliticoResponse
)

router = APIRouter()


@router.post(
    "/entrenar",
    response_model=EntrenamientoResponse,
    status_code=status.HTTP_200_OK,
    summary="CU27: Generar datos sintéticos y entrenar modelos (RF61-RF65, RN25)"
)
def entrenar_modelos_ml(
    req: EntrenamientoRequest = EntrenamientoRequest(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "administrador_plataforma", "encargado_sucursal"]))
):
    """
    CU27: Genera datos sintéticos con semilla fija (RN25), preprocesa variables y entrena:
      1. Modelo Supervisado (RandomForestRegressor): Previsión de demanda y ventas semanales.
         Métricas: MAE, RMSE, R².
      2. Modelo No Supervisado (KMeans + IsolationForest): Segmentación de clientes (RFM) y detección de anomalías.
         Métricas: Coeficiente de Silueta, tasa de anomalías.
      3. Guarda los artefactos versionados (.joblib) y registra la bitácora en la tabla `ml_modelos`.
    """
    res_supervisado = MLTrainingService.entrenar_modelo_supervisado_demanda(
        db=db,
        n_semanas=req.n_semanas,
        n_sucursales=req.n_sucursales,
        semilla=req.semilla
    )

    res_no_supervisado = MLTrainingService.entrenar_modelo_no_supervisado_clientes(
        db=db,
        n_clientes=req.n_clientes,
        semilla=req.semilla
    )

    return {
        "mensaje": "Modelos de Machine Learning entrenados, validados y versionados exitosamente.",
        "modelo_supervisado": res_supervisado,
        "modelo_no_supervisado": res_no_supervisado,
        "aclaracion_origen": (
            "Aviso oficial RN25: Estos modelos analíticos fueron entrenados a partir de series de tiempo "
            "y perfiles RFM generados sintéticamente para garantizar reproducibilidad en la evaluación."
        )
    }


@router.get(
    "/dashboard",
    response_model=DashboardAnaliticoResponse,
    summary="CU29: Dashboard analítico con indicadores y resultados de modelos (RF66)"
)
def obtener_dashboard_analitico(
    sucursal_id: int = Query(default=1, description="ID de la sucursal para la proyección muestra"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "administrador_plataforma", "encargado_sucursal"]))
):
    """
    CU29: Visualiza el dashboard analítico consolidado con métricas de los modelos,
    distribución de clientes en segmentos RFM y proyección de demanda para las próximas semanas.
    """
    # 1. Obtener información de modelos activos en la base de datos o inferencia directa
    modelo_sup_db = db.query(MlModelo).filter(
        MlModelo.tipo == "supervisado",
        MlModelo.activo == True
    ).order_by(MlModelo.entrenado_en.desc()).first()

    modelo_nosup_db = db.query(MlModelo).filter(
        MlModelo.tipo == "no_supervisado",
        MlModelo.activo == True
    ).order_by(MlModelo.entrenado_en.desc()).first()

    # Si aún no se han entrenado en la BD, se ejecutan automáticamente
    if not modelo_sup_db or not modelo_nosup_db:
        MLTrainingService.entrenar_modelo_supervisado_demanda(db=db)
        MLTrainingService.entrenar_modelo_no_supervisado_clientes(db=db)
        modelo_sup_db = db.query(MlModelo).filter(
            MlModelo.tipo == "supervisado",
            MlModelo.activo == True
        ).first()
        modelo_nosup_db = db.query(MlModelo).filter(
            MlModelo.tipo == "no_supervisado",
            MlModelo.activo == True
        ).first()

    # 2. Obtener segmentos y anomalías
    datos_clientes = MLTrainingService.obtener_segmentos_y_anomalias()

    # 3. Obtener proyección de demanda de muestra a 6 semanas
    proyecciones = MLTrainingService.predecir_demanda(
        sucursal_id=sucursal_id,
        semana_inicio=1,
        semanas_proyeccion=6,
        tiene_promocion=False
    )

    return {
        "mensaje": "Dashboard analítico de Machine Learning generado exitosamente.",
        "aclaracion_datos": "Procedencia: Modelos entrenados con datos sintéticos según regla RN25.",
        "modelo_supervisado": {
            "nombre": modelo_sup_db.nombre,
            "version": modelo_sup_db.version,
            "metricas": modelo_sup_db.metricas,
            "entrenado_en": modelo_sup_db.entrenado_en.isoformat()
        },
        "modelo_no_supervisado": {
            "nombre": modelo_nosup_db.nombre,
            "version": modelo_nosup_db.version,
            "metricas": modelo_nosup_db.metricas,
            "entrenado_en": modelo_nosup_db.entrenado_en.isoformat()
        },
        "segmentos_clientes": datos_clientes["segmentos"],
        "proyeccion_demanda_muestra": proyecciones
    }


@router.post(
    "/predecir-demanda",
    response_model=PrediccionDemandaResponse,
    summary="CU28: Inferencia con modelo supervisado para proyección de ventas"
)
def predecir_demanda(
    req: PrediccionDemandaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "administrador_plataforma", "encargado_sucursal"]))
):
    """
    CU28: Genera la proyección de demanda de unidades e ingresos estimados
    para una sucursal específica con o sin promociones activas.
    """
    proyecciones = MLTrainingService.predecir_demanda(
        sucursal_id=req.sucursal_id,
        semana_inicio=req.semana_inicio,
        semanas_proyeccion=req.semanas_proyeccion,
        tiene_promocion=req.tiene_promocion
    )

    total_unidades = sum(p["demanda_estimada_unidades"] for p in proyecciones)
    total_ingresos = round(sum(p["ingreso_estimado_bs"] for p in proyecciones), 2)

    return {
        "sucursal_id": req.sucursal_id,
        "semanas_proyectadas": req.semanas_proyeccion,
        "total_unidades_proyectadas": total_unidades,
        "total_ingreso_proyectado_bs": total_ingresos,
        "proyecciones": proyecciones,
        "modelo_version": "RandomForestRegressor-v1.0"
    }


@router.get(
    "/segmentacion-clientes",
    summary="CU28: Perfiles de clientes RFM y detección de anomalías"
)
def obtener_segmentacion_clientes(
    current_user: dict = Depends(require_roles(["administrador", "administrador_plataforma", "encargado_sucursal"]))
):
    """
    CU28: Retorna los clusters de clientes identificados por KMeans (VIP, Leales, Ocasionales)
    y la tasa de anomalías calculada por IsolationForest.
    """
    return MLTrainingService.obtener_segmentos_y_anomalias()


@router.get(
    "/modelos",
    summary="Consultar historial de versiones de modelos de Machine Learning en la plataforma"
)
def listar_modelos_registrados(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "administrador_plataforma"]))
):
    """Lista las versiones registradas y activas en la tabla `ml_modelos` de PostgreSQL."""
    modelos = db.query(MlModelo).order_by(MlModelo.entrenado_en.desc()).all()
    return [
        {
            "id": str(m.id),
            "nombre": m.nombre,
            "tipo": m.tipo,
            "version": m.version,
            "metricas": m.metricas,
            "entrenado_en": m.entrenado_en.isoformat(),
            "activo": m.activo
        }
        for m in modelos
    ]
