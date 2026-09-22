import uuid
import io
import base64
import qrcode
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.venta import Venta, VentaDetalle, Pago, Comprobante
from app.models.interacciones import Carrito, CarritoDetalle
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.producto import ProductoVariante
from app.models.usuario import Cliente

router = APIRouter()

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

def get_cliente_obj(current_user: dict, db: Session) -> Cliente:
    if current_user["user_type"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo clientes pueden hacer compras digitales.")
    return db.query(Cliente).filter(Cliente.id == current_user["id"]).first()

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
    for i in items:
        v = i.variante
        precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0) if v and v.producto else 0
        subtotal += precio * i.cantidad
    costo_envio = 30.0 if data.metodo_entrega == "delivery" else 0.0
    total = subtotal + costo_envio
    venta = Venta(
        cliente_id=cliente.id,
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
        det = VentaDetalle(venta_id=venta.id, variante_id=i.variante_id, cantidad=i.cantidad, precio_unitario=precio, subtotal=precio * i.cantidad)
        db.add(det)
    db.commit()
    return {"venta_id": venta.id, "subtotal": subtotal, "costo_envio": costo_envio, "total": total, "estado": venta.estado, "mensaje": "Orden creada. Procede al pago."}

@router.post("/pagar/{venta_id}")
def pagar_venta(venta_id: int, data: PagoInput, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-20: Procesar pago (simulado) y descontar inventario."""
    venta = db.query(Venta).options(joinedload(Venta.detalles)).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    if venta.estado != "pendiente_pago":
        raise HTTPException(status_code=400, detail=f"La orden ya fue procesada: {venta.estado}")
    if data.monto < float(venta.total):
        raise HTTPException(status_code=400, detail="Monto insuficiente.")
    pago = Pago(venta_id=venta.id, metodo_pago=data.metodo_pago, monto=data.monto, estado="aprobado", pasarela="Simulado_FashionStore", referencia_transaccion="TXN-" + str(uuid.uuid4())[:8].upper())
    db.add(pago)
    venta.estado = "completada"
    for det in venta.detalles:
        inv = db.query(InventarioSucursal).filter(InventarioSucursal.variante_id == det.variante_id).order_by(InventarioSucursal.cantidad_disponible.desc()).first()
        if inv:
            inv.cantidad_disponible = max(0, inv.cantidad_disponible - det.cantidad)
            db.add(MovimientoInventario(variante_id=det.variante_id, sucursal_id=inv.sucursal_id, tipo_movimiento="venta", cantidad=det.cantidad, referencia_tipo="venta", referencia_id=venta.id))
    num_comp = "COMP-" + str(uuid.uuid4())[:10].upper()
    comprobante = Comprobante(venta_id=venta.id, numero_comprobante=num_comp, tipo="recibo")
    db.add(comprobante)
    if current_user["user_type"] == "cliente":
        carrito = db.query(Carrito).filter(Carrito.cliente_id == venta.cliente_id, Carrito.activo == True).first()
        if carrito:
            db.query(CarritoDetalle).filter(CarritoDetalle.carrito_id == carrito.id).delete()
    db.commit()
    return {"mensaje": "Pago aprobado. Compra completada.", "numero_comprobante": num_comp, "venta_id": venta.id, "total_pagado": data.monto}

@router.post("/pos", status_code=status.HTTP_201_CREATED)
def venta_pos(data: PosVentaInput, db: Session = Depends(get_db), current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))):
    """CU-21: Venta presencial POS."""
    subtotal = sum(i.precio_unitario * i.cantidad for i in data.items)
    venta = Venta(tipo_venta="presencial", sucursal_id=data.sucursal_id, usuario_id=current_user["id"], cliente_id=data.cliente_id, metodo_entrega="retiro_tienda", subtotal=subtotal, total=subtotal, estado="completada")
    db.add(venta)
    db.commit()
    db.refresh(venta)
    for i in data.items:
        det = VentaDetalle(venta_id=venta.id, variante_id=i.variante_id, cantidad=i.cantidad, precio_unitario=i.precio_unitario, subtotal=i.precio_unitario * i.cantidad)
        db.add(det)
        inv = db.query(InventarioSucursal).filter(InventarioSucursal.variante_id == i.variante_id, InventarioSucursal.sucursal_id == data.sucursal_id).first()
        if inv:
            inv.cantidad_disponible = max(0, inv.cantidad_disponible - i.cantidad)
            db.add(MovimientoInventario(variante_id=i.variante_id, sucursal_id=data.sucursal_id, tipo_movimiento="venta", cantidad=i.cantidad, referencia_tipo="venta_pos", referencia_id=venta.id))
    pago = Pago(venta_id=venta.id, metodo_pago=data.metodo_pago, monto=subtotal, estado="aprobado", pasarela="POS_Fisico")
    db.add(pago)
    num_comp = "POS-" + str(uuid.uuid4())[:10].upper()
    db.add(Comprobante(venta_id=venta.id, numero_comprobante=num_comp, tipo="recibo"))
    db.commit()
    return {"mensaje": "Venta POS registrada exitosamente.", "venta_id": venta.id, "numero_comprobante": num_comp, "total": subtotal}

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

