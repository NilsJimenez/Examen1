import uuid, qrcode, io, base64
from datetime import datetime, date, time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.reserva import Reserva, ReservaDetalle
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.usuario import Cliente
from app.models.producto import ProductoVariante

router = APIRouter()

class ReservaItemInput(BaseModel):
    variante_id: int
    cantidad: int = 1

class ReservaCreate(BaseModel):
    sucursal_id: int
    fecha_reserva: str
    horario_atencion: str
    items: List[ReservaItemInput]
    observaciones: Optional[str] = None

def generar_qr_base64(texto: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(texto)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def get_cliente(current_user: dict, db: Session) -> Cliente:
    if current_user["user_type"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo clientes pueden hacer reservas.")
    cliente = db.query(Cliente).filter(Cliente.id == current_user["id"]).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    return cliente

@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_reserva(data: ReservaCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-14: Crear reserva multi-prenda con codigo QR."""
    cliente = get_cliente(current_user, db)
    for item in data.items:
        inv = db.query(InventarioSucursal).filter(
            InventarioSucursal.variante_id == item.variante_id,
            InventarioSucursal.sucursal_id == data.sucursal_id
        ).first()
        if not inv:
            raise HTTPException(status_code=400, detail=f"Variante {item.variante_id} no disponible en esa sucursal.")
        libre = inv.cantidad_disponible - inv.cantidad_reservada
        if libre < item.cantidad:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para variante {item.variante_id}. Disponible: {libre}")
    codigo = "RES-" + str(uuid.uuid4()).upper()[:12]
    fecha_dt = date.fromisoformat(data.fecha_reserva)
    hora_dt = time.fromisoformat(data.horario_atencion)
    reserva = Reserva(
        cliente_id=cliente.id,
        sucursal_id=data.sucursal_id,
        codigo_reserva=codigo,
        fecha_reserva=fecha_dt,
        horario_atencion=hora_dt,
        estado="pendiente",
        observaciones=data.observaciones,
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)
    for item in data.items:
        det = ReservaDetalle(reserva_id=reserva.id, variante_id=item.variante_id, cantidad=item.cantidad)
        db.add(det)
        inv = db.query(InventarioSucursal).filter(
            InventarioSucursal.variante_id == item.variante_id,
            InventarioSucursal.sucursal_id == data.sucursal_id
        ).first()
        inv.cantidad_reservada += item.cantidad
        db.add(MovimientoInventario(variante_id=item.variante_id, sucursal_id=data.sucursal_id, tipo_movimiento="reserva", cantidad=item.cantidad, referencia_tipo="reserva", referencia_id=reserva.id))
    qr_data = generar_qr_base64(codigo)
    reserva.codigo_qr = f"QR-{codigo}"
    db.commit()
    db.refresh(reserva)
    return {"id": reserva.id, "codigo_reserva": codigo, "estado": reserva.estado, "codigo_qr": qr_data, "fecha": data.fecha_reserva, "hora": data.horario_atencion}

@router.get("/mis-reservas")
def mis_reservas(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-15: Listar reservas del cliente autenticado."""
    cliente = get_cliente(current_user, db)
    reservas = db.query(Reserva).options(
        joinedload(Reserva.sucursal),
        joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.producto),
        joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.talla),
        joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.color),
    ).filter(Reserva.cliente_id == cliente.id).order_by(Reserva.fecha_creacion.desc()).all()
    return [{
        "id": r.id,
        "codigo_reserva": r.codigo_reserva,
        "codigo_qr": generar_qr_base64(r.codigo_reserva),
        "sucursal": r.sucursal.nombre if r.sucursal else "---",
        "fecha": str(r.fecha_reserva),
        "hora": str(r.horario_atencion),
        "estado": r.estado,
        "fecha_creacion": r.fecha_creacion.isoformat(),
        "items": [{
            "variante_id": d.variante_id,
            "producto": d.variante.producto.nombre if d.variante and d.variante.producto else "---",
            "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "---",
            "color": d.variante.color.nombre if d.variante and d.variante.color else "---",
            "cantidad": d.cantidad,
        } for d in r.detalles],
    } for r in reservas]

