import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.inventario import InventarioSucursal, MovimientoInventario, AlertaReabastecimiento
from app.models.producto import ProductoVariante, Producto
from app.models.sucursal import Sucursal

logger = logging.getLogger(__name__)

DEFAULT_STOCK_MINIMO = 5

def _simular_envio_notificacion(variante_nombre: str, sucursal_nombre: str):
    """Simula el envío de un correo y notificación interna al administrador y encargado."""
    # Excepción 2: Falla el envío pero el flujo continúa (se atrapa en evaluar_todo_el_stock)
    # En un caso real esto llamaría a un SMTP o push notifications.
    pass

def calcular_cantidad_sugerida(db: Session, variante_id: int, sucursal_id: int, stock_minimo: int) -> int:
    """Calcula cantidad sugerida usando promedio de ventas de últimos 30 días"""
    fecha_hace_30_dias = datetime.utcnow() - timedelta(days=30)
    
    ventas = db.query(func.sum(MovimientoInventario.cantidad)).filter(
        MovimientoInventario.variante_id == variante_id,
        MovimientoInventario.sucursal_id == sucursal_id,
        MovimientoInventario.tipo_movimiento == 'venta',
        MovimientoInventario.fecha >= fecha_hace_30_dias
    ).scalar() or 0
    
    # Lógica de sugerencia: recuperar el mínimo + las ventas mensuales (o al menos recuperar el doble del mínimo)
    sugerida = stock_minimo * 2
    if ventas > sugerida:
        sugerida = ventas + stock_minimo
        
    return int(sugerida)

def evaluar_todo_el_stock(db: Session):
    """
    Se ejecuta al abrir el panel para garantizar que las alertas estén actualizadas.
    Evalúa cada variante en cada sucursal.
    """
    inventarios = db.query(InventarioSucursal).all()
    
    for inv in inventarios:
        # Excepción 1: Variante no tiene stock mínimo -> valor por defecto
        minimo = inv.stock_minimo if inv.stock_minimo is not None else DEFAULT_STOCK_MINIMO
        
        if inv.cantidad_disponible <= minimo:
            # Revisar si ya existe una alerta activa para evitar duplicados
            alerta_activa = db.query(AlertaReabastecimiento).filter(
                AlertaReabastecimiento.variante_id == inv.variante_id,
                AlertaReabastecimiento.sucursal_id == inv.sucursal_id,
                AlertaReabastecimiento.resuelta == False
            ).first()
            
            if not alerta_activa:
                cant_sugerida = calcular_cantidad_sugerida(db, inv.variante_id, inv.sucursal_id, minimo)
                
                nueva_alerta = AlertaReabastecimiento(
                    variante_id=inv.variante_id,
                    sucursal_id=inv.sucursal_id,
                    cantidad_actual=inv.cantidad_disponible,
                    stock_minimo_usado=minimo,
                    cantidad_sugerida=cant_sugerida
                )
                db.add(nueva_alerta)
                
                # Excepción 2: Fallo de servicio de notificaciones
                try:
                    variante = db.query(ProductoVariante).get(inv.variante_id)
                    prod = db.query(Producto).get(variante.producto_id)
                    suc = db.query(Sucursal).get(inv.sucursal_id)
                    _simular_envio_notificacion(prod.nombre, suc.nombre)
                except Exception as e:
                    logger.error(f"Fallo envío notificación de alerta, pero alerta registrada. Error: {e}")
                    
    db.commit()

def atender_alerta(db: Session, alerta_id: int, cantidad_ingresada: int, usuario_id: int, observaciones: str):
    """
    Marca la alerta como resuelta e ingresa automáticamente el inventario al sistema.
    """
    alerta = db.query(AlertaReabastecimiento).filter(AlertaReabastecimiento.id == alerta_id).first()
    if not alerta:
        return None
        
    if alerta.resuelta:
        return alerta
        
    # Registrar el movimiento de inventario (Ingreso)
    movimiento = MovimientoInventario(
        variante_id=alerta.variante_id,
        sucursal_id=alerta.sucursal_id,
        tipo_movimiento='ingreso',
        cantidad=cantidad_ingresada,
        usuario_id=usuario_id,
        observaciones=observaciones
    )
    db.add(movimiento)
    
    # Actualizar inventario
    inv = db.query(InventarioSucursal).filter(
        InventarioSucursal.variante_id == alerta.variante_id,
        InventarioSucursal.sucursal_id == alerta.sucursal_id
    ).first()
    if inv:
        inv.cantidad_disponible += cantidad_ingresada
        
    # Marcar alerta como resuelta
    alerta.resuelta = True
    alerta.fecha_resolucion = datetime.utcnow()
    alerta.cantidad_actual = inv.cantidad_disponible if inv else cantidad_ingresada
    
    db.commit()
    db.refresh(alerta)
    return alerta
