from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.usuario import Usuario, Cliente

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> dict:
    """
    Decodifica el Token JWT y retorna el usuario autenticado desde la base de datos,
    incluyendo su tenant_id para aislamiento SaaS.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales de acceso",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        role: str = payload.get("role")
        user_type: str = payload.get("user_type")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    if user_type == "cliente":
        user = db.query(Cliente).filter(Cliente.id == user_id, Cliente.activo == True).first()
    else:
        user = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()

    if user is None:
        raise credentials_exception

    return {
        "user": user,
        "role": role,
        "user_type": user_type,
        "id": user.id,
        "email": user.email,
        "tenant_id": getattr(user, "tenant_id", None)
    }


def get_optional_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional)
) -> Optional[dict]:
    """
    Retorna el usuario autenticado si existe un token válido en la petición,
    o None si es un visitante público.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        role: str = payload.get("role")
        user_type: str = payload.get("user_type")
        if user_id_str is None:
            return None
        user_id = int(user_id_str)
        if user_type == "cliente":
            user = db.query(Cliente).filter(Cliente.id == user_id, Cliente.activo == True).first()
        else:
            user = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()
        if not user:
            return None
        return {
            "user": user,
            "role": role,
            "user_type": user_type,
            "id": user.id,
            "email": user.email,
            "tenant_id": getattr(user, "tenant_id", None)
        }
    except Exception:
        return None


def require_roles(allowed_roles: list[str]):
    """Decorador / Dependencia para restringir endpoints según el rol del usuario."""
    def role_checker(current_user: dict = Depends(get_current_user)):
        rol_lower = current_user["role"].lower()
        allowed_lower = [r.lower() for r in allowed_roles]
        if rol_lower in ["superadmin", "admin_plataforma"] or rol_lower in allowed_lower:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permiso denegado. Se requiere uno de los roles: {allowed_roles}"
        )
    return role_checker
