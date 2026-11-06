import uuid
from datetime import date, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.tenant import get_tenant_context, require_superadmin, TenantContext
from app.core.security import get_password_hash
from app.models.saas import Tenant, Plan, Suscripcion
from app.models.usuario import Usuario, Rol
from app.models.sucursal import Sucursal
from app.schemas.saas import (
    TenantCreateRequest, TenantUpdateRequest, CambiarPlanRequest,
    TenantDetailResponse, PlanResponse, SuscripcionResponse, OnboardingResponse
)

router = APIRouter()


# =============================================================================
# CU01: REGISTRAR EMPRESA (TENANT) Y SUSCRIPCIÓN INICIAL (SUPERADMIN)
# =============================================================================
@router.post("/tenants", response_model=TenantDetailResponse, status_code=status.HTTP_201_CREATED)
def registrar_empresa(
    data: TenantCreateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_superadmin())
):
    """
    CU01: Registrar una nueva empresa en la plataforma SaaS.
    - Crea el Tenant con NIT y Razón Social.
    - Asigna el Plan solicitado (Básico o Profesional) con su suscripción activa.
    - Crea automáticamente la cuenta del Administrador de la Empresa.
    """
    # 1. Validar que el NIT no exista
    existing_tenant = db.query(Tenant).filter(Tenant.nit == data.nit.strip()).first()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una empresa registrada con el NIT: {data.nit}."
        )

    # 2. Validar que el email del admin no exista
    existing_user = db.query(Usuario).filter(Usuario.email == data.admin_email.strip().lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo electrónico {data.admin_email} ya se encuentra registrado."
        )

    # 3. Buscar el plan solicitado
    plan = db.query(Plan).filter(Plan.nombre == data.plan_nombre).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El plan '{data.plan_nombre}' no existe en la plataforma (disponibles: Basico, Profesional)."
        )

    # 4. Crear el Tenant
    new_tenant = Tenant(
        id=uuid.uuid4(),
        razon_social=data.razon_social.strip(),
        nit=data.nit.strip(),
        estado="ACTIVA"
    )
    db.add(new_tenant)
    db.flush()

    # 5. Crear la Suscripción Activa (RN03: Solo 1 activa)
    meses = max(1, data.meses_vigencia)
    fecha_fin = date.today() + timedelta(days=meses * 30)
    suscripcion = Suscripcion(
        id=uuid.uuid4(),
        tenant_id=new_tenant.id,
        plan_id=plan.id,
        fecha_inicio=date.today(),
        fecha_vencimiento=fecha_fin,
        estado="ACTIVA"
    )
    db.add(suscripcion)
    db.flush()

    # 6. Crear el Administrador de la Empresa
    rol_admin = db.query(Rol).filter(Rol.nombre == "Administrador").first()
    if not rol_admin:
        rol_admin = Rol(nombre="Administrador")
        db.add(rol_admin)
        db.flush()

    admin_user = Usuario(
        tenant_id=new_tenant.id,
        nombres=data.admin_nombre.strip(),
        apellidos=data.admin_apellido.strip(),
        email=data.admin_email.strip().lower(),
        password_hash=get_password_hash(data.admin_password),
        rol_id=rol_admin.id,
        activo=True
    )
    db.add(admin_user)
    db.commit()

    return TenantDetailResponse(
        id=new_tenant.id,
        razon_social=new_tenant.razon_social,
        nit=new_tenant.nit,
        estado=new_tenant.estado,
        creado_en=new_tenant.creado_en,
        plan_activo=plan.nombre,
        max_sucursales=plan.max_sucursales,
        permite_reportes_ia=plan.permite_reportes_ia,
        fecha_vencimiento=suscripcion.fecha_vencimiento,
        total_sucursales=0,
        total_usuarios=1
    )


