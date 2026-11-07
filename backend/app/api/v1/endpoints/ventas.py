import uuid
import io
import base64
import qrcode
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.venta import Venta, VentaDetalle, Pago, Comprobante, CambioPrenda
from app.models.interacciones import Carrito, CarritoDetalle
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.producto import Producto, ProductoVariante
from app.models.sucursal import Sucursal
from app.models.usuario import Cliente, Usuario
from app.services.push_service import emitir_notificacion_push

router = APIRouter()

PLAZO_CAMBIO_DIAS_RN20 = 15

class CheckoutInput(BaseModel):
    metodo_entrega: str = "retiro_tienda"
    direccion_envio: Optional[str] = None
    sucursal_retiro_id: Optional[int] = None

class PosItemInput(BaseModel):
    variante_id: int
    cantidad: int
    precio_unitario: float

class PosVentaInput(BaseModel):
    sucursal_id: int
    metodo_pago: str
    items: List[PosItemInput]
    cliente_id: Optional[int] = None

class PagoInput(BaseModel):
    metodo_pago: str
    monto: float
    simular_rechazo: Optional[bool] = False
    numero_tarjeta: Optional[str] = None

class CambioPrendaInput(BaseModel):
    venta_id: int
    sucursal_id: int
    variante_devuelta_id: int
    variante_entregada_id: int
    cantidad: int = 1
    motivo: str = "Cambio de talla o color"
    metodo_pago_diferencia: Optional[str] = "efectivo"
    autorizado_excepcion: Optional[bool] = False
    justificacion_excepcion: Optional[str] = None

