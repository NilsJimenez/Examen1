import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class VentaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/ventas`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  checkout(data: {
    metodo_entrega: string;
    direccion_envio?: string;
    sucursal_retiro_id?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/checkout`, data, { headers: this.headers });
  }

  pagarVenta(ventaId: number, data: { metodo_pago: string; monto: number; simular_rechazo?: boolean; numero_tarjeta?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/pagar/${ventaId}`, data, { headers: this.headers });
  }

  ventaPos(data: {
    sucursal_id: number;
    metodo_pago: string;
    items: { variante_id: number; cantidad: number; precio_unitario: number }[];
    cliente_id?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/pos`, data, { headers: this.headers });
  }

  getVentasRecientesPos(sucursalId?: number): Observable<any[]> {
    let params = new HttpParams();
    if (sucursalId) params = params.set('sucursal_id', sucursalId);
    return this.http.get<any[]>(`${this.apiUrl}/pos/recientes`, { headers: this.headers, params });
  }

  buscarVentaPorComprobante(q: string): Observable<any> {
    const params = new HttpParams().set('q', q);
    return this.http.get<any>(`${this.apiUrl}/pos/buscar-comprobante`, { headers: this.headers, params });
  }

  getCatalogoVariantesSucursal(sucursalId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pos/catalogo-sucursal/${sucursalId}`, { headers: this.headers });
  }

  registrarCambioPrenda(data: {
    venta_id: number;
    sucursal_id: number;
    variante_devuelta_id: number;
    variante_entregada_id: number;
    cantidad: number;
    motivo: string;
    metodo_pago_diferencia?: string;
    autorizado_excepcion?: boolean;
    justificacion_excepcion?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cambio-prenda`, data, { headers: this.headers });
  }

  getHistorialCambios(sucursalId?: number): Observable<any[]> {
    let params = new HttpParams();
    if (sucursalId) params = params.set('sucursal_id', sucursalId);
    return this.http.get<any[]>(`${this.apiUrl}/cambios/historial`, { headers: this.headers, params });
  }

  getVenta(ventaId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${ventaId}`, { headers: this.headers });
  }

  getMisCompras(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mis-compras`, { headers: this.headers });
  }
}
