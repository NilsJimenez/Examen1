import google.generativeai as genai
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case
import io
import openpyxl
from fpdf import FPDF
from datetime import datetime, date

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.venta import Venta
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.reporte import DashboardReporteOut, ReporteGenerativoRequest

router = APIRouter()

def verificar_permisos_sucursal(db: Session, user: dict, sucursal_id: int):
    # Excepción 2: Denegar si no tiene permisos sobre la sucursal
    if user["role"] == "encargado_sucursal":
        usr_db = db.query(Usuario).get(user["id"])
        if usr_db and usr_db.sucursal_id != sucursal_id:
            raise HTTPException(status_code=403, detail="No tienes permisos para consultar reportes de otras sucursales.")

@router.get("/dashboard", response_model=DashboardReporteOut)
def get_dashboard_data(
    sucursal_id: int = Query(None, description="Filtro opcional de sucursal"),
    fecha_inicio: date = Query(None, description="Fecha de inicio"),
    fecha_fin: date = Query(None, description="Fecha de fin"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    if sucursal_id:
        verificar_permisos_sucursal(db, current_user, sucursal_id)
    elif current_user["role"] == "encargado_sucursal":
        # Si no manda sucursal pero es encargado, forzar su propia sucursal
        usr_db = db.query(Usuario).get(current_user["id"])
        sucursal_id = usr_db.sucursal_id

    # Base query for Ventas
    q_ventas = db.query(Venta)
    if sucursal_id:
        q_ventas = q_ventas.filter(Venta.sucursal_id == sucursal_id)
    if fecha_inicio:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) >= fecha_inicio)
    if fecha_fin:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) <= fecha_fin)

    ventas = q_ventas.all()

    # Excepción 1: No hay datos
    if not ventas:
        return {
            "kpis": {"total_vendido": 0, "ticket_promedio": 0, "cantidad_ventas": 0, "reservas_concretadas_pct": 0},
            "ventas_por_dia": [],
            "mensaje": "No se encontró información de ventas en el periodo seleccionado."
        }

    total_vendido = sum(v.total for v in ventas)
    cantidad_ventas = len(ventas)
    ticket_promedio = total_vendido / cantidad_ventas if cantidad_ventas > 0 else 0

    # Base query for Reservas
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

    # Agrupar por día
    ventas_por_dia_map = {}
    for v in ventas:
        d_str = v.fecha_venta.strftime("%Y-%m-%d")
        ventas_por_dia_map[d_str] = ventas_por_dia_map.get(d_str, 0) + float(v.total)
    
    ventas_chart = [{"fecha": k, "total": v} for k, v in sorted(ventas_por_dia_map.items())]

    return {
        "kpis": {
            "total_vendido": float(total_vendido),
            "ticket_promedio": float(ticket_promedio),
            "cantidad_ventas": cantidad_ventas,
            "reservas_concretadas_pct": round(reservas_pct, 2)
        },
        "ventas_por_dia": ventas_chart,
        "mensaje": None
    }


