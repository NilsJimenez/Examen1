import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/reservas`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  crearReserva(data: {
    sucursal_id: number;
    fecha_reserva: string;
    horario_atencion: string;
    items: { variante_id: number; cantidad: number }[];
    observaciones?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/`, data, { headers: this.headers });
  }

  getMisReservas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mis-reservas`, { headers: this.headers });
  }

  getReserva(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.headers });
  }

  cancelarReserva(id: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/cancelar`, {}, { headers: this.headers });
  }

  getReservasSucursal(sucursalId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sucursal/${sucursalId}`, { headers: this.headers });
  }

  prepararReserva(id: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/preparar`, {}, { headers: this.headers });
  }

  atenderReserva(id: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/atender`, {}, { headers: this.headers });
  }

  checkinQR(codigo: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/qr/${encodeURIComponent(codigo)}`, { headers: this.headers });
  }
}
