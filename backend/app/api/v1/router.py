from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, productos, sucursales, admin, inventario, reservas,
    carrito, ventas, recomendaciones, chatbot, alertas, reportes, lookbook, saas, notificaciones, sync, analitica, caja
)

api_router = APIRouter()

# Registro de routers por módulo
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(saas.router, prefix="/saas", tags=["SaaS Multi-tenant (CU01-CU04)"])
api_router.include_router(sync.router, prefix="/sync", tags=["Sincronización Offline (PWA & Flutter)"])
api_router.include_router(analitica.router, prefix="/analitica", tags=["Analítica con Machine Learning (CU27-CU29)"])
api_router.include_router(productos.router, prefix="/productos", tags=["Catálogo de Productos"])
api_router.include_router(sucursales.router, prefix="/sucursales", tags=["Sucursales"])
api_router.include_router(admin.router, prefix="/admin", tags=["Panel de Administración"])
# Ciclo 2
api_router.include_router(inventario.router, prefix="/inventario", tags=["Inventario"])
api_router.include_router(reservas.router, prefix="/reservas", tags=["Reservas"])
api_router.include_router(carrito.router, prefix="/carrito", tags=["Carrito"])
api_router.include_router(ventas.router, prefix="/ventas", tags=["Ventas"])
api_router.include_router(caja.router, prefix="/caja", tags=["Control de Caja (CU30)"])
# Ciclo 3
api_router.include_router(recomendaciones.router, prefix="/recomendaciones", tags=["Recomendaciones IA y BI"])
api_router.include_router(chatbot.router, prefix="/chatbot", tags=["Asistente Virtual IA"])
api_router.include_router(alertas.router, prefix="/alertas", tags=["Alertas de Stock"])
api_router.include_router(reportes.router, prefix="/reportes", tags=["Reportes y BI"])
api_router.include_router(lookbook.router, prefix="/lookbook", tags=["Lookbook IA"])
api_router.include_router(notificaciones.router, prefix="/notificaciones", tags=["Notificaciones Push Móvil"])
