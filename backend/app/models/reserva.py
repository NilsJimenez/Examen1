from datetime import datetime, date, time
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, DateTime, Date, Time, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Reserva(Base):
    __tablename__ = "reservas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id"), nullable=False)
    sucursal_id: Mapped[int] = mapped_column(Integer, ForeignKey("sucursales.id"), nullable=False)
    codigo_reserva: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    codigo_qr: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    fecha_reserva: Mapped[date] = mapped_column(Date, nullable=False)
    horario_atencion: Mapped[time] = mapped_column(Time, nullable=False)
    vestidor_asignado: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estado: Mapped[str] = mapped_column(String(30), default="pendiente")  # 'pendiente', 'preparada', 'atendida', 'cancelada', 'expirada'
    notificado: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fecha_atencion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relaciones
    cliente: Mapped["Cliente"] = relationship("Cliente", back_populates="reservas")
    sucursal: Mapped["Sucursal"] = relationship("Sucursal", back_populates="reservas")
    detalles: Mapped[list["ReservaDetalle"]] = relationship("ReservaDetalle", back_populates="reserva", cascade="all, delete-orphan")


class ReservaDetalle(Base):
    __tablename__ = "reserva_detalle"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reserva_id: Mapped[int] = mapped_column(Integer, ForeignKey("reservas.id", ondelete="CASCADE"), nullable=False)
    variante_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, default=1)

    # Relaciones
    reserva: Mapped["Reserva"] = relationship("Reserva", back_populates="detalles")
    variante: Mapped["ProductoVariante"] = relationship("ProductoVariante")
