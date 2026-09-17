from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class InventarioSucursal(Base):
    __tablename__ = "inventario_sucursal"
    __table_args__ = (UniqueConstraint("variante_id", "sucursal_id", name="uq_variante_sucursal"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    variante_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id", ondelete="CASCADE"), nullable=False)
    sucursal_id: Mapped[int] = mapped_column(Integer, ForeignKey("sucursales.id", ondelete="CASCADE"), nullable=False)
    cantidad_disponible: Mapped[int] = mapped_column(Integer, default=0)
    cantidad_reservada: Mapped[int] = mapped_column(Integer, default=0)
    stock_minimo: Mapped[int] = mapped_column(Integer, default=5)

    # Relaciones
    variante: Mapped["ProductoVariante"] = relationship("ProductoVariante", back_populates="inventarios")
    sucursal: Mapped["Sucursal"] = relationship("Sucursal", back_populates="inventarios")


class MovimientoInventario(Base):
    __tablename__ = "movimientos_inventario"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    variante_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id"), nullable=False)
    sucursal_id: Mapped[int] = mapped_column(Integer, ForeignKey("sucursales.id"), nullable=False)
    tipo_movimiento: Mapped[str] = mapped_column(
        SQLEnum('ingreso', 'venta', 'reserva', 'liberacion_reserva', 'devolucion', 'ajuste', 'transferencia', name='tipo_movimiento_enum', create_type=False),
        nullable=False
    )
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("usuarios.id"), nullable=True)
    referencia_tipo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    referencia_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
