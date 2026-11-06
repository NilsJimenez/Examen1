import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface PlanSaaS {
  id: string;
  nombre: string;
  max_sucursales: number;
  permite_reportes_ia: boolean;
  activo: boolean;
}

export interface TenantSaaS {
  id: string;
  razon_social: string;
  nit: string;
  estado: string;
  creado_en: string;
  plan_activo?: string;
  max_sucursales?: number;
  permite_reportes_ia?: boolean;
  fecha_vencimiento?: string;
  total_sucursales: number;
  total_usuarios: number;
}

export interface CrearTenantDto {
  razon_social: string;
  nit: string;
  plan_nombre: string;
  admin_nombre: string;
  admin_apellido: string;
  admin_email: string;
  admin_password: string;
  meses_vigencia?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SaasService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/saas`;

  private getHeaders(): HttpHeaders {
    const token = this.authService.token;
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getPlanes(): Observable<PlanSaaS[]> {
    return this.http.get<PlanSaaS[]>(`${this.apiUrl}/planes`);
  }

  getTenants(): Observable<TenantSaaS[]> {
    return this.http.get<TenantSaaS[]>(`${this.apiUrl}/tenants`, { headers: this.getHeaders() });
  }

  crearTenant(dto: CrearTenantDto): Observable<TenantSaaS> {
    return this.http.post<TenantSaaS>(`${this.apiUrl}/tenants`, dto, { headers: this.getHeaders() });
  }

  cambiarEstado(tenantId: string, estado: string): Observable<TenantSaaS> {
    return this.http.patch<TenantSaaS>(
      `${this.apiUrl}/tenants/${tenantId}/estado`,
      { estado },
      { headers: this.getHeaders() }
    );
  }

  cambiarPlan(tenantId: string, plan_nombre: string, meses_vigencia: number = 12): Observable<TenantSaaS> {
    return this.http.post<TenantSaaS>(
      `${this.apiUrl}/tenants/${tenantId}/cambiar-plan`,
      { plan_nombre, meses_vigencia },
      { headers: this.getHeaders() }
    );
  }
}
