from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.producto import ProductoOut

class LookbookRequest(BaseModel):
    ocasion: str = Field(..., description="La ocasión para el outfit (ej. Fiesta, Trabajo, Casual)")
    presupuesto_max: float = Field(..., description="Presupuesto máximo permitido")
    talla_preferida: Optional[str] = Field(None, description="Talla preferida del usuario")
    sucursal_id: Optional[int] = Field(None, description="Sucursal donde se verificará el stock")
    genero: Optional[str] = Field(None, description="Género del cliente (ej. Hombre, Mujer)")

class PrendaLookbook(BaseModel):
    producto: ProductoOut
    rol: str = Field(..., description="Rol en el conjunto (Superior, Inferior, Calzado, Accesorio)")

class LookbookResponse(BaseModel):
    outfits: List[List[PrendaLookbook]] = Field(..., description="Lista de conjuntos generados (cada uno es una lista de prendas)")
    justificacion: str = Field(..., description="Explicación de la IA sobre por qué eligió estas prendas")
    total_bs: float = Field(..., description="Costo total del conjunto sugerido")
    mensaje: Optional[str] = Field(None, description="Mensaje en caso de excepciones (ej. presupuesto superado o falta de stock)")
