from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.api.deps import require_roles
from app.core.security import get_password_hash
from app.models.usuario import Usuario, Rol
from app.models.sucursal import Ciudad, Sucursal
from app.models.producto import (
    Producto, ProductoVariante, Categoria, Talla, Color,
    Proveedor, Temporada, Coleccion
)
from app.models.inventario import InventarioSucursal
from app.schemas.admin import (
    ProductoCreate, ProductoUpdate, CategoriaCreate, TallaCreate, ColorCreate,
    SucursalCreate, CiudadCreate, ProveedorCreate, TemporadaCreate, ColeccionCreate,
    UsuarioCreate
)
from app.schemas.producto import ProductoDetailOut, CategoriaOut, TallaOut, ColorOut

router = APIRouter(dependencies=[Depends(require_roles(["administrador"]))])


# =============================================================================
# GESTIÓN DE PRENDAS Y VARIANTES (RF04, CU-06)
# =============================================================================
@router.post("/productos", response_model=ProductoDetailOut, status_code=status.HTTP_201_CREATED)
def crear_producto(data: ProductoCreate, db: Session = Depends(get_db)):
    """Crea una nueva prenda con sus variantes e inicializa stock en las sucursales."""
    nuevo_producto = Producto(
        nombre=data.nombre,
        descripcion=data.descripcion,
        categoria_id=data.categoria_id,
        proveedor_id=data.proveedor_id,
        coleccion_id=data.coleccion_id,
        precio_base=data.precio_base,
        imagen_url=data.imagen_url,
        modelo_ar_url=data.modelo_ar_url,
        activo=True
    )
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)

    # Crear variantes si se enviaron
    sucursales = db.query(Sucursal).filter(Sucursal.activo == True).all()

    for v_data in data.variantes:
        # Verificar que el SKU no exista
        existing_sku = db.query(ProductoVariante).filter(ProductoVariante.sku == v_data.sku).first()
        if existing_sku:
            v_sku = f"{v_data.sku}-{nuevo_producto.id}"
        else:
            v_sku = v_data.sku

        nueva_variante = ProductoVariante(
            producto_id=nuevo_producto.id,
            talla_id=v_data.talla_id,
            color_id=v_data.color_id,
            sku=v_sku,
            precio_adicional=v_data.precio_adicional,
            activo=True
        )
        db.add(nueva_variante)
        db.commit()
        db.refresh(nueva_variante)

        # Inicializar registro de inventario en cada sucursal
        for suc in sucursales:
            inv = InventarioSucursal(
                variante_id=nueva_variante.id,
                sucursal_id=suc.id,
                cantidad_disponible=10,
                cantidad_reservada=0,
                stock_minimo=3
            )
            db.add(inv)
        db.commit()

    db.refresh(nuevo_producto)
    return nuevo_producto


@router.put("/productos/{producto_id}")
def actualizar_producto(producto_id: int, data: ProductoUpdate, db: Session = Depends(get_db)):
    """Actualiza los datos de una prenda."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(producto, key, value)

    db.commit()
    db.refresh(producto)
    return {"message": "Prenda actualizada exitosamente", "id": producto.id}


@router.delete("/productos/{producto_id}")
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    """Desactiva una prenda del catálogo."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")
    producto.activo = False
    db.commit()
    return {"message": "Prenda desactivada del catálogo exitosamente."}


# =============================================================================
# ATRIBUTOS: CATEGORÍAS, TALLAS, COLORES (RF05, CU-07)
# =============================================================================
@router.post("/categorias", response_model=CategoriaOut)
def crear_categoria(data: CategoriaCreate, db: Session = Depends(get_db)):
    existing = db.query(Categoria).filter(Categoria.nombre == data.nombre).first()
    if existing:
        if not existing.activo:
            existing.activo = True
            db.commit()
            db.refresh(existing)
            return existing
        raise HTTPException(status_code=400, detail="La categoría ya existe.")
    cat = Categoria(nombre=data.nombre, descripcion=data.descripcion, activo=True)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categorias/{categoria_id}")
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    """Elimina o desactiva una categoría del catálogo."""
    cat = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    productos_en_cat = db.query(Producto).filter(Producto.categoria_id == categoria_id, Producto.activo == True).count()
    if productos_en_cat > 0:
        cat.activo = False
        db.commit()
        return {"message": f"Categoría '{cat.nombre}' desactivada del catálogo (tiene {productos_en_cat} prendas asociadas)."}
    db.delete(cat)
    db.commit()
    return {"message": f"Categoría '{cat.nombre}' eliminada exitosamente."}


@router.post("/tallas", response_model=TallaOut)
def crear_talla(data: TallaCreate, db: Session = Depends(get_db)):
    existing = db.query(Talla).filter(Talla.nombre.ilike(data.nombre.strip())).first()
    if existing:
        existing.activo = True
        db.commit()
        db.refresh(existing)
        return existing
    talla = Talla(nombre=data.nombre.strip(), orden=data.orden, activo=True)
    db.add(talla)
    db.commit()
    db.refresh(talla)
    return talla


@router.delete("/tallas/{talla_id}")
def eliminar_talla(talla_id: int, db: Session = Depends(get_db)):
    """Desmarca o elimina una talla."""
    talla = db.query(Talla).filter(Talla.id == talla_id).first()
    if not talla:
        raise HTTPException(status_code=404, detail="Talla no encontrada.")
    en_uso = db.query(ProductoVariante).filter(ProductoVariante.talla_id == talla_id).first()
    if en_uso:
        talla.activo = False
        db.commit()
        return {"message": f"Talla '{talla.nombre}' desmarcada exitosamente."}
    db.delete(talla)
    db.commit()
    return {"message": f"Talla '{talla.nombre}' eliminada exitosamente."}


