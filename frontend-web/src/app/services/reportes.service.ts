import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface KPIData {
  total_vendido: number;
  ticket_promedio: number;
  cantidad_ventas: number;
  reservas_concretadas_pct: number;
}

export interface VentasPorDia {
  fecha: string;
  total: number;
}

export interface DashboardReporteOut {
  kpis: KPIData;
  ventas_por_dia: VentasPorDia[];
  mensaje: string | null;
  resumen_ia?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/reportes`;

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  getDashboard(filtros?: { sucursal_id?: number; fecha_inicio?: string; fecha_fin?: string }): Observable<DashboardReporteOut> {
    let params = new HttpParams();
    if (filtros?.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id);
    if (filtros?.fecha_inicio) params = params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros?.fecha_fin) params = params.set('fecha_fin', filtros.fecha_fin);

    return this.http.get<DashboardReporteOut>(`${this.apiUrl}/dashboard`, { headers: this.getHeaders(), params });
  }

  exportarReporte(formato: 'pdf' | 'xlsx', filtros?: { sucursal_id?: number; fecha_inicio?: string; fecha_fin?: string }) {
    let params = new HttpParams().set('formato', formato);
    if (filtros?.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id);
    if (filtros?.fecha_inicio) params = params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros?.fecha_fin) params = params.set('fecha_fin', filtros.fecha_fin);

    return this.http.get(`${this.apiUrl}/exportar`, {
      headers: this.getHeaders(),
      params,
      responseType: 'blob'
    });
  }

  generarReporteIA(prompt: string, sucursalesDisponibles: any[]): Observable<DashboardReporteOut> {
    return this.http.post<DashboardReporteOut>(
      `${this.apiUrl}/generativo`, 
      { prompt, sucursales_disponibles: sucursalesDisponibles },
      { headers: this.getHeaders() }
    );
  }
}

