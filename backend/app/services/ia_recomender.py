import json
import logging
import google.generativeai as genai
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.producto import Producto, Categoria
from app.models.interacciones import HistorialInteraccion, SesionVestidorVirtual, Recomendacion
from app.models.venta import Venta, VentaDetalle

logger = logging.getLogger(__name__)

# Configurar API Key de Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

def generar_recomendaciones(db: Session, cliente_id: int):
    """
    Motor de Recomendaciones (CU-22).
    Genera recomendaciones usando Gemini. Aplica Fallback si falla o no hay historial.
    """
    productos_disponibles = db.query(Producto).filter(Producto.activo == True).all()
    if not productos_disponibles:
        return {"recomendaciones": [], "fallback_aplicado": True}

    # Recopilar historial
    historial_vistas = db.query(HistorialInteraccion).filter(HistorialInteraccion.cliente_id == cliente_id).order_by(HistorialInteraccion.fecha.desc()).limit(10).all()
    sesiones_ar = db.query(SesionVestidorVirtual).filter(SesionVestidorVirtual.cliente_id == cliente_id).order_by(SesionVestidorVirtual.fecha.desc()).limit(5).all()
    compras = db.query(VentaDetalle).join(Venta).filter(Venta.cliente_id == cliente_id).order_by(Venta.fecha_venta.desc()).limit(5).all()

    # Si no hay suficiente historial, aplicar fallback (Excepción 2)
    if len(historial_vistas) == 0 and len(compras) == 0 and len(sesiones_ar) == 0:
        return aplicar_fallback(db, cliente_id, productos_disponibles)

    # Si no hay API KEY, aplicar fallback (Excepción 1)
    if not settings.GEMINI_API_KEY:
        return aplicar_fallback(db, cliente_id, productos_disponibles)

    # Construir el contexto para la IA
    catalogo_text = ""
    for p in productos_disponibles:
        cat_nombre = p.categoria.nombre if p.categoria else "General"
        catalogo_text += f"- ID: {p.id} | Nombre: {p.nombre} | Categoría: {cat_nombre}\n"

    historial_text = "Vistas recientes:\n" + "\n".join([f"- Producto ID: {h.producto_id}" for h in historial_vistas])
    historial_text += "\nCompras recientes:\n" + "\n".join([f"- Variante ID: {c.variante_id}" for c in compras])
    
    prompt = f"""
    Eres un asistente de moda experto de la tienda FashionStore.
    Aquí está el catálogo de productos disponibles en tienda:
    {catalogo_text}

    Aquí está el historial de interacción del cliente:
    {historial_text}

    Basado en el perfil del cliente, recomienda EXACTAMENTE 3 prendas diferentes del catálogo.
    Debes devolver la respuesta estrictamente en este formato JSON válido sin bloques de código adicionales:
    [
        {{"producto_id": 1, "score": 0.95, "motivo": "Explicación breve del porqué"}},
        ...
    ]
    """

    try:
        model = genai.GenerativeModel('gemini-flash-latest')
        response = model.generate_content(prompt)
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        
        datos_json = json.loads(raw_text)
        
        nuevas_rec = []
        for item in datos_json:
            rec = Recomendacion(
                cliente_id=cliente_id,
                producto_id=item["producto_id"],
                score=item.get("score", 0.8),
                motivo=item.get("motivo", "Recomendado para ti")
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            nuevas_rec.append(rec)
            
        return {"recomendaciones": nuevas_rec, "fallback_aplicado": False}

    except Exception as e:
        logger.error(f"Error generando recomendaciones con IA: {e}")
        # Excepción 1: Fallback en caso de error
        return aplicar_fallback(db, cliente_id, productos_disponibles)


def aplicar_fallback(db: Session, cliente_id: int, productos: list):
    """
    Lógica de respaldo (Fallback): Recomendar los primeros 3 productos por defecto (más populares/nuevos).
    """
    nuevas_rec = []
    for p in productos[:3]:
        rec = Recomendacion(
            cliente_id=cliente_id,
            producto_id=p.id,
            score=0.75,
            motivo="Tendencia actual de temporada."
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        nuevas_rec.append(rec)
    
    return {"recomendaciones": nuevas_rec, "fallback_aplicado": True}
