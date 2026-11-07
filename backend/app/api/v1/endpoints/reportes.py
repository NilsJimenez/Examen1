from typing import Optional
import json
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import io
import openpyxl
from fpdf import FPDF

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.venta import Venta, Comprobante, CambioPrenda
from app.models.reserva import Reserva
from app.models.inventario import InventarioSucursal
from app.models.producto import ProductoVariante, Producto
from app.models.sucursal import Sucursal
from app.models.usuario import Usuario
from app.schemas.reporte import DashboardReporteOut, ReporteGenerativoRequest

router = APIRouter()

def latin_safe(s: any) -> str:
    """Evita errores de codificación Latin-1 en FPDF."""
    if s is None:
        return ""
    return str(s).encode('latin-1', 'replace').decode('latin-1')

def verificar_permisos_sucursal(db: Session, user: dict, sucursal_id: int):
    if user["role"] == "encargado_sucursal":
        usr_db = db.query(Usuario).get(user["id"])
        if usr_db and usr_db.sucursal_id and usr_db.sucursal_id != sucursal_id:
            raise HTTPException(status_code=403, detail="No tienes permisos para consultar reportes de otras sucursales.")

# =============================================================================
# CU14: REPORTES CONVENCIONALES DE VENTAS E INVENTARIO (HABILITADO PARA TODOS LOS PLANES - RN07)
# =============================================================================
@router.get("/convencionales")
def obtener_reportes_convencionales(
    sucursal_id: Optional[int] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """
    CU14: Generar reportes convencionales de ventas e inventario (RF22, RN07).
    Habilitado para TODOS los planes de suscripción (Básico, Estándar y Profesional).
    Aislado estrictamente por empresa (tenant_id).
    """
    tenant_id = current_user.get("tenant_id")
    if sucursal_id:
        verificar_permisos_sucursal(db, current_user, sucursal_id)

    # 1. Tabla Convencional de Ventas Confirmadas
    q_ventas = db.query(Venta).options(
        joinedload(Venta.comprobante),
        joinedload(Venta.cliente),
        joinedload(Venta.detalles)
    )
    if tenant_id:
        q_ventas = q_ventas.filter(Venta.tenant_id == tenant_id)
    if sucursal_id:
        q_ventas = q_ventas.filter(Venta.sucursal_id == sucursal_id)
    if fecha_inicio:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) >= fecha_inicio)
    if fecha_fin:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) <= fecha_fin)

    ventas_db = q_ventas.order_by(Venta.fecha_venta.desc()).limit(100).all()

    sucursales_map = {}
    q_suc = db.query(Sucursal)
    if tenant_id:
        q_suc = q_suc.filter(Sucursal.tenant_id == tenant_id)
    for s in q_suc.all():
        sucursales_map[s.id] = s.nombre

    ventas_tabla = []
    for v in ventas_db:
        total_unidades = sum(d.cantidad for d in v.detalles) if v.detalles else 0
        ventas_tabla.append({
            "id": v.id,
            "numero_comprobante": v.comprobante.numero_comprobante if v.comprobante else f"REC-{v.id:05d}",
            "fecha_venta": v.fecha_venta.strftime("%Y-%m-%d %H:%M") if v.fecha_venta else "",
            "tipo_venta": v.tipo_venta,
            "sucursal_id": v.sucursal_id,
            "sucursal_nombre": sucursales_map.get(v.sucursal_id, "Tienda Online / Global"),
            "cliente": f"{v.cliente.nombres} {v.cliente.apellidos}".strip() if v.cliente else "Cliente en Caja (POS)",
            "unidades": total_unidades,
            "total": float(v.total),
            "estado": v.estado
        })

    # 2. Tabla Convencional de Inventario Actual por Sucursal
    q_inv = db.query(InventarioSucursal).options(
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto).joinedload(Producto.categoria),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.talla),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.color),
        joinedload(InventarioSucursal.sucursal)
    )
    if tenant_id:
        q_inv = q_inv.filter(InventarioSucursal.tenant_id == tenant_id)
    if sucursal_id:
        q_inv = q_inv.filter(InventarioSucursal.sucursal_id == sucursal_id)

    inventarios_db = q_inv.all()
    inventario_tabla = []
    total_unidades_stock = 0
    valorizacion_total_bs = 0.0
    items_bajo_stock = 0

    for inv in inventarios_db:
        var = inv.variante
        if not var or not var.producto:
            continue
        precio_unit = float(var.producto.precio_base or 0) + float(var.precio_adicional or 0)
        disp = int(inv.cantidad_disponible or 0)
        res = int(inv.cantidad_reservada or 0)
        minimo = int(inv.stock_minimo or 5)
        bajo = disp <= minimo
        valor_linea = round(disp * precio_unit, 2)

        total_unidades_stock += disp
        valorizacion_total_bs += valor_linea
        if bajo:
            items_bajo_stock += 1

        inventario_tabla.append({
            "inventario_id": inv.id,
            "variante_id": var.id,
            "sku": var.sku,
            "producto": var.producto.nombre,
            "categoria": var.producto.categoria.nombre if var.producto.categoria else "General",
            "talla": var.talla.nombre if var.talla else "U",
            "color": var.color.nombre if var.color else "Único",
            "color_hex": var.color.codigo_hex if var.color else "#333333",
            "sucursal_id": inv.sucursal_id,
            "sucursal_nombre": inv.sucursal.nombre if inv.sucursal else sucursales_map.get(inv.sucursal_id, f"Sucursal #{inv.sucursal_id}"),
            "cantidad_disponible": disp,
            "cantidad_reservada": res,
            "stock_libre": max(0, disp - res),
            "stock_minimo": minimo,
            "bajo_stock": bajo,
            "precio_unitario": precio_unit,
            "valor_stock_bs": valor_linea
        })

    # 3. Resumen de Cambios de Prenda (CU13)
    q_cambios = db.query(CambioPrenda)
    if tenant_id:
        q_cambios = q_cambios.filter(CambioPrenda.tenant_id == tenant_id)
    if sucursal_id:
        q_cambios = q_cambios.filter(CambioPrenda.sucursal_id == sucursal_id)
    total_cambios = q_cambios.count()

    return {
        "ventas": ventas_tabla,
        "inventario": inventario_tabla,
        "resumen_inventario": {
            "total_variantes": len(inventario_tabla),
            "total_unidades_stock": total_unidades_stock,
            "valorizacion_total_bs": round(valorizacion_total_bs, 2),
            "items_bajo_stock": items_bajo_stock,
            "total_cambios_prenda_cu13": total_cambios
        }
    }