# =============================================================================
# CU01: ONBOARDING PÚBLICO / AUTORREGISTRO DE EMPRESA Y PLAN (LANDING PAGE)
# =============================================================================
@router.post("/onboarding", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
def onboarding_empresa(
    data: TenantCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Permite a cualquier empresa de moda suscribirse desde la pantalla inicial (Landing Page).
    Crea el tenant, la suscripción y la cuenta admin, retornando el token para login inmediato.
    """
    from app.core.security import create_access_token

    existing_tenant = db.query(Tenant).filter(Tenant.nit == data.nit.strip()).first()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una empresa registrada con el NIT: {data.nit}."
        )

    existing_user = db.query(Usuario).filter(Usuario.email == data.admin_email.strip().lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo electrónico {data.admin_email} ya se encuentra registrado."
        )

    plan = db.query(Plan).filter(Plan.nombre == data.plan_nombre).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El plan '{data.plan_nombre}' no existe en la plataforma (disponibles: Basico, Profesional)."
        )

    new_tenant = Tenant(
        id=uuid.uuid4(),
        razon_social=data.razon_social.strip(),
        nit=data.nit.strip(),
        estado="ACTIVA"
    )
    db.add(new_tenant)
    db.flush()

    meses = max(1, data.meses_vigencia)
    fecha_fin = date.today() + timedelta(days=meses * 30)
    suscripcion = Suscripcion(
        id=uuid.uuid4(),
        tenant_id=new_tenant.id,
        plan_id=plan.id,
        fecha_inicio=date.today(),
        fecha_vencimiento=fecha_fin,
        estado="ACTIVA"
    )
    db.add(suscripcion)
    db.flush()

    rol_admin = db.query(Rol).filter(Rol.nombre == "Administrador").first()
    if not rol_admin:
        rol_admin = Rol(nombre="Administrador")
        db.add(rol_admin)
        db.flush()

    admin_user = Usuario(
        tenant_id=new_tenant.id,
        nombres=data.admin_nombre.strip(),
        apellidos=data.admin_apellido.strip(),
        email=data.admin_email.strip().lower(),
        password_hash=get_password_hash(data.admin_password),
        rol_id=rol_admin.id,
        activo=True
    )
    db.add(admin_user)
    db.commit()

    token = create_access_token(
        subject=admin_user.id,
        role="Administrador",
        user_type="usuario",
        tenant_id=new_tenant.id
    )

    tenant_resp = TenantDetailResponse(
        id=new_tenant.id,
        razon_social=new_tenant.razon_social,
        nit=new_tenant.nit,
        estado=new_tenant.estado,
        creado_en=new_tenant.creado_en,
        plan_activo=plan.nombre,
        max_sucursales=plan.max_sucursales,
        permite_reportes_ia=plan.permite_reportes_ia,
        fecha_vencimiento=suscripcion.fecha_vencimiento,
        total_sucursales=0,
        total_usuarios=1
    )

    return OnboardingResponse(
        tenant=tenant_resp,
        access_token=token,
        token_type="bearer",
        role="Administrador",
        user_type="usuario",
        user_id=admin_user.id,
        nombre_completo=f"{admin_user.nombres} {admin_user.apellidos}",
        email=admin_user.email,
        tenant_id=str(new_tenant.id),
        tenant_nombre=new_tenant.razon_social,
        plan=plan.nombre,
        permite_reportes_ia=plan.permite_reportes_ia,
        max_sucursales=plan.max_sucursales
    )


# =============================================================================
# CU03: LISTAR EMPRESAS Y MÉTRICAS GLOBALES (SUPERADMIN)
# =============================================================================
@router.get("/tenants", response_model=List[TenantDetailResponse])
def listar_empresas(
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_superadmin())
):
    """
    CU03: Monitorear y auditar todas las empresas clientes de la plataforma SaaS.
    """
    tenants = db.query(Tenant).order_by(Tenant.creado_en.desc()).all()
    resultado = []

    for t in tenants:
        # Obtener suscripción activa
        sub = (
            db.query(Suscripcion)
            .join(Plan, Suscripcion.plan_id == Plan.id)
            .filter(Suscripcion.tenant_id == t.id, Suscripcion.estado == "ACTIVA")
            .first()
        )
        plan_nom = sub.plan.nombre if (sub and sub.plan) else "Sin Plan"
        max_suc = sub.plan.max_sucursales if (sub and sub.plan) else 0
        permite_ia = sub.plan.permite_reportes_ia if (sub and sub.plan) else False
        f_venc = sub.fecha_vencimiento if sub else None

        cant_suc = db.query(func.count(Sucursal.id)).filter(Sucursal.tenant_id == t.id).scalar() or 0
        cant_usr = db.query(func.count(Usuario.id)).filter(Usuario.tenant_id == t.id).scalar() or 0

        resultado.append(TenantDetailResponse(
            id=t.id,
            razon_social=t.razon_social,
            nit=t.nit,
            estado=t.estado,
            creado_en=t.creado_en,
            plan_activo=plan_nom,
            max_sucursales=max_suc,
            permite_reportes_ia=permite_ia,
            fecha_vencimiento=f_venc,
            total_sucursales=cant_suc,
            total_usuarios=cant_usr
        ))

    return resultado


# =============================================================================
# CU04: SUSPENDER / REACTIVAR EMPRESA (RN05)
# =============================================================================
@router.patch("/tenants/{tenant_id}/estado", response_model=TenantDetailResponse)
def cambiar_estado_empresa(
    tenant_id: uuid.UUID,
    data: TenantUpdateRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_superadmin())
):
    """
    CU04: Suspender o reactivar una empresa (RN05).
    Cuando se suspende, ningún usuario de esa empresa podrá autenticarse.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    if data.estado:
        nuevo_est = data.estado.upper()
        if nuevo_est not in ["ACTIVA", "SUSPENDIDA"]:
            raise HTTPException(status_code=400, detail="El estado debe ser 'ACTIVA' o 'SUSPENDIDA'.")
        tenant.estado = nuevo_est

    if data.razon_social:
        tenant.razon_social = data.razon_social.strip()

    db.commit()
    db.refresh(tenant)

    sub = (
        db.query(Suscripcion)
        .join(Plan, Suscripcion.plan_id == Plan.id)
        .filter(Suscripcion.tenant_id == tenant.id, Suscripcion.estado == "ACTIVA")
        .first()
    )
    plan_nom = sub.plan.nombre if (sub and sub.plan) else "Sin Plan"
    max_suc = sub.plan.max_sucursales if (sub and sub.plan) else 0
    permite_ia = sub.plan.permite_reportes_ia if (sub and sub.plan) else False
    f_venc = sub.fecha_vencimiento if sub else None

    cant_suc = db.query(func.count(Sucursal.id)).filter(Sucursal.tenant_id == tenant.id).scalar() or 0
    cant_usr = db.query(func.count(Usuario.id)).filter(Usuario.tenant_id == tenant.id).scalar() or 0

    return TenantDetailResponse(
        id=tenant.id,
        razon_social=tenant.razon_social,
        nit=tenant.nit,
        estado=tenant.estado,
        creado_en=tenant.creado_en,
        plan_activo=plan_nom,
        max_sucursales=max_suc,
        permite_reportes_ia=permite_ia,
        fecha_vencimiento=f_venc,
        total_sucursales=cant_suc,
        total_usuarios=cant_usr
    )


# =============================================================================
# CU02: ACTUALIZAR PLAN / SUSCRIPCIÓN (RN03, RN04)
# =============================================================================
@router.post("/tenants/{tenant_id}/cambiar-plan", response_model=TenantDetailResponse)
def cambiar_plan_empresa(
    tenant_id: uuid.UUID,
    data: CambiarPlanRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_superadmin())
):
    """
    CU02: Actualizar el plan contratado por una empresa (Upgrade / Downgrade).
    - Cierra la suscripción anterior como 'CANCELADA' o 'REEMPLAZADA'.
    - Crea la nueva suscripción con el nuevo plan (RN03).
    - Si se hace downgrade y tiene más sucursales activas que el límite, advierte o exige inactivación (RN04).
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Empresa no encontrada.")

    nuevo_plan = db.query(Plan).filter(Plan.nombre == data.plan_nombre).first()
    if not nuevo_plan:
        raise HTTPException(status_code=404, detail=f"El plan '{data.plan_nombre}' no existe.")

    # Validar que si hace downgrade a Básico, no exceda 2 sucursales activas
    cant_sucursales_activas = (
        db.query(func.count(Sucursal.id))
        .filter(Sucursal.tenant_id == tenant_id, Sucursal.activo == True)
        .scalar() or 0
    )
    if cant_sucursales_activas > nuevo_plan.max_sucursales:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"No se puede cambiar al plan '{nuevo_plan.nombre}' porque la empresa tiene "
                f"{cant_sucursales_activas} sucursales activas y el plan solo permite {nuevo_plan.max_sucursales} (RN04). "
                "Desactive las sucursales excedentes antes de cambiar de plan."
            )
        )

    # Inactivar suscripciones anteriores
    db.query(Suscripcion).filter(
        Suscripcion.tenant_id == tenant_id,
        Suscripcion.estado == "ACTIVA"
    ).update({"estado": "CANCELADA"})

    # Crear nueva suscripción
    meses = max(1, data.meses_vigencia)
    nueva_sub = Suscripcion(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        plan_id=nuevo_plan.id,
        fecha_inicio=date.today(),
        fecha_vencimiento=date.today() + timedelta(days=meses * 30),
        estado="ACTIVA"
    )
    db.add(nueva_sub)
    db.commit()

    cant_usr = db.query(func.count(Usuario.id)).filter(Usuario.tenant_id == tenant.id).scalar() or 0

    return TenantDetailResponse(
        id=tenant.id,
        razon_social=tenant.razon_social,
        nit=tenant.nit,
        estado=tenant.estado,
        creado_en=tenant.creado_en,
        plan_activo=nuevo_plan.nombre,
        max_sucursales=nuevo_plan.max_sucursales,
        permite_reportes_ia=nuevo_plan.permite_reportes_ia,
        fecha_vencimiento=nueva_sub.fecha_vencimiento,
        total_sucursales=cant_sucursales_activas,
        total_usuarios=cant_usr
    )


# =============================================================================
# LISTAR PLANES SAAS
# =============================================================================
@router.get("/planes", response_model=List[PlanResponse])
def listar_planes(db: Session = Depends(get_db)):
    """
    Retorna la lista de planes SaaS disponibles y sus características.
    """
    return db.query(Plan).filter(Plan.activo == True).order_by(Plan.max_sucursales.asc()).all()
