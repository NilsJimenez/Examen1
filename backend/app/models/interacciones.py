from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, Numeric, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Carrito(Base):
    __tablename__ = "carritos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    detalles: Mapped[list["CarritoDetalle"]] = relationship("CarritoDetalle", back_populates="carrito", cascade="all, delete-orphan")


class CarritoDetalle(Base):
    __tablename__ = "carrito_detalle"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    carrito_id: Mapped[int] = mapped_column(Integer, ForeignKey("carritos.id", ondelete="CASCADE"), nullable=False)
    variante_id: Mapped[int] = mapped_column(Integer, ForeignKey("producto_variantes.id", ondelete="CASCADE"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, default=1)

    # Relaciones
    carrito: Mapped["Carrito"] = relationship("Carrito", back_populates="detalles")
    variante: Mapped["ProductoVariante"] = relationship("ProductoVariante")


class Promocion(Base):
    __tablename__ = "promociones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    descuento_porcentaje: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    producto_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), nullable=True)
    categoria_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categorias.id", ondelete="CASCADE"), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class HistorialInteraccion(Base):
    __tablename__ = "historial_interacciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("productos.id", ondelete="SET NULL"), nullable=True)
    tipo_interaccion: Mapped[str] = mapped_column(String(50), nullable=False)  # 'vista', 'busqueda', 'favorito', 'vestidor_virtual', 'clic_recomendacion'
    termino_busqueda: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Recomendacion(Base):
    __tablename__ = "recomendaciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    motivo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_generada: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    producto = relationship("Producto")


class InteraccionChatbot(Base):
    __tablename__ = "interacciones_chatbot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True)
    mensaje_usuario: Mapped[str] = mapped_column(Text, nullable=False)
    respuesta_ia: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SesionVestidorVirtual(Base):
    __tablename__ = "sesiones_vestidor_virtual"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    variante_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("producto_variantes.id", ondelete="SET NULL"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    imagen_resultado_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dispositivo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class ReporteIA(Base):
    __tablename__ = "reportes_ia"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    comando_voz_transcrito: Mapped[str] = mapped_column(Text, nullable=False)
    tipo_reporte: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contenido_generado: Mapped[str] = mapped_column(Text, nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
