import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page-wrapper">
      
      <!-- Card Principal Split (2 Columnas Moda de Lujo) -->
      <div class="auth-split-card animate-fade-in">
        
        <!-- ================================================================= -->
        <!-- COLUMNA IZQUIERDA: FORMULARIO DE INICIO DE SESIÓN                 -->
        <!-- ================================================================= -->
        <div class="auth-form-column">
          
          <!-- Encabezado con línea de acento dorado -->
          <div class="auth-header">
            <h2 class="auth-title">INICIAR SESIÓN</h2>
            <div class="auth-title-line"></div>
          </div>

          <!-- Mensaje de Error -->
          <div *ngIf="errorMessage" class="auth-alert-error">
            <i class="fa-solid fa-circle-exclamation mr-2"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <form (ngSubmit)="onSubmit()" class="auth-form">
            
            <!-- Campo Correo Electrónico -->
            <div class="auth-field-group">
              <label class="auth-label">
                CORREO ELECTRÓNICO <span class="required-star">*</span>
              </label>
              <input 
                type="email" 
                name="email"
                [(ngModel)]="email" 
                required
                placeholder="ejemplo@fashionstore.com"
                class="auth-input" 
              />
            </div>

            <!-- Campo Contraseña con Botón de Mostrar/Ocultar (Ojo) -->
            <div class="auth-field-group">
              <label class="auth-label">
                CONTRASEÑA <span class="required-star">*</span>
              </label>
              <div class="password-input-wrapper">
                <input 
                  [type]="mostrarPassword ? 'text' : 'password'" 
                  name="password"
                  [(ngModel)]="password" 
                  required
                  placeholder="Introduce tu contraseña"
                  class="auth-input password-input" 
                />
                <button 
                  type="button" 
                  (click)="toggleMostrarPassword()" 
                  class="password-toggle-btn"
                  [title]="mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
                >
                  <i class="fa-solid" [class.fa-eye]="!mostrarPassword" [class.fa-eye-slash]="mostrarPassword"></i>
                </button>
              </div>
            </div>

            <!-- Fila: Recordarme & Olvidaste tu contraseña -->
            <div class="auth-meta-row">
              <label class="remember-me-label">
                <input type="checkbox" [(ngModel)]="recordarme" name="recordarme" class="remember-checkbox" />
                <span>Recordarme</span>
              </label>
              <a href="javascript:void(0)" (click)="onForgotPassword()" class="forgot-link">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <!-- Botón Principal Submit -->
            <button 
              type="submit" 
              [disabled]="loading" 
              class="auth-submit-btn"
            >
              <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> VERIFICANDO...</span>
              <span *ngIf="!loading">INICIAR SESIÓN</span>
            </button>

          </form>

          <!-- Separador Estilizado -->
          <div class="auth-divider">
            <span>O ACCEDE COMO DEMO</span>
          </div>

          <!-- Botones de Rápido Acceso Demo (Estilo Botones Sociales de la Referencia) -->
          <div class="demo-buttons-grid">
            <button 
              type="button" 
              (click)="fillCredentials('admin')" 
              class="demo-access-btn"
              title="Cargar credenciales de Administrador"
            >
              <i class="fa-solid fa-shield-halved mr-2" style="color: var(--accent);"></i>
              <span>Admin Demo</span>
            </button>

            <button 
              type="button" 
              (click)="fillCredentials('encargado')" 
              class="demo-access-btn"
              title="Cargar credenciales de Encargado de Sucursal"
            >
              <i class="fa-solid fa-warehouse mr-2" style="color: #818cf8;"></i>
              <span>Encargado Demo</span>
            </button>
          </div>

          <!-- Enlace a Registro -->
          <div class="auth-footer-switch">
            <span>¿Aún no tienes cuenta?</span>
            <a routerLink="/registro" class="switch-link">
              Regístrate aquí
            </a>
          </div>

        </div>

        <!-- ================================================================= -->
        <!-- COLUMNA DERECHA: FASHION EDITORIAL BANNER (FOTO DE MODA DE LUJO)  -->
        <!-- ================================================================= -->
        <div class="auth-image-column">
          
          <!-- Botón de Cerrar (X) que regresa al catálogo -->
          <button (click)="cerrarModal()" class="close-modal-btn" title="Cerrar y volver al catálogo">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <!-- Capa de Gradiente Oscuro para Legibilidad -->
          <div class="auth-image-overlay"></div>

          <!-- Contenido Tipográfico de Alta Costura sobre la Imagen -->
          <div class="auth-image-content">
            <span class="editorial-tag">
              <i class="fa-solid fa-gem mr-1.5"></i> COLECCIÓN 2026
            </span>
            <h3 class="editorial-brand">FASHIONSTORE</h3>
            <p class="editorial-headline">
              ALTA COSTURA &<br>VESTIDORES VIRTUALES
            </p>
            <div class="editorial-separator"></div>
            <p class="editorial-subtext">
              Reserva prendas exclusivas online y pruébatelas en probadores VIP equipados con realidad aumentada
            </p>
          </div>

        </div>

      </div>

    </div>
  `,
  styles: [`
    .auth-page-wrapper {
      min-height: calc(100vh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
      background: var(--bg-main);
    }

    /* Card Split de 2 Columnas */
    .auth-split-card {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      max-width: 960px;
      width: 100%;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      position: relative;
    }

    @media (max-width: 820px) {
      .auth-split-card {
        grid-template-columns: 1fr;
        max-width: 480px;
      }
      .auth-image-column {
        display: none;
      }
    }

    /* Columna Izquierda: Formulario */
    .auth-form-column {
      padding: 3rem 2.75rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: var(--card-bg);
    }

    @media (max-width: 480px) {
      .auth-form-column {
        padding: 2.25rem 1.75rem;
      }
    }

    .auth-header {
      margin-bottom: 2.25rem;
    }

    .auth-title {
      font-family: var(--font-sans);
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-main);
      margin: 0;
    }

    .auth-title-line {
      width: 42px;
      height: 3px;
      background: var(--accent);
      border-radius: 2px;
      margin-top: 0.6rem;
    }

    .auth-alert-error {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 0.85rem 1.15rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.75rem;
      display: flex;
      align-items: center;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .auth-field-group {
      display: flex;
      flex-direction: column;
    }

    .auth-label {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 0.45rem;
    }

    .required-star {
      color: #ef4444;
      font-weight: bold;
    }

    .auth-input {
      width: 100%;
      padding: 0.9rem 1.15rem;
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      background: var(--input-bg);
      color: var(--text-main);
      font-size: 0.92rem;
      transition: all 0.2s ease;
      outline: none;
      box-sizing: border-box;
    }

    .auth-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
    }

    .auth-input::placeholder {
      color: var(--text-muted);
      opacity: 0.6;
    }

    /* Wrapper de Contraseña con Botón de Ojo */
    .password-input-wrapper {
      position: relative;
      width: 100%;
    }

    .password-input {
      padding-right: 2.85rem !important;
    }

    .password-toggle-btn {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.95rem;
      cursor: pointer;
      padding: 0.35rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    .password-toggle-btn:hover {
      color: var(--accent);
    }

    /* Fila Meta (Recordarme & Link Olvidé Contraseña) */
    .auth-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      font-size: 0.82rem;
      margin-top: 0.1rem;
    }

    .remember-me-label {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
    }

    .remember-checkbox {
      accent-color: var(--accent);
      cursor: pointer;
      width: 16px;
      height: 16px;
    }

    .forgot-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.2s ease;
    }

    .forgot-link:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    /* Botón Submit */
    .auth-submit-btn {
      width: 100%;
      padding: 1rem;
      background: var(--primary);
      color: var(--primary-text);
      font-family: var(--font-sans);
      font-size: 0.9rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 0.75rem;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
    }

    .auth-submit-btn:hover:not(:disabled) {
      background: var(--accent);
      color: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3);
    }

    .auth-submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Separador Demo */
    .auth-divider {
      position: relative;
      text-align: center;
      margin: 2.25rem 0 1.65rem 0;
    }

    .auth-divider::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--border-color);
      z-index: 1;
    }

    .auth-divider span {
      position: relative;
      z-index: 2;
      background: var(--card-bg);
      padding: 0 1rem;
      color: var(--text-muted);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    /* Botones Rápidos Demo (Estilo social media de la referencia) */
    .demo-buttons-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .demo-access-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.8rem 1rem;
      background: var(--table-th-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-main);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .demo-access-btn:hover {
      border-color: var(--accent);
      background: rgba(245, 158, 11, 0.08);
      color: var(--accent);
      transform: translateY(-1px);
    }

    /* Enlace a Registro */
    .auth-footer-switch {
      margin-top: 2.25rem;
      text-align: center;
      font-size: 0.86rem;
      color: var(--text-muted);
    }

    .switch-link {
      font-weight: 800;
      color: var(--accent);
      text-decoration: none;
      margin-left: 0.35rem;
    }

    .switch-link:hover {
      text-decoration: underline;
    }

    /* Columna Derecha: Imagen Editorial de Moda */
    .auth-image-column {
      position: relative;
      background-image: url('https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop&q=80');
      background-size: cover;
      background-position: center top;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 3rem 2.5rem;
      min-height: 520px;
    }

    .auth-image-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg, 
        rgba(9, 9, 11, 0.25) 0%, 
        rgba(9, 9, 11, 0.65) 55%, 
        rgba(9, 9, 11, 0.92) 100%
      );
      z-index: 1;
    }

    .close-modal-btn {
      position: absolute;
      top: 18px;
      right: 18px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }

    .close-modal-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
      transform: scale(1.08);
    }

    .auth-image-content {
      position: relative;
      z-index: 2;
      color: #ffffff;
    }

    .editorial-tag {
      display: inline-flex;
      align-items: center;
      background: rgba(245, 158, 11, 0.25);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.5);
      border-radius: 9999px;
      padding: 0.2rem 0.75rem;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      margin-bottom: 0.75rem;
    }

    .editorial-brand {
      font-family: var(--font-serif);
      font-size: 1.75rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.06em;
      margin: 0 0 0.35rem 0;
    }

    .editorial-headline {
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #f59e0b;
      line-height: 1.4;
      margin: 0;
    }

    .editorial-separator {
      width: 48px;
      height: 2px;
      background: rgba(255, 255, 255, 0.3);
      margin: 1rem 0;
    }

    .editorial-subtext {
      font-size: 0.8rem;
      line-height: 1.5;
      color: #d4d4d8;
      margin: 0;
      max-width: 320px;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  email: string = '';
  password: string = '';
  mostrarPassword: boolean = false;
  recordarme: boolean = true;
  loading: boolean = false;
  errorMessage: string = '';

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  fillCredentials(role: 'admin' | 'encargado'): void {
    if (role === 'admin') {
      this.email = 'admin@fashionstore.com';
      this.password = 'Admin123!';
    } else {
      this.email = 'encargado@fashionstore.com';
      this.password = 'Admin123!';
    }
  }

  onForgotPassword(): void {
    this.toastService.info(
      'Recuperación de Contraseña',
      'Para recuperar tu contraseña, por favor contacta al administrador del sistema o escribe a soporte@fashionstore.com',
      7000
    );
  }

  cerrarModal(): void {
    this.router.navigate(['/catalogo']);
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingresa tu correo electrónico y contraseña.';
      this.toastService.error('Campos Requeridos', this.errorMessage);
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.loading = false;
        this.toastService.success('¡Bienvenido!', `Has iniciado sesión correctamente como ${res.role || 'cliente'}.`);
        if (res.role === 'administrador') {
          this.router.navigate(['/admin']);
        } else if (res.role === 'encargado_sucursal' || res.role === 'cajero') {
          this.router.navigate(['/encargado']);
        } else {
          this.router.navigate(['/catalogo']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Credenciales incorrectas. Verifica tu usuario y contraseña.';
        this.toastService.error('Error de Acceso', this.errorMessage);
      }
    });
  }
}
