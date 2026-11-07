from typing import List, Optional
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.api.deps import get_optional_user
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
def listar_sucursales(
    tenant_id: Optional[str] = Query(None, description="Filtrar sucursales por empresa SaaS"),
    db: Session = Depends(get_db),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    CU-05: Administrar Ciudades y Sucursales (Con Aislamiento Multi-Tenant).
    - Si quien consulta es personal interno de una empresa (Administrador, Encargado, Cajero),
      retorna únicamente las sucursales activas de su propia empresa (tenant_id).
    - Si es un cliente y envía tenant_id, filtra por esa empresa.
    """
    query = db.query(Sucursal).options(joinedload(Sucursal.ciudad)).filter(Sucursal.activo == True)

    effective_tenant_id = None
    if current_user and current_user.get("user_type") == "usuario" and current_user.get("tenant_id"):
        effective_tenant_id = current_user.get("tenant_id")
    elif tenant_id:
        try:
            effective_tenant_id = uuid.UUID(str(tenant_id))
        except Exception:
            effective_tenant_id = None

    if effective_tenant_id:
        query = query.filter(Sucursal.tenant_id == effective_tenant_id)

    return query.all()
