from typing import Optional, List
from pydantic import BaseModel


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None

    class Config:
        from_attributes = True


class TallaOut(BaseModel):
    id: int
    nombre: str
    orden: int

    class Config:
        from_attributes = True


class ColorOut(BaseModel):
    id: int
    nombre: str
    codigo_hex: Optional[str] = None

    class Config:
        from_attributes = True


class VarianteOut(BaseModel):
    id: int
    sku: str
    talla: TallaOut
    color: ColorOut
    precio_adicional: float
    imagen_url: Optional[str] = None
    activo: bool

    class Config:
        from_attributes = True


class ProductoOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    precio_base: float
    imagen_url: Optional[str] = None
    modelo_ar_url: Optional[str] = None
    genero: Optional[str] = "Unisex"
    categoria: Optional[CategoriaOut] = None
    activo: bool
    stock_total: Optional[int] = 0
    stock_sucursal_seleccionada: Optional[int] = None
    stock_por_sucursal: Optional[List[dict]] = []
    variantes: Optional[List[VarianteOut]] = []

    class Config:
        from_attributes = True


class ProductoDetailOut(ProductoOut):
    variantes: List[VarianteOut] = []

    class Config:
        from_attributes = True
