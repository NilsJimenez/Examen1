from typing import Optional
from sqlalchemy import String, Integer, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Ciudad(Base):
    __tablename__ = "ciudades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    pais: Mapped[str] = mapped_column(String(100), default="Bolivia")

    # Relaciones
    sucursales: Mapped[list["Sucursal"]] = relationship("Sucursal", back_populates="ciudad")


class Sucursal(Base):
    __tablename__ = "sucursales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    ciudad_id: Mapped[int] = mapped_column(Integer, ForeignKey("ciudades.id"), nullable=False)
    direccion: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    latitud: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    longitud: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    ciudad: Mapped["Ciudad"] = relationship("Ciudad", back_populates="sucursales")
    usuarios: Mapped[list["Usuario"]] = relationship("Usuario", back_populates="sucursal")
    inventarios: Mapped[list["InventarioSucursal"]] = relationship("InventarioSucursal", back_populates="sucursal")
    reservas: Mapped[list["Reserva"]] = relationship("Reserva", back_populates="sucursal")
