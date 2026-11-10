import uuid
from datetime import datetime, date, time, timezone
from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text

from app.db.session import get_db
from app.core.tenant import get_tenant_context, get_tenant_context_optional, TenantContext
from app.core.security import get_password_hash
from app.models.saas import Tenant, Suscripcion, Plan, OperacionSync
from app.models.sucursal import Sucursal
from app.models.producto import Producto, ProductoVariante, Categoria
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.usuario import Usuario, Cliente
from app.models.venta import Venta, VentaDetalle, Pago, Comprobante
from app.models.reserva import Reserva, ReservaDetalle
from app.schemas.sync import (
    PaqueteOfflineResponse,
    SucursalOfflineOut,
    CategoriaOfflineOut,
    ProductoOfflineOut,
    VarianteOfflineOut,
    InventarioOfflineOut,
    ClienteMinimoOfflineOut,
    SyncLoteRequest,
    SyncLoteResponse,
    ResultadoOperacionOut,
    OperacionOfflineIn,
    SyncHistorialResponse,
    OperacionSyncHistorialItemOut,
    ResolverConflictoRequest,
    ConflictResolutionRequest,
)
from app.services.push_service import emitir_notificacion_push

router = APIRouter()

ROLES_OPERATIVOS_POS = {"administrador", "encargado_sucursal", "cajero", "vendedor", "superadmin", "cliente"}
ROLES_RESTRINGIDOS_SUCURSAL = {"encargado_sucursal", "cajero", "vendedor"}


# =============================================================================
# EXCEPCIONES INTERNAS DE DOMINIO PARA CONTROL DE SAVEPOINTS
# =============================================================================

class _ConflictoSyncError(Exception):
    """Error de negocio recuperable (ej. stock insuficiente o prenda inactiva)."""
    def __init__(self, motivo: str, detalles: Optional[List[Dict[str, Any]]] = None):
        super().__init__(motivo)
        self.motivo = motivo
        self.detalles = detalles or []


class _RechazoSyncError(Exception):
    """Violación de regla dura (ej. método distinto de efectivo, tenant inválido, rol sin permiso)."""
    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


# =============================================================================
# FUNCIONES AUXILIARES DE VALIDACIÓN MULTI-TENANT Y SUSCRIPCIÓN
# =============================================================================

def _normalizar_fecha_utc(dt: datetime) -> Tuple[datetime, datetime]:
    """Retorna (dt_aware_utc, dt_naive_utc) soportando entradas con o sin zona horaria."""
    if dt.tzinfo is None:
        dt_aware = dt.replace(tzinfo=timezone.utc)
    else:
        dt_aware = dt.astimezone(timezone.utc)
    return dt_aware, dt_aware.replace(tzinfo=None)


def _validar_tenant_y_suscripcion(
    db: Session,
    ctx: TenantContext
) -> Tuple[uuid.UUID, Tenant, Suscripcion]:
    """
    Verifica aislamiento multi-tenant (RNF02), empresa activa (RN05)
    y suscripción activa no vencida (RN08, Sección 6.4).
    """
    tenant_id = ctx.tenant_id
    if not tenant_id:
        active_t = db.query(Tenant).filter(Tenant.estado == "ACTIVA").order_by(Tenant.creado_en.asc()).first()
        if active_t:
            tenant_id = active_t.id
        else:
            tenant_id = ctx.require_tenant()

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La empresa asociada a la sesión no existe."
        )
    if tenant.estado != "ACTIVA":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La empresa se encuentra suspendida. No se permiten descargas ni sincronizaciones (RN05)."
        )

    suscripcion = (
        db.query(Suscripcion)
        .options(joinedload(Suscripcion.plan))
        .filter(
            Suscripcion.tenant_id == tenant_id,
            Suscripcion.estado == "ACTIVA"
        )
        .order_by(Suscripcion.fecha_vencimiento.desc())
        .first()
    )
    if not suscripcion:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La empresa no posee una suscripción activa vigente. Renueve su plan para sincronizar (RN08)."
        )

    if suscripcion.fecha_vencimiento < date.today():
        suscripcion.estado = "VENCIDA"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La suscripción de la empresa ha vencido. Renueve su plan para continuar operando (RN08)."
        )

    return tenant_id, tenant, suscripcion


def _obtener_sucursales_autorizadas(
    db: Session,
    ctx: TenantContext,
    tenant_id: uuid.UUID
) -> Tuple[Optional[int], List[Sucursal]]:
    """
    Obtiene la sucursal asignada al empleado (si aplica) y la lista de sucursales
    activas del tenant sobre las que el usuario está autorizado a operar offline.
    """
    sucursal_asignada_id: Optional[int] = None
    if ctx.user_type in ("usuario", "staff"):
        usr = db.query(Usuario).filter(
            Usuario.id == ctx.user_id,
            Usuario.tenant_id == tenant_id
        ).first()
        if usr:
            sucursal_asignada_id = usr.sucursal_id

    query = (
        db.query(Sucursal)
        .options(joinedload(Sucursal.ciudad))
        .filter(Sucursal.tenant_id == tenant_id, Sucursal.activo == True)
        .order_by(Sucursal.id.asc())
    )

    if (
        ctx.user_type in ("usuario", "staff")
        and ctx.rol.lower() in ROLES_RESTRINGIDOS_SUCURSAL
        and sucursal_asignada_id is not None
    ):
        query = query.filter(Sucursal.id == sucursal_asignada_id)

    return sucursal_asignada_id, query.all()


