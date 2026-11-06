import uuid
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Integer, Boolean, Text, Numeric, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Tenant(Base):
    """
    Entidad raíz para arquitectura SaaS Multi-tenant.
    Cada empresa cliente (empresa de moda) posee su propio tenant_id
    que aísla lógicamente todos sus datos (sucursales, usuarios, productos, ventas).
    """
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    razon_social: Mapped[str] = mapped_column(String(200), nullable=False)
    nit: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    estado: Mapped[str] = mapped_column(String(20), default="ACTIVA", nullable=False)  # 'ACTIVA', 'SUSPENDIDA'
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relaciones
    suscripciones: Mapped[List["Suscripcion"]] = relationship(
        "Suscripcion", back_populates="tenant", cascade="all, delete-orphan"
    )
    operaciones_sync: Mapped[List["OperacionSync"]] = relationship(
        "OperacionSync", back_populates="tenant", cascade="all, delete-orphan"
    )


class Plan(Base):
    """
    Planes de suscripción SaaS ofrecidos por la plataforma.
    Define límites de sucursales y características avanzadas (ej: Reportes IA).
    """
    __tablename__ = "planes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    nombre: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # 'Basico', 'Profesional'
    max_sucursales: Mapped[int] = mapped_column(Integer, nullable=False)  # 2 (Básico) o 10 (Profesional)
    permite_reportes_ia: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relaciones
    suscripciones: Mapped[List["Suscripcion"]] = relationship("Suscripcion", back_populates="plan")


class Suscripcion(Base):
    """
    Relaciona una empresa (Tenant) con su Plan contratado y controla vigencia.
    Regla RN03: Un tenant solo puede tener una suscripción activa a la vez.
    """
    __tablename__ = "suscripciones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planes.id"), nullable=False, index=True
    )
    fecha_inicio: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="ACTIVA", nullable=False)  # 'ACTIVA', 'VENCIDA', 'CANCELADA'

    # Relaciones
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="suscripciones")
    plan: Mapped["Plan"] = relationship("Plan", back_populates="suscripciones")


class OperacionSync(Base):
    """
    Bitácora de Sincronización Offline-first (CU16, RF29-RF32, RNF06).
    Garantiza idempotencia ante reintentos de red del cliente/cajero móvil o web.
    """
    __tablename__ = "operaciones_sync"

    operation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, index=True
    )  # Generado en cliente
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # 'VENTA', 'RESERVA'
    entidad_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), default="CONFIRMADA", nullable=False
    )  # 'CONFIRMADA', 'RECHAZADA', 'EN_CONFLICTO'
    motivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resultado: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    recibida_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Relaciones
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="operaciones_sync")


class CambioPrenda(Base):
    """
    CU14: Registro de cambios de prenda por talla o color posterior a la venta (RN11).
    Permite liquidar diferencias monetarias y recalcular inventario de ambas variantes.
    """
    __tablename__ = "cambios_prenda"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    venta_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variante_devuelta_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("producto_variantes.id"), nullable=False
    )
    variante_entregada_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("producto_variantes.id"), nullable=False
    )
    diferencia: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    autorizado_por: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )


class SolicitudReporte(Base):
    """
    CU28: Bitácora de reportes generados a partir de lenguaje natural (Gemini LLM).
    Permite auditar consultas del Administrador de Empresa y validar acceso según plan.
    """
    __tablename__ = "solicitudes_reporte"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuarios.id"), nullable=False
    )
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_reporte: Mapped[str] = mapped_column(String(50), default="GENERAL", nullable=False)
    filtros: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="COMPLETADO", nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )


class MlModelo(Base):
    """
    CU29: Registro de modelos de Machine Learning entrenados para previsión de demanda
    y alertas inteligentes de reabastecimiento. Modelo global de la plataforma.
    """
    __tablename__ = "ml_modelos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    metricas: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    entrenado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