def get_cliente_obj(current_user: dict, db: Session) -> Cliente:
    if current_user["user_type"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo clientes pueden hacer compras digitales.")
    return db.query(Cliente).filter(Cliente.id == current_user["id"]).first()

def _formatear_venta_completa(v: Venta) -> dict:
    ahora = datetime.utcnow()
    fecha_v = v.fecha_venta.replace(tzinfo=None) if v.fecha_venta else ahora
    dias_transcurridos = max(0, (ahora - fecha_v).days)
    dentro_plazo = dias_transcurridos <= PLAZO_CAMBIO_DIAS_RN20

    return {
        "id": v.id,
        "tenant_id": str(v.tenant_id) if v.tenant_id else None,
        "tipo_venta": v.tipo_venta,
        "sucursal_id": v.sucursal_id,
        "cliente_id": v.cliente_id,
        "cliente_nombre": f"{v.cliente.nombres} {v.cliente.apellidos}".strip() if v.cliente else "Cliente en Tienda (POS)",
        "fecha_venta": v.fecha_venta.isoformat() if v.fecha_venta else None,
        "dias_transcurridos": dias_transcurridos,
        "plazo_maximo_dias": PLAZO_CAMBIO_DIAS_RN20,
        "dentro_plazo_rn20": dentro_plazo,
        "subtotal": float(v.subtotal),
        "costo_envio": float(v.costo_envio or 0),
        "total": float(v.total),
        "estado": v.estado,
        "metodo_entrega": v.metodo_entrega,
        "numero_comprobante": v.comprobante.numero_comprobante if v.comprobante else f"REC-{v.id:05d}",
        "items": [{
            "detalle_id": d.id,
            "variante_id": d.variante_id,
            "producto_id": d.variante.producto_id if d.variante else None,
            "producto": d.variante.producto.nombre if d.variante and d.variante.producto else "Prenda",
            "sku": d.variante.sku if d.variante else f"VAR-{d.variante_id}",
            "imagen_url": (d.variante.imagen_url or d.variante.producto.imagen_url) if d.variante and d.variante.producto else None,
            "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "U",
            "color": d.variante.color.nombre if d.variante and d.variante.color else "Único",
            "color_hex": d.variante.color.codigo_hex if d.variante and d.variante.color else "#333333",
            "cantidad": d.cantidad,
            "precio_unitario": float(d.precio_unitario),
            "subtotal": float(d.subtotal)
        } for d in v.detalles]
    }

@router.post("/checkout", status_code=status.HTTP_201_CREATED)
def checkout(data: CheckoutInput, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-19: Crear orden desde el carrito."""
    cliente = get_cliente_obj(current_user, db)
    carrito = db.query(Carrito).filter(Carrito.cliente_id == cliente.id, Carrito.activo == True).first()
    if not carrito:
        raise HTTPException(status_code=400, detail="El carrito esta vacio.")
    items = db.query(CarritoDetalle).options(joinedload(CarritoDetalle.variante).joinedload(ProductoVariante.producto)).filter(CarritoDetalle.carrito_id == carrito.id).all()
    if not items:
        raise HTTPException(status_code=400, detail="El carrito esta vacio.")
    subtotal = 0.0
    tenant_id_orden = None
    for i in items:
        v = i.variante
        if v and v.producto and v.producto.tenant_id and not tenant_id_orden:
            tenant_id_orden = v.producto.tenant_id
        precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0) if v and v.producto else 0
        subtotal += precio * i.cantidad
    costo_envio = 30.0 if data.metodo_entrega == "delivery" else 0.0
    total = subtotal + costo_envio
    venta = Venta(
        tenant_id=tenant_id_orden,
        cliente_id=cliente.id,
        sucursal_id=data.sucursal_retiro_id,
        tipo_venta="digital",
        metodo_entrega=data.metodo_entrega,
        direccion_envio=data.direccion_envio,
        costo_envio=costo_envio,
        subtotal=subtotal,
        total=total,
        estado="pendiente_pago",
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    for i in items:
        v = i.variante
        precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0) if v and v.producto else 0
        det = VentaDetalle(
            tenant_id=tenant_id_orden,
            venta_id=venta.id,
            variante_id=i.variante_id,
            cantidad=i.cantidad,
            precio_unitario=precio,
            subtotal=precio * i.cantidad
        )
        db.add(det)
    db.commit()
    # Generar QR Simple interoperable en base64 con el payload de cobro
    qr_data = f"FASHIONSTORE|ORDEN:{venta.id}|TOTAL:{float(venta.total):.2f}|BS|PAGOSIMPLE"
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#09090b", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    return {
        "venta_id": venta.id,
        "id": venta.id,
        "subtotal": subtotal,
        "costo_envio": costo_envio,
        "total": total,
        "estado": venta.estado,
        "metodo_entrega": venta.metodo_entrega,
        "direccion_envio": venta.direccion_envio,
        "qr_image": qr_base64,
        "mensaje": "Orden creada. Procede al pago."
    }

@router.post("/pagar/{venta_id}")
def pagar_venta(venta_id: int, data: PagoInput, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-20: Procesar pago (simulado) y descontar inventario. Permite simular rechazo de pasarela."""
    venta = db.query(Venta).options(joinedload(Venta.detalles)).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    if venta.estado != "pendiente_pago":
        raise HTTPException(status_code=400, detail=f"La orden ya fue procesada: {venta.estado}")

    # Simulación de aprobación / rechazo
    es_rechazo = bool(data.simular_rechazo) or (
        bool(data.numero_tarjeta) and (
            data.numero_tarjeta.replace(" ", "").startswith("0000") or
            data.numero_tarjeta.replace(" ", "").startswith("9999")
        )
    )

    if es_rechazo:
        ref_rechazo = "TXN-RECH-" + str(uuid.uuid4())[:8].upper()
        pago_rechazado = Pago(
            tenant_id=venta.tenant_id,
            venta_id=venta.id,
            metodo_pago=data.metodo_pago,
            monto=float(data.monto or venta.total),
            estado="rechazado",
            pasarela="Simulado_FashionStore",
            referencia_transaccion=ref_rechazo
        )
        db.add(pago_rechazado)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Transacción Rechazada: La pasarela de pagos denegó la operación (Tarjeta declinada o fondos insuficientes). Ref: {ref_rechazo}"
        )

    if round(float(data.monto), 2) < round(float(venta.total), 2) - 0.05:
        raise HTTPException(status_code=400, detail=f"Monto insuficiente. Se requiere al menos Bs. {float(venta.total):.2f}")

    ref_aprobada = "TXN-" + str(uuid.uuid4())[:8].upper()
    pago = Pago(
        tenant_id=venta.tenant_id,
        venta_id=venta.id,
        metodo_pago=data.metodo_pago,
        monto=float(venta.total),
        estado="aprobado",
        pasarela="Simulado_FashionStore",
        referencia_transaccion=ref_aprobada
    )
    db.add(pago)
    venta.estado = "completada"
    for det in venta.detalles:
        inv = db.query(InventarioSucursal).filter(InventarioSucursal.variante_id == det.variante_id).order_by(InventarioSucursal.cantidad_disponible.desc()).first()
        if inv:
            inv.cantidad_disponible = max(0, inv.cantidad_disponible - det.cantidad)
            if not venta.sucursal_id:
                venta.sucursal_id = inv.sucursal_id
            db.add(MovimientoInventario(
                tenant_id=venta.tenant_id,
                variante_id=det.variante_id,
                sucursal_id=inv.sucursal_id,
                tipo_movimiento="venta",
                cantidad=det.cantidad,
                referencia_tipo="venta",
                referencia_id=venta.id
            ))
            if inv.cantidad_disponible <= (inv.stock_minimo or 3):
                emitir_notificacion_push(
                    titulo="⚠️ Alerta Crítica de Stock Bajo",
                    cuerpo=f"Quedan solo {inv.cantidad_disponible} unidades de la variante #{det.variante_id} en sucursal #{inv.sucursal_id}.",
                    categoria="stock",
                    referencia=str(det.variante_id)
                )
    num_comp = "COMP-" + str(uuid.uuid4())[:8].upper()
    comprobante = Comprobante(
        tenant_id=venta.tenant_id,
        venta_id=venta.id,
        numero_comprobante=num_comp,
        tipo="recibo"
    )
    db.add(comprobante)
    if current_user["user_type"] == "cliente":
        carrito = db.query(Carrito).filter(Carrito.cliente_id == venta.cliente_id, Carrito.activo == True).first()
        if carrito:
            db.query(CarritoDetalle).filter(CarritoDetalle.carrito_id == carrito.id).delete()
    db.commit()
    emitir_notificacion_push(
        titulo=f"💳 Compra Confirmada • {num_comp}",
        cuerpo=f"Pago aprobado por Bs. {float(venta.total):.2f} ({data.metodo_pago.upper()}). ¡Gracias por comprar en FashionStore!",
        categoria="venta",
        referencia=num_comp
    )
    return {"mensaje": "Pago aprobado. Compra completada.", "numero_comprobante": num_comp, "venta_id": venta.id, "total_pagado": data.monto, "referencia_transaccion": ref_aprobada}

@router.post("/pos", status_code=status.HTTP_201_CREATED)
def venta_pos(data: PosVentaInput, db: Session = Depends(get_db), current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))):
    """CU12: Venta presencial en Punto de Venta (POS)."""
    if not data.items:
        raise HTTPException(status_code=400, detail="Agrega al menos una prenda para registrar la venta POS.")
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        suc = db.query(Sucursal).filter(Sucursal.id == data.sucursal_id).first()
        if suc and suc.tenant_id:
            tenant_id = str(suc.tenant_id)
    tenant_uuid = uuid.UUID(str(tenant_id)) if tenant_id else None

    subtotal = sum(i.precio_unitario * i.cantidad for i in data.items)
    venta = Venta(
        tenant_id=tenant_uuid,
        tipo_venta="presencial",
        sucursal_id=data.sucursal_id,
        usuario_id=current_user["id"],
        cliente_id=data.cliente_id,
        metodo_entrega="retiro_tienda",
        subtotal=subtotal,
        total=subtotal,
        estado="completada"
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    for i in data.items:
        det = VentaDetalle(
            tenant_id=tenant_uuid,
            venta_id=venta.id,
            variante_id=i.variante_id,
            cantidad=i.cantidad,
            precio_unitario=i.precio_unitario,
            subtotal=i.precio_unitario * i.cantidad
        )
        db.add(det)
        inv = db.query(InventarioSucursal).filter(
            InventarioSucursal.variante_id == i.variante_id,
            InventarioSucursal.sucursal_id == data.sucursal_id
        ).first()
        if inv:
            inv.cantidad_disponible = max(0, inv.cantidad_disponible - i.cantidad)
            db.add(MovimientoInventario(
                tenant_id=tenant_uuid,
                variante_id=i.variante_id,
                sucursal_id=data.sucursal_id,
                usuario_id=current_user["id"],
                tipo_movimiento="venta",
                cantidad=i.cantidad,
                referencia_tipo="venta_pos",
                referencia_id=venta.id,
                observaciones="Venta presencial POS (CU12)"
            ))
            if inv.cantidad_disponible <= (inv.stock_minimo or 3):
                emitir_notificacion_push(
                    titulo="⚠️ Alerta Crítica de Stock en Tienda",
                    cuerpo=f"Variante #{i.variante_id} quedó con solo {inv.cantidad_disponible} unidad(es) en Sucursal #{data.sucursal_id}.",
                    categoria="stock",
                    referencia=str(i.variante_id)
                )
    pago = Pago(
        tenant_id=tenant_uuid,
        venta_id=venta.id,
        metodo_pago=data.metodo_pago,
        monto=subtotal,
        estado="aprobado",
        pasarela="POS_Fisico",
        referencia_transaccion="POS-TXN-" + str(uuid.uuid4())[:6].upper()
    )
    db.add(pago)
    num_comp = "POS-" + str(uuid.uuid4())[:8].upper()
    db.add(Comprobante(
        tenant_id=tenant_uuid,
        venta_id=venta.id,
        numero_comprobante=num_comp,
        tipo="recibo"
    ))
    db.commit()
    emitir_notificacion_push(
        titulo=f"🧾 Venta POS Registrada ({num_comp})",
        cuerpo=f"Nueva venta en caja por Bs. {float(subtotal):.2f} ({data.metodo_pago.upper()}).",
        categoria="venta",
        referencia=num_comp
    )
    return {
        "mensaje": "Venta POS registrada exitosamente.",
        "venta_id": venta.id,
        "numero_comprobante": num_comp,
        "total": subtotal
    }

# =============================================================================
# CU12 & CU13: OPERACIONES POS Y GESTIÓN DE CAMBIO DE PRENDA (RN20, RN21)
# =============================================================================
@router.get("/pos/recientes")
def listar_ventas_recientes_pos(
    sucursal_id: Optional[int] = None,
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """Lista las últimas ventas confirmadas de la empresa para seleccionarlas rápido en CU13."""
    tenant_id = current_user.get("tenant_id")
    q = db.query(Venta).options(
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto),
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.talla),
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.color),
        joinedload(Venta.comprobante),
        joinedload(Venta.cliente)
    ).filter(Venta.estado == "completada")

    if tenant_id:
        q = q.filter(Venta.tenant_id == tenant_id)
    if sucursal_id:
        q = q.filter((Venta.sucursal_id == sucursal_id) | (Venta.sucursal_id == None))

    ventas = q.order_by(Venta.fecha_venta.desc()).limit(limit).all()
    return [_formatear_venta_completa(v) for v in ventas]


