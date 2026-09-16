export interface Ciudad {
  id: number;
  nombre: string;
  pais: string;
}

export interface Sucursal {
  id: number;
  nombre: string;
  direccion: string;
  telefono?: string;
  latitud?: number;
  longitud?: number;
  ciudad: Ciudad;
}
