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
}

export interface ClienteRegisterRequest {
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  telefono?: string;
  direccion?: string;
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
}