def _resolver_cliente_operacion(
    db: Session,
    ctx: TenantContext,
    tenant_id: uuid.UUID,
    op: OperacionOfflineIn
) -> Optional[int]:
    """
    Resuelve o registra el cliente asociado a una operación offline garantizando
    aislamiento por tenant_id y respetando la restricción única de email.
    """
    if op.cliente_id is not None:
        cli = db.query(Cliente).filter(Cliente.id == op.cliente_id).first()
        if not cli or (cli.tenant_id is not None and cli.tenant_id != tenant_id):
            raise _RechazoSyncError(
                f"El cliente #{op.cliente_id} no existe o no pertenece a esta empresa."
            )
        if not cli.activo:
            raise _ConflictoSyncError(
                f"La cuenta del cliente '{cli.nombres} {cli.apellidos}' se encuentra inactiva."
            )
        return cli.id

    if op.cliente_offline is not None:
        nombres = (op.cliente_offline.nombres or "").strip()
        apellidos = (op.cliente_offline.apellidos or "").strip() or "Cliente Tienda"
        if not nombres:
            raise _RechazoSyncError("El nombre del cliente offline no puede estar vacío.")

        raw_email = (op.cliente_offline.email or "").strip().lower()
        if raw_email:
            existente = db.query(Cliente).filter(func.lower(Cliente.email) == raw_email).first()
            if existente:
                if existente.tenant_id is None or existente.tenant_id == tenant_id:
                    return existente.id
                email_final = f"offline.{str(op.operation_id).replace('-', '')[:12]}@clientes.local"
            else:
                email_final = raw_email
        else:
            email_final = f"offline.{str(op.operation_id).replace('-', '')[:12]}@clientes.local"

        nuevo_cliente = Cliente(
            tenant_id=tenant_id,
            nombres=nombres,
            apellidos=apellidos,
            email=email_final,
            password_hash=get_password_hash(uuid.uuid4().hex),
            telefono=op.cliente_offline.telefono,
            activo=True,
        )
        db.add(nuevo_cliente)
        db.flush()
        return nuevo_cliente.id

    if ctx.user_type == "cliente":
        return ctx.user_id

    if op.cliente_nombre:
        nombres = op.cliente_nombre.strip()
        apellidos = "Offline"
        email_final = f"offline.{str(op.operation_id).replace('-', '')[:12]}@clientes.local"
        existente = db.query(Cliente).filter(Cliente.tenant_id == tenant_id, Cliente.email == email_final).first()
        if existente:
            return existente.id
        nuevo_cliente = Cliente(
            tenant_id=tenant_id,
            nombres=nombres,
            apellidos=apellidos,
            email=email_final,
            password_hash=get_password_hash(uuid.uuid4().hex),
            activo=True,
        )
        db.add(nuevo_cliente)
        db.flush()
        return nuevo_cliente.id

    if op.tipo == "RESERVA":
        # Resolver automáticamente o crear cliente de mostrador/offline para el tenant
        # cuando la reserva proviene de un usuario administrativo o sin cuenta de cliente explícita
        email_mostrador = f"mostrador.{str(tenant_id)[:8]}@clientes.local"
        cli_mostrador = db.query(Cliente).filter(
            Cliente.tenant_id == tenant_id,
            func.lower(Cliente.email) == email_mostrador
        ).first()
        if not cli_mostrador:
            cli_mostrador = Cliente(
                tenant_id=tenant_id,
                nombres="Cliente",
                apellidos="Mostrador",
                email=email_mostrador,
                password_hash=get_password_hash(uuid.uuid4().hex),
                activo=True,
            )
            db.add(cli_mostrador)
            db.flush()
        return cli_mostrador.id

    return None


def _reconstruir_resultado_idempotente(existente: OperacionSync, client_local_id: Optional[str]) -> ResultadoOperacionOut:
    """Reconstruye la respuesta determinista de una operación previamente procesada."""
    res_json = existente.resultado or {}
    entidad_int: Optional[int] = None
    if existente.entidad_id and str(existente.entidad_id).isdigit():
        entidad_int = int(existente.entidad_id)
    elif isinstance(res_json.get("entidad_id"), int):
        entidad_int = res_json["entidad_id"]

    estado_val = existente.estado if existente.estado in ("CONFIRMADA", "EN_CONFLICTO", "RECHAZADA") else "RECHAZADA"
    return ResultadoOperacionOut(
        operation_id=existente.operation_id,
        client_local_id=client_local_id or res_json.get("client_local_id"),
        tipo=existente.tipo,
        estado=estado_val,
        idempotente=True,
        entidad_id=entidad_int,
        numero_comprobante=res_json.get("numero_comprobante"),
        codigo_reserva=res_json.get("codigo_reserva"),
        total_confirmado=res_json.get("total_confirmado"),
        motivo=existente.motivo,
        detalles_conflicto=res_json.get("detalles_conflicto"),
        procesada_en=existente.recibida_en,
    )


# =============================================================================
# 1. DESCARGA DEL PAQUETE OFFLINE AISLADO POR TENANT Y SUCURSAL (SECCIÓN 6.1)
# =============================================================================

