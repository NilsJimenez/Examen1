from typing import Optional, List
from datetime import date
from pydantic import BaseModel, EmailStr


# --- Atributos de Producto ---
class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class TallaCreate(BaseModel):
    nombre: str
    orden: int = 0


class ColorCreate(BaseModel):
    nombre: str
    codigo_hex: Optional[str] = None


# --- Proveedores, Temporadas y Colecciones ---
class ProveedorCreate(BaseModel):
    nombre: str
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    direccion: Optional[str] = None


class TemporadaCreate(BaseModel):
    nombre: str
    tipo: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None


class ColeccionCreate(BaseModel):
    nombre: str
    temporada_id: Optional[int] = None
    descripcion: Optional[str] = None
    fecha_lanzamiento: Optional[date] = None


# --- Sucursales y Ciudades ---
class CiudadCreate(BaseModel):
    nombre: str
    pais: str = "Bolivia"


class SucursalCreate(BaseModel):
    nombre: str
    ciudad_id: int
    direccion: str
    telefono: Optional[str] = None
    latitud: Optional[float] = None
    longitud: Optional[float] = None


# --- Productos y Variantes ---
class VarianteInput(BaseModel):
    talla_id: int
    color_id: int
    sku: str
    precio_adicional: float = 0.0
    imagen_url: Optional[str] = None
    stock_inicial: Optional[int] = 10


class ProductoCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    categoria_id: int
    proveedor_id: int
    coleccion_id: Optional[int] = None
    precio_base: float
    imagen_url: Optional[str] = None
    modelo_ar_url: Optional[str] = None
    variantes: List[VarianteInput] = []


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria_id: Optional[int] = None
    precio_base: Optional[float] = None
    imagen_url: Optional[str] = None
    modelo_ar_url: Optional[str] = None
    activo: Optional[bool] = None


class VarianteUpdateInput(BaseModel):
    id: int
    imagen_url: Optional[str] = None
    precio_adicional: Optional[float] = None
    activo: Optional[bool] = None


class StockIngresoInput(BaseModel):
    sucursal_id: int
    cantidad: int
    variante_id: Optional[int] = None
    observaciones: Optional[str] = None


class StockMatrizItem(BaseModel):
    talla_id: int
    color_id: int
    cantidad: int
    variante_id: Optional[int] = None


class StockMatrizInput(BaseModel):
    sucursal_id: int
    items: List[StockMatrizItem]
    observaciones: Optional[str] = None


# --- Personal Interno (Usuarios & Roles) ---
class RolCreate(BaseModel):
    nombre: str

class RolOut(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True


class UsuarioCreate(BaseModel):
    nombres: str
    apellidos: str
    email: EmailStr
    password: str
    rol_id: int
    sucursal_id: Optional[int] = None
    telefono: Optional[str] = None


class UsuarioRolUpdate(BaseModel):
    rol_id: int
    sucursal_id: Optional[int] = None

