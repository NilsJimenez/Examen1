import uuid
from datetime import datetime, date, time as dt_time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.saas import Tenant, Plan, Suscripcion, OperacionSync
from app.models.producto import Producto, ProductoVariante
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.sucursal import Sucursal
from app.models.usuario import Usuario, Cliente
from app.models.venta import Venta, VentaDetalle, Pago, Comprobante
from app.models.reserva import Reserva, ReservaDetalle

router = APIRouter()


# =============================================================================
# SCHEMAS PARA PAQUETE C: OPERACION OFFLINE Y SINCRONIZACION (CU15-CU22)
# =============================================================================
class SyncItemPayload(BaseModel):
    variante_id: int
    sku: Optional[str] = None
    nombre: Optional[str] = None
    talla: Optional[str] = None
    color: Optional[str] = None
    cantidad: int = Field(gt=0)
    precio_unitario: Optional[float] = 0.0


class SyncOperationPayload(BaseModel):
    operation_id: str  # UUID v4 generado en el cliente (IndexedDB / SQLite)
    tipo: str  # 'VENTA' | 'RESERVA'
    sucursal_id: int
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = "Cliente Local (Offline)"
    metodo_pago: Optional[str] = "efectivo"  # RN11: Solo efectivo en modo offline
    fecha_local: Optional[str] = None  # ISO datetime cuando se creó sin conexión
    fecha_reserva: Optional[str] = None  # YYYY-MM-DD para reservas
    horario_atencion: Optional[str] = "15:00"
    observaciones: Optional[str] = None
    operacion_origen_id: Optional[str] = None  # Si proviene de resolución de conflicto (CU21)
    items: List[SyncItemPayload]


class SyncBatchRequest(BaseModel):
    operaciones: List[SyncOperationPayload]


class ConflictResolutionRequest(BaseModel):
    accion: str  # 'ajustar_reenviar' | 'anular'
    justificacion: Optional[str] = None
    nueva_operation_id: Optional[str] = None
    items_ajustados: Optional[List[SyncItemPayload]] = None