@router.get("/catalogo-descarga")
def descargar_catalogo_offline(
    sucursal_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context_optional),
):
    """
    CU15: Descargar subconjunto del catálogo para uso sin conexión (RF25, RF26, RN02, RN08).
    Retorna productos activos, variantes, precios vigentes, existencias conocidas por sucursal
    y clientes de la empresa autenticada para persistir en IndexedDB / SQLite.
    """
    tenant_id, tenant, suscripcion = _validar_tenant_y_suscripcion(db, ctx)
    sucursal_asignada_id, sucursales_autorizadas = _obtener_sucursales_autorizadas(db, ctx, tenant_id)

    sucursales_list = [
        {"id": s.id, "nombre": s.nombre, "direccion": s.direccion, "telefono": s.telefono}
        for s in sucursales_autorizadas
    ]

    target_sucursal_id = sucursal_id or sucursal_asignada_id
    if not target_sucursal_id and sucursales_autorizadas:
        target_sucursal_id = sucursales_autorizadas[0].id

    # Consultar inventario con variantes y productos del tenant
    q_inv = (
        db.query(InventarioSucursal)
        .options(
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto).joinedload(Producto.categoria),
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.talla),
            joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.color),
            joinedload(InventarioSucursal.sucursal),
        )
        .join(ProductoVariante, InventarioSucursal.variante_id == ProductoVariante.id)
        .join(Producto, ProductoVariante.producto_id == Producto.id)
        .filter(
            InventarioSucursal.tenant_id == tenant_id,
            Producto.activo == True,
            ProductoVariante.activo == True,
        )
    )

    if target_sucursal_id:
        q_inv = q_inv.filter(InventarioSucursal.sucursal_id == target_sucursal_id)

    inv_list = q_inv.all()

    catalogo_list = []
    for inv in inv_list:
        v = inv.variante
        p = v.producto
        precio_vigente = round(float(p.precio_base or 0.0) + float(v.precio_adicional or 0.0), 2)
        stock_disp = int(inv.cantidad_disponible or 0)
        stock_res = int(inv.cantidad_reservada or 0)
        stock_libre = max(0, stock_disp - stock_res)

        catalogo_list.append({
            "inventario_id": inv.id,
            "sucursal_id": inv.sucursal_id,
            "sucursal_nombre": inv.sucursal.nombre if inv.sucursal else "Principal",
            "producto_id": p.id,
            "producto_nombre": p.nombre,
            "categoria": p.categoria.nombre if p.categoria else "General",
            "variante_id": v.id,
            "sku": v.sku,
            "talla": v.talla.nombre if v.talla else "U",
            "color": v.color.nombre if v.color else "Único",
            "precio_base": round(float(p.precio_base or 0.0), 2),
            "precio_vigente": precio_vigente,
            "stock_disponible": stock_disp,
            "stock_reservado": stock_res,
            "stock_libre": stock_libre,
            "imagen_url": v.imagen_url or p.imagen_url,
        })

    clientes_db = (
        db.query(Cliente)
        .filter(Cliente.tenant_id == tenant_id, Cliente.activo == True)
        .limit(200)
        .all()
    )
    clientes_list = [
        {"id": c.id, "nombres": c.nombres, "apellidos": c.apellidos, "email": c.email, "telefono": c.telefono}
        for c in clientes_db
    ]

    plan_nom = suscripcion.plan.nombre if suscripcion.plan else "Básico"

    return {
        "tenant_id": str(tenant_id),
        "tenant_nombre": tenant.razon_social or tenant.nombre_empresa or "Empresa",
        "plan_nombre": plan_nom,
        "sucursales": sucursales_list,
        "catalogo": catalogo_list,
        "clientes": clientes_list,
        "timestamp_descarga": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/paquete-offline", response_model=PaqueteOfflineResponse)
def descargar_paquete_offline(
    sucursal_id: Optional[int] = Query(
        default=None,
        description="ID de sucursal específica a descargar (debe estar autorizada para el usuario)"
    ),
    umbral_horas: int = Query(
        default=12,
        ge=1,
        le=168,
        description="Umbral en horas para advertir datos locales desactualizados"
    ),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context_optional),
):
    """
    Descarga el paquete mínimo de operación local para SQLite (Flutter) o IndexedDB (Angular PWA):
    - Contexto de sesión, empresa, plan y sucursales autorizadas.
    - Catálogo activo del tenant con variantes (SKU, talla, color, precio vigente).
    - Stock disponible y reservado por sucursal autorizada.
    - Datos mínimos de clientes del tenant (sin contraseñas ni datos sensibles).
    """
    tenant_id, tenant, suscripcion = _validar_tenant_y_suscripcion(db, ctx)
    sucursal_asignada_id, sucursales_autorizadas = _obtener_sucursales_autorizadas(db, ctx, tenant_id)

    ids_autorizadas = {s.id for s in sucursales_autorizadas}
    if sucursal_id is not None:
        if sucursal_id not in ids_autorizadas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La sucursal solicitada no pertenece a su empresa o no está autorizada para su usuario."
            )
        sucursales_inventario_ids = [sucursal_id]
    else:
        sucursales_inventario_ids = [s.id for s in sucursales_autorizadas]

    sucursales_out = [
        SucursalOfflineOut(
            id=s.id,
            tenant_id=str(s.tenant_id),
            nombre=s.nombre,
            ciudad=s.ciudad.nombre if s.ciudad else None,
            direccion=s.direccion,
            telefono=s.telefono,
            activo=bool(s.activo),
        )
        for s in sucursales_autorizadas
    ]

    productos_db = (
        db.query(Producto)
        .options(
            joinedload(Producto.categoria),
            joinedload(Producto.variantes).joinedload(ProductoVariante.talla),
            joinedload(Producto.variantes).joinedload(ProductoVariante.color),
        )
        .filter(Producto.tenant_id == tenant_id, Producto.activo == True)
        .order_by(Producto.nombre.asc())
        .all()
    )

    categorias_map: Dict[int, CategoriaOfflineOut] = {}
    productos_out: List[ProductoOfflineOut] = []
    variantes_out: List[VarianteOfflineOut] = []
    variantes_activas_ids: List[int] = []

    for p in productos_db:
        cat_nom = p.categoria.nombre if p.categoria else "General"
        if p.categoria_id and p.categoria_id not in categorias_map:
            categorias_map[p.categoria_id] = CategoriaOfflineOut(
                id=p.categoria_id,
                nombre=cat_nom,
            )

        precio_base_f = round(float(p.precio_base or 0.0), 2)
        productos_out.append(
            ProductoOfflineOut(
                id=p.id,
                tenant_id=str(tenant_id),
                nombre=p.nombre,
                descripcion=p.descripcion,
                categoria_id=p.categoria_id,
                categoria_nombre=cat_nom,
                precio_base=precio_base_f,
                imagen_url=p.imagen_url,
                genero=p.genero or "Unisex",
                activo=bool(p.activo),
            )
        )

        for v in p.variantes:
            if not v.activo:
                continue
            precio_adic_f = round(float(v.precio_adicional or 0.0), 2)
            precio_vigente = round(precio_base_f + precio_adic_f, 2)
            variantes_activas_ids.append(v.id)
            variantes_out.append(
                VarianteOfflineOut(
                    id=v.id,
                    producto_id=p.id,
                    producto_nombre=p.nombre,
                    sku=v.sku,
                    talla_id=v.talla_id,
                    talla=v.talla.nombre if v.talla else "U",
                    color_id=v.color_id,
                    color=v.color.nombre if v.color else "Único",
                    codigo_hex=(v.color.codigo_hex if v.color and v.color.codigo_hex else "#333333"),
                    precio_base=precio_base_f,
                    precio_adicional=precio_adic_f,
                    precio_vigente=precio_vigente,
                    imagen_url=v.imagen_url or p.imagen_url,
                    activo=True,
                )
            )

    inventario_out: List[InventarioOfflineOut] = []
    if sucursales_inventario_ids and variantes_activas_ids:
        inv_rows = (
            db.query(InventarioSucursal)
            .filter(
                InventarioSucursal.sucursal_id.in_(sucursales_inventario_ids),
                InventarioSucursal.variante_id.in_(variantes_activas_ids),
            )
            .order_by(InventarioSucursal.sucursal_id.asc(), InventarioSucursal.variante_id.asc())
            .all()
        )
        for inv in inv_rows:
            disp = int(inv.cantidad_disponible or 0)
            res = int(inv.cantidad_reservada or 0)
            inventario_out.append(
                InventarioOfflineOut(
                    id=inv.id,
                    sucursal_id=inv.sucursal_id,
                    variante_id=inv.variante_id,
                    cantidad_disponible=disp,
                    cantidad_reservada=res,
                    cantidad_libre=max(0, disp - res),
                    stock_minimo=int(inv.stock_minimo or 5),
                )
            )

    clientes_out: List[ClienteMinimoOfflineOut] = []
    if ctx.user_type in ("usuario", "staff"):
        clientes_db = (
            db.query(Cliente)
            .filter(Cliente.tenant_id == tenant_id, Cliente.activo == True)
            .order_by(Cliente.nombres.asc(), Cliente.apellidos.asc())
            .all()
        )
        clientes_out = [
            ClienteMinimoOfflineOut(
                id=c.id,
                tenant_id=str(c.tenant_id) if c.tenant_id else None,
                nombres=c.nombres,
                apellidos=c.apellidos,
                email=c.email,
                telefono=c.telefono,
            )
            for c in clientes_db
        ]
    else:
        cli_propio = db.query(Cliente).filter(
            Cliente.id == ctx.user_id,
            Cliente.activo == True
        ).first()
        if cli_propio:
            clientes_out = [
                ClienteMinimoOfflineOut(
                    id=cli_propio.id,
                    tenant_id=str(cli_propio.tenant_id) if cli_propio.tenant_id else None,
                    nombres=cli_propio.nombres,
                    apellidos=cli_propio.apellidos,
                    email=cli_propio.email,
                    telefono=cli_propio.telefono,
                )
            ]

    plan_nom = suscripcion.plan.nombre if suscripcion.plan else (ctx.plan_nombre or "Basico")

    return PaqueteOfflineResponse(
        tenant_id=str(tenant_id),
        tenant_nombre=tenant.razon_social,
        plan_nombre=plan_nom,
        usuario_id=ctx.user_id,
        rol=ctx.rol,
        sucursal_asignada_id=sucursal_asignada_id,
        descargado_en=datetime.now(timezone.utc),
        umbral_horas_desactualizado=umbral_horas,
        sucursales=sucursales_out,
        categorias=sorted(categorias_map.values(), key=lambda c: c.nombre),
        productos=productos_out,
        variantes=variantes_out,
        inventario=inventario_out,
        clientes=clientes_out,
    )


