from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatbotRequest(BaseModel):
    mensaje: str

class ChatbotResponse(BaseModel):
    respuesta: str
    fecha: datetime
    excepcion_aplicada: bool = False
