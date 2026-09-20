import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Producto } from '../models/producto.models';
import { AuthService } from './auth.service';

export interface PrendaLookbook {
  producto: Producto;
  rol: string;
}

export interface LookbookResponse {
  outfits: PrendaLookbook[][];
  justificacion: string;
  total_bs: number;
  mensaje?: string;
}

export interface LookbookRequest {
  ocasion: string;
  presupuesto_max: number;
  talla_preferida?: string;
  sucursal_id?: number;
  genero?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LookbookService {
  private apiUrl = `${environment.apiUrl}/lookbook`;

  constructor(private http: HttpClient, private authService: AuthService) { }

  generarLookbook(req: LookbookRequest): Observable<LookbookResponse> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.token}`
    });
    return this.http.post<LookbookResponse>(`${this.apiUrl}/generar`, req, { headers });
  }
}
