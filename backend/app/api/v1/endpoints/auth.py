import uuid
import random
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.usuario import Usuario, Cliente, Rol
from app.models.saas import Tenant, Plan, Suscripcion
from app.schemas.auth import (
    LoginRequest, TokenResponse, ClienteRegisterRequest,
    UsuarioRegisterRequest, UserProfileResponse
)
from app.api.deps import get_current_user, require_roles
from app.services.email_service import send_reset_code_email

router = APIRouter()


# =============================================================================
# CU-01: REGISTRAR CLIENTE
# =============================================================================
@router.post("/register-cliente", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_cliente(data: ClienteRegisterRequest, db: Session = Depends(get_db)):
    """
    CU-01: Registrar Cliente.
    Permite el autoregistro de clientes desde la Web o App Móvil.
    - Valida que el correo electrónico no esté previamente registrado.
    - Encripta la contraseña usando algoritmo seguro bcrypt.
    - Asigna tenant_id opcionalmente si se registra en el portal de una empresa.
    """
    existing_cliente = db.query(Cliente).filter(Cliente.email == data.email).first()
    if existing_cliente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta registrada con este correo electrónico."
        )

    tenant_uuid: Optional[uuid.UUID] = None
    if data.tenant_id:
        try:
            tenant_uuid = uuid.UUID(data.tenant_id)
        except ValueError:
            pass

    nuevo_cliente = Cliente(
        tenant_id=tenant_uuid,
        nombres=data.nombres,
        apellidos=data.apellidos,
        email=data.email,
        password_hash=get_password_hash(data.password),
        telefono=data.telefono,
        direccion=data.direccion,
        activo=True
    )
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)

    token = create_access_token(
        subject=nuevo_cliente.id,
        role="cliente",
        user_type="cliente",
        tenant_id=str(tenant_uuid) if tenant_uuid else None
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role="cliente",
        user_type="cliente",
        user_id=nuevo_cliente.id,
        nombre_completo=f"{nuevo_cliente.nombres} {nuevo_cliente.apellidos}",
        email=nuevo_cliente.email,
        tenant_id=str(tenant_uuid) if tenant_uuid else None
    )


