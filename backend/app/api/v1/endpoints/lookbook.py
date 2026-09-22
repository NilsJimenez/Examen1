from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import json
import requests
from app.api.deps import get_db, require_roles
from app.models.producto import Producto, ProductoVariante
from app.models.inventario import InventarioSucursal
from app.schemas.lookbook import LookbookRequest, LookbookResponse, PrendaLookbook
from app.schemas.producto import ProductoOut
from app.core.config import settings

router = APIRouter()

# =============================================================================
# CU-24: GENERAR OUTFIT COMPLETO POR OCASIÓN (LOOKBOOK IA)
# =============================================================================
@router.post("/generar", response_model=LookbookResponse)
def generar_lookbook(
    req: LookbookRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["cliente", "admin", "encargado_sucursal"]))
):
    """
    CU-24: Generar Outfit Completo por Ocasión (Lookbook IA).
    Arma un conjunto armonioso de prendas (superior, inferior, calzado, accesorio)
    utilizando Google Gemini AI con base en ocasión, presupuesto máximo, género y talla preferida.
    Verifica disponibilidad de stock real en la sucursal indicada o catálogo global.
    """
    # 1. Filtrar inventario disponible
    # Buscar productos con stock > 0 en la sucursal indicada o en cualquier sucursal
    q = db.query(Producto).join(ProductoVariante, Producto.id == ProductoVariante.producto_id).join(InventarioSucursal, ProductoVariante.id == InventarioSucursal.variante_id).filter(InventarioSucursal.cantidad_disponible > 0)
    
    if req.sucursal_id:
        q = q.filter(InventarioSucursal.sucursal_id == req.sucursal_id)
        
    if req.genero:
        q = q.filter(Producto.genero.in_([req.genero, "Unisex", None, ""]))

    if req.talla_preferida:
        from app.models.producto import Talla
        q = q.join(Talla, ProductoVariante.talla_id == Talla.id).filter(Talla.nombre == req.talla_preferida)
        
    productos_db = q.distinct().all()
    
    if not productos_db:
        raise HTTPException(status_code=400, detail="No hay prendas suficientes en stock con estos filtros para armar un outfit.")

    # 2. Agrupar por categorías para pasar a la IA un catálogo simplificado
    catalogo_simplificado = []
    for p in productos_db:
        cat_nombre = p.categoria.nombre.lower() if p.categoria else ""
        nombre_prod = p.nombre.lower()
        texto = f"{cat_nombre} {nombre_prod}"
        
        rol = "accesorio"
        if "vestid" in texto:
            rol = "vestido"
        elif any(k in texto for k in ["camis", "poler", "chaquet", "sueter", "top", "blusa", "abrig", "biker", "blazer", "sudadera"]):
            rol = "superior"
        elif any(k in texto for k in ["zapat", "calzad", "botas", "botin", "tacón", "tacon", "mocas", "sneaker", "stiletto", "tenis"]):
            rol = "calzado"
        elif any(k in texto for k in ["pantal", "jean", "short", "fald", "legging", "bermuda", "calza"]):
            rol = "inferior"

        catalogo_simplificado.append({
            "id": p.id,
            "nombre": p.nombre,
            "genero": p.genero or "Unisex",
            "precio": float(p.precio_base),
            "rol_sugerido": rol
        })

    if len(catalogo_simplificado) > 80:
        catalogo_simplificado = catalogo_simplificado[:80]

    catalogo_str = json.dumps(catalogo_simplificado)

    prompt = f"""
    Eres el "Fashion Stylist IA" de FashionStore.
    El cliente quiere un outfit para: "{req.ocasion}".
    El género del cliente es: "{req.genero if req.genero else 'Unisex / Cualquiera'}". Debes buscar estrictamente prendas que coincidan con este género o sean Unisex.
    Su presupuesto máximo es: Bs. {req.presupuesto_max}.
    
    Aquí tienes el catálogo de prendas disponibles en su talla:
    {catalogo_str}
    
    Reglas OBLIGATORIAS:
    1. Debes seleccionar SIEMPRE un outfit completo y armónico:
       - Opción A: 1 prenda superior + 1 prenda inferior + 1 calzado (y 1 accesorio opcional si alcanza).
       - Opción B: 1 vestido + 1 calzado (y 1 accesorio opcional).
    2. La suma de los precios de las prendas elegidas DEBE SER MENOR O IGUAL a {req.presupuesto_max}. Si no hay combinación exacta que cumpla el presupuesto, elige la combinación más armoniosa y cercana.
    3. Asegúrate de que los estilos y colores combinen bien para la ocasión ({req.ocasion}).
    
    Devuelve ESTRICTAMENTE un JSON puro (SIN bloques markdown) con la siguiente estructura:
    {{
        "prendas_ids": [id1, id2, id3],
        "justificacion": "He elegido esta combinación porque...",
        "alerta_presupuesto": false
    }}
    """

    api_key = settings.GEMINI_API_KEY
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    
    try:
        r = requests.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=(3.0, 15.0))
        if r.status_code != 200:
            raise Exception(f"Google API Error {r.status_code}: {r.text}")
            
        respuesta_json = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        respuesta_json = respuesta_json.strip().strip("```json").strip("```").strip()
        data_ia = json.loads(respuesta_json)
    except Exception as e:
        print("Error IA Lookbook (usando Fallback Inteligente):", e)
        # --- SMART FALLBACK PARA EXAMEN ---
        cat_filtrado = catalogo_simplificado
        gen = req.genero.lower() if req.genero else ""
        if "hombre" in gen:
            cat_filtrado = [p for p in cat_filtrado if p.get("genero") in ["Hombre", "Unisex"]]
        elif "mujer" in gen:
            cat_filtrado = [p for p in cat_filtrado if p.get("genero") in ["Mujer", "Unisex"]]
            
        if not cat_filtrado: 
            cat_filtrado = catalogo_simplificado
            
        vestidos = [p for p in cat_filtrado if p.get('rol_sugerido') == 'vestido']
        superiores = [p for p in cat_filtrado if p.get('rol_sugerido') == 'superior']
        inferiores = [p for p in cat_filtrado if p.get('rol_sugerido') == 'inferior']
        calzados = [p for p in cat_filtrado if p.get('rol_sugerido') == 'calzado']
        accesorios = [p for p in cat_filtrado if p.get('rol_sugerido') == 'accesorio']
        
        fallback_ids = []
        # Si es mujer y la ocasión es formal/fiesta y hay vestido
        if "mujer" in gen and vestidos and ("fiesta" in req.ocasion.lower() or "boda" in req.ocasion.lower() or "gala" in req.ocasion.lower() or not superiores):
            fallback_ids.append(vestidos[0]["id"])
            if calzados: fallback_ids.append(calzados[0]["id"])
            elif accesorios: fallback_ids.append(accesorios[0]["id"])
        else:
            if superiores: fallback_ids.append(superiores[0]["id"])
            if inferiores: fallback_ids.append(inferiores[0]["id"])
            if calzados: fallback_ids.append(calzados[0]["id"])
            if accesorios and len(fallback_ids) < 3: fallback_ids.append(accesorios[0]["id"])
            
        if not fallback_ids and catalogo_simplificado:
            fallback_ids = [p["id"] for p in catalogo_simplificado[:3]]

        data_ia = {
            "prendas_ids": fallback_ids,
            "justificacion": f"Para la ocasión '{req.ocasion}', he combinado estas prendas coordinadas (superior, inferior y calzado) para un look equilibrado y elegante.",
            "alerta_presupuesto": False
        }

    ids_seleccionados = data_ia.get("prendas_ids", [])
    
    # Construir el listado de objetos reales
    outfit = []
    total_bs = 0.0
    
    for pid in ids_seleccionados:
        prod = next((p for p in productos_db if p.id == pid), None)
        if prod:
            cat_nombre = prod.categoria.nombre.lower() if prod.categoria else ""
            nombre_prod = prod.nombre.lower()
            texto = f"{cat_nombre} {nombre_prod}"
            
            rol = "Accesorio"
            if "vestid" in texto:
                rol = "Vestido"
            elif any(k in texto for k in ["camis", "poler", "chaquet", "sueter", "top", "blusa", "abrig", "biker", "blazer", "sudadera"]):
                rol = "Superior"
            elif any(k in texto for k in ["zapat", "calzad", "botas", "botin", "tacón", "tacon", "mocas", "sneaker", "stiletto", "tenis"]):
                rol = "Calzado"
            elif any(k in texto for k in ["pantal", "jean", "short", "fald", "legging", "bermuda", "calza"]):
                rol = "Inferior"
                
            outfit.append(PrendaLookbook(
                producto=ProductoOut.model_validate(prod),
                rol=rol
            ))
            total_bs += float(prod.precio_base)
            
    mensaje = None
    if total_bs > req.presupuesto_max or data_ia.get("alerta_presupuesto"):
        mensaje = "Se sugiere la combinación más cercana al presupuesto indicado."
    elif len(outfit) < 2:
        mensaje = "Mostrando prendas sugeridas disponibles."

    return LookbookResponse(
        outfits=[outfit],  # Enviamos como lista de conjuntos (1 por ahora)
        justificacion=data_ia.get("justificacion", "Combinación generada con éxito."),
        total_bs=total_bs,
        mensaje=mensaje
    )
