import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Venta(Base):
    """
    Registro de transacciones de venta.
    Soporta sincronización Offline-First (RF29, RNF06):
    - client_sale_id: Identificador único provisto por el cajero offline para idempotencia.
    - estado_sync: 'CONFIRMADA', 'PENDIENTE', 'EN_CONFLICTO'.
    - fecha_local: Momento de emisión en el dispositivo local.
    - fecha_servidor: Momento de consolidación en base de datos central.
    """
    __tablename__ = "ventas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    client_sale_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    cliente_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clientes.id"), nullable=True)
    tipo_venta: Mapped[str] = mapped_column(String(30), nullable=False)  # 'presencial', 'digital'
    sucursal_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sucursales.id"), nullable=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=True)
    reserva_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("reservas.id"), nullable=True)
    metodo_entrega: Mapped[str] = mapped_column(String(30), default="retiro_tienda")  # 'retiro_tienda', 'delivery'
    direccion_envio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    costo_envio: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    fecha_venta: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_local: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fecha_servidor: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    estado_sync: Mapped[str] = mapped_column(String(30), default="CONFIRMADA")  # 'CONFIRMADA', 'PENDIENTE', 'EN_CONFLICTO'
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    descuento: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    impuestos: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="pendiente_pago")  # 'completada', 'anulada', 'pendiente_pago'

    # Relaciones
    cliente: Mapped[Optional["Cliente"]] = relationship("Cliente", back_populates="ventas")
    detalles: Mapped[list["VentaDetalle"]] = relationship("VentaDetalle", back_populates="venta", cascade="all, delete-orphan")
    pagos: Mapped[list["Pago"]] = relationship("Pago", back_populates="venta")
    comprobante: Mapped[Optional["Comprobante"]] = relationship("Comprobante", back_populates="venta", uselist=False)


class VentaDetalle(Base):
    __tablename__ = "venta_detalle"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    venta_id: Mapped[int] = mapped_column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    variante_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, default=1)
    precio_unitario: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relaciones
    venta: Mapped["Venta"] = relationship("Venta", back_populates="detalles")
    variante: Mapped["ProductoVariante"] = relationship("ProductoVariante")


class Pago(Base):
    __tablename__ = "pagos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    venta_id: Mapped[int] = mapped_column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    metodo_pago: Mapped[str] = mapped_column(String(50), nullable=False)  # 'tarjeta_credito', 'tarjeta_debito', 'qr', 'transferencia', 'efectivo'
    monto: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="pendiente")  # 'pendiente', 'aprobado', 'rechazado', 'reembolsado'
    pasarela: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 'Stripe', 'PayPal', 'Libélula', 'POS_Fisico'
    referencia_transaccion: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    fecha_pago: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones
    venta: Mapped["Venta"] = relationship("Venta", back_populates="pagos")


class Comprobante(Base):
    __tablename__ = "comprobantes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    venta_id: Mapped[int] = mapped_column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), unique=True, nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), default="recibo")  # 'factura', 'boleta', 'recibo', 'ticket'
    numero_comprobante: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    archivo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_emision: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones
    venta: Mapped["Venta"] = relationship("Venta", back_populates="comprobante")


class CambioPrenda(Base):
    """
    CU13: Gestionar cambio de prenda (RF21, RN20, RN21).
    Registra la devolución de una variante adquirida previamente y la entrega
    de una nueva variante, actualizando el kárdex en una sola transacción atómica.
    """
    __tablename__ = "cambio_prenda"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    venta_id: Mapped[int] = mapped_column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    sucursal_id: Mapped[int] = mapped_column(Integer, ForeignKey("sucursales.id"), nullable=False)
    variante_devuelta_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id"), nullable=False)
    variante_entregada_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    precio_devuelto: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    precio_entregado: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    diferencia: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    motivo: Mapped[str] = mapped_column(String(250), default="Cambio de talla / color")
    autorizado_excepcion: Mapped[bool] = mapped_column(Boolean, default=False)
    justificacion_excepcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=True)
    numero_comprobante_cambio: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    venta: Mapped["Venta"] = relationship("Venta")
    variante_devuelta: Mapped["ProductoVariante"] = relationship("ProductoVariante", foreign_keys=[variante_devuelta_id])
    variante_entregada: Mapped["ProductoVariante"] = relationship("ProductoVariante", foreign_keys=[variante_entregada_id])

