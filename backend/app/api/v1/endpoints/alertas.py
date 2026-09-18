from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.api.deps import require_roles
from app.schemas.alerta import AlertaOut, AtenderAlertaRequest
from app.services.alerta_service import evaluar_todo_el_stock, atender_alerta
from app.models.inventario import AlertaReabastecimiento

router = APIRouter()

@router.get("/", response_model=List[AlertaOut])
def listar_alertas(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    """
    CU-25: Consulta el panel de alertas. 
    Primero evalúa el inventario para asegurar detección automática.
    """
    evaluar_todo_el_stock(db)
    
    # Filtrar solo las alertas no resueltas (Pendientes)
    query = db.query(AlertaReabastecimiento).filter(AlertaReabastecimiento.resuelta == False)
    
    # Si es encargado, filtrar por su sucursal (asumimos que en una app real tiene sucursal_id,
    # pero aquí mostramos todas si es admin, o filtramos si la lógica del current_user lo indica)
    
    alertas = query.order_by(AlertaReabastecimiento.fecha_creacion.desc()).all()
    
    # Mapeo manual para llenar los datos anidados que requiere AlertaOut
    resultado = []
    for a in alertas:
        prod = a.variante.producto
        resultado.append({
            "id": a.id,
            "variante_id": a.variante_id,
            "sucursal_id": a.sucursal_id,
            "cantidad_actual": a.cantidad_actual,
            "stock_minimo_usado": a.stock_minimo_usado,
            "cantidad_sugerida": a.cantidad_sugerida,
            "resuelta": a.resuelta,
            "fecha_creacion": a.fecha_creacion,
            "fecha_resolucion": a.fecha_resolucion,
            "proveedor_sugerido": a.proveedor_sugerido,
            "variante": {
                "id": a.variante.id,
                "talla": a.variante.talla.nombre if a.variante.talla else "N/A",
                "color": a.variante.color.nombre if a.variante.color else "N/A",
                "producto_nombre": prod.nombre if prod else "Desconocido"
            },
            "sucursal": {
                "id": a.sucursal.id,
                "nombre": a.sucursal.nombre
            }
        })
        
    return resultado

@router.put("/{alerta_id}/atender", response_model=AlertaOut)
def marcar_alerta_atendida(
    alerta_id: int,
    request: AtenderAlertaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    """
    CU-25: Marca la alerta como atendida y registra el ingreso del nuevo stock.
    """
    alerta = atender_alerta(db, alerta_id, request.cantidad_ingresada, current_user["id"], request.observaciones)
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
        
    # El retorno directo de ORM fallará al machear esquemas complejos si no se formatea:
    return {
        "id": alerta.id,
        "variante_id": alerta.variante_id,
        "sucursal_id": alerta.sucursal_id,
        "cantidad_actual": alerta.cantidad_actual,
        "stock_minimo_usado": alerta.stock_minimo_usado,
        "cantidad_sugerida": alerta.cantidad_sugerida,
        "resuelta": alerta.resuelta,
        "fecha_creacion": alerta.fecha_creacion,
        "fecha_resolucion": alerta.fecha_resolucion,
        "proveedor_sugerido": alerta.proveedor_sugerido,
        "variante": {
            "id": alerta.variante.id,
            "talla": alerta.variante.talla.nombre if alerta.variante.talla else "N/A",
            "color": alerta.variante.color.nombre if alerta.variante.color else "N/A",
            "producto_nombre": alerta.variante.producto.nombre if alerta.variante.producto else "Desconocido"
        },
        "sucursal": {
            "id": alerta.sucursal.id,
            "nombre": alerta.sucursal.nombre
        }
    }
