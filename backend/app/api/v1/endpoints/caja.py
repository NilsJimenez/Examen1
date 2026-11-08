"""
Módulo de Gestión de Turnos de Caja (CU30)
Control de Apertura, Arqueo y Cierre de Caja por Turno de Cajero.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.api.deps import require_roles
from app.models.venta import Venta, Pago, CajaTurno
from app.models.sucursal import Sucursal
from app.models.usuario import Usuario
from app.services.push_service import emitir_notificacion_push

router = APIRouter()


class AperturaCajaInput(BaseModel):
    sucursal_id: int
    monto_apertura: float = Field(default=0.0, ge=0.0, description="Fondo inicial de cambio en efectivo")
    observaciones: Optional[str] = None


class CierreCajaInput(BaseModel):
    turno_id: int
    monto_cierre_real: float = Field(default=0.0, ge=0.0, description="Efectivo físico contado en arqueo")
    observaciones: Optional[str] = None


def _calcular_totales_turno(db: Session, turno: CajaTurno, tenant_id) -> dict:
    """Calcula las ventas y cobros realizados durante la vigencia del turno de caja."""
    fecha_fin = turno.fecha_cierre or datetime.utcnow()

    # Consultar ventas presenciales o confirmadas en la misma sucursal
    q_ventas = db.query(Venta).filter(
        Venta.sucursal_id == turno.sucursal_id,
        Venta.fecha_venta >= turno.fecha_apertura,
        Venta.fecha_venta <= fecha_fin,
        Venta.estado == "completada"
    )
    if tenant_id:
        q_ventas = q_ventas.filter(Venta.tenant_id == tenant_id)

    ventas = q_ventas.all()
    venta_ids = [v.id for v in ventas]

    ventas_efectivo = 0.0
    ventas_digitales = 0.0

    if venta_ids:
        pagos = db.query(Pago).filter(Pago.venta_id.in_(venta_ids)).all()
        for p in pagos:
            metodo = (p.metodo_pago or "").lower()
            if "efectivo" in metodo:
                ventas_efectivo += float(p.monto or 0.0)
            else:
                ventas_digitales += float(p.monto or 0.0)

    monto_esperado = float(turno.monto_apertura) + ventas_efectivo

    return {
        "cantidad_ventas": len(ventas),
        "total_ventas_efectivo": round(ventas_efectivo, 2),
        "total_ventas_digitales": round(ventas_digitales, 2),
        "total_ventas": round(ventas_efectivo + ventas_digitales, 2),
        "monto_esperado_en_caja": round(monto_esperado, 2)
    }


@router.get("/turno-activo")
def obtener_turno_activo(
    sucursal_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """
    CU30: Consulta si la sucursal y el usuario tienen una caja actualmente ABIERTA.
    Devuelve los totales en tiempo real calculados sobre las ventas del turno.
    """
    tenant_id = current_user.get("tenant_id")
    usuario_id = current_user.get("id")

    query = db.query(CajaTurno).options(
        joinedload(CajaTurno.sucursal),
        joinedload(CajaTurno.usuario)
    ).filter(
        CajaTurno.estado == "ABIERTA"
    )

    if tenant_id:
        query = query.filter(CajaTurno.tenant_id == tenant_id)
    if sucursal_id is not None:
        query = query.filter(CajaTurno.sucursal_id == sucursal_id)
    else:
        # Priorizar caja abierta por el usuario actual
        turno_propio = query.filter(CajaTurno.usuario_id == usuario_id).first()
        if turno_propio:
            totales = _calcular_totales_turno(db, turno_propio, tenant_id)
            return {
                "activo": True,
                "turno": {
                    "id": turno_propio.id,
                    "sucursal_id": turno_propio.sucursal_id,
                    "sucursal_nombre": turno_propio.sucursal.nombre if turno_propio.sucursal else "Sucursal",
                    "cajero_id": turno_propio.usuario_id,
                    "cajero_nombre": f"{turno_propio.usuario.nombres} {turno_propio.usuario.apellidos}" if turno_propio.usuario else "Cajero",
                    "fecha_apertura": turno_propio.fecha_apertura.isoformat(),
                    "monto_apertura": float(turno_propio.monto_apertura),
                    "observaciones_apertura": turno_propio.observaciones_apertura,
                    "estado": turno_propio.estado,
                    **totales
                }
            }

    turno = query.order_by(CajaTurno.fecha_apertura.desc()).first()
    if not turno:
        return {"activo": False, "turno": None}

    totales = _calcular_totales_turno(db, turno, tenant_id)
    return {
        "activo": True,
        "turno": {
            "id": turno.id,
            "sucursal_id": turno.sucursal_id,
            "sucursal_nombre": turno.sucursal.nombre if turno.sucursal else "Sucursal",
            "cajero_id": turno.usuario_id,
            "cajero_nombre": f"{turno.usuario.nombres} {turno.usuario.apellidos}" if turno.usuario else "Cajero",
            "fecha_apertura": turno.fecha_apertura.isoformat(),
            "monto_apertura": float(turno.monto_apertura),
            "observaciones_apertura": turno.observaciones_apertura,
            "estado": turno.estado,
            **totales
        }
    }


@router.post("/abrir", status_code=status.HTTP_201_CREATED)
def abrir_caja(
    data: AperturaCajaInput,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """
    CU30: Registra la apertura de turno de caja con fondo inicial en efectivo.
    """
    tenant_id = current_user.get("tenant_id")
    usuario_id = current_user.get("id")

    # Validar sucursal
    sucursal = db.query(Sucursal).filter(Sucursal.id == data.sucursal_id).first()
    if not sucursal:
        raise HTTPException(status_code=404, detail="La sucursal seleccionada no existe.")
    if tenant_id and sucursal.tenant_id and str(sucursal.tenant_id) != str(tenant_id):
        raise HTTPException(status_code=403, detail="La sucursal no pertenece a tu empresa.")

    # Verificar si el usuario ya tiene una caja abierta en esta sucursal
    caja_previa = db.query(CajaTurno).filter(
        CajaTurno.sucursal_id == data.sucursal_id,
        CajaTurno.usuario_id == usuario_id,
        CajaTurno.estado == "ABIERTA"
    ).first()

    if caja_previa:
        raise HTTPException(
            status_code=400,
            detail=f"Ya tienes una caja abierta en la sucursal '{sucursal.nombre}' (Turno #{caja_previa.id} iniciada a las {caja_previa.fecha_apertura.strftime('%H:%M')}). Cierra el turno actual antes de abrir uno nuevo."
        )

    nuevo_turno = CajaTurno(
        tenant_id=tenant_id,
        sucursal_id=data.sucursal_id,
        usuario_id=usuario_id,
        fecha_apertura=datetime.utcnow(),
        monto_apertura=data.monto_apertura,
        observaciones_apertura=data.observaciones,
        estado="ABIERTA"
    )
    db.add(nuevo_turno)
    db.commit()
    db.refresh(nuevo_turno)

    emitir_notificacion_push(
        titulo="🟢 Apertura de Caja Registrada",
        cuerpo=f"Turno #{nuevo_turno.id} en {sucursal.nombre} con fondo de Bs. {data.monto_apertura:.2f}.",
        categoria="venta",
        referencia=f"caja_apertura_{nuevo_turno.id}"
    )

    return {
        "mensaje": "Caja abierta exitosamente. Ya puedes registrar ventas en este turno.",
        "turno_id": nuevo_turno.id,
        "sucursal_id": nuevo_turno.sucursal_id,
        "monto_apertura": float(nuevo_turno.monto_apertura),
        "fecha_apertura": nuevo_turno.fecha_apertura.isoformat(),
        "estado": nuevo_turno.estado
    }


@router.post("/cerrar")
def cerrar_caja(
    data: CierreCajaInput,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """
    CU30: Realiza el arqueo físico y cierre formal del turno de caja.
    Calcula automáticamente el total de ventas en efectivo durante el turno y la discrepancia (sobrante/faltante).
    """
    tenant_id = current_user.get("tenant_id")
    turno = db.query(CajaTurno).options(
        joinedload(CajaTurno.sucursal),
        joinedload(CajaTurno.usuario)
    ).filter(CajaTurno.id == data.turno_id).first()

    if not turno:
        raise HTTPException(status_code=404, detail="El turno de caja especificado no existe.")
    if tenant_id and turno.tenant_id and str(turno.tenant_id) != str(tenant_id):
        raise HTTPException(status_code=403, detail="Este turno no pertenece a tu empresa.")
    if turno.estado == "CERRADA":
        raise HTTPException(status_code=400, detail=f"Este turno de caja ya fue cerrado el {turno.fecha_cierre.strftime('%d/%m/%Y %H:%M')}.")

    ahora = datetime.utcnow()
    totales = _calcular_totales_turno(db, turno, tenant_id)

    monto_esperado = totales["monto_esperado_en_caja"]
    diferencia = round(data.monto_cierre_real - monto_esperado, 2)

    turno.fecha_cierre = ahora
    turno.total_ventas_efectivo = totales["total_ventas_efectivo"]
    turno.total_ventas_digitales = totales["total_ventas_digitales"]
    turno.monto_cierre_esperado = monto_esperado
    turno.monto_cierre_real = data.monto_cierre_real
    turno.diferencia = diferencia
    turno.estado = "CERRADA"
    turno.observaciones_cierre = data.observaciones

    db.commit()
    db.refresh(turno)

    # Mensaje de auditoría
    if diferencia == 0:
        msg_auditoria = "Caja Cuadrada (Exacta)"
    elif diferencia > 0:
        msg_auditoria = f"Sobrante de Caja (+Bs. {diferencia:.2f})"
    else:
        msg_auditoria = f"Faltante de Caja (-Bs. {abs(diferencia):.2f})"

    emitir_notificacion_push(
        titulo="🔒 Cierre de Turno de Caja",
        cuerpo=f"Turno #{turno.id} cerrado en {turno.sucursal.nombre if turno.sucursal else 'Sucursal'}. {msg_auditoria}. Real: Bs. {data.monto_cierre_real:.2f}.",
        categoria="venta",
        referencia=f"caja_cierre_{turno.id}"
    )

    return {
        "mensaje": "Turno de caja cerrado y arqueado correctamente.",
        "turno_id": turno.id,
        "monto_apertura": float(turno.monto_apertura),
        "total_ventas_efectivo": float(turno.total_ventas_efectivo),
        "monto_cierre_esperado": float(turno.monto_cierre_esperado),
        "monto_cierre_real": float(turno.monto_cierre_real),
        "diferencia": float(turno.diferencia),
        "diagnostico_arqueo": msg_auditoria,
        "fecha_cierre": turno.fecha_cierre.isoformat(),
        "estado": turno.estado
    }


@router.get("/historial")
def listar_historial_turnos(
    sucursal_id: Optional[int] = None,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["administrador", "cajero", "encargado_sucursal"]))
):
    """
    CU30: Consulta la bitácora de turnos de caja cerrados con su arqueo y diferencias.
    """
    tenant_id = current_user.get("tenant_id")
    q = db.query(CajaTurno).options(
        joinedload(CajaTurno.sucursal),
        joinedload(CajaTurno.usuario)
    )

    if tenant_id:
        q = q.filter(CajaTurno.tenant_id == tenant_id)
    if sucursal_id is not None:
        q = q.filter(CajaTurno.sucursal_id == sucursal_id)

    turnos = q.order_by(CajaTurno.fecha_apertura.desc()).limit(limit).all()

    resultado = []
    for t in turnos:
        resultado.append({
            "id": t.id,
            "sucursal_id": t.sucursal_id,
            "sucursal_nombre": t.sucursal.nombre if t.sucursal else "Sucursal",
            "cajero_id": t.usuario_id,
            "cajero_nombre": f"{t.usuario.nombres} {t.usuario.apellidos}" if t.usuario else "Cajero",
            "fecha_apertura": t.fecha_apertura.isoformat(),
            "fecha_cierre": t.fecha_cierre.isoformat() if t.fecha_cierre else None,
            "monto_apertura": float(t.monto_apertura),
            "total_ventas_efectivo": float(t.total_ventas_efectivo or 0.0),
            "monto_cierre_esperado": float(t.monto_cierre_esperado) if t.monto_cierre_esperado is not None else None,
            "monto_cierre_real": float(t.monto_cierre_real) if t.monto_cierre_real is not None else None,
            "diferencia": float(t.diferencia) if t.diferencia is not None else None,
            "estado": t.estado,
            "observaciones_apertura": t.observaciones_apertura,
            "observaciones_cierre": t.observaciones_cierre,
        })
    return resultado
