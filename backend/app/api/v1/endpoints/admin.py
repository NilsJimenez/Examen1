from typing import List
from datetime import datetime
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
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.schemas.admin import (
    ProductoCreate, ProductoUpdate, CategoriaCreate, CategoriaUpdate, TallaCreate, TallaUpdate, ColorCreate, ColorUpdate,
    SucursalCreate, CiudadCreate, ProveedorCreate, TemporadaCreate, ColeccionCreate,
    UsuarioCreate, UsuarioUpdate, StockIngresoInput, StockMatrizInput, VarianteUpdateInput,
    RolCreate, RolOut
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
        genero=data.genero,
        activo=True
    )
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)

    # Crear variantes si se enviaron
    sucursales = db.query(Sucursal).filter(Sucursal.activo == True).all()

    for v_data in data.variantes:
        # Verificar que el SKU no exista (Excepción 1 de CU-06)
        existing_sku = db.query(ProductoVariante).filter(ProductoVariante.sku == v_data.sku).first()
        if existing_sku:
            raise HTTPException(status_code=400, detail=f"El código de producto SKU '{v_data.sku}' ya existe.")
        
        v_sku = v_data.sku

        nueva_variante = ProductoVariante(
            producto_id=nuevo_producto.id,
            talla_id=v_data.talla_id,
            color_id=v_data.color_id,
            sku=v_sku,
            precio_adicional=v_data.precio_adicional,
            imagen_url=v_data.imagen_url or data.imagen_url,
            activo=True
        )
        db.add(nueva_variante)
        db.commit()
        db.refresh(nueva_variante)

        # Inicializar registro de inventario en cada sucursal con la cantidad ingresada
        cant_inicial = v_data.stock_inicial if v_data.stock_inicial is not None else 10
        for suc in sucursales:
            inv = InventarioSucursal(
                variante_id=nueva_variante.id,
                sucursal_id=suc.id,
                cantidad_disponible=cant_inicial,
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


@router.get("/productos/{producto_id}/variantes-detalle")
def obtener_variantes_detalle(producto_id: int, db: Session = Depends(get_db)):
    """Obtiene las variantes de una prenda con sus colores, tallas, fotos y stock por sucursal."""
    producto = db.query(Producto).options(
        joinedload(Producto.variantes).joinedload(ProductoVariante.talla),
        joinedload(Producto.variantes).joinedload(ProductoVariante.color),
        joinedload(Producto.variantes).joinedload(ProductoVariante.inventarios).joinedload(InventarioSucursal.sucursal)
    ).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")

    resultado = []
    for v in producto.variantes:
        stock_list = []
        for inv in v.inventarios:
            s_nombre = inv.sucursal.nombre if inv.sucursal else f"Sucursal #{inv.sucursal_id}"
            stock_list.append({
                "sucursal_id": inv.sucursal_id,
                "sucursal_nombre": s_nombre,
                "cantidad_disponible": inv.cantidad_disponible,
                "cantidad_reservada": inv.cantidad_reservada,
                "stock_libre": max(0, inv.cantidad_disponible - inv.cantidad_reservada)
            })
        resultado.append({
            "id": v.id,
            "sku": v.sku,
            "talla_id": v.talla_id,
            "talla_nombre": v.talla.nombre if v.talla else "N/A",
            "color_id": v.color_id,
            "color_nombre": v.color.nombre if v.color else "N/A",
            "color_hex": v.color.codigo_hex if v.color else "#18181b",
            "imagen_url": v.imagen_url,
            "precio_adicional": v.precio_adicional,
            "activo": v.activo,
            "stock_por_sucursal": stock_list
        })
    return {
        "producto_id": producto.id,
        "producto_nombre": producto.nombre,
        "imagen_url": producto.imagen_url,
        "variantes": resultado
    }


@router.put("/productos/{producto_id}/variantes")
def actualizar_variantes_prenda(producto_id: int, variantes_data: List[VarianteUpdateInput], db: Session = Depends(get_db)):
    """Actualiza fotos, precios adicionales y estado activo de las variantes de una prenda."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")

    actualizados = 0
    for v_in in variantes_data:
        variante = db.query(ProductoVariante).filter(
            ProductoVariante.id == v_in.id,
            ProductoVariante.producto_id == producto_id
        ).first()
        if variante:
            if v_in.imagen_url is not None:
                variante.imagen_url = v_in.imagen_url.strip() or None
            if v_in.precio_adicional is not None:
                variante.precio_adicional = v_in.precio_adicional
            if v_in.activo is not None:
                variante.activo = v_in.activo
            actualizados += 1

    db.commit()
    return {"message": f"{actualizados} variantes actualizadas correctamente."}


@router.post("/productos/{producto_id}/ingreso-stock")
def registrar_ingreso_stock(producto_id: int, data: StockIngresoInput, db: Session = Depends(get_db)):
    """Registra entrada de stock (cantidades que entran) en una sucursal para una variante o para toda la prenda."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")

    sucursal = db.query(Sucursal).filter(Sucursal.id == data.sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada.")

    if data.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad a ingresar debe ser mayor a 0.")

    variantes_afectadas = []
    if data.variante_id:
        v = db.query(ProductoVariante).filter(
            ProductoVariante.id == data.variante_id,
            ProductoVariante.producto_id == producto_id
        ).first()
        if not v:
            raise HTTPException(status_code=404, detail="Variante no encontrada para este producto.")
        variantes_afectadas.append(v)
    else:
        variantes_afectadas = db.query(ProductoVariante).filter(
            ProductoVariante.producto_id == producto_id,
            ProductoVariante.activo == True
        ).all()

    if not variantes_afectadas:
        raise HTTPException(status_code=400, detail="No hay variantes activas disponibles.")

    for v in variantes_afectadas:
        inv = db.query(InventarioSucursal).filter(
            InventarioSucursal.variante_id == v.id,
            InventarioSucursal.sucursal_id == data.sucursal_id
        ).first()
        if inv:
            inv.cantidad_disponible += data.cantidad
        else:
            inv = InventarioSucursal(
                variante_id=v.id,
                sucursal_id=data.sucursal_id,
                cantidad_disponible=data.cantidad,
                cantidad_reservada=0,
                stock_minimo=3
            )
            db.add(inv)

        # Registrar kardex
        mov = MovimientoInventario(
            variante_id=v.id,
            sucursal_id=data.sucursal_id,
            tipo_movimiento="ingreso",
            cantidad=data.cantidad,
            observaciones=data.observaciones or f"Ingreso comercial registrado por administración para {producto.nombre}"
        )
        db.add(mov)

    db.commit()
    return {
        "message": f"Ingreso registrado con éxito: +{data.cantidad} unidades en {sucursal.nombre} ({len(variantes_afectadas)} variantes actualizadas)."
    }


@router.post("/productos/{producto_id}/ingreso-matriz")
def registrar_ingreso_matriz(producto_id: int, data: StockMatrizInput, db: Session = Depends(get_db)):
    """Registra entrada de stock por matriz de talla y color para una prenda en una sucursal específica."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Prenda no encontrada.")

    sucursal = db.query(Sucursal).filter(Sucursal.id == data.sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada.")

    items_validos = [it for it in data.items if it.cantidad > 0]
    if not items_validos:
        raise HTTPException(status_code=400, detail="Debes ingresar al menos una cantidad mayor a 0.")

    total_unidades = 0
    variantes_actualizadas = 0

    for item in items_validos:
        variante = None
        if item.variante_id:
            variante = db.query(ProductoVariante).filter(
                ProductoVariante.id == item.variante_id,
                ProductoVariante.producto_id == producto_id
            ).first()

        if not variante:
            variante = db.query(ProductoVariante).filter(
                ProductoVariante.producto_id == producto_id,
                ProductoVariante.talla_id == item.talla_id,
                ProductoVariante.color_id == item.color_id
            ).first()

        if not variante:
            talla = db.query(Talla).filter(Talla.id == item.talla_id).first()
            color = db.query(Color).filter(Color.id == item.color_id).first()
            t_nom = talla.nombre if talla else str(item.talla_id)
            c_nom = color.nombre[:3].upper() if color else str(item.color_id)
            sku = f"SKU-{producto.id}-{t_nom}-{c_nom}-{int(datetime.now().timestamp()) % 10000}"
            variante = ProductoVariante(
                producto_id=producto_id,
                talla_id=item.talla_id,
                color_id=item.color_id,
                sku=sku,
                precio_adicional=0.0,
                activo=True
            )
            db.add(variante)
            db.flush()

        inv = db.query(InventarioSucursal).filter(
            InventarioSucursal.variante_id == variante.id,
            InventarioSucursal.sucursal_id == data.sucursal_id
        ).first()

        if inv:
            inv.cantidad_disponible += item.cantidad
        else:
            inv = InventarioSucursal(
                variante_id=variante.id,
                sucursal_id=data.sucursal_id,
                cantidad_disponible=item.cantidad,
                cantidad_reservada=0,
                stock_minimo=3
            )
            db.add(inv)

        mov = MovimientoInventario(
            variante_id=variante.id,
            sucursal_id=data.sucursal_id,
            tipo_movimiento="ingreso",
            cantidad=item.cantidad,
            observaciones=data.observaciones or f"Ingreso matriz por lote ({item.cantidad} Uds) para {producto.nombre}"
        )
        db.add(mov)

        total_unidades += item.cantidad
        variantes_actualizadas += 1

    db.commit()
    return {
        "message": f"¡Entrada registrada con éxito! +{total_unidades} prendas ingresadas en {sucursal.nombre} ({variantes_actualizadas} combinaciones de talla y color actualizadas).",
        "total_unidades": total_unidades,
        "variantes_actualizadas": variantes_actualizadas
    }


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
        raise HTTPException(status_code=400, detail="No se puede eliminar la categoría porque está asociada a productos registrados.")
    db.delete(cat)
    db.commit()
    return {"message": f"Categoría '{cat.nombre}' eliminada exitosamente."}

@router.put("/categorias/{categoria_id}", response_model=CategoriaOut)
def actualizar_categoria(categoria_id: int, data: CategoriaUpdate, db: Session = Depends(get_db)):
    cat = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    
    if data.nombre:
        existing = db.query(Categoria).filter(Categoria.nombre == data.nombre, Categoria.id != categoria_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe otra categoría con este nombre.")
        cat.nombre = data.nombre
    
    if data.descripcion is not None:
        cat.descripcion = data.descripcion

    db.commit()
    db.refresh(cat)
    return cat


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
        raise HTTPException(status_code=400, detail="No se puede eliminar la talla porque está asociada a productos registrados.")
    db.delete(talla)
    db.commit()
    return {"message": f"Talla '{talla.nombre}' eliminada exitosamente."}

@router.put("/tallas/{talla_id}", response_model=TallaOut)
def actualizar_talla(talla_id: int, data: TallaUpdate, db: Session = Depends(get_db)):
    talla = db.query(Talla).filter(Talla.id == talla_id).first()
    if not talla:
        raise HTTPException(status_code=404, detail="Talla no encontrada.")
    
    if data.nombre:
        existing = db.query(Talla).filter(Talla.nombre.ilike(data.nombre.strip()), Talla.id != talla_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe otra talla con este nombre.")
        talla.nombre = data.nombre.strip()
    
    if data.orden is not None:
        talla.orden = data.orden
    if data.guia_medidas is not None:
        talla.guia_medidas = data.guia_medidas

    db.commit()
    db.refresh(talla)
    return talla


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
        raise HTTPException(status_code=400, detail="No se puede eliminar el color porque está asociado a productos registrados.")
    db.delete(color)
    db.commit()
    return {"message": f"Color '{color.nombre}' eliminado exitosamente."}

@router.put("/colores/{color_id}", response_model=ColorOut)
def actualizar_color(color_id: int, data: ColorUpdate, db: Session = Depends(get_db)):
    color = db.query(Color).filter(Color.id == color_id).first()
    if not color:
        raise HTTPException(status_code=404, detail="Color no encontrado.")
    
    if data.nombre:
        existing = db.query(Color).filter(Color.nombre.ilike(data.nombre.strip()), Color.id != color_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe otro color con este nombre.")
        color.nombre = data.nombre.strip()
    
    if data.codigo_hex is not None:
        color.codigo_hex = data.codigo_hex

    db.commit()
    db.refresh(color)
    return color


# =============================================================================
# CIUDADES Y SUCURSALES (RF03, CU-05)
# =============================================================================
@router.get("/ciudades")
def listar_ciudades(db: Session = Depends(get_db)):
    """Lista todas las ciudades."""
    return db.query(Ciudad).all()

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


@router.get("/sucursales")
def listar_sucursales_admin(db: Session = Depends(get_db)):
    """Lista todas las sucursales, incluyendo estado activo, para el panel admin."""
    sucursales = db.query(Sucursal).options(joinedload(Sucursal.ciudad)).all()
    return [
        {
            "id": s.id,
            "nombre": s.nombre,
            "direccion": s.direccion,
            "telefono": s.telefono,
            "latitud": s.latitud,
            "longitud": s.longitud,
            "activo": s.activo,
            "ciudad": {
                "id": s.ciudad.id,
                "nombre": s.ciudad.nombre,
                "pais": s.ciudad.pais,
            } if s.ciudad else None
        }
        for s in sucursales
    ]

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


@router.delete("/sucursales/{sucursal_id}")
def eliminar_sucursal(sucursal_id: int, db: Session = Depends(get_db)):
    """Desactiva una sucursal para que no aparezca en el sistema."""
    sucursal = db.query(Sucursal).filter(Sucursal.id == sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada.")
    sucursal.activo = False
    db.commit()
    return {"message": f"Sucursal '{sucursal.nombre}' desactivada exitosamente."}


# =============================================================================
# PROVEEDORES Y TEMPORADAS (RF06, RF23, CU-08, CU-09)
# =============================================================================
@router.get("/proveedores")
def listar_proveedores(db: Session = Depends(get_db)):
    return db.query(Proveedor).filter(Proveedor.activo == True).all()


@router.post("/proveedores")
def crear_proveedor(data: ProveedorCreate, db: Session = Depends(get_db)):
    if data.ruc_nit:
        existing_nit = db.query(Proveedor).filter(Proveedor.ruc_nit == data.ruc_nit).first()
        if existing_nit:
            raise HTTPException(status_code=400, detail="El RUC/NIT ya está registrado.")

    if data.email:
        existing_email = db.query(Proveedor).filter(Proveedor.email == data.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="El correo electrónico de la empresa proveedora ya está registrado.")
        
        user_email = db.query(Usuario).filter(Usuario.email == data.email).first()
        if user_email:
            raise HTTPException(status_code=400, detail="El correo electrónico ya está en uso por otro usuario.")

    prov = Proveedor(
        nombre=data.nombre,
        ruc_nit=data.ruc_nit,
        contacto_nombre=data.contacto_nombre,
        telefono=data.telefono,
        email=data.email,
        direccion=data.direccion,
        activo=True
    )
    db.add(prov)
    db.commit()
    db.refresh(prov)

    # Crear cuenta de usuario para el proveedor
    if data.email:
        rol_prov = db.query(Rol).filter(Rol.nombre.ilike("PROVEEDOR")).first()
        if not rol_prov:
            rol_prov = Rol(nombre="PROVEEDOR", descripcion="Usuario Proveedor (A5)")
            db.add(rol_prov)
            db.commit()
            db.refresh(rol_prov)

        nuevo_usuario = Usuario(
            nombres=data.contacto_nombre or data.nombre,
            apellidos="[Proveedor]",
            email=data.email,
            telefono=data.telefono,
            password_hash=get_password_hash(data.ruc_nit or "Proveedor123!"),
            rol_id=rol_prov.id,
            activo=True
        )
        db.add(nuevo_usuario)
        db.commit()

    return prov


@router.get("/temporadas")
def listar_temporadas(db: Session = Depends(get_db)):
    return db.query(Temporada).all()


@router.post("/temporadas")
def crear_temporada(data: TemporadaCreate, db: Session = Depends(get_db)):
    if data.fecha_inicio and data.fecha_fin:
        if data.fecha_fin < data.fecha_inicio:
            raise HTTPException(status_code=400, detail="La fecha de fin de la temporada no puede ser anterior a la fecha de inicio.")

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


@router.delete("/proveedores/{proveedor_id}")
def eliminar_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    prov = db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado.")
    prov.activo = False
    db.commit()
    return {"message": f"Proveedor '{prov.nombre}' desactivado exitosamente."}


@router.delete("/temporadas/{temporada_id}")
def eliminar_temporada(temporada_id: int, db: Session = Depends(get_db)):
    temp = db.query(Temporada).filter(Temporada.id == temporada_id).first()
    if not temp:
        raise HTTPException(status_code=404, detail="Temporada no encontrada.")
    temp.activo = False
    db.commit()
    return {"message": f"Temporada '{temp.nombre}' desactivada exitosamente."}


@router.delete("/colecciones/{coleccion_id}")
def eliminar_coleccion(coleccion_id: int, db: Session = Depends(get_db)):
    col = db.query(Coleccion).filter(Coleccion.id == coleccion_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Colección no encontrada.")
    db.delete(col)
    db.commit()
    return {"message": f"Colección '{col.nombre}' eliminada exitosamente."}


# =============================================================================
# USUARIOS INTERNOS Y ROLES (RF02, CU-04)
# =============================================================================
@router.get("/roles")
def listar_roles(db: Session = Depends(get_db)):
    return db.query(Rol).all()


@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).options(joinedload(Usuario.rol), joinedload(Usuario.sucursal)).filter(Usuario.activo == True).all()
    return [
        {
            "id": u.id,
            "nombres": u.nombres,
            "apellidos": u.apellidos,
            "email": u.email,
            "telefono": u.telefono,
            "rol": u.rol.nombre if u.rol else "Sin rol",
            "rol_id": u.rol_id,
            "sucursal_id": u.sucursal_id,
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


@router.put("/usuarios/{usuario_id}")
def editar_usuario(usuario_id: int, data: UsuarioUpdate, db: Session = Depends(get_db)):
    """Edita la información de un usuario existente (incluyendo su rol, correo, contraseña)."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    if data.rol_id is not None:
        rol = db.query(Rol).filter(Rol.id == data.rol_id).first()
        if not rol:
            raise HTTPException(status_code=404, detail="Rol no válido.")
        usuario.rol_id = data.rol_id
        
    if data.nombres is not None:
        usuario.nombres = data.nombres
    if data.apellidos is not None:
        usuario.apellidos = data.apellidos
    if data.email is not None:
        usuario.email = data.email
    if data.telefono is not None:
        usuario.telefono = data.telefono
    if data.sucursal_id is not None:
        usuario.sucursal_id = data.sucursal_id
    if data.password is not None and len(data.password.strip()) > 0:
        usuario.password_hash = get_password_hash(data.password)

    db.commit()
    db.refresh(usuario)
    return {
        "message": f"Usuario '{usuario.nombres}' actualizado correctamente.",
        "usuario_id": usuario.id,
    }


@router.delete("/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: int, db: Session = Depends(get_db)):
    """Desactiva un empleado interno de la tienda."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    usuario.activo = False
    db.commit()
    return {"message": f"Empleado '{usuario.nombres} {usuario.apellidos}' desactivado exitosamente."}


# =============================================================================
# GESTIÓN DE ROLES (RF02, CU-04)
# =============================================================================
@router.post("/roles", response_model=RolOut, status_code=status.HTTP_201_CREATED)
def crear_rol(rol_in: RolCreate, db: Session = Depends(get_db)):
    """Crea un nuevo rol en el sistema."""
    rol_existente = db.query(Rol).filter(Rol.nombre == rol_in.nombre).first()
    if rol_existente:
        raise HTTPException(status_code=400, detail="El rol ya existe.")
    
    nuevo_rol = Rol(nombre=rol_in.nombre)
    db.add(nuevo_rol)
    db.commit()
    db.refresh(nuevo_rol)
    return nuevo_rol


@router.get("/roles", response_model=List[RolOut])
def listar_roles(db: Session = Depends(get_db)):
    """Lista todos los roles disponibles en el sistema."""
    return db.query(Rol).all()


@router.put("/roles/{rol_id}", response_model=RolOut)
def actualizar_rol(rol_id: int, rol_in: RolCreate, db: Session = Depends(get_db)):
    """Edita el nombre de un rol existente."""
    rol = db.query(Rol).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")
    
    rol_duplicado = db.query(Rol).filter(Rol.nombre == rol_in.nombre, Rol.id != rol_id).first()
    if rol_duplicado:
        raise HTTPException(status_code=400, detail="Ya existe otro rol con ese nombre.")
        
    rol.nombre = rol_in.nombre
    db.commit()
    db.refresh(rol)
    return rol


@router.delete("/roles/{rol_id}")
def eliminar_rol(rol_id: int, db: Session = Depends(get_db)):
    """Elimina un rol si no tiene usuarios asociados."""
    rol = db.query(Rol).filter(Rol.id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")
    
    usuarios_asociados = db.query(Usuario).filter(Usuario.rol_id == rol_id).first()
    if usuarios_asociados:
        raise HTTPException(status_code=400, detail="No se puede eliminar el rol porque tiene usuarios asociados.")
        
    db.delete(rol)
    db.commit()
    return {"message": f"Rol '{rol.nombre}' eliminado exitosamente."}