@router.get("/pos/buscar-comprobante")
def buscar_venta_por_comprobante(
    q: str = Query(..., description="Número de comprobante (POS-XXXX / COMP-XXXX) o ID de venta"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """CU13 Paso 1 y 2: Busca una venta confirmada por número de comprobante o ID y verifica plazo RN20 (15 días)."""
    termino = (q or "").strip().upper().lstrip("#")
    if not termino:
        raise HTTPException(status_code=400, detail="Ingresa un número de comprobante o ID de venta válido.")

    tenant_id = current_user.get("tenant_id")
    query_base = db.query(Venta).options(
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto),
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.talla),
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.color),
        joinedload(Venta.comprobante),
        joinedload(Venta.cliente)
    ).outerjoin(Comprobante, Comprobante.venta_id == Venta.id)

    if tenant_id:
        query_base = query_base.filter(Venta.tenant_id == tenant_id)

    if termino.isdigit():
        venta = query_base.filter((Venta.id == int(termino)) | (Comprobante.numero_comprobante.ilike(f"%{termino}%"))).first()
    else:
        venta = query_base.filter(Comprobante.numero_comprobante.ilike(f"%{termino}%")).first()

    if not venta:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró ninguna venta confirmada con el comprobante o código '{q}' en tu empresa."
        )

    return _formatear_venta_completa(venta)