# =============================================================================
# CU-02: GESTIONAR INICIO DE SESIÓN CON AISLAMIENTO SAAS (RN02, RN05)
# =============================================================================
@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    CU-02: Gestionar Inicio de Sesión Multi-tenant.
    - Valida credenciales contra 'usuarios' y 'clientes'.
    - Verifica si la cuenta o la empresa (Tenant) están activas (RN05).
    - Carga suscripción y plan activo para determinar límites (sucursales, IA).
    - Emite JWT con 'tid' (tenant_id) y rol.
    """
    clean_email = credentials.email.strip().lower() if credentials.email else ''

    # 1. Buscar en empleados internos
    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == clean_email).first()
    if usuario and usuario.activo and verify_password(credentials.password, usuario.password_hash):
        rol_nombre = usuario.rol.nombre if usuario.rol else "usuario"
        tenant_id_str = str(usuario.tenant_id) if usuario.tenant_id else None
        tenant_nombre = None
        plan_nombre = "SuperAdmin" if rol_nombre.lower() == "superadmin" else "Basico"
        permite_ia = True if rol_nombre.lower() == "superadmin" else False
        max_suc = 999 if rol_nombre.lower() == "superadmin" else 2

        tenant_obj = None
        if usuario.tenant_id:
            tenant_obj = db.query(Tenant).filter(Tenant.id == usuario.tenant_id).first()
        else:
            tenant_obj = db.query(Tenant).filter(Tenant.estado == "ACTIVA").order_by(Tenant.creado_en.asc()).first()
            if tenant_obj:
                tenant_id_str = str(tenant_obj.id)

        if tenant_obj:
            if tenant_obj.estado == "SUSPENDIDA":
                raise HTTPException(
                    status_code=403,
                    detail="La cuenta de la empresa se encuentra suspendida por falta de pago o decisión comercial (RN05)."
                )
            tenant_nombre = tenant_obj.razon_social
            sub = (
                db.query(Suscripcion)
                .join(Plan, Suscripcion.plan_id == Plan.id)
                .filter(Suscripcion.tenant_id == tenant_obj.id, Suscripcion.estado == "ACTIVA")
                .order_by(Suscripcion.fecha_vencimiento.desc())
                .first()
            )
            if sub and sub.plan:
                plan_nombre = sub.plan.nombre
                permite_ia = sub.plan.permite_reportes_ia
                max_suc = sub.plan.max_sucursales

        if rol_nombre.lower() == "cliente":
            cliente_rec = db.query(Cliente).filter(func.lower(Cliente.email) == clean_email).first()
            if not cliente_rec:
                cliente_rec = Cliente(
                    tenant_id=usuario.tenant_id,
                    nombres=usuario.nombres,
                    apellidos=usuario.apellidos,
                    email=usuario.email,
                    password_hash=usuario.password_hash,
                    telefono=usuario.telefono,
                    activo=True
                )
                db.add(cliente_rec)
                db.commit()
                db.refresh(cliente_rec)
            else:
                cliente_rec.nombres = usuario.nombres
                cliente_rec.apellidos = usuario.apellidos
                cliente_rec.password_hash = usuario.password_hash
                db.commit()
                db.refresh(cliente_rec)

            token = create_access_token(
                subject=cliente_rec.id,
                role="cliente",
                user_type="cliente",
                tenant_id=tenant_id_str
            )
            return TokenResponse(
                access_token=token,
                token_type="bearer",
                role="cliente",
                user_type="cliente",
                user_id=cliente_rec.id,
                nombre_completo=f"{cliente_rec.nombres} {cliente_rec.apellidos}",
                email=cliente_rec.email,
                tenant_id=tenant_id_str,
                tenant_nombre=tenant_nombre,
                sucursal_id=None,
                plan=plan_nombre,
                permite_reportes_ia=permite_ia,
                max_sucursales=max_suc
            )

        token = create_access_token(
            subject=usuario.id,
            role=rol_nombre,
            user_type="usuario",
            tenant_id=tenant_id_str
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role=rol_nombre,
            user_type="usuario",
            user_id=usuario.id,
            nombre_completo=f"{usuario.nombres} {usuario.apellidos}",
            email=usuario.email,
            tenant_id=tenant_id_str,
            tenant_nombre=tenant_nombre,
            sucursal_id=usuario.sucursal_id,
            plan=plan_nombre,
            permite_reportes_ia=permite_ia,
            max_sucursales=max_suc
        )

    # 2. Si no es empleado interno (o la contraseña no coincidió con usuario), buscar en clientes
    cliente = db.query(Cliente).filter(func.lower(Cliente.email) == clean_email).first()
    if cliente and cliente.activo and verify_password(credentials.password, cliente.password_hash):
        tenant_obj_cli = None
        if cliente.tenant_id:
            tenant_obj_cli = db.query(Tenant).filter(Tenant.id == cliente.tenant_id).first()
        else:
            tenant_obj_cli = db.query(Tenant).filter(Tenant.estado == "ACTIVA").order_by(Tenant.creado_en.asc()).first()
        
        tenant_id_str = str(tenant_obj_cli.id) if tenant_obj_cli else None
        tenant_nombre_cli = tenant_obj_cli.razon_social if tenant_obj_cli else None
        token = create_access_token(
            subject=cliente.id,
            role="cliente",
            user_type="cliente",
            tenant_id=tenant_id_str
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role="cliente",
            user_type="cliente",
            user_id=cliente.id,
            nombre_completo=f"{cliente.nombres} {cliente.apellidos}",
            email=cliente.email,
            tenant_id=tenant_id_str
        )

    raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")


# =============================================================================
# RECUPERACIÓN DE CONTRASEÑA
# =============================================================================
@router.post("/forgot-password")
def forgot_password(email_data: dict, db: Session = Depends(get_db)):
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="El correo es requerido.")

    user = db.query(Usuario).filter(Usuario.email == email).first() or \
           db.query(Cliente).filter(Cliente.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No se encontró una cuenta con ese correo.")

    code = f"{random.randint(100000, 999999)}"
    user.reset_code = code
    user.reset_code_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()
    
    send_reset_code_email(email, code)

    return {
        "message": f"Se ha enviado un código de 6 dígitos a: {email}",
        "status": "success"
    }


@router.post("/verify-code")
def verify_code(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    code = data.get("code")
    
    if not email or not code:
        raise HTTPException(status_code=400, detail="Faltan datos.")
        
    user = db.query(Usuario).filter(Usuario.email == email).first() or \
           db.query(Cliente).filter(Cliente.email == email).first()
           
    if not user or user.reset_code != code:
        raise HTTPException(status_code=400, detail="Código inválido o incorrecto.")
        
    if not user.reset_code_expires or user.reset_code_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El código ha expirado. Solicita uno nuevo.")
        
    return {"message": "Código verificado correctamente.", "status": "success"}


@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    email = data.get("email")
    code = data.get("code")
    new_password = data.get("new_password")
    
    if not email or not new_password or not code:
        raise HTTPException(status_code=400, detail="Faltan datos (email, code o new_password).")

    user = db.query(Usuario).filter(Usuario.email == email).first() or \
           db.query(Cliente).filter(Cliente.email == email).first()
           
    if not user or user.reset_code != code:
        raise HTTPException(status_code=400, detail="Código inválido.")
        
    if not user.reset_code_expires or user.reset_code_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El código ha expirado.")

    user.password_hash = get_password_hash(new_password)
    user.reset_code = None
    user.reset_code_expires = None
    db.commit()
    
    return {"message": "Contraseña actualizada con éxito."}


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_obj = current["user"]
    tenant_id_str = str(user_obj.tenant_id) if getattr(user_obj, "tenant_id", None) else None
    tenant_nombre = None
    plan_nombre = None
    permite_ia = False
    max_suc = 1

    if getattr(user_obj, "tenant_id", None):
        tenant = db.query(Tenant).filter(Tenant.id == user_obj.tenant_id).first()
        if tenant:
            tenant_nombre = tenant.razon_social
            sub = (
                db.query(Suscripcion)
                .join(Plan, Suscripcion.plan_id == Plan.id)
                .filter(Suscripcion.tenant_id == user_obj.tenant_id, Suscripcion.estado == "ACTIVA")
                .first()
            )
            if sub and sub.plan:
                plan_nombre = sub.plan.nombre
                permite_ia = sub.plan.permite_reportes_ia
                max_suc = sub.plan.max_sucursales
    else:
        # Fallback para clientes u usuarios sin tenant explícito: vincular al tenant principal activo
        t_default = db.query(Tenant).filter(Tenant.activo == True).order_by(Tenant.created_at.asc()).first()
        if t_default:
            tenant_id_str = str(t_default.id)
            tenant_nombre = t_default.razon_social
            sub = (
                db.query(Suscripcion)
                .join(Plan, Suscripcion.plan_id == Plan.id)
                .filter(Suscripcion.tenant_id == t_default.id, Suscripcion.estado == "ACTIVA")
                .first()
            )
            if sub and sub.plan:
                plan_nombre = sub.plan.nombre
                permite_ia = sub.plan.permite_reportes_ia
                max_suc = sub.plan.max_sucursales

    return UserProfileResponse(
        id=user_obj.id,
        nombres=user_obj.nombres,
        apellidos=user_obj.apellidos,
        email=user_obj.email,
        rol=current["role"],
        user_type=current["user_type"],
        tenant_id=tenant_id_str,
        tenant_nombre=tenant_nombre,
        sucursal_id=getattr(user_obj, "sucursal_id", None),
        plan=plan_nombre,
        permite_reportes_ia=permite_ia,
        max_sucursales=max_suc
    )
