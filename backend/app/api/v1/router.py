from fastapi import APIRouter
from app.api.v1.endpoints import auth, productos, sucursales, admin, inventario, reservas, carrito, ventas, recomendaciones

api_router = APIRouter()

# Registro de routers por módulo
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(productos.router, prefix="/productos", tags=["Catálogo de Productos"])
api_router.include_router(sucursales.router, prefix="/sucursales", tags=["Sucursales"])
api_router.include_router(admin.router, prefix="/admin", tags=["Panel de Administración"])
# Ciclo 2
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
api_router.include_router(reservas.router, prefix="/reservas", tags=["Reservas"])
api_router.include_router(carrito.router, prefix="/carrito", tags=["Carrito"])
api_router.include_router(ventas.router, prefix="/ventas", tags=["Ventas"])
# Ciclo 3
api_router.include_router(recomendaciones.router, prefix="/recomendaciones", tags=["Recomendaciones IA y BI"])
