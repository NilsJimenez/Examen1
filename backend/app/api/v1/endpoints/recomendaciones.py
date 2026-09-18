from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.schemas.recomendacion import RecomendacionListOut
from app.services.ia_recomender import generar_recomendaciones
from app.models.interacciones import HistorialInteraccion

router = APIRouter()

@router.get("/para-mi", response_model=RecomendacionListOut)
def obtener_recomendaciones(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["cliente"]))
):
    """
    CU-22: Obtiene recomendaciones personalizadas para el cliente autenticado
    usando Inteligencia Artificial (Gemini) o lógica de Fallback.
    """
    cliente_id = current_user["id"]
    resultado = generar_recomendaciones(db, cliente_id)
    return resultado

@router.post("/{recomendacion_id}/clic", status_code=status.HTTP_201_CREATED)
def registrar_clic_recomendacion(
    recomendacion_id: int,
    producto_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["cliente"]))
):
    """
    Registra cuando el usuario hace clic en una recomendación para retroalimentar el modelo.
    """
    interaccion = HistorialInteraccion(
        cliente_id=current_user["id"],
        producto_id=producto_id,
        tipo_interaccion="clic_recomendacion"
    )
    db.add(interaccion)
    db.commit()
    return {"message": "Clic registrado correctamente"}
