import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  pagarVenta(ventaId: number, data: { metodo_pago: string; monto: number }): Observable<any> {
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

  getMisCompras(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mis-compras`, { headers: this.headers });
  }
}
