export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
}

export interface Talla {
  id: number;
  nombre: string;
  orden: number;
}

export interface Color {
  id: number;
  nombre: string;
  codigo_hex?: string;
}

export interface Variante {
  id: number;
  sku: string;
  talla: Talla;
  color: Color;
  precio_adicional: number;
  imagen_url?: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio_base: number;
  imagen_url?: string;
  modelo_ar_url?: string;
  categoria?: Categoria;
  categoria_id?: number;
  activo: boolean;
  variantes?: Variante[];
  stock_total?: number;
  stock_sucursal_seleccionada?: number;
  stock_por_sucursal?: { sucursal_id: number; sucursal_nombre: string; stock_disponible: number }[];
  imagen_url_preview?: string;
}