@router.get("/pos/catalogo-sucursal/{sucursal_id}")
def obtener_catalogo_variantes_sucursal(
    sucursal_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """Devuelve todas las variantes con stock disponible en la sucursal de la empresa para Venta POS (CU12) y Cambio de Prenda (CU13)."""
    tenant_id = current_user.get("tenant_id")
    q = db.query(InventarioSucursal).options(
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto).joinedload(Producto.categoria),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.talla),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.color)
    ).filter(InventarioSucursal.sucursal_id == sucursal_id)

    if tenant_id:
        q = q.filter(InventarioSucursal.tenant_id == tenant_id)

    inventarios = q.all()
    resultado = []
    for inv in inventarios:
        v = inv.variante
        if not v or not v.producto or not v.producto.activo:
            continue
        precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0)
        stock_libre = max(0, (inv.cantidad_disponible or 0) - (inv.cantidad_reservada or 0))
        resultado.append({
            "variante_id": v.id,
            "producto_id": v.producto.id,
            "producto_nombre": v.producto.nombre,
            "categoria": v.producto.categoria.nombre if v.producto.categoria else "General",
            "sku": v.sku,
            "talla": v.talla.nombre if v.talla else "U",
            "color": v.color.nombre if v.color else "Único",
            "color_hex": v.color.codigo_hex if v.color else "#333333",
            "imagen_url": v.imagen_url or v.producto.imagen_url,
            "precio_unitario": precio,
            "cantidad_disponible": inv.cantidad_disponible,
            "stock_libre": stock_libre
        })
    return resultado


