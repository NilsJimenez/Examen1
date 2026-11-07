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

export interface FiltrosInterpretados {
  sucursal_id?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  formato_descarga?: 'pdf' | 'xlsx' | null;
}

export interface DashboardReporteOut {
  kpis: KPIData;
  ventas_por_dia: VentasPorDia[];
  mensaje: string | null;
  resumen_ia?: string;
  filtros_interpretados?: FiltrosInterpretados;
}

export interface ReportesConvencionalesOut {
  ventas: any[];
  inventario: any[];
  resumen_inventario: {
    total_variantes: number;
    total_unidades_stock: number;
    valorizacion_total_bs: number;
    items_bajo_stock: number;
    total_cambios_prenda_cu13: number;
  };
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

  getReportesConvencionales(filtros?: { sucursal_id?: number; fecha_inicio?: string; fecha_fin?: string }): Observable<ReportesConvencionalesOut> {
    let params = new HttpParams();
    if (filtros?.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id);
    if (filtros?.fecha_inicio) params = params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros?.fecha_fin) params = params.set('fecha_fin', filtros.fecha_fin);

    return this.http.get<ReportesConvencionalesOut>(`${this.apiUrl}/convencionales`, { headers: this.getHeaders(), params });
  }

  exportarReporte(formato: 'pdf' | 'xlsx', filtros?: { sucursal_id?: number; fecha_inicio?: string; fecha_fin?: string }, tipo: 'ventas' | 'inventario' = 'ventas') {
    let params = new HttpParams().set('formato', formato).set('tipo', tipo);
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
