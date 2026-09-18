from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import require_roles
from app.schemas.chatbot import ChatbotRequest, ChatbotResponse
from app.services.chatbot_service import procesar_mensaje_chatbot

router = APIRouter()

@router.post("/mensaje", response_model=ChatbotResponse, status_code=status.HTTP_200_OK)
def enviar_mensaje_chatbot(
    request: ChatbotRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["cliente"]))
):
    """
    CU-23: Recibe un mensaje del cliente, consulta a la IA con contexto
    y devuelve la respuesta del asistente virtual.
    """
    resultado = procesar_mensaje_chatbot(db, current_user["id"], request.mensaje)
    return resultado
