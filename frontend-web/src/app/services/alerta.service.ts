import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AlertaReabastecimiento {
  id: number;
  variante_id: number;
  sucursal_id: number;
  cantidad_actual: number;
  stock_minimo_usado: number;
  cantidad_sugerida: number;
  resuelta: boolean;
  fecha_creacion: string;
  fecha_resolucion: string | null;
  proveedor_sugerido: string;
  variante: {
    id: number;
    talla: string;
    color: string;
    producto_nombre: string;
  };
  sucursal: {
    id: number;
    nombre: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AlertaService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/alertas`;

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  getAlertas(): Observable<AlertaReabastecimiento[]> {
    return this.http.get<AlertaReabastecimiento[]>(`${this.apiUrl}/`, { headers: this.getHeaders() });
  }

  atenderAlerta(id: number, cantidad: number, observaciones?: string): Observable<AlertaReabastecimiento> {
    const payload = {
      cantidad_ingresada: cantidad,
      observaciones: observaciones || "Atendido desde Panel"
    };
    return this.http.put<AlertaReabastecimiento>(`${this.apiUrl}/${id}/atender`, payload, { headers: this.getHeaders() });
  }
}
