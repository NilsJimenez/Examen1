import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import google.generativeai as genai

from app.core.config import settings
from app.models.producto import Producto, ProductoVariante
from app.models.sucursal import Sucursal
from app.models.inventario import InventarioSucursal
from app.models.interacciones import InteraccionChatbot
from app.models.usuario import Usuario

logger = logging.getLogger(__name__)

# Configurar API Key de Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

def obtener_contexto_tienda(db: Session) -> str:
    """Extrae un resumen del catálogo y stock para darle contexto a la IA"""
    productos = db.query(Producto).filter(Producto.activo == True).limit(50).all()
    
    contexto = "CATÁLOGO ACTUAL Y DISPONIBILIDAD (No inventes productos):\n"
    for p in productos:
        contexto += f"- {p.nombre} (ID: {p.id}, Precio: Bs. {p.precio_base})\n"
        for v in p.variantes:
            stock = db.query(func.sum(InventarioSucursal.cantidad_disponible - InventarioSucursal.cantidad_reservada))\
                      .filter(InventarioSucursal.variante_id == v.id).scalar() or 0
            if stock > 0:
                talla = v.talla.nombre if v.talla else 'N/A'
                color = v.color.nombre if v.color else 'N/A'
                contexto += f"   * Talla {talla}, Color {color}: {stock} disponibles en total.\n"
    
    sucursales = db.query(Sucursal).all()
    contexto += "\nSUCURSALES DISPONIBLES:\n"
    for s in sucursales:
        contexto += f"- {s.nombre} (Dirección: {s.direccion})\n"
        
    return contexto

def procesar_mensaje_chatbot(db: Session, cliente_id: int, mensaje: str) -> dict:
    """
    Procesa un mensaje del usuario utilizando Gemini y guarda el historial.
    Cumple con el CU-23 incluyendo Excepciones 1 y 2.
    """
    cliente = db.query(Usuario).filter(Usuario.id == cliente_id).first()
    nombre_cliente = cliente.nombres if cliente else "Cliente"
    
    # Excepción 1 (Preventiva): Validar que el servicio de IA esté habilitado
    if not settings.GEMINI_API_KEY:
        respuesta_error = "Hola, lo siento mucho. Mi sistema de inteligencia artificial está en mantenimiento temporal. Si tienes consultas urgentes, puedes contactarnos al 77889900 o al correo soporte@fashionstore.com."
        _guardar_interaccion(db, cliente_id, mensaje, respuesta_error)
        return {"respuesta": respuesta_error, "fecha": datetime.utcnow(), "excepcion_aplicada": True}

    contexto = obtener_contexto_tienda(db)
    
    prompt_sistema = f"""
    Eres 'FashionBot', el asistente virtual experto y amigable de la tienda de ropa 'FashionStore'.
    Estás hablando con {nombre_cliente}.
    
    REGLA DE ORO (EXCEPCIÓN 2 - FUERA DE ALCANCE):
    Si el usuario te hace una pregunta que NO tiene NADA que ver con moda, ropa, compras, la tienda FashionStore, sucursales, o el proceso de reserva/compra (por ejemplo, política, deportes, matemáticas, código, etc.), DEBES responder EXACTAMENTE:
    "Disculpa, soy el asistente virtual de FashionStore y solo estoy programado para ayudarte con nuestro catálogo de moda, tus reservas o consultas de la tienda. Si necesitas ayuda con otro tema, te sugiero comunicarte con el encargado de sucursal."
    No respondas la pregunta fuera de tema bajo ninguna circunstancia.

    Si la pregunta es sobre la tienda, responde de forma amigable, breve (máximo 3 párrafos cortos) y usa emojis.
    Si el cliente pregunta por un producto o talla, usa esta información real de la base de datos para responderle:
    {contexto}
    
    Mensaje del usuario: "{mensaje}"
    """
    
    try:
        model = genai.GenerativeModel('gemini-flash-latest')
        response = model.generate_content(prompt_sistema)
        respuesta_ia = response.text.strip()
        
        _guardar_interaccion(db, cliente_id, mensaje, respuesta_ia)
        return {"respuesta": respuesta_ia, "fecha": datetime.utcnow(), "excepcion_aplicada": False}
        
    except Exception as e:
        logger.error(f"Error en Chatbot Gemini: {e}")
        # Excepción 1: Fallo de API en tiempo de ejecución
        respuesta_error = "Disculpa la demora, en este momento nuestros servidores de IA están saturados. Por favor, comunícate con el encargado de sucursal en nuestros teléfonos oficiales o envíanos un mensaje desde la sección de Contacto."
        _guardar_interaccion(db, cliente_id, mensaje, respuesta_error)
        return {"respuesta": respuesta_error, "fecha": datetime.utcnow(), "excepcion_aplicada": True}


def _guardar_interaccion(db: Session, cliente_id: int, mensaje: str, respuesta: str):
    try:
        interaccion = InteraccionChatbot(
            cliente_id=cliente_id,
            mensaje_usuario=mensaje,
            respuesta_ia=respuesta,
            fecha=datetime.utcnow()
        )
        db.add(interaccion)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error al guardar historial de chatbot: {e}")
