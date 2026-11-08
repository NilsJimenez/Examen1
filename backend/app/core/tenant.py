import uuid
from dataclasses import dataclass
from datetime import date
from typing import Optional, List, Callable, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db
from app.models.usuario import Usuario, Cliente
from app.models.saas import Tenant, Suscripcion, Plan

security = HTTPBearer(auto_error=False)


@dataclass
class TenantContext:
    """
    Contexto de ejecución del tenant actual (RN02, RF06, RNF02).
    Inyectado en cada petición para garantizar aislamiento estricto.
    """
    user_id: int
    email: str
    rol: str
    user_type: str  # 'usuario' o 'cliente'
    tenant_id: Optional[uuid.UUID] = None
    tenant_nombre: Optional[str] = None
    plan_nombre: Optional[str] = None
    max_sucursales: int = 10
    permite_reportes_ia: bool = True
    is_superadmin: bool = False

    def require_tenant(self) -> uuid.UUID:
        """Garantiza que la operación se realice dentro del contexto de un tenant."""
        if not self.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta operación requiere un contexto de empresa (tenant_id)."
            )
        return self.tenant_id


def get_tenant_context(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> TenantContext:
    """
    Dependencia FastAPI que extrae el token JWT, valida el tenant y suscripción activa.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de autenticación no proporcionadas.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        rol: str = payload.get("role")
        user_type: str = payload.get("user_type", "usuario")
        tid_claim: Optional[str] = payload.get("tid")

        if user_id_str is None or rol is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de acceso inválido.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales de acceso.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Caso SuperAdmin de la plataforma (sin tenant_id asignado)
    if rol.upper() in ["SUPERADMIN", "ADMIN_PLATAFORMA"]:
        # Buscar usuario en BD
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        email = user.email if user else "admin@fashionstore.saas"
        ctx = TenantContext(
            user_id=user_id,
            email=email,
            rol=rol,
            user_type=user_type,
            tenant_id=None,
            tenant_nombre="Plataforma FashionStore SaaS",
            plan_nombre="SuperAdmin",
            max_sucursales=999,
            permite_reportes_ia=True,
            is_superadmin=True
        )
        request.state.tenant_context = ctx
        return ctx

    # 2. Caso Usuario interno o Cliente
    tenant_uuid: Optional[uuid.UUID] = None
    email_res: str = ""

    if user_type == "usuario":
        user = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado o inactivo.")
        email_res = user.email
        tenant_uuid = user.tenant_id
    else:
        cliente = db.query(Cliente).filter(Cliente.id == user_id, Cliente.activo == True).first()
        if not cliente:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cliente no encontrado o inactivo.")
        email_res = cliente.email
        tenant_uuid = cliente.tenant_id

    # Fallback si en el payload venía tid
    if not tenant_uuid and tid_claim:
        try:
            tenant_uuid = uuid.UUID(tid_claim)
        except ValueError:
            pass

    # Si aún no tiene tenant asignado
    if not tenant_uuid:
        ctx = TenantContext(
            user_id=user_id,
            email=email_res,
            rol=rol,
            user_type=user_type,
            tenant_id=None,
            tenant_nombre=None,
            plan_nombre=None,
            max_sucursales=1,
            permite_reportes_ia=False,
            is_superadmin=False
        )
        request.state.tenant_context = ctx
        return ctx

    # 3. Validar estado del Tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La empresa (tenant) asociada ya no existe."
        )

    if tenant.estado == "SUSPENDIDA":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta de la empresa se encuentra suspendida por falta de pago o política comercial (RN05)."
        )

    # 4. Validar suscripción activa y plan
    suscripcion = (
        db.query(Suscripcion)
        .join(Plan, Suscripcion.plan_id == Plan.id)
        .filter(
            Suscripcion.tenant_id == tenant_uuid,
            Suscripcion.estado == "ACTIVA"
        )
        .order_by(Suscripcion.fecha_vencimiento.desc())
        .first()
    )

    plan_nombre = "Basico"
    max_sucursales = 2
    permite_ia = False

    if suscripcion:
        # Verificar fecha de vencimiento
        if suscripcion.fecha_vencimiento < date.today():
            suscripcion.estado = "VENCIDA"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La suscripción de la empresa ha vencido. Contacte al administrador para renovar su plan."
            )
        if suscripcion.plan:
            plan_nombre = suscripcion.plan.nombre
            max_sucursales = suscripcion.plan.max_sucursales
            permite_ia = suscripcion.plan.permite_reportes_ia

    ctx = TenantContext(
        user_id=user_id,
        email=email_res,
        rol=rol,
        user_type=user_type,
        tenant_id=tenant_uuid,
        tenant_nombre=tenant.razon_social,
        plan_nombre=plan_nombre,
        max_sucursales=max_sucursales,
        permite_reportes_ia=permite_ia,
        is_superadmin=False
    )
    request.state.tenant_context = ctx
    return ctx


def require_roles(allowed_roles: List[str]) -> Callable:
    """Validador de roles permitidos con bypass automático para SuperAdmin."""
    def role_checker(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if ctx.is_superadmin:
            return ctx
        if ctx.rol not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permisos insuficientes. Requiere uno de los siguientes roles: {', '.join(allowed_roles)}."
            )
        return ctx
    return role_checker


def require_superadmin() -> Callable:
    """Validador exclusivo para Super Administrador de la Plataforma SaaS (CU01-CU04)."""
    def superadmin_checker(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if not ctx.is_superadmin and ctx.rol.upper() not in ["SUPERADMIN", "ADMIN_PLATAFORMA"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso restringido únicamente al Administrador Global de la Plataforma SaaS (CU01-CU04)."
            )
        return ctx
    return superadmin_checker


def get_tenant_context_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> TenantContext:
    if credentials and credentials.credentials:
        try:
            return get_tenant_context(request, credentials, db)
        except HTTPException:
            pass

    tenant = db.query(Tenant).filter(Tenant.estado == 'ACTIVA').order_by(Tenant.creado_en.asc()).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='No se encontro ningun inquilino activo en la plataforma.'
        )

    suscripcion = (
        db.query(Suscripcion)
        .join(Plan, Suscripcion.plan_id == Plan.id)
        .filter(
            Suscripcion.tenant_id == tenant.id,
            Suscripcion.estado == 'ACTIVA'
        )
        .order_by(Suscripcion.fecha_vencimiento.desc())
        .first()
    )

    plan_nombre = suscripcion.plan.nombre if (suscripcion and suscripcion.plan) else 'Profesional'
    max_sucursales = suscripcion.plan.max_sucursales if (suscripcion and suscripcion.plan) else 10
    permite_ia = suscripcion.plan.permite_reportes_ia if (suscripcion and suscripcion.plan) else True

    ctx = TenantContext(
        user_id=0,
        email='visitante@fashionstore.local',
        rol='CLIENTE',
        user_type='cliente',
        tenant_id=tenant.id,
        tenant_nombre=tenant.razon_social,
        plan_nombre=plan_nombre,
        max_sucursales=max_sucursales,
        permite_reportes_ia=permite_ia,
        is_superadmin=False
    )
    request.state.tenant_context = ctx
    return ctx
