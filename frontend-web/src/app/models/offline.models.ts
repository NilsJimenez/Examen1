export interface ProductoOffline {
  id: number;
  nombre: string;
  descripcion?: string;
  precio_base: number;
  categoria_id: number;
  categoria_nombre?: string;
  imagen_url?: string;
}

export interface VarianteOffline {
  id: number;
  producto_id: number;
  sku: string;
  talla: string;
  color: string;
  precio: number;
  codigo_barra?: string;
}

export interface InventarioOffline {
  id: number;
  sucursal_id: number;
  variante_id: number;
  stock_disponible: number;
  stock_reservado: number;
  stock_libre: number;
}

export type EstadoOperacionOffline = 'registrada_local' | 'enviada' | 'confirmada' | 'rechazada' | 'en_conflicto';

export interface ItemOperacionOffline {
  variante_id: number;
  producto_nombre?: string;
  talla?: string;
  color?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface OperacionOffline {
  id: string; // UUIDv4
  tipo: 'venta' | 'reserva';
  sucursal_id: number;
  sucursal_nombre?: string;
  timestamp_local: string;
  estado: EstadoOperacionOffline;
  monto_total: number;
  items: ItemOperacionOffline[];
  payload: any;
  cliente_id?: number;
  cliente_nombre?: string;
  error_mensaje?: string;
  respuesta_servidor?: any;
  intentos_sincronizacion: number;
  sincronizado_en?: string;
}

export interface PaqueteOfflineMeta {
  clave: string; // 'paquete_meta'
  tenant_id: string;
  tenant_nombre: string;
  descargado_en: string;
  total_productos: number;
  total_variantes: number;
  sucursal_id?: number;
}