@router.post("/cambio-prenda", status_code=status.HTTP_201_CREATED)
def registrar_cambio_prenda(
    data: CambioPrendaInput,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """
    CU13: Gestionar cambio de prenda (RF21, RN20, RN21).
    1. Valida que la venta exista y pertenezca a la empresa (tenant_id).
    2. Verifica el plazo máximo de 15 días (RN20) o exige autorización excepcional con justificación (Flujo Alterno A1).
    3. Calcula diferencia de precio entre la prenda devuelta y la prenda nueva.
    4. En una transacción atómica (RN21):
       - Incrementa stock de la prenda devuelta (+cantidad, ENTRADA_CAMBIO).
       - Descuenta stock de la prenda entregada (-cantidad, SALIDA_CAMBIO).
       - Registra el cambio en `cambio_prenda` y emite comprobante `CAM-XXXX`.
    """
    if data.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad a cambiar debe ser al menos 1 unidad.")
    if data.variante_devuelta_id == data.variante_entregada_id:
        raise HTTPException(status_code=400, detail="Selecciona una variante diferente (otra talla, color o prenda) para realizar el cambio.")

    tenant_id = current_user.get("tenant_id")
    venta = db.query(Venta).options(
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto),
        joinedload(Venta.comprobante)
    ).filter(Venta.id == data.venta_id).first()

    if not venta:
        raise HTTPException(status_code=404, detail="La venta original no existe.")
    if tenant_id and venta.tenant_id and str(venta.tenant_id) != str(tenant_id):
        raise HTTPException(status_code=403, detail="Esta venta no pertenece a tu empresa.")
    if venta.estado != "completada":
        raise HTTPException(status_code=400, detail=f"Solo se permiten cambios sobre ventas completadas (Estado actual: {venta.estado}).")

    # Regla de Negocio RN20: Verificar plazo de 15 días
    ahora = datetime.utcnow()
    fecha_v = venta.fecha_venta.replace(tzinfo=None) if venta.fecha_venta else ahora
    dias_transcurridos = max(0, (ahora - fecha_v).days)

    if dias_transcurridos > PLAZO_CAMBIO_DIAS_RN20:
        if not data.autorizado_excepcion or not (data.justificacion_excepcion or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"RN20: La venta tiene {dias_transcurridos} días de antigüedad (supera el plazo máximo de {PLAZO_CAMBIO_DIAS_RN20} días). Para proceder, activa la Autorización Excepcional de Gerente/Encargado e ingresa la justificación."
            )

    # Verificar que la variante devuelta forme parte de la venta original
    detalle_original = next((d for d in venta.detalles if d.variante_id == data.variante_devuelta_id), None)
    if not detalle_original:
        raise HTTPException(status_code=400, detail="La prenda seleccionada como devuelta no pertenece al comprobante de venta original.")
    if data.cantidad > detalle_original.cantidad:
        raise HTTPException(
            status_code=400,
            detail=f"No puedes devolver {data.cantidad} unidad(es) porque en la venta original solo se adquirieron {detalle_original.cantidad} unidad(es)."
        )

    # Verificar la variante nueva y su stock en la sucursal
    var_nueva = db.query(ProductoVariante).options(
        joinedload(ProductoVariante.producto),
        joinedload(ProductoVariante.talla),
        joinedload(ProductoVariante.color)
    ).filter(ProductoVariante.id == data.variante_entregada_id).first()
    if not var_nueva or not var_nueva.producto:
        raise HTTPException(status_code=404, detail="La variante de reemplazo no existe.")

    inv_nueva = db.query(InventarioSucursal).filter(
        InventarioSucursal.variante_id == data.variante_entregada_id,
        InventarioSucursal.sucursal_id == data.sucursal_id
    ).first()
    if not inv_nueva or inv_nueva.cantidad_disponible < data.cantidad:
        disp = inv_nueva.cantidad_disponible if inv_nueva else 0
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente para la prenda de reemplazo en esta sucursal (Disponible: {disp}, Solicitado: {data.cantidad})."
        )

    # Cálculo de precios y diferencia
    precio_unit_devuelto = float(detalle_original.precio_unitario)
    precio_unit_nuevo = float(var_nueva.producto.precio_base or 0) + float(var_nueva.precio_adicional or 0)
    subtotal_devuelto = round(precio_unit_devuelto * data.cantidad, 2)
    subtotal_entregado = round(precio_unit_nuevo * data.cantidad, 2)
    diferencia = round(subtotal_entregado - subtotal_devuelto, 2)

    tenant_uuid = venta.tenant_id or (uuid.UUID(str(tenant_id)) if tenant_id else None)
    num_cambio = "CAM-" + str(uuid.uuid4())[:8].upper()

    # RN21: Transacción atómica de Kárdex (Entrada de devuelta + Salida de entregada)
    inv_devuelta = db.query(InventarioSucursal).filter(
        InventarioSucursal.variante_id == data.variante_devuelta_id,
        InventarioSucursal.sucursal_id == data.sucursal_id
    ).first()
    if not inv_devuelta:
        inv_devuelta = InventarioSucursal(
            tenant_id=tenant_uuid,
            variante_id=data.variante_devuelta_id,
            sucursal_id=data.sucursal_id,
            cantidad_disponible=0,
            cantidad_reservada=0,
            stock_minimo=5
        )
        db.add(inv_devuelta)
        db.flush()

    inv_devuelta.cantidad_disponible += data.cantidad
    inv_nueva.cantidad_disponible = max(0, inv_nueva.cantidad_disponible - data.cantidad)

    # Movimiento 1: ENTRADA_CAMBIO (devolucion)
    db.add(MovimientoInventario(
        tenant_id=tenant_uuid,
        variante_id=data.variante_devuelta_id,
        sucursal_id=data.sucursal_id,
        usuario_id=current_user["id"],
        tipo_movimiento="devolucion",
        cantidad=data.cantidad,
        referencia_tipo="ENTRADA_CAMBIO",
        referencia_id=venta.id,
        observaciones=f"CU13 Entrada por cambio {num_cambio}: {data.motivo}"
    ))

    # Movimiento 2: SALIDA_CAMBIO (venta)
    db.add(MovimientoInventario(
        tenant_id=tenant_uuid,
        variante_id=data.variante_entregada_id,
        sucursal_id=data.sucursal_id,
        usuario_id=current_user["id"],
        tipo_movimiento="venta",
        cantidad=data.cantidad,
        referencia_tipo="SALIDA_CAMBIO",
        referencia_id=venta.id,
        observaciones=f"CU13 Salida por cambio {num_cambio}: {data.motivo}"
    ))

    # Si hay diferencia positiva a cobrar, registrar pago complementario
    if diferencia > 0:
        db.add(Pago(
            tenant_id=tenant_uuid,
            venta_id=venta.id,
            metodo_pago=data.metodo_pago_diferencia or "efectivo",
            monto=diferencia,
            estado="aprobado",
            pasarela="POS_Cambio_CU13",
            referencia_transaccion=num_cambio
        ))

    cambio = CambioPrenda(
        tenant_id=tenant_uuid,
        venta_id=venta.id,
        sucursal_id=data.sucursal_id,
        variante_devuelta_id=data.variante_devuelta_id,
        variante_entregada_id=data.variante_entregada_id,
        cantidad=data.cantidad,
        precio_devuelto=subtotal_devuelto,
        precio_entregado=subtotal_entregado,
        diferencia=diferencia,
        motivo=data.motivo,
        autorizado_excepcion=bool(data.autorizado_excepcion),
        justificacion_excepcion=data.justificacion_excepcion,
        usuario_id=current_user["id"],
        numero_comprobante_cambio=num_cambio
    )
    db.add(cambio)
    db.commit()
    db.refresh(cambio)

    dif_texto = (
        f"Diferencia cobrada: +Bs. {diferencia:.2f}" if diferencia > 0
        else (f"Saldo a favor del cliente: Bs. {abs(diferencia):.2f}" if diferencia < 0 else "Cambio sin diferencia (Bs. 0.00)")
    )
    emitir_notificacion_push(
        titulo=f"🔄 Cambio de Prenda Confirmado • {num_cambio}",
        cuerpo=f"Comprobante origen {venta.comprobante.numero_comprobante if venta.comprobante else f'#{venta.id}'}. {dif_texto}. Kárdex actualizado.",
        categoria="venta",
        referencia=num_cambio
    )

    return {
        "mensaje": "Cambio de prenda registrado exitosamente en el Kárdex (RN20 / RN21).",
        "cambio_id": cambio.id,
        "numero_comprobante_cambio": num_cambio,
        "venta_id": venta.id,
        "comprobante_original": venta.comprobante.numero_comprobante if venta.comprobante else f"REC-{venta.id:05d}",
        "cantidad": data.cantidad,
        "precio_devuelto": subtotal_devuelto,
        "precio_entregado": subtotal_entregado,
        "diferencia": diferencia,
        "autorizado_excepcion": bool(data.autorizado_excepcion),
        "creado_en": cambio.creado_en.isoformat()
    }


