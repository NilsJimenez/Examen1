import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class PlanResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    max_sucursales: int
    permite_reportes_ia: bool
    activo: bool

    class Config:
        from_attributes = True


class SuscripcionResponse(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID
    plan_nombre: str
    max_sucursales: int
    permite_reportes_ia: bool
    fecha_inicio: date
    fecha_vencimiento: date
    estado: str

    class Config:
        from_attributes = True


class TenantCreateRequest(BaseModel):
    razon_social: str
    nit: str
    plan_nombre: str = "Basico"  # 'Basico' o 'Profesional'
    admin_nombre: str
    admin_apellido: str
    admin_email: str
    admin_password: str
    meses_vigencia: int = 12


class TenantUpdateRequest(BaseModel):
    razon_social: Optional[str] = None
    nit: Optional[str] = None
    estado: Optional[str] = None  # 'ACTIVA', 'SUSPENDIDA'


class CambiarPlanRequest(BaseModel):
    plan_nombre: str  # 'Basico' o 'Profesional'
    meses_vigencia: int = 12


class TenantDetailResponse(BaseModel):
    id: uuid.UUID
    razon_social: str
    nit: str
    estado: str
    creado_en: datetime
    plan_activo: Optional[str] = None
    max_sucursales: Optional[int] = None
    permite_reportes_ia: Optional[bool] = None
    fecha_vencimiento: Optional[date] = None
    total_sucursales: int = 0
    total_usuarios: int = 0

    class Config:
        from_attributes = True


class OnboardingResponse(BaseModel):
    tenant: TenantDetailResponse
    access_token: str
    token_type: str = "bearer"
    role: str
    user_type: str = "usuario"
    user_id: int
    nombre_completo: str
    email: str
    tenant_id: str
    tenant_nombre: str
    plan: str
    permite_reportes_ia: bool
    max_sucursales: int