# =============================================================================
# CU15 & CU16: DESCARGAR Y CONSULTAR SUBCONJUNTO DEL CATALOGO PARA USO OFFLINE
# =============================================================================
@router.get("/catalogo-descarga")
def descargar_catalogo_offline(
    sucursal_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """
    CU15: Descargar subconjunto del catálogo para uso sin conexión (RF25, RF26, RN02, RN08).
    Retorna productos activos, variantes, precios vigentes, existencias conocidas por sucursal
    y clientes frecuentes de la empresa autenticada para persistir en IndexedDB / SQLite.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="El usuario no pertenece a una empresa (tenant) activa.")

    # Verificar que la suscripción de la empresa esté activa (RN08)
    sub = (
        db.query(Suscripcion)
        .filter(Suscripcion.tenant_id == tenant_id, Suscripcion.estado == "ACTIVA")
        .first()
    )
    if not sub or sub.fecha_vencimiento < date.today():
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="SuscripcionVencida: No se puede descargar el catálogo offline con una suscripción vencida o inactiva (RN08)."
        )

    # Si es encargado/cajero con sucursal asignada, priorizar su sucursal
    usr_db = db.query(Usuario).get(current_user["id"])
    if current_user["role"] in ["encargado_sucursal", "cajero"] and usr_db and usr_db.sucursal_id:
        sucursal_id = usr_db.sucursal_id

    # Sucursales activas de la empresa
    q_suc = db.query(Sucursal).filter(Sucursal.tenant_id == tenant_id, Sucursal.activo == True)
    sucursales_db = q_suc.all()
    sucursales_list = [
        {"id": s.id, "nombre": s.nombre, "direccion": s.direccion, "telefono": s.telefono}
        for s in sucursales_db
    ]

    if not sucursal_id and sucursales_list:
        sucursal_id = sucursales_list[0]["id"]

    # Inventario por sucursal y variantes de la empresa
    q_inv = db.query(InventarioSucursal).options(
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.producto).joinedload(Producto.categoria),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.talla),
        joinedload(InventarioSucursal.variante).joinedload(ProductoVariante.color),
        joinedload(InventarioSucursal.sucursal)
    ).filter(InventarioSucursal.tenant_id == tenant_id)

    if sucursal_id:
        q_inv = q_inv.filter(InventarioSucursal.sucursal_id == sucursal_id)

    inventarios = q_inv.all()

    catalogo_items = []
    for inv in inventarios:
        var = inv.variante
        if not var or not var.producto or not var.producto.activo:
            continue
        prod = var.producto
        precio_vigente = float(prod.precio_base or 0) + float(var.precio_adicional or 0)
        disp = int(inv.cantidad_disponible or 0)
        res = int(inv.cantidad_reservada or 0)
        stock_libre = max(0, disp - res)

        catalogo_items.append({
            "inventario_id": inv.id,
            "variante_id": var.id,
            "producto_id": prod.id,
            "sku": var.sku,
            "nombre": prod.nombre,
            "categoria": prod.categoria.nombre if prod.categoria else "General",
            "talla": var.talla.nombre if var.talla else "U",
            "color": var.color.nombre if var.color else "Único",
            "color_hex": var.color.codigo_hex if var.color else "#334155",
            "imagen_url": prod.imagen_url,
            "precio_unitario": round(precio_vigente, 2),
            "sucursal_id": inv.sucursal_id,
            "sucursal_nombre": inv.sucursal.nombre if inv.sucursal else f"Sucursal #{inv.sucursal_id}",
            "cantidad_disponible": disp,
            "cantidad_reservada": res,
            "existencia_local_conocida": stock_libre
        })

    # Clientes básicos de la empresa para reservas offline (CU17)
    clientes_db = (
        db.query(Cliente)
        .filter(Cliente.tenant_id == tenant_id)
        .order_by(Cliente.id.asc())
        .limit(50)
        .all()
    )
    clientes_list = [
        {
            "id": c.id,
            "nombre_completo": f"{c.nombres} {c.apellidos}".strip(),
            "telefono": c.telefono or "",
            "ci_nit": getattr(c, "ci_nit", "") or ""
        }
        for c in clientes_db
    ]

    ahora_iso = datetime.utcnow().isoformat() + "Z"
    return {
        "tenant_id": str(tenant_id),
        "sucursal_id_descargada": sucursal_id,
        "fecha_descarga": ahora_iso,
        "vigencia_horas_recomendada": 24,
        "total_variantes": len(catalogo_items),
        "sucursales": sucursales_list,
        "clientes": clientes_list,
        "catalogo": catalogo_items
    }


# =============================================================================
# FUNCION INTERNA: PROCESAR UNA OPERACION OFFLINE CON SAVEPOINT (RN08, RN11, RN13, RN14)
# =============================================================================
def _procesar_operacion_individual(
    db: Session,
    op: SyncOperationPayload,
    tenant_id: uuid.UUID,
    usuario_id: int
) -> Dict[str, Any]:
    """
    Procesa una operación offline dentro de un SAVEPOINT (db.begin_nested()).
    Garantiza idempotencia por operation_id (RN13, RNF05) y aislamiento de fallos.
    """
    try:
        op_uuid = uuid.UUID(str(op.operation_id))
    except ValueError:
        op_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, str(op.operation_id))

    # 1. Verificar idempotencia (RN13 / RNF05 / CP-I03): ¿Ya fue procesado este operation_id?
    existente = db.query(OperacionSync).filter(OperacionSync.operation_id == op_uuid).first()
    if existente:
        if existente.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="AccesoCruzadoDenegado: El operation_id pertenece a otra empresa.")
        res_previo = dict(existente.resultado or {})
        res_previo["idempotente_reintento"] = True
        return {
            "operation_id": str(op_uuid),
            "tipo": existente.tipo,
            "estado": existente.estado,
            "entidad_id": existente.entidad_id,
            "motivo": existente.motivo,
            "idempotente": True,
            "resultado": res_previo
        }

    # Parsear fecha_local
    dt_local = datetime.utcnow()
    if op.fecha_local:
        try:
            clean_iso = str(op.fecha_local).replace("Z", "+00:00")
            dt_local = datetime.fromisoformat(clean_iso).replace(tzinfo=None)
        except Exception:
            dt_local = datetime.utcnow()

    tipo_norm = str(op.tipo).upper().strip()
    payload_dict = op.model_dump()

    # 2. Verificar estado del Tenant y vigencia de la Suscripción en fecha_local (RN08 / RF42)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.estado != "ACTIVA":
        reg_rechazo = OperacionSync(
            operation_id=op_uuid,
            tenant_id=tenant_id,
            tipo=tipo_norm,
            entidad_id=None,
            estado="RECHAZADA",
            motivo="EmpresaSuspendida: La empresa se encuentra suspendida en la plataforma (RN05/RN08).",
            resultado={"payload_original": payload_dict, "usuario_id": usuario_id, "sucursal_id": op.sucursal_id}
        )
        db.add(reg_rechazo)
        db.commit()
        return {
            "operation_id": str(op_uuid),
            "tipo": tipo_norm,
            "estado": "RECHAZADA",
            "entidad_id": None,
            "motivo": reg_rechazo.motivo,
            "idempotente": False,
            "resultado": reg_rechazo.resultado
        }

    sub = (
        db.query(Suscripcion)
        .filter(Suscripcion.tenant_id == tenant_id, Suscripcion.estado == "ACTIVA")
        .first()
    )
    if not sub or sub.fecha_vencimiento < dt_local.date() or sub.fecha_vencimiento < date.today():
        reg_rechazo = OperacionSync(
            operation_id=op_uuid,
            tenant_id=tenant_id,
            tipo=tipo_norm,
            entidad_id=None,
            estado="RECHAZADA",
            motivo="SuscripcionVencida: La suscripción de la empresa no estaba vigente al momento de la operación (RN08).",
            resultado={"payload_original": payload_dict, "usuario_id": usuario_id, "sucursal_id": op.sucursal_id}
        )
        db.add(reg_rechazo)
        db.commit()
        return {
            "operation_id": str(op_uuid),
            "tipo": tipo_norm,
            "estado": "RECHAZADA",
            "entidad_id": None,
            "motivo": reg_rechazo.motivo,
            "idempotente": False,
            "resultado": reg_rechazo.resultado
        }

    # 3. Verificar que la sucursal pertenezca a la empresa (RN02)
    sucursal = (
        db.query(Sucursal)
        .filter(Sucursal.id == op.sucursal_id, Sucursal.tenant_id == tenant_id)
        .first()
    )
    if not sucursal:
        reg_rechazo = OperacionSync(
            operation_id=op_uuid,
            tenant_id=tenant_id,
            tipo=tipo_norm,
            entidad_id=None,
            estado="RECHAZADA",
            motivo=f"SucursalInvalida: La sucursal #{op.sucursal_id} no pertenece a tu empresa (RN02).",
            resultado={"payload_original": payload_dict, "usuario_id": usuario_id, "sucursal_id": op.sucursal_id}
        )
        db.add(reg_rechazo)
        db.commit()
        return {
            "operation_id": str(op_uuid),
            "tipo": tipo_norm,
            "estado": "RECHAZADA",
            "entidad_id": None,
            "motivo": reg_rechazo.motivo,
            "idempotente": False,
            "resultado": reg_rechazo.resultado
        }

    # 4. Validar medio de pago para VENTAS offline: RN11 exige SOLO EFECTIVO
    if tipo_norm == "VENTA":
        metodo = (op.metodo_pago or "efectivo").lower().strip()
        if metodo != "efectivo":
            reg_rechazo = OperacionSync(
                operation_id=op_uuid,
                tenant_id=tenant_id,
                tipo=tipo_norm,
                entidad_id=None,
                estado="RECHAZADA",
                motivo=f"MetodoPagoNoPermitidoOffline: En modo sin conexión solo se admiten ventas de contado en efectivo, no '{metodo}' (RN11).",
                resultado={"payload_original": payload_dict, "usuario_id": usuario_id, "sucursal_id": op.sucursal_id}
            )
            db.add(reg_rechazo)
            db.commit()
            return {
                "operation_id": str(op_uuid),
                "tipo": tipo_norm,
                "estado": "RECHAZADA",
                "entidad_id": None,
                "motivo": reg_rechazo.motivo,
                "idempotente": False,
                "resultado": reg_rechazo.resultado
            }

    # 5. Validar disponibilidad de stock en PostgreSQL usando SAVEPOINT (RN14, RF43)
    detalles_conflicto = []
    inventarios_bloqueados: Dict[int, InventarioSucursal] = {}
    variantes_map: Dict[int, ProductoVariante] = {}

    for item in op.items:
        var = (
            db.query(ProductoVariante)
            .join(Producto, ProductoVariante.producto_id == Producto.id)
            .options(joinedload(ProductoVariante.producto), joinedload(ProductoVariante.talla), joinedload(ProductoVariante.color))
            .filter(ProductoVariante.id == item.variante_id, Producto.tenant_id == tenant_id)
            .first()
        )
        if not var:
            detalles_conflicto.append({
                "variante_id": item.variante_id,
                "sku": item.sku or f"VAR-{item.variante_id}",
                "solicitado": item.cantidad,
                "disponible_servidor": 0,
                "causa": "La variante no existe o no pertenece a la empresa."
            })
            continue

        variantes_map[item.variante_id] = var
        inv = (
            db.query(InventarioSucursal)
            .filter(
                InventarioSucursal.sucursal_id == op.sucursal_id,
                InventarioSucursal.variante_id == item.variante_id,
                InventarioSucursal.tenant_id == tenant_id
            )
            .with_for_update()
            .first()
        )
        disp_real = int(inv.cantidad_disponible or 0) - int(inv.cantidad_reservada or 0) if inv else 0
        if not inv or disp_real < item.cantidad:
            detalles_conflicto.append({
                "variante_id": item.variante_id,
                "sku": var.sku,
                "nombre": var.producto.nombre if var.producto else (item.nombre or var.sku),
                "talla": var.talla.nombre if var.talla else "U",
                "color": var.color.nombre if var.color else "Único",
                "solicitado": item.cantidad,
                "disponible_servidor": max(0, disp_real),
                "causa": f"Stock insuficiente en '{sucursal.nombre}': solicitado {item.cantidad}, disponible real en servidor {max(0, disp_real)} (RN14)."
            })
        else:
            inventarios_bloqueados[item.variante_id] = inv

    # Si algún ítem no tiene stock suficiente -> registrar EN_CONFLICTO sin afectar otras operaciones del lote (CU20 A1 / CU21)
    if detalles_conflicto:
        motivo_str = "; ".join(d["causa"] for d in detalles_conflicto)
        reg_conflicto = OperacionSync(
            operation_id=op_uuid,
            tenant_id=tenant_id,
            tipo=tipo_norm,
            entidad_id=None,
            estado="EN_CONFLICTO",
            motivo=motivo_str,
            resultado={
                "payload_original": payload_dict,
                "conflictos_stock": detalles_conflicto,
                "sucursal_id": op.sucursal_id,
                "sucursal_nombre": sucursal.nombre,
                "usuario_id": usuario_id,
                "fecha_local": dt_local.isoformat()
            }
        )
        db.add(reg_conflicto)
        db.commit()
        return {
            "operation_id": str(op_uuid),
            "tipo": tipo_norm,
            "estado": "EN_CONFLICTO",
            "entidad_id": None,
            "motivo": motivo_str,
            "idempotente": False,
            "resultado": reg_conflicto.resultado
        }

    # 6. Ejecutar en firme la VENTA o RESERVA dentro de SAVEPOINT
    try:
        with db.begin_nested():
            if tipo_norm == "VENTA":
                subtotal_calc = 0.0
                lineas_preparadas = []
                for item in op.items:
                    var = variantes_map[item.variante_id]
                    precio_oficial = float(var.producto.precio_base or 0) + float(var.precio_adicional or 0)
                    precio_final = float(item.precio_unitario) if (item.precio_unitario and item.precio_unitario > 0) else precio_oficial
                    sub_linea = round(precio_final * item.cantidad, 2)
                    subtotal_calc += sub_linea
                    lineas_preparadas.append((var, item.cantidad, precio_final, sub_linea))

                nueva_venta = Venta(
                    tenant_id=tenant_id,
                    client_sale_id=str(op_uuid),
                    cliente_id=op.cliente_id,
                    tipo_venta="presencial",
                    sucursal_id=op.sucursal_id,
                    usuario_id=usuario_id,
                    metodo_entrega="retiro_tienda",
                    fecha_venta=dt_local,
                    fecha_local=dt_local,
                    fecha_servidor=datetime.utcnow(),
                    estado_sync="CONFIRMADA",
                    subtotal=round(subtotal_calc, 2),
                    descuento=0.0,
                    impuestos=0.0,
                    total=round(subtotal_calc, 2),
                    estado="completada"
                )
                db.add(nueva_venta)
                db.flush()

                for var, cant, prec, sub_l in lineas_preparadas:
                    det = VentaDetalle(
                        tenant_id=tenant_id,
                        venta_id=nueva_venta.id,
                        variante_id=var.id,
                        cantidad=cant,
                        precio_unitario=prec,
                        subtotal=sub_l
                    )
                    db.add(det)

                    # Descontar stock y registrar en Kárdex
                    inv = inventarios_bloqueados[var.id]
                    inv.cantidad_disponible = max(0, int(inv.cantidad_disponible or 0) - cant)

                    mov = MovimientoInventario(
                        tenant_id=tenant_id,
                        sucursal_id=op.sucursal_id,
                        variante_id=var.id,
                        tipo_movimiento="venta",
                        cantidad=cant,
                        referencia_tipo="venta_offline",
                        referencia_id=nueva_venta.id,
                        observaciones=f"Venta Offline Sincronizada (UUID {str(op_uuid)[:8]})",
                        usuario_id=usuario_id,
                        fecha=datetime.utcnow()
                    )
                    db.add(mov)

                # Registrar pago en efectivo (RN11)
                pago = Pago(
                    tenant_id=tenant_id,
                    venta_id=nueva_venta.id,
                    metodo_pago="efectivo",
                    monto=round(subtotal_calc, 2),
                    estado="aprobado",
                    pasarela="POS_Offline_Sync",
                    referencia_transaccion=f"SYNC-{str(op_uuid)[:8].upper()}"
                )
                db.add(pago)

                nro_comp = f"SYNC-POS-{nueva_venta.id:05d}"
                comp = Comprobante(
                    tenant_id=tenant_id,
                    venta_id=nueva_venta.id,
                    tipo="recibo",
                    numero_comprobante=nro_comp
                )
                db.add(comp)

                res_data = {
                    "venta_id": nueva_venta.id,
                    "numero_comprobante": nro_comp,
                    "total_bs": round(subtotal_calc, 2),
                    "sucursal_id": op.sucursal_id,
                    "sucursal_nombre": sucursal.nombre,
                    "metodo_pago": "efectivo",
                    "fecha_local": dt_local.isoformat(),
                    "fecha_servidor": datetime.utcnow().isoformat() + "Z",
                    "operacion_origen_id": op.operacion_origen_id,
                    "payload_original": payload_dict
                }

                reg_ok = OperacionSync(
                    operation_id=op_uuid,
                    tenant_id=tenant_id,
                    tipo="VENTA",
                    entidad_id=str(nueva_venta.id),
                    estado="CONFIRMADA",
                    motivo="Sincronizada y confirmada exitosamente en el servidor central.",
                    resultado=res_data
                )
                db.add(reg_ok)

            elif tipo_norm == "RESERVA":
                # Resolver cliente (usar cliente_id provisto o el primer cliente del tenant)
                cliente_id_final = op.cliente_id
                if not cliente_id_final:
                    cli_default = db.query(Cliente).filter(Cliente.tenant_id == tenant_id).first()
                    if not cli_default:
                        cli_default = Cliente(
                            tenant_id=tenant_id,
                            nombres=op.cliente_nombre or "Cliente",
                            apellidos="Reserva Offline",
                            email=f"offline.{str(op_uuid)[:8]}@fashionstore.local",
                            password_hash="offline_sync_client",
                            telefono="70000000"
                        )
                        db.add(cli_default)
                        db.flush()
                    cliente_id_final = cli_default.id

                f_res = date.today()
                if op.fecha_reserva:
                    try:
                        f_res = datetime.strptime(str(op.fecha_reserva)[:10], "%Y-%m-%d").date()
                    except Exception:
                        f_res = date.today()

                h_res = dt_time(15, 0)
                if op.horario_atencion:
                    try:
                        parts = str(op.horario_atencion).split(":")
                        h_res = dt_time(int(parts[0]), int(parts[1]))
                    except Exception:
                        h_res = dt_time(15, 0)

                cod_res = f"RES-OFF-{str(op_uuid)[:6].upper()}"
                nueva_res = Reserva(
                    tenant_id=tenant_id,
                    cliente_id=cliente_id_final,
                    sucursal_id=op.sucursal_id,
                    codigo_reserva=cod_res,
                    codigo_qr=f"QR-{cod_res}",
                    fecha_reserva=f_res,
                    horario_atencion=h_res,
                    estado="pendiente",
                    estado_sync="CONFIRMADA",
                    fecha_local=dt_local,
                    observaciones=op.observaciones or f"Reserva creada offline ({op.cliente_nombre or 'Cliente'})"
                )
                db.add(nueva_res)
                db.flush()

                for item in op.items:
                    var = variantes_map[item.variante_id]
                    r_det = ReservaDetalle(
                        tenant_id=tenant_id,
                        reserva_id=nueva_res.id,
                        variante_id=var.id,
                        cantidad=item.cantidad,
                        estado_prenda="reservada"
                    )
                    db.add(r_det)

                    # Incrementar cantidad reservada en la sucursal
                    inv = inventarios_bloqueados[var.id]
                    inv.cantidad_reservada = int(inv.cantidad_reservada or 0) + item.cantidad

                res_data = {
                    "reserva_id": nueva_res.id,
                    "codigo_reserva": cod_res,
                    "cliente_id": cliente_id_final,
                    "cliente_nombre": op.cliente_nombre,
                    "sucursal_id": op.sucursal_id,
                    "sucursal_nombre": sucursal.nombre,
                    "fecha_reserva": str(f_res),
                    "fecha_local": dt_local.isoformat(),
                    "fecha_servidor": datetime.utcnow().isoformat() + "Z",
                    "operacion_origen_id": op.operacion_origen_id,
                    "payload_original": payload_dict
                }

                reg_ok = OperacionSync(
                    operation_id=op_uuid,
                    tenant_id=tenant_id,
                    tipo="RESERVA",
                    entidad_id=str(nueva_res.id),
                    estado="CONFIRMADA",
                    motivo="Reserva offline sincronizada y apartada en inventario.",
                    resultado=res_data
                )
                db.add(reg_ok)
            else:
                raise ValueError(f"Tipo de operación '{tipo_norm}' no soportado (use VENTA o RESERVA).")

        db.commit()
        return {
            "operation_id": str(op_uuid),
            "tipo": tipo_norm,
            "estado": "CONFIRMADA",
            "entidad_id": reg_ok.entidad_id,
            "motivo": reg_ok.motivo,
            "idempotente": False,
            "resultado": res_data
        }
    except Exception as exc:
        db.rollback()
        reg_err = OperacionSync(
            operation_id=op_uuid,
            tenant_id=tenant_id,
            tipo=tipo_norm,
            entidad_id=None,
            estado="RECHAZADA",
            motivo=f"Error al consolidar operación: {str(exc)}",
            resultado={"payload_original": payload_dict, "usuario_id": usuario_id}
        )
        db.add(reg_err)
        db.commit()
        return {
            "operation_id": str(op_uuid),
            "tipo": tipo_norm,
            "estado": "RECHAZADA",
            "entidad_id": None,
            "motivo": reg_err.motivo,
            "idempotente": False,
            "resultado": reg_err.resultado
        }


# =============================================================================
# CU20: SINCRONIZAR LOTE DE OPERACIONES PENDIENTES (POST /api/v1/sync)
# =============================================================================
@router.post("")
@router.post("/lote")
def sincronizar_operaciones_offline(
    req: SyncBatchRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """
    CU20: Sincronizar operaciones pendientes (RF38-RF45, RN08, RN13, RN14, RNF04, RNF05).
    Procesa cada operación con SAVEPOINT individual: una operación en conflicto no aborta el resto del lote.
    Garantiza idempotencia total por operation_id.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="El usuario autenticado no tiene tenant_id asignado.")

    resultados = []
    confirmadas = 0
    en_conflicto = 0
    rechazadas = 0
    idempotentes = 0

    for op in req.operaciones:
        res = _procesar_operacion_individual(db, op, tenant_id, current_user["id"])
        resultados.append(res)
        if res.get("idempotente"):
            idempotentes += 1
        if res["estado"] == "CONFIRMADA":
            confirmadas += 1
        elif res["estado"] == "EN_CONFLICTO":
            en_conflicto += 1
        else:
            rechazadas += 1

    return {
        "procesado_en": datetime.utcnow().isoformat() + "Z",
        "total_recibidas": len(req.operaciones),
        "resumen": {
            "confirmadas": confirmadas,
            "en_conflicto": en_conflicto,
            "rechazadas": rechazadas,
            "idempotentes_omitidas": idempotentes
        },
        "resultados": resultados
    }


