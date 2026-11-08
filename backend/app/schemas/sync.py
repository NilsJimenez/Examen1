import uuid
from datetime import datetime, date, time
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


# =============================================================================
# ESQUEMAS DE DESCARGA DEL PAQUETE OFFLINE (SECCIONES 5.1 Y 6.1)
# =============================================================================

class SucursalOfflineOut(BaseModel):
    id: int
    tenant_id: str
    nombre: str
    ciudad: Optional[str] = None
    direccion: str
    telefono: Optional[str] = None
    activo: bool = True


class CategoriaOfflineOut(BaseModel):
    id: int
    nombre: str


class ProductoOfflineOut(BaseModel):
    id: int
    tenant_id: str
    nombre: str
    descripcion: Optional[str] = None
    categoria_id: int
    categoria_nombre: Optional[str] = None
    precio_base: float
    imagen_url: Optional[str] = None
    genero: Optional[str] = "Unisex"
    activo: bool = True


class VarianteOfflineOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    sku: str
    talla_id: int
    talla: str
    color_id: int
    color: str
    codigo_hex: Optional[str] = "#333333"
    precio_base: float
    precio_adicional: float
    precio_vigente: float
    imagen_url: Optional[str] = None
    activo: bool = True


class InventarioOfflineOut(BaseModel):
    id: int
    sucursal_id: int
    variante_id: int
    cantidad_disponible: int
    cantidad_reservada: int
    cantidad_libre: int
    stock_minimo: int = 5


class ClienteMinimoOfflineOut(BaseModel):
    id: int
    tenant_id: Optional[str] = None
    nombres: str
    apellidos: str
    email: str
    telefono: Optional[str] = None


class PaqueteOfflineResponse(BaseModel):
    """
    Paquete mínimo aislado por tenant y sucursales autorizadas para persistencia
    local en SQLite (Flutter - Desafío III) e IndexedDB (Angular PWA - Desafío II).
    """
    tenant_id: str
    tenant_nombre: str
    plan_nombre: str
    usuario_id: int
    rol: str
    sucursal_asignada_id: Optional[int] = None
    descargado_en: datetime
    umbral_horas_desactualizado: int = 12
    sucursales: List[SucursalOfflineOut]
    categorias: List[CategoriaOfflineOut]
    productos: List[ProductoOfflineOut]
    variantes: List[VarianteOfflineOut]
    inventario: List[InventarioOfflineOut]
    clientes: List[ClienteMinimoOfflineOut]


# =============================================================================
# ESQUEMAS DE SINCRONIZACIÓN POR LOTES E IDEMPOTENCIA (SECCIÓN 6.4, RNF05)
# =============================================================================

class SyncItemDetalleIn(BaseModel):
    variante_id: int
    cantidad: int = Field(..., ge=1, description="Cantidad solicitada (>= 1)")
    precio_unitario: Optional[float] = Field(
        default=None,
        description="Precio unitario registrado en el punto de venta local"
    )


class ClienteMinimoOfflineIn(BaseModel):
    """Datos mínimos del cliente capturados offline cuando no estaba en caché."""
    nombres: str
    apellidos: Optional[str] = ""
    email: Optional[str] = None
    telefono: Optional[str] = None


class OperacionOfflineIn(BaseModel):
    """
    Operación generada en modo offline (VENTA presencial de contado o RESERVA).
    Identificada unívocamente por operation_id (UUIDv4) para idempotencia estricta.
    """
    operation_id: uuid.UUID = Field(..., description="Identificador único UUIDv4 generado en el dispositivo")
    tipo: Literal["VENTA", "RESERVA"]
    client_local_id: Optional[str] = Field(
        default=None,
        description="ID local de la entidad en SQLite/IndexedDB para correlación en el cliente"
    )
    sucursal_id: int
    cliente_id: Optional[int] = None
    cliente_offline: Optional[ClienteMinimoOfflineIn] = None
    metodo_pago: str = "efectivo"
    fecha_local: datetime = Field(..., description="Marca de tiempo local en que se originó la operación")
    fecha_reserva: Optional[date] = None
    horario_atencion: Optional[time] = None
    observaciones: Optional[str] = None
    total_local: Optional[float] = None
    items: List[SyncItemDetalleIn] = Field(..., min_length=1)


class SyncLoteRequest(BaseModel):
    operaciones: List[OperacionOfflineIn] = Field(..., min_length=1, max_length=200)


class ResultadoOperacionOut(BaseModel):
    operation_id: uuid.UUID
    client_local_id: Optional[str] = None
    tipo: str
    estado: Literal["CONFIRMADA", "EN_CONFLICTO", "RECHAZADA"]
    idempotente: bool = False
    entidad_id: Optional[int] = None
    numero_comprobante: Optional[str] = None
    codigo_reserva: Optional[str] = None
    total_confirmado: Optional[float] = None
    motivo: Optional[str] = None
    detalles_conflicto: Optional[List[Dict[str, Any]]] = None
    procesada_en: datetime


class SyncLoteResponse(BaseModel):
    tenant_id: str
    procesado_en: datetime
    total_recibidas: int
    confirmadas: int
    en_conflicto: int
    rechazadas: int
    idempotentes: int
    resultados: List[ResultadoOperacionOut]


# =============================================================================
# ESQUEMAS DE HISTORIAL Y RESOLUCIÓN DE CONFLICTOS (RNF10)
# =============================================================================

class OperacionSyncHistorialItemOut(BaseModel):
    operation_id: uuid.UUID
    tenant_id: str
    tipo: str
    entidad_id: Optional[str] = None
    estado: str
    motivo: Optional[str] = None
    resultado: Optional[Dict[str, Any]] = None
    recibida_en: datetime


class SyncHistorialResponse(BaseModel):
    tenant_id: str
    total: int
    confirmadas: int
    en_conflicto: int
    rechazadas: int
    operaciones: List[OperacionSyncHistorialItemOut]


class ResolverConflictoRequest(BaseModel):
    accion: Literal["DESCARTADA_LOCALMENTE", "AJUSTADA_NUEVA_OPERACION", "REVISADA"]
    nueva_operation_id: Optional[uuid.UUID] = None
    nota: Optional[str] = None