@router.post("/colores", response_model=ColorOut)
def crear_color(data: ColorCreate, db: Session = Depends(get_db)):
    existing = db.query(Color).filter(Color.nombre.ilike(data.nombre.strip())).first()
    if existing:
        existing.activo = True
        if data.codigo_hex:
            existing.codigo_hex = data.codigo_hex
        db.commit()
        db.refresh(existing)
        return existing
    color = Color(nombre=data.nombre.strip(), codigo_hex=data.codigo_hex, activo=True)
    db.add(color)
    db.commit()
    db.refresh(color)
    return color


@router.delete("/colores/{color_id}")
def eliminar_color(color_id: int, db: Session = Depends(get_db)):
    """Desmarca o elimina un color."""
    color = db.query(Color).filter(Color.id == color_id).first()
    if not color:
        raise HTTPException(status_code=404, detail="Color no encontrado.")
    en_uso = db.query(ProductoVariante).filter(ProductoVariante.color_id == color_id).first()
    if en_uso:
        color.activo = False
        db.commit()
        return {"message": f"Color '{color.nombre}' desmarcado exitosamente."}
    db.delete(color)
    db.commit()
    return {"message": f"Color '{color.nombre}' eliminado exitosamente."}


# =============================================================================
# CIUDADES Y SUCURSALES (RF03, CU-05)
# =============================================================================
@router.post("/ciudades")
def crear_ciudad(data: CiudadCreate, db: Session = Depends(get_db)):
    existing = db.query(Ciudad).filter(Ciudad.nombre == data.nombre).first()
    if existing:
        raise HTTPException(status_code=400, detail="La ciudad ya existe.")
    ciudad = Ciudad(nombre=data.nombre, pais=data.pais)
    db.add(ciudad)
    db.commit()
    db.refresh(ciudad)
    return ciudad


@router.post("/sucursales")
def crear_sucursal(data: SucursalCreate, db: Session = Depends(get_db)):
    sucursal = Sucursal(
        nombre=data.nombre,
        ciudad_id=data.ciudad_id,
        direccion=data.direccion,
        telefono=data.telefono,
        latitud=data.latitud,
        longitud=data.longitud,
        activo=True
    )
    db.add(sucursal)
    db.commit()
    db.refresh(sucursal)
    return sucursal


# =============================================================================
# PROVEEDORES Y TEMPORADAS (RF06, RF23, CU-08, CU-09)
# =============================================================================
@router.get("/proveedores")
def listar_proveedores(db: Session = Depends(get_db)):
    return db.query(Proveedor).filter(Proveedor.activo == True).all()


@router.post("/proveedores")
def crear_proveedor(data: ProveedorCreate, db: Session = Depends(get_db)):
    prov = Proveedor(
        nombre=data.nombre,
        contacto_nombre=data.contacto_nombre,
        telefono=data.telefono,
        email=data.email,
        direccion=data.direccion,
        activo=True
    )
    db.add(prov)
    db.commit()
    db.refresh(prov)
    return prov


@router.get("/temporadas")
def listar_temporadas(db: Session = Depends(get_db)):
    return db.query(Temporada).all()


@router.post("/temporadas")
def crear_temporada(data: TemporadaCreate, db: Session = Depends(get_db)):
    temp = Temporada(
        nombre=data.nombre,
        tipo=data.tipo,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        activo=True
    )
    db.add(temp)
    db.commit()
    db.refresh(temp)
    return temp


@router.get("/colecciones")
def listar_colecciones(db: Session = Depends(get_db)):
    return db.query(Coleccion).all()


@router.post("/colecciones")
def crear_coleccion(data: ColeccionCreate, db: Session = Depends(get_db)):
    col = Coleccion(
        nombre=data.nombre,
        temporada_id=data.temporada_id,
        descripcion=data.descripcion,
        fecha_lanzamiento=data.fecha_lanzamiento
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


# =============================================================================
# USUARIOS INTERNOS Y ROLES (RF02, CU-04)
# =============================================================================
@router.get("/roles")
def listar_roles(db: Session = Depends(get_db)):
    return db.query(Rol).all()


@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).options(joinedload(Usuario.rol), joinedload(Usuario.sucursal)).all()
    return [
        {
            "id": u.id,
            "nombres": u.nombres,
            "apellidos": u.apellidos,
            "email": u.email,
            "telefono": u.telefono,
            "rol": u.rol.nombre if u.rol else "Sin rol",
            "sucursal": u.sucursal.nombre if u.sucursal else "Central / Global",
            "activo": u.activo,
            "fecha_registro": u.fecha_registro
        }
        for u in usuarios
    ]


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
def crear_usuario_interno(data: UsuarioCreate, db: Session = Depends(get_db)):
    """Crea un empleado interno de la tienda (Encargado de Sucursal o Cajero)."""
    existing = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con este correo.")

    nuevo_usuario = Usuario(
        nombres=data.nombres,
        apellidos=data.apellidos,
        email=data.email,
        password_hash=get_password_hash(data.password),
        rol_id=data.rol_id,
        sucursal_id=data.sucursal_id,
        telefono=data.telefono,
        activo=True
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return {"message": "Usuario empleado creado exitosamente", "id": nuevo_usuario.id}
