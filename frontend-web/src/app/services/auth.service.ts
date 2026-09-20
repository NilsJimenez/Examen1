import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginRequest, TokenResponse, ClienteRegisterRequest, UserProfile } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  // Estado reactivo del usuario conectado
  private currentUserSubject = new BehaviorSubject<TokenResponse | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  private getStoredUser(): TokenResponse | null {
    const userJson = localStorage.getItem('fashionstore_user');
    return userJson ? JSON.parse(userJson) : null;
  }

  public get token(): string | null {
    return localStorage.getItem('fashionstore_token');
  }

  public get currentUserValue(): TokenResponse | null {
    return this.currentUserSubject.value;
  }

  public get isLoggedIn(): boolean {
    return !!this.token;
  }

  public get isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'administrador';
  }

  /**
   * Envía credenciales al Backend FastAPI y almacena el Token JWT
   */
  login(credentials: LoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem('fashionstore_token', response.access_token);
        localStorage.setItem('fashionstore_user', JSON.stringify(response));
        this.currentUserSubject.next(response);
      })
    );
  }

  /**
   * Registra un nuevo cliente y lo autentica automáticamente
   */
  registerCliente(data: ClienteRegisterRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/register-cliente`, data).pipe(
      tap(response => {
        localStorage.setItem('fashionstore_token', response.access_token);
        localStorage.setItem('fashionstore_user', JSON.stringify(response));
        this.currentUserSubject.next(response);
      })
    );
  }

  /**
   * Obtiene la información del perfil del usuario autenticado
   */
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
  }

  /**
   * Cierra la sesión eliminando el Token JWT y limpiando el estado
   */

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyCode(email: string, code: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-code`, { email, code });
  }

  resetPassword(email: string, code: string, new_password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { email, code, new_password });
  }

  logout(): void {

    localStorage.removeItem('fashionstore_token');
    localStorage.removeItem('fashionstore_user');
    this.currentUserSubject.next(null);
  }
}
