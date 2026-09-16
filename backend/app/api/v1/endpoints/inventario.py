from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from pydantic import BaseModel
from app.db.session import get_db
from app.api.deps import get_current_user, require_roles
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.producto import ProductoVariante
from app.models.sucursal import Sucursal

router = APIRouter()

class MovimientoCreate(BaseModel):
    variante_id: int
    sucursal_id: int
    tipo_movimiento: str
    cantidad: int
    observaciones: Optional[str] = None
    sucursal_destino_id: Optional[int] = None

class AjusteStockInput(BaseModel):
    variante_id: int
    sucursal_id: int
    nueva_cantidad: int
    observaciones: Optional[str] = None

@router.get("/stock/{variante_id}")
def get_stock_por_variante(variante_id: int, db: Session = Depends(get_db)):
    """CU-11: Stock por sucursal para una variante."""
    variante = db.query(ProductoVariante).options(
        joinedload(ProductoVariante.producto),
        joinedload(ProductoVariante.talla),
        joinedload(ProductoVariante.color),
    ).filter(ProductoVariante.id == variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada.")
    inventarios = db.query(InventarioSucursal).options(
        joinedload(InventarioSucursal.sucursal)
    ).filter(InventarioSucursal.variante_id == variante_id).all()
    resultado = []
    for inv in inventarios:
        libre = inv.cantidad_disponible - inv.cantidad_reservada
        if libre >= 5:
            estado = "disponible"
        elif libre > 0:
            estado = "ultimas_unidades"
        else:
            estado = "agotado"
        resultado.append({
            "sucursal_id": inv.sucursal_id,
            "sucursal_nombre": inv.sucursal.nombre if inv.sucursal else "---",
            "cantidad_disponible": inv.cantidad_disponible,
            "cantidad_reservada": inv.cantidad_reservada,
            "stock_libre": libre,
            "estado": estado,
        })
    return {
        "variante_id": variante_id,
        "producto": variante.producto.nombre if variante.producto else "---",
        "talla": variante.talla.nombre if variante.talla else "---",
        "color": variante.color.nombre if variante.color else "---",
        "sku": variante.sku,
        "stock_por_sucursal": resultado,
    }

@router.get("/sucursal/{sucursal_id}")
def get_inventario_sucursal(sucursal_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-11/12: Inventario completo de una sucursal."""
    sucursal = db.query(Sucursal).filter(Sucursal.id == sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada.")
    items = db.query(InventarioSucursal).options(
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.talla),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.color),
    ).filter(InventarioSucursal.sucursal_id == sucursal_id).all()
    return {
        "sucursal_id": sucursal_id,
        "sucursal": sucursal.nombre,
        "total_variantes": len(items),
        "items": [{
            "inventario_id": i.id,
            "variante_id": i.variante_id,
            "sku": i.variante.sku if i.variante else "---",
            "producto": i.variante.producto.nombre if i.variante and i.variante.producto else "---",
            "talla": i.variante.talla.nombre if i.variante and i.variante.talla else "---",
            "color": i.variante.color.nombre if i.variante and i.variante.color else "---",
            "color_hex": i.variante.color.codigo_hex if i.variante and i.variante.color else "#888",
            "cantidad_disponible": i.cantidad_disponible,
            "cantidad_reservada": i.cantidad_reservada,
            "stock_libre": i.cantidad_disponible - i.cantidad_reservada,
            "stock_minimo": i.stock_minimo,
            "bajo_stock": (i.cantidad_disponible - i.cantidad_reservada) <= i.stock_minimo,
        } for i in items]
    }

@router.post("/movimiento", status_code=status.HTTP_201_CREATED)
def registrar_movimiento(data: MovimientoCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal"]))):
    """CU-12: Ingreso, devolucion, ajuste o transferencia."""
    inv = db.query(InventarioSucursal).filter(
        InventarioSucursal.variante_id == data.variante_id,
        InventarioSucursal.sucursal_id == data.sucursal_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventario no encontrado para esta variante y sucursal.")
    tipo = data.tipo_movimiento
    cant = data.cantidad
    if tipo in ("venta", "transferencia_saliente"):
        libre = inv.cantidad_disponible - inv.cantidad_reservada
        if cant > libre:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente. Libre: {libre} unidades.")
        inv.cantidad_disponible -= cant
    elif tipo in ("ingreso", "devolucion", "transferencia_entrante", "ajuste"):
        inv.cantidad_disponible += cant
    else:
        raise HTTPException(status_code=400, detail=f"Tipo no valido: {tipo}")
    if tipo == "transferencia_saliente" and data.sucursal_destino_id:
        inv_dest = db.query(InventarioSucursal).filter(
            InventarioSucursal.variante_id == data.variante_id,
            InventarioSucursal.sucursal_id == data.sucursal_destino_id
        ).first()
        if inv_dest:
            inv_dest.cantidad_disponible += cant
        else:
            db.add(InventarioSucursal(variante_id=data.variante_id, sucursal_id=data.sucursal_destino_id, cantidad_disponible=cant, cantidad_reservada=0, stock_minimo=3))
    mov = MovimientoInventario(variante_id=data.variante_id, sucursal_id=data.sucursal_id, tipo_movimiento=tipo, cantidad=cant, observaciones=data.observaciones)
    db.add(mov)
    db.commit()
    return {"message": f"Movimiento '{tipo}' registrado. Nuevo stock: {inv.cantidad_disponible}"}

@router.get("/movimientos")
def get_kardex(sucursal_id: Optional[int] = None, variante_id: Optional[int] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-12: Historial Kardex."""
    q = db.query(MovimientoInventario)
    if sucursal_id:
        q = q.filter(MovimientoInventario.sucursal_id == sucursal_id)
    if variante_id:
        q = q.filter(MovimientoInventario.variante_id == variante_id)
    movimientos = q.order_by(MovimientoInventario.fecha.desc()).limit(200).all()
    return [{"id": m.id, "variante_id": m.variante_id, "sucursal_id": m.sucursal_id, "tipo": m.tipo_movimiento, "cantidad": m.cantidad, "fecha": m.fecha.isoformat(), "observaciones": m.observaciones} for m in movimientos]

@router.put("/ajustar")
def ajustar_stock(data: AjusteStockInput, db: Session = Depends(get_db), current_user: dict = Depends(require_roles(["administrador"]))):
    inv = db.query(InventarioSucursal).filter(InventarioSucursal.variante_id == data.variante_id, InventarioSucursal.sucursal_id == data.sucursal_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventario no encontrado.")
    inv.cantidad_disponible = data.nueva_cantidad
    db.add(MovimientoInventario(variante_id=data.variante_id, sucursal_id=data.sucursal_id, tipo_movimiento="ajuste", cantidad=abs(data.nueva_cantidad), observaciones=data.observaciones or f"Ajuste manual a {data.nueva_cantidad}"))
    db.commit()
    return {"message": f"Stock ajustado a {inv.cantidad_disponible} unidades."}

