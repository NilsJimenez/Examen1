from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.services.push_service import push_hub, emitir_notificacion_push

router = APIRouter()


class EnviarPushInput(BaseModel):
    titulo: str
    cuerpo: str
    categoria: Optional[str] = "promo"
    rol_destino: Optional[str] = "TODOS"
    referencia: Optional[str] = ""


@router.get("/pendientes")
def obtener_notificaciones_pendientes(
    device_id: str = Query(..., description="Identificador único del dispositivo móvil"),
    rol: str = Query("TODOS", description="Rol del usuario en el móvil")
):
    """
    Endpoint consultado en tiempo real por la App Móvil (Flutter) para disparar
    notificaciones Push nativas en el panel general del sistema Android/iOS.
    """
    pendientes = push_hub.obtener_pendientes(device_id=device_id, rol=rol)
    return {
        "count": len(pendientes),
        "notificaciones": pendientes
    }


@router.post("/enviar")
def enviar_notificacion_manual(data: EnviarPushInput):
    """
    Permite enviar una notificación Push inmediata a los dispositivos móviles
    desde el Panel de Administración Web o SuperAdmin SaaS.
    """
    notif = emitir_notificacion_push(
        titulo=data.titulo.strip(),
        cuerpo=data.cuerpo.strip(),
        categoria=data.categoria or "promo",
        rol_destino=data.rol_destino or "TODOS",
        referencia=data.referencia or ""
    )
    return {
        "message": "Notificación Push enviada exitosamente a los dispositivos móviles.",
        "notificacion": notif
    }


@router.get("/historial")
def obtener_historial_notificaciones():
    """
    Lista las últimas notificaciones Push disparadas en la plataforma.
    """
    return push_hub.listar_historial(limit=25)
