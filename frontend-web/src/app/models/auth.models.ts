export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_type: string;
  user_id: number;
  nombre_completo: string;
  email: string;
  tenant_id?: string | null;
  tenant_nombre?: string | null;
  plan?: string | null;
  permite_reportes_ia?: boolean | null;
  max_sucursales?: number | null;
}

export interface ClienteRegisterRequest {
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  telefono?: string;
  direccion?: string;
  tenant_id?: string;
}

export interface UserProfile {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  user_type: string;
  sucursal_id?: number | null;
  activo: boolean;
  tenant_id?: string | null;
  tenant_nombre?: string | null;
  plan?: string | null;
  permite_reportes_ia?: boolean | null;
  max_sucursales?: number | null;
}
