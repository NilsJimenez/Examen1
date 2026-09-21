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
        # Clasificación simple (para ayudar a la IA)
        cat_nombre = p.categoria.nombre.lower() if p.categoria else "otro"
        rol = "accesorio"
        if "camis" in cat_nombre or "poler" in cat_nombre or "chaquet" in cat_nombre or "sueter" in cat_nombre or "top" in cat_nombre:
            rol = "superior"
        elif "pantal" in cat_nombre or "jean" in cat_nombre or "short" in cat_nombre or "fald" in cat_nombre:
            rol = "inferior"
        elif "zapat" in cat_nombre or "zapatill" in cat_nombre or "bot" in cat_nombre or "calzad" in cat_nombre:
            rol = "calzado"

        catalogo_simplificado.append({
            "id": p.id,
            "nombre": p.nombre,
            "precio": float(p.precio_base),
            "color": "Varios",
            "rol_sugerido": rol
        })

    # Si es muy grande, lo cortamos para no saturar el prompt (ej. max 50 prendas)
    if len(catalogo_simplificado) > 80:
        catalogo_simplificado = catalogo_simplificado[:80]

    catalogo_str = json.dumps(catalogo_simplificado)

    prompt = f"""
    Eres el "Fashion Stylist IA" de FashionStore.
    El cliente quiere un outfit para: "{req.ocasion}".
    El género del cliente es: "{req.genero if req.genero else 'Unisex / Cualquiera'}". Debes buscar estrictamente prendas que coincidan con este género, no mezcles.
    Su presupuesto máximo es: Bs. {req.presupuesto_max}.
    
    Aquí tienes el catálogo de prendas disponibles en su talla:
    {catalogo_str}
    
    Reglas:
    1. Debes seleccionar MÁXIMO 1 prenda superior, 1 prenda inferior, 1 calzado y 1 accesorio (si alcanza). Si es un vestido, cuenta como superior+inferior.
    2. La suma de los precios de las prendas elegidas DEBE SER MENOR O IGUAL a {req.presupuesto_max}. Si no hay ninguna combinación exacta que cumpla el presupuesto, elige la más barata y razonable e indícalo en el mensaje de error, pero envíalo.
    3. Asegúrate de que los colores combinen bien para la ocasión.
    
    Devuelve ESTRICTAMENTE un JSON puro (SIN bloques markdown) con la siguiente estructura:
    {{
        "prendas_ids": [id1, id2, id3],
        "justificacion": "He elegido estas prendas porque...",
        "alerta_presupuesto": false (o true si no pudiste cumplir el presupuesto y elegiste lo más barato)
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
        print("Error IA Lookbook (usando Fallback):", e)
        # --- SMART FALLBACK PARA EXAMEN ---
        # Filtramos por genero primero
        cat_filtrado = catalogo_simplificado
        gen = req.genero.lower() if req.genero else ""
        if "hombre" in gen:
            cat_filtrado = [p for p in cat_filtrado if "mujer" not in p["nombre"].lower() and "mujer" not in p.get("descripcion", "").lower()]
        elif "mujer" in gen:
            cat_filtrado = [p for p in cat_filtrado if "hombre" not in p["nombre"].lower() and "hombre" not in p.get("descripcion", "").lower()]
            
        if not cat_filtrado: 
            cat_filtrado = catalogo_simplificado
            
        # Intentamos buscar coincidencias con la ocasion (ej. deportivo)
        ocas = req.ocasion.lower()
        match_ocas = [p for p in cat_filtrado if ocas in p["nombre"].lower() or ocas in p.get("descripcion", "").lower()]
        
        superiores = [p for p in (match_ocas if match_ocas else cat_filtrado) if p['rol_sugerido'] == 'superior']
        inferiores = [p for p in (match_ocas if match_ocas else cat_filtrado) if p['rol_sugerido'] == 'inferior']
        calzados = [p for p in (match_ocas if match_ocas else cat_filtrado) if p['rol_sugerido'] == 'calzado']
        
        if not superiores: superiores = [p for p in cat_filtrado if p['rol_sugerido'] == 'superior']
        if not inferiores: inferiores = [p for p in cat_filtrado if p['rol_sugerido'] == 'inferior']
        if not calzados: calzados = [p for p in cat_filtrado if p['rol_sugerido'] == 'calzado']
        
        fallback_ids = []
        if superiores: fallback_ids.append(superiores[0]["id"])
        if inferiores: fallback_ids.append(inferiores[-1]["id"])
        if calzados: fallback_ids.append(calzados[0]["id"])
        if not fallback_ids and catalogo_simplificado:
            fallback_ids = [catalogo_simplificado[0]["id"]]

        data_ia = {
            "prendas_ids": fallback_ids,
            "justificacion": f"Para esta ocasión '{req.ocasion}', he armado esta combinación especial usando nuestra colección. (Google AI Limit alcanzado, Fallback Inteligente activado).",
            "alerta_presupuesto": False
        }

    ids_seleccionados = data_ia.get("prendas_ids", [])
    
    # Construir el listado de objetos reales
    outfit = []
    total_bs = 0.0
    
    for pid in ids_seleccionados:
        prod = next((p for p in productos_db if p.id == pid), None)
        if prod:
            # Re-determinar rol para la respuesta
            cat_nombre = prod.categoria.nombre.lower() if prod.categoria else "otro"
            rol = "Accesorio"
            if "camis" in cat_nombre or "poler" in cat_nombre or "chaquet" in cat_nombre or "sueter" in cat_nombre or "top" in cat_nombre:
                rol = "Superior"
            elif "pantal" in cat_nombre or "jean" in cat_nombre or "short" in cat_nombre or "fald" in cat_nombre:
                rol = "Inferior"
            elif "zapat" in cat_nombre or "zapatill" in cat_nombre or "bot" in cat_nombre or "calzad" in cat_nombre:
                rol = "Calzado"
                
            outfit.append(PrendaLookbook(
                producto=ProductoOut.model_validate(prod),
                rol=rol
            ))
            total_bs += float(prod.precio_base)
            
    mensaje = None
    if total_bs > req.presupuesto_max or data_ia.get("alerta_presupuesto"):
        mensaje = "No se encontraron prendas que sumen menos del presupuesto indicado. Se sugiere la opción más cercana."
    elif len(outfit) < 2:
        mensaje = "No existen prendas suficientes en stock con los filtros indicados para completar un conjunto. Mostrando prendas sugeridas parciales."

    return LookbookResponse(
        outfits=[outfit],  # Enviamos como lista de conjuntos (1 por ahora)
        justificacion=data_ia.get("justificacion", "Combinación generada con éxito."),
        total_bs=total_bs,
        mensaje=mensaje
    )