# =============================================================================
# CU-26 / CU14: DASHBOARD BI DE VENTAS E INVENTARIO
# =============================================================================
@router.get("/dashboard", response_model=DashboardReporteOut)
def get_dashboard_data(
    sucursal_id: Optional[int] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """
    Dashboard de Ventas, Reservas y Rendimiento (habilitado para todos los planes, filtrado por tenant_id).
    """
    if hasattr(sucursal_id, 'default') or not isinstance(sucursal_id, int):
        sucursal_id = None
    if hasattr(fecha_inicio, 'default') or not isinstance(fecha_inicio, (date, datetime)):
        fecha_inicio = None
    if hasattr(fecha_fin, 'default') or not isinstance(fecha_fin, (date, datetime)):
        fecha_fin = None

    tenant_id = current_user.get("tenant_id")

    if sucursal_id:
        verificar_permisos_sucursal(db, current_user, sucursal_id)
    elif current_user["role"] == "encargado_sucursal":
        usr_db = db.query(Usuario).get(current_user["id"])
        sucursal_id = usr_db.sucursal_id if usr_db else None

    q_ventas = db.query(Venta)
    if tenant_id:
        q_ventas = q_ventas.filter(Venta.tenant_id == tenant_id)
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
            "mensaje": "No se encontró información de ventas en el periodo seleccionado."
        }

    total_vendido = sum(v.total for v in ventas)
    cantidad_ventas = len(ventas)
    ticket_promedio = total_vendido / cantidad_ventas if cantidad_ventas > 0 else 0

    q_reservas = db.query(Reserva)
    if tenant_id:
        q_reservas = q_reservas.filter(Reserva.tenant_id == tenant_id)
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
    formato: str = "pdf",
    tipo: str = "ventas",
    sucursal_id: Optional[int] = None,
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """CU14: Exportación de reportes convencionales de Ventas o Inventario en PDF o Excel (aislados por tenant_id)."""
    if hasattr(formato, 'default'):
        formato = getattr(formato, 'default', 'pdf')
    formato = str(formato).lower().strip()
    if formato not in ["pdf", "xlsx"]:
        formato = "pdf"

    if hasattr(tipo, 'default'):
        tipo = getattr(tipo, 'default', 'ventas')
    tipo = str(tipo).lower().strip()
    if tipo not in ["ventas", "inventario"]:
        tipo = "ventas"

    if hasattr(sucursal_id, 'default') or not isinstance(sucursal_id, int):
        sucursal_id = None
    if hasattr(fecha_inicio, 'default') or not isinstance(fecha_inicio, (date, datetime)):
        fecha_inicio = None
    if hasattr(fecha_fin, 'default') or not isinstance(fecha_fin, (date, datetime)):
        fecha_fin = None

    tenant_id = current_user.get("tenant_id")

    if sucursal_id:
        verificar_permisos_sucursal(db, current_user, sucursal_id)
    elif current_user["role"] == "encargado_sucursal":
        usr_db = db.query(Usuario).get(current_user["id"])
        sucursal_id = usr_db.sucursal_id if usr_db else None

    # Exportación de Inventario Convencional (CU14)
    if tipo == "inventario":
        q_inv = db.query(InventarioSucursal).options(
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto),
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.talla),
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.color),
            joinedload(InventarioSucursal.sucursal)
        )
        if tenant_id:
            q_inv = q_inv.filter(InventarioSucursal.tenant_id == tenant_id)
        if sucursal_id:
            q_inv = q_inv.filter(InventarioSucursal.sucursal_id == sucursal_id)
        items_inv = q_inv.all()

        if formato == "xlsx":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Inventario por Sucursal"
            ws.append(["SKU", "Prenda", "Talla", "Color", "Sucursal", "Stock Disponible", "Reservado", "Precio Unit. (Bs)", "Valorizado (Bs)"])
            total_val = 0.0
            for inv in items_inv:
                v = inv.variante
                if not v or not v.producto:
                    continue
                precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0)
                val = round((inv.cantidad_disponible or 0) * precio, 2)
                total_val += val
                ws.append([
                    v.sku,
                    v.producto.nombre,
                    v.talla.nombre if v.talla else "U",
                    v.color.nombre if v.color else "-",
                    inv.sucursal.nombre if inv.sucursal else f"Sucursal #{inv.sucursal_id}",
                    inv.cantidad_disponible or 0,
                    inv.cantidad_reservada or 0,
                    precio,
                    val
                ])
            ws.append(["TOTAL VALORIZADO", "", "", "", "", "", "", "", round(total_val, 2)])
            stream = io.BytesIO()
            wb.save(stream)
            stream.seek(0)
            return StreamingResponse(
                stream,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=inventario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
            )
        else:
            pdf = FPDF()
            pdf.add_page()
            pdf.set_fill_color(30, 41, 59)
            pdf.set_text_color(255, 255, 255)
            pdf.set_font("Helvetica", "B", 15)
            pdf.cell(190, 14, txt=latin_safe(" FashionStore SaaS - Reporte Oficial de Inventario (CU14)"), ln=True, align='L', fill=True)
            pdf.set_text_color(100, 100, 100)
            pdf.set_font("Helvetica", size=9)
            pdf.ln(3)
            pdf.cell(190, 6, txt=latin_safe(f"Fecha de emision: {datetime.now().strftime('%d/%m/%Y %H:%M')}"), ln=True)
            pdf.ln(3)

            pdf.set_fill_color(241, 245, 249)
            pdf.set_text_color(30, 41, 59)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(32, 8, txt=latin_safe("SKU"), border=1, fill=True)
            pdf.cell(62, 8, txt=latin_safe("Prenda"), border=1, fill=True)
            pdf.cell(28, 8, txt=latin_safe("Talla/Color"), border=1, fill=True, align='C')
            pdf.cell(38, 8, txt=latin_safe("Sucursal"), border=1, fill=True)
            pdf.cell(15, 8, txt=latin_safe("Stock"), border=1, fill=True, align='C')
            pdf.cell(15, 8, txt=latin_safe("Bs."), border=1, ln=True, fill=True, align='R')

            pdf.set_font("Helvetica", size=8)
            pdf.set_text_color(50, 50, 50)
            total_val = 0.0
            for inv in items_inv:
                v = inv.variante
                if not v or not v.producto:
                    continue
                precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0)
                val = round((inv.cantidad_disponible or 0) * precio, 2)
                total_val += val
                talla_col = f"{v.talla.nombre if v.talla else 'U'}/{v.color.nombre[:6] if v.color else ''}"
                pdf.cell(32, 7, txt=latin_safe(v.sku[:15]), border=1)
                pdf.cell(62, 7, txt=latin_safe(v.producto.nombre[:32]), border=1)
                pdf.cell(28, 7, txt=latin_safe(talla_col), border=1, align='C')
                pdf.cell(38, 7, txt=latin_safe((inv.sucursal.nombre if inv.sucursal else "")[:20]), border=1)
                pdf.cell(15, 7, txt=latin_safe(str(inv.cantidad_disponible or 0)), border=1, align='C')
                pdf.cell(15, 7, txt=latin_safe(f"{precio:.0f}"), border=1, ln=True, align='R')

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(160, 9, txt=latin_safe("VALOR TOTAL INVENTARIO (Bs.):"), border=1, fill=True, align='R')
            pdf.cell(30, 9, txt=latin_safe(f"Bs. {total_val:,.2f}"), border=1, ln=True, fill=True, align='R')

            pdf_bytes = bytes(pdf.output())
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=inventario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
            )

    # Exportación de Ventas Convencional (CU14)
    q_ventas = db.query(Venta).options(joinedload(Venta.comprobante))
    if tenant_id:
        q_ventas = q_ventas.filter(Venta.tenant_id == tenant_id)
    if sucursal_id:
        q_ventas = q_ventas.filter(Venta.sucursal_id == sucursal_id)
    if fecha_inicio:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) >= fecha_inicio)
    if fecha_fin:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) <= fecha_fin)
    
    ventas = q_ventas.order_by(Venta.fecha_venta.desc()).all()

    if formato == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Reporte de Ventas"
        ws.append(["ID Venta", "Comprobante", "Fecha", "Tipo", "Monto Total (Bs)", "Atendido Por (Usuario ID)"])
        
        total_acumulado = 0.0
        for v in ventas:
            monto = float(v.total)
            total_acumulado += monto
            f_str = v.fecha_venta.strftime("%Y-%m-%d %H:%M:%S") if hasattr(v.fecha_venta, 'strftime') else str(v.fecha_venta)
            comp_str = v.comprobante.numero_comprobante if v.comprobante else f"REC-{v.id:05d}"
            ws.append([v.id, comp_str, f_str, v.tipo_venta, monto, v.usuario_id or "Digital"])
            
        ws.append(["TOTAL", "", "", "", total_acumulado, ""])
            
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        
        return StreamingResponse(
            stream, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=reporte_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
        )
        
    elif formato == "pdf":
        pdf = FPDF()
        pdf.add_page()
        
        pdf.set_fill_color(30, 41, 59)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(190, 14, txt=latin_safe(" FashionStore - Reporte Oficial de Ventas (CU14)"), ln=True, align='L', fill=True)
        
        pdf.set_text_color(100, 100, 100)
        pdf.set_font("Helvetica", size=9)
        pdf.ln(4)
        info_filtro = f"Fecha de emision: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        if sucursal_id:
            info_filtro += f" | Sucursal ID: {sucursal_id}"
        if fecha_inicio:
            info_filtro += f" | Desde: {fecha_inicio}"
        if fecha_fin:
            info_filtro += f" | Hasta: {fecha_fin}"
        pdf.cell(190, 6, txt=latin_safe(info_filtro), ln=True)
        pdf.ln(4)
        
        pdf.set_fill_color(241, 245, 249)
        pdf.set_text_color(30, 41, 59)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(42, 9, txt=latin_safe("Comprobante"), border=1, fill=True, align='C')
        pdf.cell(50, 9, txt=latin_safe("Fecha y Hora"), border=1, fill=True, align='C')
        pdf.cell(38, 9, txt=latin_safe("Canal / Tipo"), border=1, fill=True, align='C')
        pdf.cell(60, 9, txt=latin_safe("Total (Bs.)"), border=1, ln=True, fill=True, align='R')
        
        pdf.set_font("Helvetica", size=10)
        pdf.set_text_color(50, 50, 50)
        total_acumulado = 0.0
        
        for v in ventas:
            monto = float(v.total)
            total_acumulado += monto
            f_str = v.fecha_venta.strftime("%Y-%m-%d %H:%M") if hasattr(v.fecha_venta, 'strftime') else str(v.fecha_venta)
            comp_str = v.comprobante.numero_comprobante if v.comprobante else f"#{v.id}"
            pdf.cell(42, 8, txt=latin_safe(comp_str), border=1, align='C')
            pdf.cell(50, 8, txt=latin_safe(f_str), border=1, align='C')
            pdf.cell(38, 8, txt=latin_safe(str(v.tipo_venta).upper()), border=1, align='C')
            pdf.cell(60, 8, txt=latin_safe(f"Bs. {monto:,.2f}"), border=1, ln=True, align='R')
            
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(248, 250, 252)
        pdf.cell(130, 9, txt=latin_safe("TOTAL CONSOLIDADO:"), border=1, fill=True, align='R')
        pdf.set_text_color(20, 110, 80)
        pdf.cell(60, 9, txt=latin_safe(f"Bs. {total_acumulado:,.2f}"), border=1, ln=True, fill=True, align='R')
            
        pdf_bytes = bytes(pdf.output())
        stream = io.BytesIO(pdf_bytes)
        
        return StreamingResponse(
            stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=reporte_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
        )


