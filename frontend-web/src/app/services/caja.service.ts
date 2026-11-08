import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface CajaTurno {
  id: number;
  sucursal_id: number;
  sucursal_nombre?: string;
  cajero_id: number;
  cajero_nombre?: string;
  fecha_apertura: string;
  fecha_cierre?: string;
  monto_apertura: number;
  total_ventas_efectivo?: number;
  total_ventas_digitales?: number;
  total_ventas?: number;
  monto_esperado_en_caja?: number;
  monto_cierre_esperado?: number;
  monto_cierre_real?: number;
  diferencia?: number;
  estado: 'ABIERTA' | 'CERRADA';
  observaciones_apertura?: string;
  observaciones_cierre?: string;
  cantidad_ventas?: number;
}

export interface TurnoActivoResponse {
  activo: boolean;
  turno: CajaTurno | null;
}

export interface AperturaCajaInput {
  sucursal_id: number;
  monto_apertura: number;
  observaciones?: string;
}

export interface CierreCajaInput {
  turno_id: number;
  monto_cierre_real: number;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/caja`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  getTurnoActivo(sucursalId?: number): Observable<TurnoActivoResponse> {
    let params = new HttpParams();
    if (sucursalId) {
      params = params.set('sucursal_id', sucursalId.toString());
    }
    return this.http.get<TurnoActivoResponse>(`${this.apiUrl}/turno-activo`, {
      headers: this.headers,
      params
    });
  }

  abrirCaja(data: AperturaCajaInput): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/abrir`, data, { headers: this.headers });
  }

  cerrarCaja(data: CierreCajaInput): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cerrar`, data, { headers: this.headers });
  }

  getHistorial(sucursalId?: number, limit = 25): Observable<CajaTurno[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (sucursalId) {
      params = params.set('sucursal_id', sucursalId.toString());
    }
    return this.http.get<CajaTurno[]>(`${this.apiUrl}/historial`, {
      headers: this.headers,
      params
    });
  }
}