@router.get("/cambios/historial")
def listar_historial_cambios(
    sucursal_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """Devuelve el historial de cambios de prenda (CU13) de la empresa actual."""
    tenant_id = current_user.get("tenant_id")
    q = db.query(CambioPrenda).options(
        joinedload(CambioPrenda.venta).joinedload(Venta.comprobante),
        joinedload(CambioPrenda.variante_devuelta).joinedload(ProductoVariante.producto),
        joinedload(CambioPrenda.variante_devuelta).joinedload(ProductoVariante.talla),
        joinedload(CambioPrenda.variante_devuelta).joinedload(ProductoVariante.color),
        joinedload(CambioPrenda.variante_entregada).joinedload(ProductoVariante.producto),
        joinedload(CambioPrenda.variante_entregada).joinedload(ProductoVariante.talla),
        joinedload(CambioPrenda.variante_entregada).joinedload(ProductoVariante.color)
    )
    if tenant_id:
        q = q.filter(CambioPrenda.tenant_id == tenant_id)
    if sucursal_id:
        q = q.filter(CambioPrenda.sucursal_id == sucursal_id)

    cambios = q.order_by(CambioPrenda.creado_en.desc()).limit(50).all()
    resultado = []
    for c in cambios:
        vd = c.variante_devuelta
        ve = c.variante_entregada
        resultado.append({
            "id": c.id,
            "numero_comprobante_cambio": c.numero_comprobante_cambio,
            "venta_id": c.venta_id,
            "comprobante_original": c.venta.comprobante.numero_comprobante if c.venta and c.venta.comprobante else f"REC-{c.venta_id:05d}",
            "sucursal_id": c.sucursal_id,
            "cantidad": c.cantidad,
            "prenda_devuelta": f"{vd.producto.nombre} ({vd.talla.nombre if vd.talla else 'U'} / {vd.color.nombre if vd.color else ''})" if vd and vd.producto else f"Variante #{c.variante_devuelta_id}",
            "prenda_entregada": f"{ve.producto.nombre} ({ve.talla.nombre if ve.talla else 'U'} / {ve.color.nombre if ve.color else ''})" if ve and ve.producto else f"Variante #{c.variante_entregada_id}",
            "precio_devuelto": float(c.precio_devuelto),
            "precio_entregado": float(c.precio_entregado),
            "diferencia": float(c.diferencia),
            "motivo": c.motivo,
            "autorizado_excepcion": c.autorizado_excepcion,
            "justificacion_excepcion": c.justificacion_excepcion,
            "creado_en": c.creado_en.isoformat() if c.creado_en else None
        })
    return resultado


@router.get("/mis-compras")
def mis_compras(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-19/20: Historial de compras del cliente."""
    cliente = get_cliente_obj(current_user, db)
    ventas = db.query(Venta).options(joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto), joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.talla), joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.color), joinedload(Venta.comprobante)).filter(Venta.cliente_id == cliente.id).order_by(Venta.fecha_venta.desc()).all()
    return [{
        "id": v.id,
        "tipo": v.tipo_venta,
        "fecha": v.fecha_venta.isoformat(),
        "total": float(v.total),
        "estado": v.estado,
        "numero_comprobante": v.comprobante.numero_comprobante if v.comprobante else None,
        "items": [{
            "producto": d.variante.producto.nombre if d.variante and d.variante.producto else "---",
            "imagen_url": d.variante.producto.imagen_url if d.variante and d.variante.producto else None,
            "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "---",
            "color": d.variante.color.nombre if d.variante and d.variante.color else "---",
            "color_hex": d.variante.color.codigo_hex if d.variante and d.variante.color else "#333",
            "cantidad": d.cantidad,
            "precio_unitario": float(d.precio_unitario)
        } for d in v.detalles]
    } for v in ventas]

@router.get("/{venta_id}")
def obtener_venta(venta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Obtener detalle de la venta para pasarela de pago y generar QR."""
    venta = db.query(Venta).options(
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.producto),
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.talla),
        joinedload(Venta.detalles).joinedload(VentaDetalle.variante).joinedload(ProductoVariante.color),
        joinedload(Venta.comprobante)
    ).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Orden de compra no encontrada.")
    
    # Generar QR Simple interoperable en base64 con el payload de cobro
    qr_data = f"FASHIONSTORE|ORDEN:{venta.id}|TOTAL:{float(venta.total):.2f}|BS|PAGOSIMPLE"
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#09090b", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    return {
        "id": venta.id,
        "subtotal": float(venta.subtotal),
        "costo_envio": float(venta.costo_envio or 0),
        "total": float(venta.total),
        "estado": venta.estado,
        "metodo_entrega": venta.metodo_entrega,
        "direccion_envio": venta.direccion_envio,
        "fecha_venta": venta.fecha_venta.isoformat() if venta.fecha_venta else None,
        "numero_comprobante": venta.comprobante.numero_comprobante if venta.comprobante else None,
        "qr_image": qr_base64,
        "items": [{
            "producto": d.variante.producto.nombre if d.variante and d.variante.producto else "Prenda",
            "imagen_url": d.variante.producto.imagen_url if d.variante and d.variante.producto else None,
            "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "U",
            "color": d.variante.color.nombre if d.variante and d.variante.color else "",
            "color_hex": d.variante.color.codigo_hex if d.variante and d.variante.color else "#333",
            "cantidad": d.cantidad,
            "precio_unitario": float(d.precio_unitario),
            "subtotal": float(d.subtotal)
        } for d in venta.detalles]
    }
