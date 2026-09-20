from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.producto import Producto, Categoria, Talla, Color, ProductoVariante
from app.schemas.producto import (
    ProductoOut, ProductoDetailOut, CategoriaOut, TallaOut, ColorOut
)

router = APIRouter()


from app.models.inventario import InventarioSucursal

@router.get("/", response_model=List[ProductoOut])
def listar_productos(
    categoria_id: Optional[int] = Query(None, description="Filtrar por categoría"),
    talla_id: Optional[int] = Query(None, description="Filtrar por talla"),
    color_id: Optional[int] = Query(None, description="Filtrar por color"),
    coleccion_id: Optional[int] = Query(None, description="Filtrar por temporada/colección"),
    precio_min: Optional[float] = Query(None, description="Precio mínimo"),
    precio_max: Optional[float] = Query(None, description="Precio máximo"),
    search: Optional[str] = Query(None, description="Buscar por nombre o descripción"),
    sucursal_id: Optional[int] = Query(None, description="Filtrar por sucursal con stock disponible"),
    db: Session = Depends(get_db)
):
    """
    RF07 / CU-10 / CU-11: Consultar catálogo de prendas con múltiples filtros.
    """
    query = db.query(Producto).options(
        joinedload(Producto.categoria),
        joinedload(Producto.variantes).joinedload(ProductoVariante.talla),
        joinedload(Producto.variantes).joinedload(ProductoVariante.color)
    ).filter(Producto.activo == True)

    if categoria_id:
        query = query.filter(Producto.categoria_id == categoria_id)
    if coleccion_id:
        query = query.filter(Producto.coleccion_id == coleccion_id)
    if precio_min is not None:
        query = query.filter(Producto.precio_base >= precio_min)
    if precio_max is not None:
        query = query.filter(Producto.precio_base <= precio_max)
    if search:
        query = query.filter(Producto.nombre.ilike(f"%{search}%"))
    if talla_id:
        query = query.filter(Producto.variantes.any(ProductoVariante.talla_id == talla_id))
    if color_id:
        query = query.filter(Producto.variantes.any(ProductoVariante.color_id == color_id))

    productos = query.all()

    invs = db.query(InventarioSucursal).options(
        joinedload(InventarioSucursal.variante),
        joinedload(InventarioSucursal.sucursal)
    ).all()

    stock_map = {}
    for inv in invs:
        if not inv.variante:
            continue
        p_id = inv.variante.producto_id
        s_id = inv.sucursal_id
        s_nom = inv.sucursal.nombre if inv.sucursal else "Tienda"
        libre = max(0, inv.cantidad_disponible - inv.cantidad_reservada)
        if p_id not in stock_map:
            stock_map[p_id] = {"total": 0, "sucursales": {}}
        stock_map[p_id]["total"] += libre
        if s_id not in stock_map[p_id]["sucursales"]:
            stock_map[p_id]["sucursales"][s_id] = {
                "sucursal_id": s_id,
                "sucursal_nombre": s_nom,
                "stock_disponible": 0
            }
        stock_map[p_id]["sucursales"][s_id]["stock_disponible"] += libre

    resultado = []
    for p in productos:
        p_stock = stock_map.get(p.id, {"total": 0, "sucursales": {}})
        stock_total = p_stock["total"]
        sucursales_list = list(p_stock["sucursales"].values())

        stock_sucursal = None
        if sucursal_id:
            suc_info = p_stock["sucursales"].get(sucursal_id)
            stock_sucursal = suc_info["stock_disponible"] if suc_info else 0
            if stock_sucursal <= 0:
                continue

        prod_dict = {
            "id": p.id,
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "precio_base": p.precio_base,
            "imagen_url": p.imagen_url,
            "modelo_ar_url": p.modelo_ar_url,
            "categoria": p.categoria,
            "activo": p.activo,
            "stock_total": stock_total,
            "stock_sucursal_seleccionada": stock_sucursal,
            "stock_por_sucursal": sucursales_list,
            "variantes": p.variantes
        }
        resultado.append(prod_dict)

    return resultado


