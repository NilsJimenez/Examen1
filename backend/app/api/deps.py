from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.usuario import Usuario, Cliente

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> dict:
    """
    Decodifica el Token JWT y retorna el usuario autenticado desde la base de datos.
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
        "email": user.email
    }


def require_roles(allowed_roles: list[str]):
    """Decorador / Dependencia para restringir endpoints según el rol del usuario."""
    def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso denegado. Se requiere uno de los roles: {allowed_roles}"
            )
        return current_user
    return role_checker