@router.get("/{reserva_id}")
def get_reserva(reserva_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    reserva = db.query(Reserva).options(joinedload(Reserva.sucursal), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.producto), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.talla), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.color)).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    return {"id": reserva.id, "codigo_reserva": reserva.codigo_reserva, "codigo_qr": generar_qr_base64(reserva.codigo_reserva), "estado": reserva.estado, "sucursal": reserva.sucursal.nombre if reserva.sucursal else "---", "fecha": str(reserva.fecha_reserva), "hora": str(reserva.horario_atencion), "observaciones": reserva.observaciones, "items": [{"variante_id": d.variante_id, "producto": d.variante.producto.nombre if d.variante and d.variante.producto else "---", "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "---", "color": d.variante.color.nombre if d.variante and d.variante.color else "---", "cantidad": d.cantidad} for d in reserva.detalles]}

@router.patch("/{reserva_id}/cancelar")
def cancelar_reserva(reserva_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-15: Cancelar reserva y liberar stock."""
    reserva = db.query(Reserva).options(joinedload(Reserva.detalles)).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    if reserva.estado in ("completada", "atendida"):
        raise HTTPException(status_code=400, detail="No se puede cancelar una reserva ya completada.")
    if reserva.estado == "cancelada":
        raise HTTPException(status_code=400, detail="La reserva ya esta cancelada.")
    for d in reserva.detalles:
        inv = db.query(InventarioSucursal).filter(InventarioSucursal.variante_id == d.variante_id, InventarioSucursal.sucursal_id == reserva.sucursal_id).first()
        if inv:
            inv.cantidad_reservada = max(0, inv.cantidad_reservada - d.cantidad)
    reserva.estado = "cancelada"
    db.commit()
    return {"message": "Reserva cancelada. Stock liberado."}

@router.get("/sucursal/{sucursal_id}")
def reservas_sucursal(sucursal_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-16: Ver reservas de la sucursal."""
    reservas = db.query(Reserva).options(joinedload(Reserva.cliente), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.producto), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.talla), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.color)).filter(Reserva.sucursal_id == sucursal_id, Reserva.estado.in_(["pendiente", "preparada"])).order_by(Reserva.fecha_reserva, Reserva.horario_atencion).all()
    return [{"id": r.id, "codigo_reserva": r.codigo_reserva, "cliente": f"{r.cliente.nombres} {r.cliente.apellidos}" if r.cliente else "—", "fecha": str(r.fecha_reserva), "hora": str(r.horario_atencion), "estado": r.estado, "items": [{"producto": d.variante.producto.nombre if d.variante and d.variante.producto else "—", "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "—", "color": d.variante.color.nombre if d.variante and d.variante.color else "—", "cantidad": d.cantidad} for d in r.detalles]} for r in reservas]

@router.patch("/{reserva_id}/preparar")
def preparar_reserva(reserva_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-16: Marcar reserva como preparada."""
    r = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    r.estado = "preparada"
    r.notificado = True
    db.commit()
    return {"message": "Reserva marcada como Preparada. Cliente notificado."}

@router.patch("/{reserva_id}/atender")
def atender_reserva(reserva_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-16: Marcar reserva como atendida."""
    r = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    r.estado = "atendida"
    r.fecha_atencion = datetime.utcnow()
    db.commit()
    return {"message": "Reserva marcada como Atendida."}

@router.get("/qr/{codigo}")
def checkin_qr(codigo: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-17: Check-in instantaneo por codigo QR."""
    reserva = db.query(Reserva).options(joinedload(Reserva.cliente), joinedload(Reserva.detalles).joinedload(ReservaDetalle.variante).joinedload(ProductoVariante.producto)).filter(Reserva.codigo_reserva == codigo).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Codigo QR invalido o reserva no encontrada.")
    if reserva.estado == "cancelada":
        raise HTTPException(status_code=400, detail="Esta reserva fue cancelada.")
    if reserva.estado == "completada":
        raise HTTPException(status_code=400, detail="Esta reserva ya fue completada.")
    return {"valido": True, "reserva_id": reserva.id, "codigo": codigo, "cliente": f"{reserva.cliente.nombres} {reserva.cliente.apellidos}" if reserva.cliente else "—", "estado": reserva.estado, "fecha": str(reserva.fecha_reserva), "hora": str(reserva.horario_atencion), "items": [{"producto": d.variante.producto.nombre if d.variante and d.variante.producto else "—", "talla": d.variante.talla.nombre if d.variante and d.variante.talla else "—", "cantidad": d.cantidad} for d in reserva.detalles]}
