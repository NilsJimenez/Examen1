from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Esquema para recibir datos de inicio de sesión."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Esquema de respuesta exitosa tras autenticación con Token JWT."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user_type: str  # "usuario" (personal) o "cliente"
    user_id: int
    nombre_completo: str
    email: str


class ClienteRegisterRequest(BaseModel):
    """Esquema para el registro de nuevos clientes (web / móvil)."""
    nombres: str
    apellidos: str
    email: EmailStr
    password: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None


class UsuarioRegisterRequest(BaseModel):
    """Esquema para que el Administrador registre empleados internos."""
    nombres: str
    apellidos: str
    email: EmailStr
    password: str
    rol_id: int
    sucursal_id: Optional[int] = None
    telefono: Optional[str] = None


class UserProfileResponse(BaseModel):
    """Información del perfil del usuario autenticado."""
    id: int
    nombres: str
    apellidos: str
    email: str
    rol: str
    user_type: str
    sucursal_id: Optional[int] = None
    activo: bool
