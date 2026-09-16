from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.interacciones import Carrito, CarritoDetalle
from app.models.producto import ProductoVariante
from app.models.inventario import InventarioSucursal
from app.models.usuario import Cliente

router = APIRouter()

class AgregarItemInput(BaseModel):
    variante_id: int
    cantidad: int = 1

class ActualizarItemInput(BaseModel):
    cantidad: int

def get_cliente_obj(current_user: dict, db: Session) -> Cliente:
    if current_user["user_type"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo clientes pueden usar el carrito.")
    return db.query(Cliente).filter(Cliente.id == current_user["id"]).first()

def get_o_crear_carrito(cliente_id: int, db: Session) -> Carrito:
    carrito = db.query(Carrito).filter(Carrito.cliente_id == cliente_id, Carrito.activo == True).first()
    if not carrito:
        carrito = Carrito(cliente_id=cliente_id, activo=True)
        db.add(carrito)
        db.commit()
        db.refresh(carrito)
    return carrito

def serializar_carrito(carrito: Carrito, db: Session) -> dict:
    items = db.query(CarritoDetalle).options(
        joinedload(CarritoDetalle.variante).joinedload(ProductoVariante.producto),
        joinedload(CarritoDetalle.variante).joinedload(ProductoVariante.talla),
        joinedload(CarritoDetalle.variante).joinedload(ProductoVariante.color),
    ).filter(CarritoDetalle.carrito_id == carrito.id).all()
    subtotal = 0.0
    items_out = []
    for i in items:
        v = i.variante
        precio = float(v.producto.precio_base or 0) + float(v.precio_adicional or 0) if v and v.producto else 0
        sub = precio * i.cantidad
        subtotal += sub
        items_out.append({
            "id": i.id,
            "variante_id": i.variante_id,
            "producto": v.producto.nombre if v and v.producto else "—",
            "imagen_url": v.producto.imagen_url if v and v.producto else None,
            "talla": v.talla.nombre if v and v.talla else "—",
            "color": v.color.nombre if v and v.color else "—",
            "color_hex": v.color.codigo_hex if v and v.color else "#888",
            "sku": v.sku if v else "—",
            "precio_unitario": precio,
            "cantidad": i.cantidad,
            "subtotal": sub,
        })
    return {"carrito_id": carrito.id, "items": items_out, "subtotal": round(subtotal, 2), "total_items": len(items_out)}

@router.get("/")
def ver_carrito(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-18: Ver carrito del cliente."""
    cliente = get_cliente_obj(current_user, db)
    carrito = get_o_crear_carrito(cliente.id, db)
    return serializar_carrito(carrito, db)

@router.post("/agregar")
def agregar_item(data: AgregarItemInput, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-18: Agregar prenda al carrito."""
    cliente = get_cliente_obj(current_user, db)
    variante = db.query(ProductoVariante).filter(ProductoVariante.id == data.variante_id, ProductoVariante.activo == True).first()
    if not variante:
        raise HTTPException(status_code=404, detail="Variante no encontrada.")
    carrito = get_o_crear_carrito(cliente.id, db)
    item_existente = db.query(CarritoDetalle).filter(CarritoDetalle.carrito_id == carrito.id, CarritoDetalle.variante_id == data.variante_id).first()
    if item_existente:
        item_existente.cantidad += data.cantidad
    else:
        db.add(CarritoDetalle(carrito_id=carrito.id, variante_id=data.variante_id, cantidad=data.cantidad))
    db.commit()
    return serializar_carrito(carrito, db)

@router.put("/item/{item_id}")
def actualizar_item(item_id: int, data: ActualizarItemInput, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-18: Actualizar cantidad de un item."""
    cliente = get_cliente_obj(current_user, db)
    carrito = get_o_crear_carrito(cliente.id, db)
    item = db.query(CarritoDetalle).filter(CarritoDetalle.id == item_id, CarritoDetalle.carrito_id == carrito.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado en el carrito.")
    if data.cantidad <= 0:
        db.delete(item)
    else:
        item.cantidad = data.cantidad
    db.commit()
    return serializar_carrito(carrito, db)

@router.delete("/item/{item_id}")
def eliminar_item(item_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-18: Eliminar un item del carrito."""
    cliente = get_cliente_obj(current_user, db)
    carrito = get_o_crear_carrito(cliente.id, db)
    item = db.query(CarritoDetalle).filter(CarritoDetalle.id == item_id, CarritoDetalle.carrito_id == carrito.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado.")
    db.delete(item)
    db.commit()
    return serializar_carrito(carrito, db)

@router.delete("/vaciar")
def vaciar_carrito(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """CU-18: Vaciar el carrito completo."""
    cliente = get_cliente_obj(current_user, db)
    carrito = get_o_crear_carrito(cliente.id, db)
    db.query(CarritoDetalle).filter(CarritoDetalle.carrito_id == carrito.id).delete()
    db.commit()
    return {"message": "Carrito vaciado.", "carrito_id": carrito.id}
