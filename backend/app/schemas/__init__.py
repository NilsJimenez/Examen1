from app.schemas.auth import (
    LoginRequest, TokenResponse, ClienteRegisterRequest,
    UsuarioRegisterRequest, UserProfileResponse
)
from app.schemas.producto import (
    CategoriaOut, TallaOut, ColorOut, VarianteOut, ProductoOut, ProductoDetailOut
)

__all__ = [
    "LoginRequest",
    "TokenResponse",
    "ClienteRegisterRequest",
    "UsuarioRegisterRequest",
    "UserProfileResponse",
    "CategoriaOut",
    "TallaOut",
    "ColorOut",
    "VarianteOut",
    "ProductoOut",
    "ProductoDetailOut",
]
