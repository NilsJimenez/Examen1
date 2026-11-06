import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Rol(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Relaciones
    usuarios: Mapped[list["Usuario"]] = relationship("Usuario", back_populates="rol")


class Usuario(Base):
    """
    Personal interno de la empresa: Administradores, Encargados, Cajeros.
    En entorno SaaS, tenant_id vincula al usuario con su empresa.
    Para el Super Administrador de la plataforma (CU01-CU04), tenant_id es None.
    """
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    nombres: Mapped[str] = mapped_column(String(100), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.id"), nullable=False)
    sucursal_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sucursales.id"), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reset_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    reset_code_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relaciones
    rol: Mapped["Rol"] = relationship("Rol", back_populates="usuarios")
    sucursal: Mapped[Optional["Sucursal"]] = relationship("Sucursal", back_populates="usuarios")


class Cliente(Base):
    """
    Clientes que compran por web/móvil o reservan prendas para vestidores.
    Aislados por tenant_id en modelo Multi-tenant.
    """
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    nombres: Mapped[str] = mapped_column(String(100), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_nacimiento: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    genero: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reset_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    reset_code_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relaciones
    reservas: Mapped[list["Reserva"]] = relationship("Reserva", back_populates="cliente")
    ventas: Mapped[list["Venta"]] = relationship("Venta", back_populates="cliente")
