import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/carrito`;

  public carritoCount = signal<number>(0);

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  getCarrito(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/`, { headers: this.headers }).pipe(
      tap(c => this.carritoCount.set(c?.total_items || 0))
    );
  }

  agregarItem(varianteId: number, cantidad: number = 1): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/agregar`, { variante_id: varianteId, cantidad }, { headers: this.headers }).pipe(
      tap(c => this.carritoCount.set(c?.total_items || 0))
    );
  }

  actualizarItem(itemId: number, cantidad: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/item/${itemId}`, { cantidad }, { headers: this.headers }).pipe(
      tap(c => this.carritoCount.set(c?.total_items || 0))
    );
  }

  eliminarItem(itemId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/item/${itemId}`, { headers: this.headers }).pipe(
      tap(c => this.carritoCount.set(c?.total_items || 0))
    );
  }

  vaciarCarrito(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/vaciar`, { headers: this.headers }).pipe(
      tap(() => this.carritoCount.set(0))
    );
  }

  refreshCount(): void {
    if (this.authService.isLoggedIn) {
      this.getCarrito().subscribe({
        next: () => {},
        error: () => {}
      });
    }
  }
}
