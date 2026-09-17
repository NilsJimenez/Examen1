import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/admin`;

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token}`
    });
  }

  // --- PRENDAS Y CATÁLOGO ---
  crearProducto(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/productos`, data, { headers: this.headers });
  }

  actualizarProducto(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/productos/${id}`, data, { headers: this.headers });
  }

  eliminarProducto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/productos/${id}`, { headers: this.headers });
  }

  // --- ATRIBUTOS COMERCIALES (CATEGORÍAS, TALLAS, COLORES) ---
  crearCategoria(data: { nombre: string; descripcion?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/categorias`, data, { headers: this.headers });
  }

  eliminarCategoria(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categorias/${id}`, { headers: this.headers });
  }

  crearTalla(data: { nombre: string; orden: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/tallas`, data, { headers: this.headers });
  }

  eliminarTalla(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/tallas/${id}`, { headers: this.headers });
  }

  crearColor(data: { nombre: string; codigo_hex: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/colores`, data, { headers: this.headers });
  }

  eliminarColor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/colores/${id}`, { headers: this.headers });
  }

  // --- SUCURSALES Y CIUDADES ---
  crearCiudad(data: { nombre: string; pais: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/ciudades`, data, { headers: this.headers });
  }

  crearSucursal(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/sucursales`, data, { headers: this.headers });
  }

  eliminarSucursal(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sucursales/${id}`, { headers: this.headers });
  }

  // --- PROVEEDORES Y TEMPORADAS ---
  getProveedores(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/proveedores`, { headers: this.headers });
  }

  crearProveedor(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/proveedores`, data, { headers: this.headers });
  }

  eliminarProveedor(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/proveedores/${id}`, { headers: this.headers });
  }

  getTemporadas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/temporadas`, { headers: this.headers });
  }

  crearTemporada(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/temporadas`, data, { headers: this.headers });
  }

  eliminarTemporada(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/temporadas/${id}`, { headers: this.headers });
  }

  getColecciones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/colecciones`, { headers: this.headers });
  }

  crearColeccion(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/colecciones`, data, { headers: this.headers });
  }

  eliminarColeccion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/colecciones/${id}`, { headers: this.headers });
  }

  // --- PERSONAL Y ROLES ---
  getRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/roles`, { headers: this.headers });
  }

  getUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios`, { headers: this.headers });
  }

  crearUsuario(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/usuarios`, data, { headers: this.headers });
  }

  cambiarRolUsuario(usuarioId: number, data: { rol_id: number; sucursal_id?: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/usuarios/${usuarioId}/rol`, data, { headers: this.headers });
  }

  eliminarUsuario(usuarioId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/usuarios/${usuarioId}`, { headers: this.headers });
  }

  // --- VARIANTES DE COLOR, FOTOS Y ENTRADA DE STOCK ---
  getVariantesDetalle(productoId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/productos/${productoId}/variantes-detalle`, { headers: this.headers });
  }

  actualizarVariantes(productoId: number, data: any[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/productos/${productoId}/variantes`, data, { headers: this.headers });
  }

  registrarIngresoStock(productoId: number, data: { sucursal_id: number; cantidad: number; variante_id?: number; observaciones?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/productos/${productoId}/ingreso-stock`, data, { headers: this.headers });
  }

  registrarIngresoMatriz(productoId: number, data: { sucursal_id: number; items: { talla_id: number; color_id: number; cantidad: number; variante_id?: number }[]; observaciones?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/productos/${productoId}/ingreso-matriz`, data, { headers: this.headers });
  }
}
