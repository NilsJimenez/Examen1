import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface RecomendacionIA {
  id: number;
  producto_id: number;
  score: number;
  motivo: string;
  fecha_generada: string;
}

export interface RecomendacionResponse {
  recomendaciones: RecomendacionIA[];
  fallback_aplicado: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RecomendacionService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/recomendaciones`;

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  getRecomendacionesParaMi(): Observable<RecomendacionResponse> {
    return this.http.get<RecomendacionResponse>(`${this.apiUrl}/para-mi`, { headers: this.getHeaders() });
  }

  registrarClic(recomendacionId: number, productoId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${recomendacionId}/clic?producto_id=${productoId}`, {}, { headers: this.getHeaders() });
  }
}
