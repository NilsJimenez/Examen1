from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, productos, sucursales, admin, inventario, reservas,
    carrito, ventas, recomendaciones, chatbot, alertas, reportes, lookbook, saas, notificaciones, sync, analitica
)

api_router = APIRouter()

# Registro de routers por módulo
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(saas.router, prefix="/saas", tags=["SaaS Multi-tenant (CU01-CU07)"])
api_router.include_router(productos.router, prefix="/productos", tags=["Catálogo de Productos"])
api_router.include_router(sucursales.router, prefix="/sucursales", tags=["Sucursales"])
api_router.include_router(admin.router, prefix="/admin", tags=["Panel de Administración"])
# Ciclo 2: Operación Comercial y Sincronización Offline
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
api_router.include_router(reservas.router, prefix="/reservas", tags=["Reservas"])
api_router.include_router(carrito.router, prefix="/carrito", tags=["Carrito"])
api_router.include_router(ventas.router, prefix="/ventas", tags=["Ventas y Cambios de Prenda (CU12-CU13)"])
api_router.include_router(sync.router, prefix="/sync", tags=["Operación Offline y Sincronización (CU15-CU22)"])
# Ciclo 3: IA y Analítica con Machine Learning
api_router.include_router(recomendaciones.router, prefix="/recomendaciones", tags=["Recomendaciones IA y BI"])
api_router.include_router(chatbot.router, prefix="/chatbot", tags=["Asistente Virtual IA"])
api_router.include_router(alertas.router, prefix="/alertas", tags=["Alertas de Stock"])
api_router.include_router(reportes.router, prefix="/reportes", tags=["Reportes Convencionales e IA (CU14, CU23-CU26)"])
api_router.include_router(analitica.router, prefix="/analitica", tags=["Machine Learning Supervisado y No Supervisado (CU27-CU29)"])
api_router.include_router(lookbook.router, prefix="/lookbook", tags=["Lookbook IA"])
api_router.include_router(notificaciones.router, prefix="/notificaciones", tags=["Notificaciones Push Móvil"])