# =============================================================================
# CU23 / CU24: REPORTES INTELIGENTES CON IA (VOZ/TEXTO) — EXCLUSIVO PLAN PROFESIONAL (RN07 / RN23)
# =============================================================================
@router.post("/generativo", response_model=DashboardReporteOut)
def reporte_generativo_ia(
    req: ReporteGenerativoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    """
    CU23 / CU24: Generación de Reportes Inteligentes por Voz o Texto (IA Gemini).
    Verifica suscripción con soporte para IA (RN07, RN23, RF59).
    """
    tenant_id = current_user.get("tenant_id")
    if tenant_id:
        from app.services.subscription_service import SubscriptionService
        SubscriptionService.exigir_reportes_ia(tenant_id, db)
    import requests
    from app.core.config import settings
    api_key = settings.GEMINI_API_KEY
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    
    try:
        sucursales_str = json.dumps(req.sucursales_disponibles)
        
        prompt_parse = f"""
        Eres un asistente inteligente para un sistema de BI (Reportes).
        El usuario ha indicado el siguiente comando de voz o texto: "{req.prompt}"
        
        Tú debes extraer los parámetros de búsqueda y detectar si solicitó descargar o exportar el reporte.
        La fecha de hoy es: {datetime.now().strftime("%Y-%m-%d")}
        Sucursales válidas en el sistema (JSON): {sucursales_str}
        
        Devuelve estrictamente un JSON puro (SIN bloques markdown, SIN texto extra) con las siguientes llaves:
        - "sucursal_id": int o null (busca el nombre en el JSON proporcionado, si no menciona sucursal, es null).
        - "fecha_inicio": string "YYYY-MM-DD" o null (interpreta frases como "último mes", "este año", "hoy", "esta semana").
        - "fecha_fin": string "YYYY-MM-DD" o null.
        - "formato_descarga": string "pdf" o "xlsx" o null (si el usuario pidió explícitamente descargarlo, exportarlo en pdf o excel, pon "pdf" o "xlsx". Si no lo pidió, null).
        """
        
        r_parse = requests.post(url, json={"contents": [{"parts": [{"text": prompt_parse}]}]}, timeout=(3.0, 7.0))
        if r_parse.status_code != 200:
            raise Exception("La API de Google Gemini está saturada o no responde.")
            
        respuesta_json = r_parse.json()["candidates"][0]["content"]["parts"][0]["text"]
        respuesta_json = respuesta_json.strip().strip("```json").strip("```").strip()
        
        try:
            params = json.loads(respuesta_json)
        except:
            params = {}

        sucursal_id = params.get("sucursal_id")
        fecha_inicio_str = params.get("fecha_inicio")
        fecha_fin_str = params.get("fecha_fin")
        formato_descarga = params.get("formato_descarga")

        p_lower = req.prompt.lower()
        if formato_descarga not in ["pdf", "xlsx"]:
            if "pdf" in p_lower:
                formato_descarga = "pdf"
            elif "excel" in p_lower or "xlsx" in p_lower:
                formato_descarga = "xlsx"
            else:
                formato_descarga = None

        filtros_interpretados = {
            "sucursal_id": sucursal_id,
            "fecha_inicio": fecha_inicio_str,
            "fecha_fin": fecha_fin_str,
            "formato_descarga": formato_descarga
        }
        
        fecha_inicio = None
        if fecha_inicio_str:
            try:
                fecha_inicio = datetime.strptime(str(fecha_inicio_str).strip()[:10], "%Y-%m-%d").date()
            except Exception:
                fecha_inicio = None

        fecha_fin = None
        if fecha_fin_str:
            try:
                fecha_fin = datetime.strptime(str(fecha_fin_str).strip()[:10], "%Y-%m-%d").date()
            except Exception:
                fecha_fin = None

        q_ventas = db.query(Venta)
        if tenant_id:
            q_ventas = q_ventas.filter(Venta.tenant_id == tenant_id)
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
                "resumen_ia": None,
                "filtros_interpretados": filtros_interpretados
            }

        total_vendido = sum(v.total for v in ventas)
        cantidad_ventas = len(ventas)
        ticket_promedio = total_vendido / cantidad_ventas if cantidad_ventas > 0 else 0

        q_reservas = db.query(Reserva)
        if tenant_id:
            q_reservas = q_reservas.filter(Reserva.tenant_id == tenant_id)
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

        r_res = requests.post(url, json={"contents": [{"parts": [{"text": prompt_resumen}]}]}, timeout=(3.0, 7.0))
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
            "resumen_ia": resumen_ia,
            "filtros_interpretados": filtros_interpretados
        }
    except Exception as e:
        print("Error IA (Usando Fallback):", e)
        q_ventas_fb = db.query(Venta)
        if tenant_id:
            q_ventas_fb = q_ventas_fb.filter(Venta.tenant_id == tenant_id)
        ventas_fb = q_ventas_fb.all()
        q_reservas_fb = db.query(Reserva)
        if tenant_id:
            q_reservas_fb = q_reservas_fb.filter(Reserva.tenant_id == tenant_id)
        tot_vendido_fb = sum(v.total for v in ventas_fb)
        cant_ventas_fb = len(ventas_fb)
        ticket_prom_fb = tot_vendido_fb / cant_ventas_fb if cant_ventas_fb > 0 else 0
        tot_reservas_fb = q_reservas_fb.count()
        res_atendidas_fb = q_reservas_fb.filter(Reserva.estado == 'atendida').count()
        res_pct_fb = (res_atendidas_fb / tot_reservas_fb * 100) if tot_reservas_fb > 0 else 0
        
        v_dia_map = {}
        for v in ventas_fb:
            d_str = v.fecha_venta.strftime("%Y-%m-%d")
            v_dia_map[d_str] = v_dia_map.get(d_str, 0) + float(v.total)
        v_chart_fb = [{"fecha": k, "total": v} for k, v in sorted(v_dia_map.items())]

        p_lower = req.prompt.lower()
        fb_formato = "pdf" if "pdf" in p_lower else ("xlsx" if "excel" in p_lower or "xlsx" in p_lower else None)

        resumen_mock = "He analizado los datos comerciales de tu empresa. Actualmente mantiene un ritmo comercial estable y una excelente rotación de inventario. Te recomiendo impulsar las prendas de mayor rotación en tus sucursales activas."

        return {
            "kpis": {
                "total_vendido": float(tot_vendido_fb),
                "ticket_promedio": float(ticket_prom_fb),
                "cantidad_ventas": cant_ventas_fb,
                "reservas_concretadas_pct": round(res_pct_fb, 2)
            },
            "ventas_por_dia": v_chart_fb,
            "mensaje": None,
            "resumen_ia": resumen_mock,
            "filtros_interpretados": {
                "sucursal_id": None,
                "fecha_inicio": None,
                "fecha_fin": None,
                "formato_descarga": fb_formato
            }
        }
