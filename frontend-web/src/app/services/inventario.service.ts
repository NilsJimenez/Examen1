import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class InventarioService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/inventario`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  getStockPorVariante(varianteId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stock/${varianteId}`);
  }

  getInventarioSucursal(sucursalId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sucursal/${sucursalId}`, { headers: this.headers });
  }

  registrarMovimiento(data: {
    variante_id: number;
    sucursal_id: number;
    tipo_movimiento: string;
    cantidad: number;
    observaciones?: string;
    sucursal_destino_id?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/movimiento`, data, { headers: this.headers });
  }

  getKardex(sucursalId?: number, varianteId?: number): Observable<any[]> {
    let params = new HttpParams();
    if (sucursalId) params = params.set('sucursal_id', sucursalId.toString());
    if (varianteId) params = params.set('variante_id', varianteId.toString());
    return this.http.get<any[]>(`${this.apiUrl}/movimientos`, { headers: this.headers, params });
  }

  ajustarStock(data: {
    variante_id: number;
    sucursal_id: number;
    nueva_cantidad: number;
    observaciones?: string;
  }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/ajustar`, data, { headers: this.headers });
  }
}
