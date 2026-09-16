import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Producto, Categoria, Talla, Color } from '../models/producto.models';
import { Sucursal } from '../models/sucursal.models';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/productos`;

  /**
   * Obtiene la lista de prendas de vestir con filtros opcionales de categoría o búsqueda
   */
  getProductos(categoriaId?: number, search?: string, sucursalId?: number): Observable<Producto[]> {
    let params = new HttpParams();
    if (categoriaId) {
      params = params.set('categoria_id', categoriaId.toString());
    }
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }
    if (sucursalId) {
      params = params.set('sucursal_id', sucursalId.toString());
    }
    return this.http.get<Producto[]>(`${this.apiUrl}/`, { params });
  }

  /**
   * Obtiene la ficha detallada de un producto con sus variantes (tallas y colores)
   */
  getProductoById(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene las categorías registradas
   */
  getCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.apiUrl}/meta/categorias`);
  }

  /**
   * Obtiene las tallas registradas
   */
  getTallas(): Observable<Talla[]> {
    return this.http.get<Talla[]>(`${this.apiUrl}/meta/tallas`);
  }

  /**
   * Obtiene los colores registrados
   */
  getColores(): Observable<Color[]> {
    return this.http.get<Color[]>(`${this.apiUrl}/meta/colores`);
  }

  /**
   * Obtiene las sucursales físicas de la cadena
   */
  getSucursales(): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`${environment.apiUrl}/sucursales/`);
  }
}
