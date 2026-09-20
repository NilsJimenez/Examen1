from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, Numeric, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class Proveedor(Base):
    __tablename__ = "proveedores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    ruc_nit: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    contacto_nombre: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    productos: Mapped[list["Producto"]] = relationship("Producto", back_populates="proveedor")


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    productos: Mapped[list["Producto"]] = relationship("Producto", back_populates="categoria")


class Temporada(Base):
    __tablename__ = "temporadas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    fecha_inicio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    colecciones: Mapped[list["Coleccion"]] = relationship("Coleccion", back_populates="temporada")


class Coleccion(Base):
    __tablename__ = "colecciones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    temporada_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("temporadas.id"), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_lanzamiento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relaciones
    temporada: Mapped[Optional["Temporada"]] = relationship("Temporada", back_populates="colecciones")
    productos: Mapped[list["Producto"]] = relationship("Producto", back_populates="coleccion")


class Talla(Base):
    __tablename__ = "tallas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    variantes: Mapped[list["ProductoVariante"]] = relationship("ProductoVariante", back_populates="talla")


class Color(Base):
    __tablename__ = "colores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    codigo_hex: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    variantes: Mapped[list["ProductoVariante"]] = relationship("ProductoVariante", back_populates="color")


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria_id: Mapped[int] = mapped_column(Integer, ForeignKey("categorias.id"), nullable=False)
    proveedor_id: Mapped[int] = mapped_column(Integer, ForeignKey("proveedores.id"), nullable=False)
    coleccion_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("colecciones.id"), nullable=True)
    precio_base: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    modelo_ar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones
    categoria: Mapped["Categoria"] = relationship("Categoria", back_populates="productos")
    proveedor: Mapped["Proveedor"] = relationship("Proveedor", back_populates="productos")
    coleccion: Mapped[Optional["Coleccion"]] = relationship("Coleccion", back_populates="productos")
    variantes: Mapped[list["ProductoVariante"]] = relationship("ProductoVariante", back_populates="producto", cascade="all, delete-orphan")


class ProductoVariante(Base):
    __tablename__ = "producto_variantes"
    __table_args__ = (UniqueConstraint("producto_id", "talla_id", "color_id", name="uq_producto_talla_color"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    producto_id: Mapped[int] = mapped_column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), nullable=False)
    talla_id: Mapped[int] = mapped_column(Integer, ForeignKey("tallas.id"), nullable=False)
    color_id: Mapped[int] = mapped_column(Integer, ForeignKey("colores.id"), nullable=False)
    sku: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    precio_adicional: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relaciones
    producto: Mapped["Producto"] = relationship("Producto", back_populates="variantes")
    talla: Mapped["Talla"] = relationship("Talla", back_populates="variantes")
    color: Mapped["Color"] = relationship("Color", back_populates="variantes")
    inventarios: Mapped[list["InventarioSucursal"]] = relationship("InventarioSucursal", back_populates="variante")