@router.get("/meta/categorias", response_model=List[CategoriaOut])
@router.get("/categorias", response_model=List[CategoriaOut])
def listar_categorias(db: Session = Depends(get_db)):
    """Lista las categorías de ropa disponibles y activas."""
    return db.query(Categoria).filter(Categoria.activo == True).all()


@router.get("/meta/tallas", response_model=List[TallaOut])
@router.get("/tallas", response_model=List[TallaOut])
def listar_tallas(db: Session = Depends(get_db)):
    """Lista las tallas ordenadas y activas."""
    return db.query(Talla).filter(Talla.activo == True).order_by(Talla.orden.asc()).all()


@router.get("/meta/colores", response_model=List[ColorOut])
@router.get("/colores", response_model=List[ColorOut])
def listar_colores(db: Session = Depends(get_db)):
    """Lista los colores disponibles y activos."""
    return db.query(Color).filter(Color.activo == True).all()


@router.get("/{producto_id}", response_model=ProductoDetailOut)
def obtener_detalle_producto(producto_id: int, db: Session = Depends(get_db)):
    """
    Obtiene la ficha técnica de una prenda con sus variantes (tallas y colores) y modelo AR.
    """
    producto = db.query(Producto).options(
        joinedload(Producto.categoria),
        joinedload(Producto.variantes).joinedload(ProductoVariante.talla),
        joinedload(Producto.variantes).joinedload(ProductoVariante.color)
    ).filter(Producto.id == producto_id, Producto.activo == True).first()

    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")

    v_ids = [v.id for v in producto.variantes]
    invs = db.query(InventarioSucursal).options(joinedload(InventarioSucursal.sucursal)).filter(InventarioSucursal.variante_id.in_(v_ids)).all() if v_ids else []

    total = 0
    suc_map = {}
    for inv in invs:
        libre = max(0, inv.cantidad_disponible - inv.cantidad_reservada)
        total += libre
        s_id = inv.sucursal_id
        s_nom = inv.sucursal.nombre if inv.sucursal else "Tienda"
        if s_id not in suc_map:
            suc_map[s_id] = {"sucursal_id": s_id, "sucursal_nombre": s_nom, "stock_disponible": 0}
        suc_map[s_id]["stock_disponible"] += libre

    setattr(producto, "stock_total", total)
    setattr(producto, "stock_por_sucursal", list(suc_map.values()))
    return producto



@router.get("/meta/categorias", response_model=List[CategoriaOut])
def listar_categorias(db: Session = Depends(get_db)):
    """Lista las categorías de ropa disponibles y activas."""
    return db.query(Categoria).filter(Categoria.activo == True).all()


@router.get("/meta/tallas", response_model=List[TallaOut])
def listar_tallas(db: Session = Depends(get_db)):
    """Lista las tallas ordenadas y activas."""
    return db.query(Talla).filter(Talla.activo == True).order_by(Talla.orden.asc()).all()


@router.get("/meta/colores", response_model=List[ColorOut])
def listar_colores(db: Session = Depends(get_db)):
    """Lista los colores disponibles y activos."""
    return db.query(Color).filter(Color.activo == True).all()


# =============================================================================
# VESTIDOR VIRTUAL AR (RF13, CU-13)
# =============================================================================
from app.api.deps import require_roles
from app.models.interacciones import SesionVestidorVirtual
from app.schemas.vestidor import SesionVestidorCreate, SesionVestidorOut

@router.post("/vestidor-virtual/sesion", response_model=SesionVestidorOut, status_code=status.HTTP_201_CREATED)
def registrar_sesion_vestidor(
    data: SesionVestidorCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["cliente"]))
):
    """
    Registra una sesión de prueba en el Vestidor Virtual (AR) desde la aplicación móvil.
    """
    variante = db.query(ProductoVariante).filter(ProductoVariante.id == data.variante_id).first()
    if not variante:
        raise HTTPException(status_code=404, detail="La prenda seleccionada no existe.")

    nueva_sesion = SesionVestidorVirtual(
        cliente_id=current_user["id"],
        variante_id=data.variante_id,
        imagen_resultado_url=data.imagen_resultado_url,
        dispositivo=data.dispositivo
    )
    db.add(nueva_sesion)
    db.commit()
    db.refresh(nueva_sesion)
    return nueva_sesion