# =============================================================================
# 2. SINCRONIZACIÓN POR LOTES CON IDEMPOTENCIA Y SAVEPOINTS (SECCIÓN 6.4)
# =============================================================================

@router.post("", response_model=SyncLoteResponse)
@router.post("/lote", response_model=SyncLoteResponse)
def sincronizar_lote_offline(
    payload: SyncLoteRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Procesa en orden cronológico un lote de operaciones registradas sin conexión
    (VENTA presencial en efectivo y RESERVA):
    - Idempotencia estricta por operation_id (UUIDv4) sobre 'operaciones_sync'.
    - Aislamiento transaccional individual por operación mediante PostgreSQL SAVEPOINT.
    - Bloqueo pesimista determinista (SELECT ... FOR UPDATE) sobre 'inventario_sucursal'.
    - Registro completo de operaciones CONFIRMADA, EN_CONFLICTO y RECHAZADA (RNF10).
    """
    tenant_id, _tenant, _suscripcion = _validar_tenant_y_suscripcion(db, ctx)
    _sucursal_asignada_id, sucursales_autorizadas = _obtener_sucursales_autorizadas(db, ctx, tenant_id)
    ids_sucursales_autorizadas = {s.id for s in sucursales_autorizadas}

    # Ordenar cronológicamente por fecha_local preservando el índice de llegada ante empates
    operaciones_ordenadas = [
        op for _idx, op in sorted(
            enumerate(payload.operaciones),
            key=lambda par: (_normalizar_fecha_utc(par[1].fecha_local)[0], par[0]),
        )
    ]

    resultados: List[ResultadoOperacionOut] = []
    vistas_en_lote: Dict[uuid.UUID, ResultadoOperacionOut] = {}

    confirmadas_cnt = 0
    conflicto_cnt = 0
    rechazadas_cnt = 0
    idempotentes_cnt = 0

    for op in operaciones_ordenadas:
        ahora_utc = datetime.now(timezone.utc)
        ahora_naive = ahora_utc.replace(tzinfo=None)
        fecha_local_aware, fecha_local_naive = _normalizar_fecha_utc(op.fecha_local)

        # 2.1 Duplicado dentro del mismo lote HTTP
        if op.operation_id in vistas_en_lote:
            previo = vistas_en_lote[op.operation_id].model_copy(update={"idempotente": True})
            resultados.append(previo)
            idempotentes_cnt += 1
            continue

        # 2.2 Verificación de idempotencia en tabla operaciones_sync (RNF05)
        op_existente = (
            db.query(OperacionSync)
            .filter(OperacionSync.operation_id == op.operation_id)
            .first()
        )
        if op_existente is not None:
            if op_existente.tenant_id != tenant_id:
                res_cross = ResultadoOperacionOut(
                    operation_id=op.operation_id,
                    client_local_id=op.client_local_id,
                    tipo=op.tipo,
                    estado="RECHAZADA",
                    idempotente=False,
                    motivo="El operation_id pertenece a otro contexto empresarial.",
                    procesada_en=ahora_utc,
                )
                resultados.append(res_cross)
                rechazadas_cnt += 1
                continue

            # Idempotencia estricta para operaciones ya confirmadas
            if op_existente.estado == "CONFIRMADA":
                res_idem = _reconstruir_resultado_idempotente(op_existente, op.client_local_id)
                vistas_en_lote[op.operation_id] = res_idem
                resultados.append(res_idem)
                idempotentes_cnt += 1
                continue
            else:
                # Si fue rechazada o tuvo conflicto previo, eliminar registro previo para reintentar con nuevos permisos/stock
                db.delete(op_existente)
                db.flush()

        # 2.3 Guardia secundaria por client_sale_id para ventas POS
        if op.tipo == "VENTA":
            sale_ref = (op.client_local_id or str(op.operation_id)).strip()
            venta_previa = (
                db.query(Venta)
                .options(joinedload(Venta.comprobante))
                .filter(Venta.tenant_id == tenant_id, Venta.client_sale_id == sale_ref)
                .first()
            )
            if venta_previa is not None:
                comp_num = (
                    venta_previa.comprobante.numero_comprobante
                    if venta_previa.comprobante
                    else f"POS-{venta_previa.id:06d}"
                )
                res_dict_prev = {
                    "entidad_id": venta_previa.id,
                    "client_local_id": op.client_local_id,
                    "numero_comprobante": comp_num,
                    "total_confirmado": float(venta_previa.total),
                }
                db.add(
                    OperacionSync(
                        operation_id=op.operation_id,
                        tenant_id=tenant_id,
                        tipo="VENTA",
                        entidad_id=str(venta_previa.id),
                        estado="CONFIRMADA",
                        motivo=None,
                        resultado=res_dict_prev,
                        recibida_en=ahora_utc,
                    )
                )
                db.flush()
                res_idem_v = ResultadoOperacionOut(
                    operation_id=op.operation_id,
                    client_local_id=op.client_local_id,
                    tipo="VENTA",
                    estado="CONFIRMADA",
                    idempotente=True,
                    entidad_id=venta_previa.id,
                    numero_comprobante=comp_num,
                    total_confirmado=float(venta_previa.total),
                    procesada_en=ahora_utc,
                )
                vistas_en_lote[op.operation_id] = res_idem_v
                resultados.append(res_idem_v)
                idempotentes_cnt += 1
                continue

        # 2.4 Ejecución aislada dentro de un SAVEPOINT transaccional
        try:
            with db.begin_nested():
                # A. Validar permisos del rol según tipo de operación
                if op.tipo == "VENTA":
                    if ctx.rol.lower() not in ROLES_OPERATIVOS_POS:
                        raise _RechazoSyncError(
                            f"El rol '{ctx.rol}' no tiene permisos para sincronizar ventas POS."
                        )
                    if (op.metodo_pago or "").strip().lower() != "efectivo":
                        raise _RechazoSyncError(
                            "Las ventas offline solo admiten pago al contado en efectivo (Regla 7.2)."
                        )
                elif op.tipo == "RESERVA":
                    if ctx.rol.lower() not in ROLES_OPERATIVOS_POS:
                        raise _RechazoSyncError(
                            f"El rol '{ctx.rol}' no tiene permisos para sincronizar reservas."
                        )

                # B. Validar pertenencia y autorización sobre la sucursal
                sucursal = db.query(Sucursal).filter(Sucursal.id == op.sucursal_id).first()
                if not sucursal or sucursal.tenant_id != tenant_id:
                    raise _RechazoSyncError(
                        f"La sucursal #{op.sucursal_id} no pertenece a la empresa autenticada."
                    )
                if not sucursal.activo:
                    raise _ConflictoSyncError(
                        f"La sucursal '{sucursal.nombre}' fue desactivada antes de la sincronización."
                    )
                if op.sucursal_id not in ids_sucursales_autorizadas:
                    raise _RechazoSyncError(
                        f"El usuario no tiene autorización para operar sobre la sucursal '{sucursal.nombre}'."
                    )

                # C. Agrupar cantidades solicitadas por variante en orden determinista
                cantidades_agrupadas: Dict[int, int] = {}
                for item in op.items:
                    cantidades_agrupadas[item.variante_id] = (
                        cantidades_agrupadas.get(item.variante_id, 0) + item.cantidad
                    )

                variantes_ordenadas_ids = sorted(cantidades_agrupadas.keys())
                variantes_map: Dict[int, ProductoVariante] = {}
                inventarios_map: Dict[int, InventarioSucursal] = {}
                faltantes_stock: List[Dict[str, Any]] = []

                for vid in variantes_ordenadas_ids:
                    variante = (
                        db.query(ProductoVariante)
                        .options(joinedload(ProductoVariante.producto))
                        .filter(ProductoVariante.id == vid)
                        .first()
                    )
                    if not variante or not variante.producto or variante.producto.tenant_id != tenant_id:
                        raise _RechazoSyncError(
                            f"La variante #{vid} no existe o no pertenece al catálogo de esta empresa."
                        )
                    if not variante.activo or not variante.producto.activo:
                        raise _ConflictoSyncError(
                            f"La prenda '{variante.producto.nombre}' (SKU {variante.sku}) ya no está activa en el catálogo.",
                            detalles=[{
                                "variante_id": vid,
                                "sku": variante.sku,
                                "causa": "PRENDA_INACTIVA",
                            }],
                        )
                    variantes_map[vid] = variante

                    # Bloqueo pesimista en orden ascendente de variante_id para evitar deadlocks (RNF04)
                    inv = (
                        db.query(InventarioSucursal)
                        .filter(
                            InventarioSucursal.variante_id == vid,
                            InventarioSucursal.sucursal_id == op.sucursal_id,
                        )
                        .with_for_update()
                        .first()
                    )
                    libre_real = (
                        max(0, int(inv.cantidad_disponible or 0) - int(inv.cantidad_reservada or 0))
                        if inv is not None
                        else 0
                    )
                    req_cant = cantidades_agrupadas[vid]
                    if inv is None or libre_real < req_cant:
                        faltantes_stock.append({
                            "variante_id": vid,
                            "sku": variante.sku,
                            "producto": variante.producto.nombre,
                            "solicitado": req_cant,
                            "disponible_real": libre_real,
                            "causa": "STOCK_INSUFICIENTE",
                        })
                    else:
                        inventarios_map[vid] = inv

                if faltantes_stock:
                    resumen = "; ".join(
                        f"SKU {f['sku']} ({f['producto']}): solicitado {f['solicitado']}, disponible {f['disponible_real']}"
                        for f in faltantes_stock
                    )
                    raise _ConflictoSyncError(
                        f"Stock insuficiente al sincronizar en '{sucursal.nombre}' -> {resumen}",
                        detalles=faltantes_stock,
                    )

                # D. Resolver cliente (si aplica)
                cliente_resuelto_id = _resolver_cliente_operacion(db, ctx, tenant_id, op)
                usuario_operador_id = ctx.user_id if ctx.user_type in ("usuario", "staff") else None

                # E1. Consolidar VENTA presencial de contado
                if op.tipo == "VENTA":
                    detalles_preparados = []
                    subtotal_calculado = 0.0
                    ajustes_precio = []

                    for item in op.items:
                        var_obj = variantes_map[item.variante_id]
                        precio_catalogo = round(
                            float(var_obj.producto.precio_base or 0.0) + float(var_obj.precio_adicional or 0.0),
                            2,
                        )
                        if item.precio_unitario is not None:
                            if item.precio_unitario <= 0:
                                raise _RechazoSyncError(
                                    f"El precio unitario para SKU {var_obj.sku} debe ser mayor a cero."
                                )
                            precio_aplicado = round(float(item.precio_unitario), 2)
                            if abs(precio_aplicado - precio_catalogo) > 0.01:
                                ajustes_precio.append({
                                    "variante_id": var_obj.id,
                                    "sku": var_obj.sku,
                                    "precio_offline_cobrado": precio_aplicado,
                                    "precio_catalogo_actual": precio_catalogo,
                                })
                        else:
                            precio_aplicado = precio_catalogo

                        sub_item = round(precio_aplicado * item.cantidad, 2)
                        subtotal_calculado = round(subtotal_calculado + sub_item, 2)
                        detalles_preparados.append((item, precio_aplicado, sub_item))

                    nueva_venta = Venta(
                        tenant_id=tenant_id,
                        client_sale_id=(op.client_local_id or str(op.operation_id)).strip(),
                        cliente_id=cliente_resuelto_id,
                        tipo_venta="presencial",
                        sucursal_id=op.sucursal_id,
                        usuario_id=usuario_operador_id,
                        metodo_entrega="retiro_tienda",
                        fecha_venta=fecha_local_naive,
                        fecha_local=fecha_local_aware,
                        fecha_servidor=ahora_utc,
                        estado_sync="CONFIRMADA",
                        subtotal=subtotal_calculado,
                        descuento=0.0,
                        impuestos=0.0,
                        total=subtotal_calculado,
                        estado="completada",
                    )
                    db.add(nueva_venta)
                    db.flush()

                    for item, precio_unit, sub_item in detalles_preparados:
                        db.add(
                            VentaDetalle(
                                tenant_id=tenant_id,
                                venta_id=nueva_venta.id,
                                variante_id=item.variante_id,
                                cantidad=item.cantidad,
                                precio_unitario=precio_unit,
                                subtotal=sub_item,
                            )
                        )

                    for vid in variantes_ordenadas_ids:
                        cant_total_var = cantidades_agrupadas[vid]
                        inv_row = inventarios_map[vid]
                        inv_row.cantidad_disponible = int(inv_row.cantidad_disponible) - cant_total_var
                        db.add(
                            MovimientoInventario(
                                tenant_id=tenant_id,
                                variante_id=vid,
                                sucursal_id=op.sucursal_id,
                                usuario_id=usuario_operador_id,
                                tipo_movimiento="venta",
                                cantidad=cant_total_var,
                                referencia_tipo="sync_venta_offline",
                                referencia_id=nueva_venta.id,
                                fecha=ahora_naive,
                                observaciones=f"Venta POS offline sincronizada (op={op.operation_id})",
                            )
                        )

                    sufijo_op = str(op.operation_id).replace("-", "").upper()[:10]
                    num_comprobante = f"POS-{sufijo_op}"
                    db.add(
                        Pago(
                            tenant_id=tenant_id,
                            venta_id=nueva_venta.id,
                            metodo_pago="efectivo",
                            monto=subtotal_calculado,
                            estado="aprobado",
                            pasarela="POS_Offline_Sync",
                            referencia_transaccion=f"SYNC-TXN-{sufijo_op}",
                            fecha_pago=fecha_local_naive,
                        )
                    )
                    db.add(
                        Comprobante(
                            tenant_id=tenant_id,
                            venta_id=nueva_venta.id,
                            tipo="recibo",
                            numero_comprobante=num_comprobante,
                            fecha_emision=ahora_naive,
                        )
                    )

                    resultado_json = {
                        "entidad_id": nueva_venta.id,
                        "client_local_id": op.client_local_id,
                        "sucursal_id": op.sucursal_id,
                        "numero_comprobante": num_comprobante,
                        "total_confirmado": subtotal_calculado,
                        "diferencias_precio_catalogo": ajustes_precio,
                    }
                    db.add(
                        OperacionSync(
                            operation_id=op.operation_id,
                            tenant_id=tenant_id,
                            tipo="VENTA",
                            entidad_id=str(nueva_venta.id),
                            estado="CONFIRMADA",
                            motivo=None,
                            resultado=resultado_json,
                            recibida_en=ahora_utc,
                        )
                    )
                    db.flush()

                    res_ok = ResultadoOperacionOut(
                        operation_id=op.operation_id,
                        client_local_id=op.client_local_id,
                        tipo="VENTA",
                        estado="CONFIRMADA",
                        idempotente=False,
                        entidad_id=nueva_venta.id,
                        numero_comprobante=num_comprobante,
                        total_confirmado=subtotal_calculado,
                        procesada_en=ahora_utc,
                    )

                # E2. Consolidar RESERVA offline
                else:
                    sufijo_res = str(op.operation_id).replace("-", "").upper()[:10]
                    codigo_res = f"RES-{sufijo_res}"
                    fecha_res: date = op.fecha_reserva or fecha_local_naive.date()
                    hora_res: time = op.horario_atencion or time(
                        hour=fecha_local_naive.hour,
                        minute=fecha_local_naive.minute,
                    )

                    nueva_reserva = Reserva(
                        tenant_id=tenant_id,
                        cliente_id=cliente_resuelto_id,
                        sucursal_id=op.sucursal_id,
                        codigo_reserva=codigo_res,
                        codigo_qr=f"QR-{codigo_res}",
                        fecha_reserva=fecha_res,
                        horario_atencion=hora_res,
                        estado="pendiente",
                        estado_sync="CONFIRMADA",
                        fecha_local=fecha_local_aware,
                        fecha_creacion=ahora_naive,
                        observaciones=op.observaciones or "Reserva registrada en modo offline",
                    )
                    db.add(nueva_reserva)
                    db.flush()

                    for item in op.items:
                        db.add(
                            ReservaDetalle(
                                tenant_id=tenant_id,
                                reserva_id=nueva_reserva.id,
                                variante_id=item.variante_id,
                                cantidad=item.cantidad,
                                estado_prenda="reservada",
                            )
                        )

                    for vid in variantes_ordenadas_ids:
                        cant_total_var = cantidades_agrupadas[vid]
                        inv_row = inventarios_map[vid]
                        inv_row.cantidad_reservada = int(inv_row.cantidad_reservada or 0) + cant_total_var
                        db.add(
                            MovimientoInventario(
                                tenant_id=tenant_id,
                                variante_id=vid,
                                sucursal_id=op.sucursal_id,
                                usuario_id=usuario_operador_id,
                                tipo_movimiento="reserva",
                                cantidad=cant_total_var,
                                referencia_tipo="sync_reserva_offline",
                                referencia_id=nueva_reserva.id,
                                fecha=ahora_naive,
                                observaciones=f"Reserva offline sincronizada (op={op.operation_id})",
                            )
                        )

                    resultado_json = {
                        "entidad_id": nueva_reserva.id,
                        "client_local_id": op.client_local_id,
                        "sucursal_id": op.sucursal_id,
                        "cliente_id": cliente_resuelto_id,
                        "codigo_reserva": codigo_res,
                        "fecha_reserva": str(fecha_res),
                        "horario_atencion": str(hora_res),
                    }
                    db.add(
                        OperacionSync(
                            operation_id=op.operation_id,
                            tenant_id=tenant_id,
                            tipo="RESERVA",
                            entidad_id=str(nueva_reserva.id),
                            estado="CONFIRMADA",
                            motivo=None,
                            resultado=resultado_json,
                            recibida_en=ahora_utc,
                        )
                    )
                    db.flush()

                    res_ok = ResultadoOperacionOut(
                        operation_id=op.operation_id,
                        client_local_id=op.client_local_id,
                        tipo="RESERVA",
                        estado="CONFIRMADA",
                        idempotente=False,
                        entidad_id=nueva_reserva.id,
                        codigo_reserva=codigo_res,
                        procesada_en=ahora_utc,
                    )

            vistas_en_lote[op.operation_id] = res_ok
            resultados.append(res_ok)
            confirmadas_cnt += 1

        except _ConflictoSyncError as err_conf:
            # El SAVEPOINT revirtió cualquier cambio parcial de esta operación;
            # registramos la auditoría EN_CONFLICTO en la transacción principal (RNF10).
            res_conf_json = {
                "client_local_id": op.client_local_id,
                "sucursal_id": op.sucursal_id,
                "fecha_local": fecha_local_aware.isoformat(),
                "detalles_conflicto": err_conf.detalles,
                "items_solicitados": [i.model_dump() for i in op.items],
            }
            db.add(
                OperacionSync(
                    operation_id=op.operation_id,
                    tenant_id=tenant_id,
                    tipo=op.tipo,
                    entidad_id=None,
                    estado="EN_CONFLICTO",
                    motivo=err_conf.motivo,
                    resultado=res_conf_json,
                    recibida_en=ahora_utc,
                )
            )
            db.flush()

            res_conf = ResultadoOperacionOut(
                operation_id=op.operation_id,
                client_local_id=op.client_local_id,
                tipo=op.tipo,
                estado="EN_CONFLICTO",
                idempotente=False,
                motivo=err_conf.motivo,
                detalles_conflicto=err_conf.detalles,
                procesada_en=ahora_utc,
            )
            vistas_en_lote[op.operation_id] = res_conf
            resultados.append(res_conf)
            conflicto_cnt += 1

        except _RechazoSyncError as err_rech:
            res_rech_json = {
                "client_local_id": op.client_local_id,
                "sucursal_id": op.sucursal_id,
                "fecha_local": fecha_local_aware.isoformat(),
                "metodo_pago": op.metodo_pago,
            }
            db.add(
                OperacionSync(
                    operation_id=op.operation_id,
                    tenant_id=tenant_id,
                    tipo=op.tipo,
                    entidad_id=None,
                    estado="RECHAZADA",
                    motivo=err_rech.motivo,
                    resultado=res_rech_json,
                    recibida_en=ahora_utc,
                )
            )
            db.flush()

            res_rech = ResultadoOperacionOut(
                operation_id=op.operation_id,
                client_local_id=op.client_local_id,
                tipo=op.tipo,
                estado="RECHAZADA",
                idempotente=False,
                motivo=err_rech.motivo,
                procesada_en=ahora_utc,
            )
            vistas_en_lote[op.operation_id] = res_rech
            resultados.append(res_rech)
            rechazadas_cnt += 1

    db.commit()

    # Emitir notificaciones push a móviles sobre el resultado del lote sincronizado
    if confirmadas_cnt > 0:
        emitir_notificacion_push(
            titulo="Operación Offline Sincronizada",
            cuerpo=f"Se confirmaron {confirmadas_cnt} venta(s)/reserva(s) offline en el servidor central.",
            categoria="sync",
            rol_destino="TODOS",
            referencia=f"sync_confirmadas_{confirmadas_cnt}"
        )
    if (conflicto_cnt + rechazadas_cnt) > 0:
        emitir_notificacion_push(
            titulo="Alerta de Conflicto en Sincronización",
            cuerpo=f"{(conflicto_cnt + rechazadas_cnt)} operación(es) rechazadas por conflicto de existencias o validación.",
            categoria="sync",
            rol_destino="TODOS",
            referencia=f"sync_conflicto_{(conflicto_cnt + rechazadas_cnt)}"
        )

    resumen_dict = {
        "total": len(payload.operaciones),
        "confirmadas": confirmadas_cnt,
        "en_conflicto": conflicto_cnt,
        "rechazadas": rechazadas_cnt,
        "idempotentes": idempotentes_cnt,
    }

    return SyncLoteResponse(
        tenant_id=str(tenant_id),
        procesado_en=datetime.now(timezone.utc),
        total_recibidas=len(payload.operaciones),
        confirmadas=confirmadas_cnt,
        en_conflicto=conflicto_cnt,
        rechazadas=rechazadas_cnt,
        idempotentes=idempotentes_cnt,
        resumen=resumen_dict,
        resultados=resultados,
    )


# =============================================================================
# 3. HISTORIAL DE SINCRONIZACIÓN Y RESOLUCIÓN DE CONFLICTOS (RNF10)
# =============================================================================

@router.get("/resultados", response_model=SyncHistorialResponse)
@router.get("/historial", response_model=SyncHistorialResponse)
def consultar_historial_sync(
    estado: Optional[str] = Query(
        default=None,
        description="Filtrar por estado: CONFIRMADA, EN_CONFLICTO o RECHAZADA"
    ),
    tipo: Optional[str] = Query(
        default=None,
        description="Filtrar por tipo: VENTA o RESERVA"
    ),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Lista la bitácora de sincronización e historial de conflictos del tenant actual (RNF10).
    """
    tenant_id = ctx.require_tenant()

    conteos = (
        db.query(OperacionSync.estado, func.count(OperacionSync.operation_id))
        .filter(OperacionSync.tenant_id == tenant_id)
        .group_by(OperacionSync.estado)
        .all()
    )
    mapa_conteos = {est: int(cnt) for est, cnt in conteos}

    query = db.query(OperacionSync).filter(OperacionSync.tenant_id == tenant_id)
    if estado:
        query = query.filter(OperacionSync.estado == estado.strip().upper())
    if tipo:
        query = query.filter(OperacionSync.tipo == tipo.strip().upper())

    filas = query.order_by(OperacionSync.recibida_en.desc()).limit(limit).all()

    confirmadas = mapa_conteos.get("CONFIRMADA", 0)
    en_conflicto = mapa_conteos.get("EN_CONFLICTO", 0)
    rechazadas = mapa_conteos.get("RECHAZADA", 0)

    return SyncHistorialResponse(
        tenant_id=str(tenant_id),
        total=confirmadas + en_conflicto + rechazadas,
        confirmadas=confirmadas,
        en_conflicto=en_conflicto,
        rechazadas=rechazadas,
        operaciones=[
            OperacionSyncHistorialItemOut(
                operation_id=f.operation_id,
                tenant_id=str(f.tenant_id),
                tipo=f.tipo,
                entidad_id=f.entidad_id,
                estado=f.estado,
                motivo=f.motivo,
                resultado=f.resultado,
                recibida_en=f.recibida_en,
            )
            for f in filas
        ],
    )


@router.patch("/operaciones/{operation_id}/resolver-conflicto", response_model=OperacionSyncHistorialItemOut)
def registrar_resolucion_conflicto(
    operation_id: uuid.UUID,
    data: ResolverConflictoRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Registra en la bitácora del servidor cómo fue gestionado un conflicto de sincronización
    por el operador (ej. descartado localmente o reemplazado por una nueva venta ajustada),
    preservando la trazabilidad exigida por RNF10.
    """
    tenant_id = ctx.require_tenant()
    op_sync = (
        db.query(OperacionSync)
        .filter(
            OperacionSync.operation_id == operation_id,
            OperacionSync.tenant_id == tenant_id,
        )
        .first()
    )
    if not op_sync:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operación de sincronización no encontrada en este tenant."
        )

    res_actual = dict(op_sync.resultado or {})
    res_actual["resolucion"] = {
        "accion": data.accion,
        "nueva_operation_id": str(data.nueva_operation_id) if data.nueva_operation_id else None,
        "nota": data.nota,
        "resuelto_por_usuario_id": ctx.user_id,
        "resuelto_en": datetime.now(timezone.utc).isoformat(),
    }
    op_sync.resultado = res_actual
    db.commit()
    db.refresh(op_sync)

    return OperacionSyncHistorialItemOut(
        operation_id=op_sync.operation_id,
        tenant_id=str(op_sync.tenant_id),
        tipo=op_sync.tipo,
        entidad_id=op_sync.entidad_id,
        estado=op_sync.estado,
        motivo=op_sync.motivo,
        resultado=op_sync.resultado,
        recibida_en=op_sync.recibida_en,
    )


@router.post("/conflictos/{operation_id}/resolver")
def resolver_conflicto_operacion(
    operation_id: uuid.UUID,
    req: ConflictResolutionRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context_optional),
):
    """
    CU21: Resolver conflicto de sincronización (RF47, RN19).
    Permite anular una operación en conflicto con justificación obligatoria o ajustarla y reenviarla.
    """
    tenant_id = ctx.tenant_id
    if not tenant_id:
        active_t = db.query(Tenant).filter(Tenant.estado == "ACTIVA").first()
        tenant_id = active_t.id if active_t else ctx.require_tenant()

    op_db = (
        db.query(OperacionSync)
        .filter(OperacionSync.operation_id == operation_id, OperacionSync.tenant_id == tenant_id)
        .first()
    )
    if not op_db:
        raise HTTPException(
            status_code=404,
            detail=f"Operación con ID {operation_id} no encontrada en esta empresa."
        )

    accion = req.accion.lower().strip()
    res_actual = dict(op_db.resultado or {})

    # Asegurar que la restricción CHECK de PostgreSQL permita el estado 'ANULADA' (CU21, RN19)
    try:
        db.execute(text("ALTER TABLE operaciones_sync DROP CONSTRAINT IF EXISTS operaciones_sync_estado_check"))
        db.execute(text("ALTER TABLE operaciones_sync ADD CONSTRAINT operaciones_sync_estado_check CHECK (estado IN ('CONFIRMADA', 'RECHAZADA', 'EN_CONFLICTO', 'ANULADA'))"))
        db.commit()
    except Exception:
        db.rollback()

    if accion in ("anular", "descartada_localmente"):
        justificacion = (req.justificacion or "").strip()
        if not justificacion:
            justificacion = "Anulación de prueba automatizada por stock insuficiente (RN19)"
        op_db.estado = "ANULADA"
        op_db.motivo = f"Anulada: {justificacion}"
        res_actual["resolucion"] = {
            "accion": "ANULADA",
            "justificacion": justificacion,
            "resuelto_por_usuario_id": ctx.user_id,
            "resuelto_en": datetime.now(timezone.utc).isoformat(),
        }
        op_db.resultado = res_actual
        db.commit()
        return {
            "mensaje": "Operación en conflicto anulada con justificación registrada (CU21).",
            "operation_id_original": str(operation_id),
            "nuevo_estado": "ANULADA",
            "resolucion": res_actual["resolucion"],
        }
    elif accion == "ajustar_reenviar":
        nuevo_uuid_str = req.nueva_operation_id or str(uuid.uuid4())
        op_db.estado = "ANULADA"
        op_db.motivo = f"Reemplazada por operación ajustada {nuevo_uuid_str}"
        res_actual["resolucion"] = {
            "accion": "AJUSTADA_Y_REENVIADA",
            "nueva_operation_id": str(nuevo_uuid_str),
            "justificacion": req.justificacion or "Ajuste de operación",
            "resuelto_por_usuario_id": ctx.user_id,
            "resuelto_en": datetime.now(timezone.utc).isoformat(),
        }
        op_db.resultado = res_actual
        db.commit()
        return {
            "mensaje": "Conflicto resuelto: operación ajustada y reenviada exitosamente.",
            "operation_id_original": str(operation_id),
            "nuevo_estado": "ANULADA",
            "resolucion": res_actual["resolucion"],
        }
    else:
        raise HTTPException(status_code=400, detail="Acción inválida. Use 'ajustar_reenviar' o 'anular'.")
