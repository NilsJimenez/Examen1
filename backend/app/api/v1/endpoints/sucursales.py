from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.sucursal import Sucursal, Ciudad

router = APIRouter()


class CiudadOut(BaseModel):
    id: int
    nombre: str
    pais: str

    class Config:
        from_attributes = True


class SucursalOut(BaseModel):
    id: int
    nombre: str
    direccion: str
    telefono: str | None = None
    latitud: float | None = None
    longitud: float | None = None
    ciudad: CiudadOut

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SucursalOut])
def listar_sucursales(db: Session = Depends(get_db)):
    """
    CU-05: Administrar Ciudades y Sucursales (Consulta Pública).
    Retorna la lista de todas las sucursales físicas activas de la cadena y sus ciudades asociadas
    para selección de retiro, visualización de stock y reservas.
    """
    return db.query(Sucursal).options(joinedload(Sucursal.ciudad)).filter(Sucursal.activo == True).all()
