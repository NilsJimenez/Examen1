from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.usuario import Usuario, Cliente, Rol
from app.schemas.auth import (
    LoginRequest, TokenResponse, ClienteRegisterRequest,
    UsuarioRegisterRequest, UserProfileResponse
)
from app.api.deps import get_current_user, require_roles

router = APIRouter()


@router.post("/register-cliente", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_cliente(data: ClienteRegisterRequest, db: Session = Depends(get_db)):
    """
    RF01: Registro de un nuevo cliente desde la web o app móvil.
    """
    # Verificar si el correo ya existe
    existing_cliente = db.query(Cliente).filter(Cliente.email == data.email).first()
    if existing_cliente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una cuenta registrada con este correo electrónico."
        )

    # Crear el nuevo cliente con contraseña encriptada
    nuevo_cliente = Cliente(
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

    # Generar Token JWT de acceso inmediato
    token = create_access_token(
        subject=nuevo_cliente.id,
        role="cliente",
        user_type="cliente"
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role="cliente",
        user_type="cliente",
        user_id=nuevo_cliente.id,
        nombre_completo=f"{nuevo_cliente.nombres} {nuevo_cliente.apellidos}",
        email=nuevo_cliente.email
    )


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Inicio de sesión unificado para Clientes y Personal de la empresa (Admin, Encargados, Cajeros).
    """
    # 1. Buscar primero en empleados internos
    usuario = db.query(Usuario).filter(Usuario.email == credentials.email).first()
    if usuario:
        if not usuario.activo:
            raise HTTPException(status_code=400, detail="Esta cuenta de usuario ha sido desactivada.")
        if not verify_password(credentials.password, usuario.password_hash):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
        
        rol_nombre = usuario.rol.nombre if usuario.rol else "usuario"
        token = create_access_token(
            subject=usuario.id,
            role=rol_nombre,
            user_type="usuario"
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role=rol_nombre,
            user_type="usuario",
            user_id=usuario.id,
            nombre_completo=f"{usuario.nombres} {usuario.apellidos}",
            email=usuario.email
        )

    # 2. Si no es empleado, buscar en clientes
    cliente = db.query(Cliente).filter(Cliente.email == credentials.email).first()
    if cliente:
        if not cliente.activo:
            raise HTTPException(status_code=400, detail="Esta cuenta de cliente se encuentra suspendida.")
        if not verify_password(credentials.password, cliente.password_hash):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

        token = create_access_token(
            subject=cliente.id,
            role="cliente",
            user_type="cliente"
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role="cliente",
            user_type="cliente",
            user_id=cliente.id,
            nombre_completo=f"{cliente.nombres} {cliente.apellidos}",
            email=cliente.email
        )

    raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")


@router.post("/forgot-password")
def forgot_password(email_data: dict, db: Session = Depends(get_db)):
    """
    CU-03: Simulación de envío de enlace de recuperación de contraseña.
    """
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="El correo es requerido.")

    # Verificar si existe en usuarios o clientes
    user = db.query(Usuario).filter(Usuario.email == email).first() or \
           db.query(Cliente).filter(Cliente.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No se encontró una cuenta con ese correo.")

    return {
        "message": f"Se ha enviado un correo con instrucciones de restablecimiento a: {email}",
        "status": "success"
    }


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(current: dict = Depends(get_current_user)):

    """
    Obtiene los datos del usuario autenticado a partir del Token JWT.
    """
    user_obj = current["user"]
    return UserProfileResponse(
        id=user_obj.id,
        nombres=user_obj.nombres,
        apellidos=user_obj.apellidos,
        email=user_obj.email,
        rol=current["role"],
        user_type=current["user_type"],
        sucursal_id=getattr(user_obj, "sucursal_id", None),
        activo=user_obj.activo
    )
