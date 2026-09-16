# Exportar todos los modelos para registro en SQLAlchemy
from app.db.base_class import Base
from app.models.usuario import Rol, Usuario, Cliente
from app.models.sucursal import Ciudad, Sucursal
from app.models.producto import (
    Proveedor, Categoria, Temporada, Coleccion, Talla, Color, Producto, ProductoVariante
)
from app.models.inventario import InventarioSucursal, MovimientoInventario
from app.models.reserva import Reserva, ReservaDetalle
from app.models.venta import Venta, VentaDetalle, Pago, Comprobante
from app.models.interacciones import (
    Carrito, CarritoDetalle, Promocion, HistorialInteraccion,
    Recomendacion, InteraccionChatbot, SesionVestidorVirtual, ReporteIA
)

__all__ = [
    "Base",
    "Rol",
    "Usuario",
    "Cliente",
    "Ciudad",
    "Sucursal",
    "Proveedor",
    "Categoria",
    "Temporada",
    "Coleccion",
    "Talla",
    "Color",
    "Producto",
    "ProductoVariante",
    "InventarioSucursal",
    "MovimientoInventario",
    "Reserva",
    "ReservaDetalle",
    "Venta",
    "VentaDetalle",
    "Pago",
    "Comprobante",
    "Carrito",
    "CarritoDetalle",
    "Promocion",
    "HistorialInteraccion",
    "Recomendacion",
    "InteraccionChatbot",
    "SesionVestidorVirtual",
    "ReporteIA",
]
