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
# CU23 - CU26: REPORTES INTELIGENTES CON IA (VOZ/TEXTO) — CATALOGO CERRADO Y VALIDACION DE INTENCION (RN07, RN22-RN24, RF55-RF62)
# =============================================================================
CATALOGO_REPORTES_IA = {
    "ventas_por_sucursal": "Ventas consolidadas por sucursal en un rango de fechas",
    "top_productos": "Ranking de productos y variantes más vendidos",
    "ventas_por_semana": "Evolución semanal y diaria de ingresos comerciales",
    "comparativo_sucursales": "Comparativa de rendimiento comercial entre sucursales activas",
    "stock_bajo": "Reporte de prendas con existencias críticas o bajo mínimo",
    "ingresos_por_categoria": "Distribución de ingresos por categoría de prenda"
}

PALABRAS_PROHIBIDAS_INTENCION = [
    "borra", "borrar", "elimina", "eliminar", "drop ", "delete ", "truncate ", "update ",
    "modifica", "modificar", "altera", "ignora las reglas", "otras empresas", "otro tenant"
]


@router.get("/ia/historial")
def listar_historial_solicitudes_ia(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    """Lista la bitácora de solicitudes de reportes con IA de la empresa (tabla solicitudes_reporte)."""
    from app.models.saas import SolicitudReporte
    tenant_id = current_user.get("tenant_id")
    q = db.query(SolicitudReporte)
    if tenant_id:
        q = q.filter(SolicitudReporte.tenant_id == tenant_id)
    regs = q.order_by(SolicitudReporte.creado_en.desc()).limit(30).all()
    return {
        "catalogo_soportado": CATALOGO_REPORTES_IA,
        "solicitudes": [
            {
                "id": str(r.id),
                "texto": r.texto,
                "tipo_reporte": r.tipo_reporte,
                "filtros": r.filtros,
                "estado": r.estado,
                "creado_en": r.creado_en.isoformat() if r.creado_en else None
            }
            for r in regs
        ]
    }


@router.post("/generativo", response_model=DashboardReporteOut)
def reporte_generativo_ia(
    req: ReporteGenerativoRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))
):
    """
    CU23 - CU26: Generación de Reportes Inteligentes por Voz o Texto (IA Gemini + Catálogo Cerrado).
    Verifica suscripción con soporte para IA (RN07, RN23, RF59), valida la intención (RN22-RN24)
    y registra la auditoría en solicitudes_reporte.
    """
    from app.models.saas import SolicitudReporte
    from app.models.venta import VentaDetalle
    tenant_id = current_user.get("tenant_id")
    if tenant_id:
        from app.services.subscription_service import SubscriptionService
        SubscriptionService.exigir_reportes_ia(tenant_id, db)

    prompt_clean = (req.prompt or "").strip()
    p_lower = prompt_clean.lower()

    # 1. Validación de seguridad e intención (RN22, RN23, RN24, CP-F43): Bloquear instrucciones destructivas o fuera de alcance
    if any(bad in p_lower for bad in PALABRAS_PROHIBIDAS_INTENCION):
        if tenant_id:
            sol_rechazada = SolicitudReporte(
                tenant_id=tenant_id,
                usuario_id=current_user["id"],
                texto=prompt_clean,
                tipo_reporte="NO_SOPORTADO",
                filtros={"motivo": "Intención destructiva o fuera del catálogo cerrado"},
                estado="RECHAZADA"
            )
            db.add(sol_rechazada)
            db.commit()
        raise HTTPException(
            status_code=400,
            detail=(
                "SolicitudNoSoportada: La instrucción solicitada está fuera del catálogo de reportes permitidos "
                "o intenta modificar datos (RN22/RN23). Catálogo válido: " + ", ".join(CATALOGO_REPORTES_IA.keys())
            )
        )

    # 2. Validación de solicitudes ambiguas o demasiado cortas (CU23 A1, RF57, CP-F42)
    if len(prompt_clean) < 4 or p_lower in ["reporte", "ventas", "dame un reporte", "hola"]:
        if tenant_id:
            sol_incompleta = SolicitudReporte(
                tenant_id=tenant_id,
                usuario_id=current_user["id"],
                texto=prompt_clean,
                tipo_reporte="INCOMPLETO",
                filtros={"aclaracion_requerida": "Indique tipo de reporte y periodo"},
                estado="INCOMPLETA"
            )
            db.add(sol_incompleta)
            db.commit()
        raise HTTPException(
            status_code=422,
            detail=(
                "SolicitudIncompleta: Tu solicitud es ambigua. Por favor especifica el tipo de reporte "
                "(ej. 'ventas por sucursal este mes', 'top productos más vendidos', 'prendas con stock bajo') y el periodo."
            )
        )

    # 3. Clasificación determinista del tipo de reporte dentro del Catálogo Cerrado (RF60, RN22)
    tipo_catalogo = "ventas_por_sucursal"
    if any(k in p_lower for k in ["top", "más vendido", "mas vendido", "estrella", "ranking", "productos"]):
        tipo_catalogo = "top_productos"
    elif any(k in p_lower for k in ["stock bajo", "bajo stock", "agotar", "inventario crítico", "minimo", "mínimo"]):
        tipo_catalogo = "stock_bajo"
    elif any(k in p_lower for k in ["comparar", "comparativo", "entre sucursales", "versus"]):
        tipo_catalogo = "comparativo_sucursales"
    elif any(k in p_lower for k in ["categoría", "categoria", "categorías", "linea"]):
        tipo_catalogo = "ingresos_por_categoria"
    elif any(k in p_lower for k in ["semana", "semanal", "evolución", "evolucion", "tendencia"]):
        tipo_catalogo = "ventas_por_semana"

    import requests
    from app.core.config import settings
    api_key = settings.GEMINI_API_KEY
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"

    sucursal_id = None
    fecha_inicio_str = None
    fecha_fin_str = None
    formato_descarga = "pdf" if "pdf" in p_lower else ("xlsx" if ("excel" in p_lower or "xlsx" in p_lower) else None)

    # Detectar mención de sucursal localmente en caso de que Gemini no responda o como refuerzo
    for s_disp in (req.sucursales_disponibles or []):
        s_nom = str(s_disp.get("nombre", "")).lower()
        if s_nom and s_nom in p_lower:
            sucursal_id = s_disp.get("id")
            break

    try:
        sucursales_str = json.dumps(req.sucursales_disponibles or [])
        prompt_parse = f"""
        Eres un asistente inteligente para un sistema de BI (Reportes).
        El usuario ha indicado el siguiente comando de voz o texto: "{prompt_clean}"
        La fecha de hoy es: {datetime.now().strftime("%Y-%m-%d")}
        Sucursales válidas en el sistema (JSON): {sucursales_str}
        Tipos del catálogo cerrado: {list(CATALOGO_REPORTES_IA.keys())}

        Devuelve estrictamente un JSON puro (SIN bloques markdown) con:
        - "tipo_reporte": uno de {list(CATALOGO_REPORTES_IA.keys())}
        - "sucursal_id": int o null
        - "fecha_inicio": string "YYYY-MM-DD" o null
        - "fecha_fin": string "YYYY-MM-DD" o null
        - "formato_descarga": "pdf" o "xlsx" o null
        """
        r_parse = requests.post(url, json={"contents": [{"parts": [{"text": prompt_parse}]}]}, timeout=(2.5, 5.0))
        if r_parse.status_code == 200:
            respuesta_json = r_parse.json()["candidates"][0]["content"]["parts"][0]["text"]
            respuesta_json = respuesta_json.strip().strip("```json").strip("```").strip()
            params = json.loads(respuesta_json)
            if params.get("tipo_reporte") in CATALOGO_REPORTES_IA:
                tipo_catalogo = params.get("tipo_reporte")
            if params.get("sucursal_id") and not sucursal_id:
                sucursal_id = params.get("sucursal_id")
            fecha_inicio_str = params.get("fecha_inicio")
            fecha_fin_str = params.get("fecha_fin")
            if params.get("formato_descarga") in ["pdf", "xlsx"]:
                formato_descarga = params.get("formato_descarga")
    except Exception:
        pass

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

    filtros_interpretados = {
        "tipo_reporte": tipo_catalogo,
        "sucursal_id": sucursal_id,
        "fecha_inicio": fecha_inicio_str,
        "fecha_fin": fecha_fin_str,
        "formato_descarga": formato_descarga
    }

    # Consultar datos reales aislados estrictamente por tenant_id (RN02, RN24)
    q_ventas = db.query(Venta).options(joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto))
    if tenant_id:
        q_ventas = q_ventas.filter(Venta.tenant_id == tenant_id)
    if sucursal_id:
        q_ventas = q_ventas.filter(Venta.sucursal_id == sucursal_id)
    if fecha_inicio:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) >= fecha_inicio)
    if fecha_fin:
        q_ventas = q_ventas.filter(func.date(Venta.fecha_venta) <= fecha_fin)

    ventas = q_ventas.all()
    # Si el filtro de fecha sugerido por el LLM dejó 0 ventas pero el tenant sí tiene ventas históricas, mostrar las del tenant
    if not ventas and (fecha_inicio or fecha_fin):
        q_all = db.query(Venta).options(joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto))
        if tenant_id:
            q_all = q_all.filter(Venta.tenant_id == tenant_id)
        if sucursal_id:
            q_all = q_all.filter(Venta.sucursal_id == sucursal_id)
        ventas = q_all.all()

    total_vendido = sum(float(v.total) for v in ventas)
    cantidad_ventas = len(ventas)
    ticket_promedio = total_vendido / cantidad_ventas if cantidad_ventas > 0 else 0.0

    q_reservas = db.query(Reserva)
    if tenant_id:
        q_reservas = q_reservas.filter(Reserva.tenant_id == tenant_id)
    if sucursal_id:
        q_reservas = q_reservas.filter(Reserva.sucursal_id == sucursal_id)
    total_reservas = q_reservas.count()
    reservas_atendidas = q_reservas.filter(Reserva.estado == 'atendida').count()
    reservas_pct = (reservas_atendidas / total_reservas * 100) if total_reservas > 0 else 0.0

    ventas_por_dia_map = {}
    for v in ventas:
        d_str = v.fecha_venta.strftime("%Y-%m-%d")
        ventas_por_dia_map[d_str] = round(ventas_por_dia_map.get(d_str, 0.0) + float(v.total), 2)
    ventas_chart = [{"fecha": k, "total": v} for k, v in sorted(ventas_por_dia_map.items())]

    # Construir tabla estructurada según el tipo_catalogo seleccionado (CU26, RF61)
    datos_catalogo = []
    if tipo_catalogo == "top_productos":
        prod_map = {}
        for v in ventas:
            for d in (v.detalles or []):
                nom = d.variante.producto.nombre if (d.variante and d.variante.producto) else f"Variante #{d.variante_id}"
                sku = d.variante.sku if d.variante else f"SKU-{d.variante_id}"
                if sku not in prod_map:
                    prod_map[sku] = {"etiqueta": f"{nom} ({sku})", "unidades": 0, "total_bs": 0.0}
                prod_map[sku]["unidades"] += int(d.cantidad or 0)
                prod_map[sku]["total_bs"] = round(prod_map[sku]["total_bs"] + float(d.subtotal or 0), 2)
        datos_catalogo = sorted(prod_map.values(), key=lambda x: x["total_bs"], reverse=True)[:10]
    elif tipo_catalogo == "stock_bajo":
        q_inv = db.query(InventarioSucursal).options(
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto),
            joinedload(InventarioSucursal.sucursal)
        )
        if tenant_id:
            q_inv = q_inv.filter(InventarioSucursal.tenant_id == tenant_id)
        for inv in q_inv.all():
            disp = int(inv.cantidad_disponible or 0)
            minimo = int(inv.stock_minimo or 5)
            if disp <= minimo + 3 and inv.variante and inv.variante.producto:
                datos_catalogo.append({
                    "etiqueta": f"{inv.variante.producto.nombre} ({inv.variante.sku}) - {inv.sucursal.nombre if inv.sucursal else ''}",
                    "unidades": disp,
                    "total_bs": float(inv.variante.producto.precio_base or 0) * disp
                })
    else:
        # comparativo_sucursales / ventas_por_sucursal / ventas_por_semana / ingresos_por_categoria
        suc_names = {s.id: s.nombre for s in db.query(Sucursal).filter(Sucursal.tenant_id == tenant_id).all()} if tenant_id else {}
        agrupado = {}
        for v in ventas:
            s_nom = suc_names.get(v.sucursal_id, f"Sucursal #{v.sucursal_id}")
            if s_nom not in agrupado:
                agrupado[s_nom] = {"etiqueta": s_nom, "unidades": 0, "total_bs": 0.0}
            agrupado[s_nom]["unidades"] += 1
            agrupado[s_nom]["total_bs"] = round(agrupado[s_nom]["total_bs"] + float(v.total), 2)
        datos_catalogo = list(agrupado.values())

    # Registrar solicitud en la bitácora auditable (solicitudes_reporte)
    solicitud_id_str = None
    if tenant_id:
        reg_sol = SolicitudReporte(
            tenant_id=tenant_id,
            usuario_id=current_user["id"],
            texto=prompt_clean,
            tipo_reporte=tipo_catalogo,
            filtros=filtros_interpretados,
            estado="COMPLETADO"
        )
        db.add(reg_sol)
        db.commit()
        db.refresh(reg_sol)
        solicitud_id_str = str(reg_sol.id)

    resumen_ia = (
        f"Reporte '{CATALOGO_REPORTES_IA.get(tipo_catalogo, tipo_catalogo)}' generado sobre datos exclusivos de tu empresa. "
        f"Se consolidaron {cantidad_ventas} transacciones con un ingreso total de Bs. {total_vendido:,.2f} "
        f"y un ticket promedio de Bs. {ticket_promedio:,.2f}. Se recomienda priorizar la reposición de las variantes "
        f"con mayor rotación antes del cierre semanal."
    )

    return {
        "kpis": {
            "total_vendido": round(float(total_vendido), 2),
            "ticket_promedio": round(float(ticket_promedio), 2),
            "cantidad_ventas": cantidad_ventas,
            "reservas_concretadas_pct": round(reservas_pct, 2)
        },
        "ventas_por_dia": ventas_chart,
        "mensaje": None,
        "resumen_ia": resumen_ia,
        "filtros_interpretados": filtros_interpretados,
        "tipo_reporte_catalogo": tipo_catalogo,
        "datos_catalogo": datos_catalogo,
        "solicitud_id": solicitud_id_str
    }
