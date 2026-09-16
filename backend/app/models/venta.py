from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clientes.id"), nullable=True)
    tipo_venta: Mapped[str] = mapped_column(String(30), nullable=False)  # 'presencial', 'digital'
    sucursal_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sucursales.id"), nullable=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=True)
    reserva_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("reservas.id"), nullable=True)
    metodo_entrega: Mapped[str] = mapped_column(String(30), default="retiro_tienda")  # 'retiro_tienda', 'delivery'
    direccion_envio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    costo_envio: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    fecha_venta: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
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
    venta_id: Mapped[int] = mapped_column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    numero_comprobante: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), default="recibo")  # 'recibo', 'factura'
    fecha_emision: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    archivo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relaciones
    venta: Mapped["Venta"] = relationship("Venta", back_populates="comprobante")
