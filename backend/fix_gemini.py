import os
file_path = os.path.join("backend", "app", "api", "v1", "endpoints", "reportes.py")
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re

# We will replace the genai usage with requests
nuevo_generativo = """
@router.post("/generativo", response_model=DashboardReporteOut)
def reporte_generativo_ia(
    req: ReporteGenerativoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador"]))
):
    import requests
    import json
    from app.core.config import settings
    api_key = settings.GEMINI_API_KEY
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    
    try:
        sucursales_str = json.dumps(req.sucursales_disponibles)
        
        prompt_parse = f\"\"\"
        Eres un asistente inteligente para un sistema de BI (Reportes).
        El usuario ha dictado el siguiente comando de voz: "{req.prompt}"
        
        Tú debes extraer los parámetros de búsqueda.
        La fecha de hoy es: {datetime.now().strftime("%Y-%m-%d")}
        Sucursales válidas en el sistema (JSON): {sucursales_str}
        
        Devuelve estrictamente un JSON puro (SIN bloques markdown, SIN texto extra) con las siguientes llaves:
        - "sucursal_id": int o null (busca el nombre en el JSON proporcionado, si no menciona sucursal, es null).
        - "fecha_inicio": string "YYYY-MM-DD" o null (interpreta frases como "último mes", "este año").
        - "fecha_fin": string "YYYY-MM-DD" o null.
        \"\"\"
        
        # Etapa 1
        r_parse = requests.post(url, json={"contents": [{"parts": [{"text": prompt_parse}]}]}, timeout=10)
        if r_parse.status_code != 200:
            raise Exception("La API de Google Gemini está saturada o no responde.")
            
        respuesta_json = r_parse.json()["candidates"][0]["content"]["parts"][0]["text"]
        respuesta_json = respuesta_json.strip().strip("```json").strip("```").strip()
        
        try:
            params = json.loads(respuesta_json)
        except:
            raise HTTPException(status_code=400, detail="No se pudo interpretar el comando de voz. Por favor, sé más específico.")

        sucursal_id = params.get("sucursal_id")
        fecha_inicio_str = params.get("fecha_inicio")
        fecha_fin_str = params.get("fecha_fin")
        
        fecha_inicio = datetime.strptime(fecha_inicio_str, "%Y-%m-%d").date() if fecha_inicio_str else None
        fecha_fin = datetime.strptime(fecha_fin_str, "%Y-%m-%d").date() if fecha_fin_str else None

        q_ventas = db.query(Venta)
        if sucursal_id:
            q_ventas = q_ventas.filter(Venta.sucursal_id == sucursal_id)
        if fecha_inicio:
            q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) >= fecha_inicio)
        if fecha_fin:
            q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) <= fecha_fin)

        ventas = q_ventas.all()

        if not ventas:
            return {
                "kpis": {"total_vendido": 0, "ticket_promedio": 0, "cantidad_ventas": 0, "reservas_concretadas_pct": 0},
                "ventas_por_dia": [],
                "mensaje": "La IA entendió tu solicitud, pero no hay ventas en el periodo o sucursal indicados.",
                "resumen_ia": None
            }

        total_vendido = sum(v.total for v in ventas)
        cantidad_ventas = len(ventas)
        ticket_promedio = total_vendido / cantidad_ventas if cantidad_ventas > 0 else 0

        q_reservas = db.query(Reserva)
        if sucursal_id:
            q_reservas = q_reservas.filter(Reserva.sucursal_id == sucursal_id)
        if fecha_inicio:
            q_reservas = q_reservas.filter(func.date(Reserva.fecha_reserva) >= fecha_inicio)
        if fecha_fin:
            q_reservas = q_reservas.filter(func.date(Reserva.fecha_reserva) <= fecha_fin)
        
        total_reservas = q_reservas.count()
        reservas_atendidas = q_reservas.filter(Reserva.estado == 'atendida').count()
        reservas_pct = (reservas_atendidas / total_reservas * 100) if total_reservas > 0 else 0

        ventas_por_dia_map = {}
        for v in ventas:
            d_str = v.fecha_venta.strftime("%Y-%m-%d")
            ventas_por_dia_map[d_str] = ventas_por_dia_map.get(d_str, 0) + float(v.total)
        
        ventas_chart = [{"fecha": k, "total": v} for k, v in sorted(ventas_por_dia_map.items())]

        datos_str = f\"\"\"
        Total Vendido: Bs. {total_vendido}
        Ticket Promedio: Bs. {ticket_promedio}
        Cantidad Ventas: {cantidad_ventas}
        Efectividad Reservas: {reservas_pct}%
        \"\"\"

        prompt_resumen = f\"\"\"
        Actúa como un Analista de Negocios de alto nivel.
        El usuario ha preguntado: "{req.prompt}"
        
        Aquí tienes los resultados reales obtenidos de la base de datos de FashionStore:
        {datos_str}
        
        Redacta un breve resumen ejecutivo (máximo 3 párrafos).
        Analiza los datos, resalta lo importante y da una pequeña recomendación comercial. No saludes.
        Usa un tono formal, elegante y motivador.
        \"\"\"

        # Etapa 2
        r_res = requests.post(url, json={"contents": [{"parts": [{"text": prompt_resumen}]}]}, timeout=10)
        if r_res.status_code != 200:
            resumen_ia = "Los datos se obtuvieron con éxito, pero la IA está saturada y no pudo redactar el resumen."
        else:
            resumen_ia = r_res.json()["candidates"][0]["content"]["parts"][0]["text"]

        return {
            "kpis": {
                "total_vendido": float(total_vendido),
                "ticket_promedio": float(ticket_promedio),
                "cantidad_ventas": cantidad_ventas,
                "reservas_concretadas_pct": round(reservas_pct, 2)
            },
            "ventas_por_dia": ventas_chart,
            "mensaje": None,
            "resumen_ia": resumen_ia
        }
    except Exception as e:
        print("Error IA:", e)
        raise HTTPException(status_code=500, detail="Servidores de IA temporalmente saturados. Por favor espera 30 segundos o usa filtros manuales.")
"""

# Extract everything before @router.post("/generativo"
import re
match = re.search(r'@router\.post\("/generativo"', content)
if match:
    new_content = content[:match.start()] + nuevo_generativo
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Replaced with requests")