# =============================================================================
# CU19 & CU22: CONSULTAR RESULTADO Y BITACORA DE SINCRONIZACION (SIN DATOS SENSIBLES - RN26)
# =============================================================================
@router.get("/resultados")
def listar_resultados_sincronizacion(
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """
    CU19 & CU22: Consultar operaciones sincronizadas, conflictos y bitácora (RF49-RF52, RN26).
    Omite cualquier credencial, token o secreto en la bitácora devuelta (RN26).
    """
    tenant_id = current_user.get("tenant_id")
    q = db.query(OperacionSync)
    if tenant_id:
        q = q.filter(OperacionSync.tenant_id == tenant_id)
    if estado:
        q = q.filter(OperacionSync.estado == estado.upper().strip())
    if tipo:
        q = q.filter(OperacionSync.tipo == tipo.upper().strip())

    registros = q.order_by(OperacionSync.recibida_en.desc()).limit(100).all()

    items = []
    conteo = {"CONFIRMADA": 0, "EN_CONFLICTO": 0, "RECHAZADA": 0, "ANULADA": 0}
    for r in registros:
        est = r.estado
        if est in conteo:
            conteo[est] += 1
        # Sanitizar resultado para cumplir RN26 (nunca exponer tokens, passwords ni secretos)
        res_limpio = {}
        if isinstance(r.resultado, dict):
            for k, v in r.resultado.items():
                if any(sec in k.lower() for sec in ["token", "password", "secret", "credencial", "jwt"]):
                    continue
                res_limpio[k] = v

        items.append({
            "operation_id": str(r.operation_id),
            "tipo": r.tipo,
            "entidad_id": r.entidad_id,
            "estado": r.estado,
            "motivo": r.motivo,
            "recibida_en": r.recibida_en.isoformat() if r.recibida_en else None,
            "resultado": res_limpio
        })

    return {
        "resumen": conteo,
        "total": len(items),
        "bitacora": items
    }


# =============================================================================
# CU21: GESTIONAR RECHAZOS Y CONFLICTOS DE SINCRONIZACION (AJUSTAR Y REENVIAR O ANULAR - RN19)
# =============================================================================
@router.post("/conflictos/{operation_id}/resolver")
def resolver_conflicto_sincronizacion(
    operation_id: str,
    req: ConflictResolutionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "encargado_sucursal", "cajero"]))
):
    """
    CU21: Gestionar rechazos y conflictos de sincronización (RF46-RF48, RN19).
    Opciones:
    1) accion = 'anular': Anula definitivamente la operación en conflicto registrando justificación y usuario.
    2) accion = 'ajustar_reenviar': Ajusta las cantidades al stock disponible en el servidor, marca la
       operación original como resuelta/anulada por ajuste y procesa una nueva operación vinculada con nuevo UUID.
    """
    tenant_id = current_user.get("tenant_id")
    try:
        op_uuid = uuid.UUID(str(operation_id))
    except ValueError:
        op_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, str(operation_id))

    op_db = (
        db.query(OperacionSync)
        .filter(OperacionSync.operation_id == op_uuid, OperacionSync.tenant_id == tenant_id)
        .first()
    )
    if not op_db:
        raise HTTPException(status_code=404, detail="La operación indicada no existe en tu empresa.")

    if op_db.estado not in ["EN_CONFLICTO", "RECHAZADA"]:
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden resolver operaciones en estado EN_CONFLICTO o RECHAZADA (actual: {op_db.estado})."
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

    if accion == "anular":
        if not req.justificacion or len(req.justificacion.strip()) < 4:
            raise HTTPException(
                status_code=422,
                detail="Debe proporcionar una justificación válida para anular la operación en conflicto (RN19)."
            )
        op_db.estado = "ANULADA"
        op_db.motivo = f"Anulada por {current_user.get('email')}: {req.justificacion.strip()}"
        res_actual["resolucion"] = {
            "accion": "ANULADA",
            "justificacion": req.justificacion.strip(),
            "resuelto_por_usuario_id": current_user["id"],
            "resuelto_en": datetime.utcnow().isoformat() + "Z"
        }
        op_db.resultado = res_actual
        db.commit()
        return {
            "mensaje": "Operación en conflicto anulada con justificación registrada (CU21).",
            "operation_id_original": str(op_uuid),
            "nuevo_estado": "ANULADA",
            "resolucion": res_actual["resolucion"]
        }

    elif accion == "ajustar_reenviar":
        payload_orig = res_actual.get("payload_original") or {}
        items_nuevos = req.items_ajustados
        if not items_nuevos:
            # Auto-ajustar a la cantidad disponible en el servidor según conflictos_stock
            conflictos_map = {
                c["variante_id"]: int(c.get("disponible_servidor", 0))
                for c in (res_actual.get("conflictos_stock") or [])
            }
            items_nuevos = []
            for it in (payload_orig.get("items") or []):
                vid = it["variante_id"]
                cant_ajustada = conflictos_map.get(vid, it["cantidad"])
                if cant_ajustada > 0:
                    items_nuevos.append(SyncItemPayload(
                        variante_id=vid,
                        sku=it.get("sku"),
                        nombre=it.get("nombre"),
                        cantidad=cant_ajustada,
                        precio_unitario=it.get("precio_unitario", 0.0)
                    ))

        if not items_nuevos:
            raise HTTPException(
                status_code=400,
                detail="No quedan unidades disponibles para ajustar y reenviar. Anule la operación."
            )

        nuevo_uuid_str = req.nueva_operation_id or str(uuid.uuid4())
        nueva_op_payload = SyncOperationPayload(
            operation_id=nuevo_uuid_str,
            tipo=op_db.tipo,
            sucursal_id=int(payload_orig.get("sucursal_id") or res_actual.get("sucursal_id") or 1),
            cliente_id=payload_orig.get("cliente_id"),
            cliente_nombre=payload_orig.get("cliente_nombre", "Cliente Ajuste Conflicto"),
            metodo_pago="efectivo",
            fecha_local=datetime.utcnow().isoformat() + "Z",
            fecha_reserva=payload_orig.get("fecha_reserva"),
            horario_atencion=payload_orig.get("horario_atencion", "15:00"),
            observaciones=req.justificacion or f"Ajustada desde operación en conflicto {str(op_uuid)[:8]}",
            operacion_origen_id=str(op_uuid),
            items=items_nuevos
        )

        # Marcar la operación original como ANULADA por reemplazo vinculado (RF47, RN19)
        op_db.estado = "ANULADA"
        op_db.motivo = f"Reemplazada por operación ajustada {nuevo_uuid_str[:8]} ({req.justificacion or 'Ajuste al stock disponible'})."
        res_actual["resolucion"] = {
            "accion": "AJUSTADA_Y_REENVIADA",
            "nueva_operation_id": nuevo_uuid_str,
            "justificacion": req.justificacion or "Ajuste de cantidad al stock disponible en servidor",
            "resuelto_por_usuario_id": current_user["id"],
            "resuelto_en": datetime.utcnow().isoformat() + "Z"
        }
        op_db.resultado = res_actual
        db.commit()

        # Procesar la nueva operación vinculada
        resultado_reenvio = _procesar_operacion_individual(db, nueva_op_payload, tenant_id, current_user["id"])
        return {
            "mensaje": "Conflicto resuelto: operación ajustada y reenviada exitosamente con nuevo identificador vinculado (RF47).",
            "operation_id_original": str(op_uuid),
            "estado_original": "ANULADA",
            "operacion_reenviada": resultado_reenvio
        }

    else:
        raise HTTPException(status_code=400, detail="Acción inválida. Use 'ajustar_reenviar' o 'anular'.")