@router.get("/exportar")
def exportar_reporte(
    formato: str = Query(..., regex="^(pdf|xlsx)$"),
    sucursal_id: int = Query(None),
    fecha_inicio: date = Query(None),
    fecha_fin: date = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    if sucursal_id:
        verificar_permisos_sucursal(db, current_user, sucursal_id)
    elif current_user["role"] == "encargado_sucursal":
        usr_db = db.query(Usuario).get(current_user["id"])
        sucursal_id = usr_db.sucursal_id

    # Re-query simplificada
    q_ventas = db.query(Venta)
    if sucursal_id:
        q_ventas = q_ventas.filter(Venta.sucursal_id == sucursal_id)
    if fecha_inicio:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) >= fecha_inicio)
    if fecha_fin:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) <= fecha_fin)
    
    ventas = q_ventas.all()

    if formato == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Reporte de Ventas"
        ws.append(["ID Venta", "Fecha", "Monto Total (Bs)", "Atendido Por (Usuario ID)"])
        
        for v in ventas:
            ws.append([v.id, v.fecha_venta.strftime("%Y-%m-%d %H:%M:%S"), float(v.total), v.usuario_id])
            
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        
        return StreamingResponse(
            stream, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=reporte_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
        
    elif formato == "pdf":
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", size=16)
        pdf.cell(200, 10, txt="Reporte Consolidado de Ventas - FashionStore", ln=True, align='C')
        pdf.set_font("Helvetica", size=10)
        pdf.ln(10)
        
        pdf.cell(50, 10, txt="Fecha", border=1)
        pdf.cell(40, 10, txt="Usuario ID", border=1)
        pdf.cell(40, 10, txt="Total (Bs)", border=1, ln=True)
        
        for v in ventas:
            pdf.cell(50, 10, txt=v.fecha_venta.strftime("%Y-%m-%d"), border=1)
            pdf.cell(40, 10, txt=str(v.usuario_id), border=1)
            pdf.cell(40, 10, txt=str(float(v.total)), border=1, ln=True)
            
        stream = io.BytesIO(pdf.output(dest='S').encode('latin1'))
        
        return StreamingResponse(
            stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=reporte_{datetime.now().strftime('%Y%m%d')}.pdf"}
        )



@router.post("/generativo", response_model=DashboardReporteOut)
def reporte_generativo_ia(
    req: ReporteGenerativoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador"]))
):
    try:
        # Paso 1: Parsear el comando de voz a parámetros usando Gemini
        from app.core.config import settings
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # or gemini-flash-latest
        # Usamos gemini-flash-latest que configuramos previamente
        from app.core.config import settings
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        sucursales_str = json.dumps(req.sucursales_disponibles)
        
        prompt_parse = f"""
        Eres un asistente inteligente para un sistema de BI (Reportes).
        El usuario ha dictado el siguiente comando de voz: "{req.prompt}"
        
        Tú debes extraer los parámetros de búsqueda.
        La fecha de hoy es: {datetime.now().strftime("%Y-%m-%d")}
        Sucursales válidas en el sistema (JSON): {sucursales_str}
        
        Devuelve estrictamente un JSON puro (SIN bloques markdown, SIN texto extra) con las siguientes llaves:
        - "sucursal_id": int o null (busca el nombre en el JSON proporcionado, si no menciona sucursal, es null).
        - "fecha_inicio": string "YYYY-MM-DD" o null (interpreta frases como "último mes", "este año").
        - "fecha_fin": string "YYYY-MM-DD" o null.
        """
        
        respuesta_json = model.generate_content(prompt_parse).text
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

        # Paso 2: Ejecutar Consulta (reutilizamos la lógica)
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

        # Paso 3: Generar Resumen IA
        datos_str = f"""
        Total Vendido: Bs. {total_vendido}
        Ticket Promedio: Bs. {ticket_promedio}
        Cantidad Ventas: {cantidad_ventas}
        Efectividad Reservas: {reservas_pct}%
        """

        prompt_resumen = f"""
        Actúa como un Analista de Negocios de alto nivel.
        El usuario ha preguntado: "{req.prompt}"
        
        Aquí tienes los resultados reales obtenidos de la base de datos de FashionStore:
        {datos_str}
        
        Redacta un breve resumen ejecutivo (máximo 3 párrafos).
        Analiza los datos, resalta lo importante y da una pequeña recomendación comercial. No saludes.
        Usa un tono formal, elegante y motivador.
        """

        resumen_ia = model.generate_content(prompt_resumen).text

        # Paso 4: Retornar resultado estructurado
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
        # Se envía un mensaje amigable al frontend pero se imprime el real en la consola
        raise HTTPException(status_code=500, detail="Límite de peticiones de IA alcanzado (Espera 1 minuto) o error de conexión. Puedes usar los filtros manuales mientras tanto.")
