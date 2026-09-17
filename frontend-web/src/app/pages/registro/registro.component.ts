import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page-wrapper">
      
      <!-- Card Principal Split (2 Columnas Moda de Lujo) -->
      <div class="auth-split-card animate-fade-in">
        
        <!-- ================================================================= -->
        <!-- COLUMNA IZQUIERDA: FORMULARIO DE REGISTRO                         -->
        <!-- ================================================================= -->
        <div class="auth-form-column">
          
          <!-- Encabezado con línea de acento dorado -->
          <div class="auth-header">
            <h2 class="auth-title">CREA TU CUENTA</h2>
            <div class="auth-title-line"></div>
          </div>

          <!-- Mensaje de Error -->
          <div *ngIf="errorMessage" class="auth-alert-error">
            <i class="fa-solid fa-circle-exclamation mr-2"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <form (ngSubmit)="onSubmit()" class="auth-form">
            
            <!-- Fila: Nombres y Apellidos (2 columnas) -->
            <div class="auth-row-2col">
              <div class="auth-field-group">
                <label class="auth-label">
                  NOMBRES <span class="required-star">*</span>
                </label>
                <input 
                  type="text" 
                  name="nombres"
                  [(ngModel)]="nombres" 
                  required
                  placeholder="Ej: Laura"
                  class="auth-input" 
                />
              </div>

              <div class="auth-field-group">
                <label class="auth-label">
                  APELLIDOS <span class="required-star">*</span>
                </label>
                <input 
                  type="text" 
                  name="apellidos"
                  [(ngModel)]="apellidos" 
                  required
                  placeholder="Ej: Torres"
                  class="auth-input" 
                />
              </div>
            </div>

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
                placeholder="tu.correo@ejemplo.com"
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
                  placeholder="Mínimo 6 caracteres"
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

            <!-- Fila Opcional: Teléfono y Ciudad/Dirección -->
            <div class="auth-row-2col">
              <div class="auth-field-group">
                <label class="auth-label">
                  TELÉFONO / CELULAR
                </label>
                <input 
                  type="tel" 
                  name="telefono"
                  [(ngModel)]="telefono" 
                  placeholder="Ej: 77665544"
                  class="auth-input" 
                />
              </div>

              <div class="auth-field-group">
                <label class="auth-label">
                  CIUDAD / DIRECCIÓN
                </label>
                <input 
                  type="text" 
                  name="direccion"
                  [(ngModel)]="direccion" 
                  placeholder="Ej: Av. San Martín #450"
                  class="auth-input" 
                />
              </div>
            </div>

            <!-- Botón Principal Submit -->
            <button 
              type="submit" 
              [disabled]="loading" 
              class="auth-submit-btn"
            >
              <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> REGISTRANDO...</span>
              <span *ngIf="!loading">CREAR CUENTA DE CLIENTE</span>
            </button>

          </form>

          <!-- Enlace a Iniciar Sesión -->
          <div class="auth-footer-switch">
            <span>¿Ya tienes una cuenta registrada?</span>
            <a routerLink="/login" class="switch-link">
              Inicia sesión aquí
            </a>
          </div>

        </div>

        <!-- ================================================================= -->
        <!-- COLUMNA DERECHA: FASHION EDITORIAL BANNER (MODA DE ALTA COSTURA)  -->
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
              <i class="fa-solid fa-crown mr-1.5"></i> CLUB DE CLIENTES VIP
            </span>
            <h3 class="editorial-brand">EXPERIENCIA EXCLUSIVA</h3>
            <p class="editorial-headline">
              RESERVA TUS PRENDAS FAVORITAS
            </p>
            <div class="editorial-separator"></div>
            <p class="editorial-subtext">
              Pruébate ropa en Realidad Aumentada desde tu hogar o agenda tu visita en probadores físicos para tener tu vestidor preparado al llegar
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
      grid-template-columns: 1.25fr 1fr;
      max-width: 1020px;
      width: 100%;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      position: relative;
    }

    @media (max-width: 860px) {
      .auth-split-card {
        grid-template-columns: 1fr;
        max-width: 520px;
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
      margin-bottom: 2rem;
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
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
    }

    .auth-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    @media (max-width: 520px) {
      .auth-row-2col {
        grid-template-columns: 1fr;
        gap: 1.35rem;
      }
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
      padding: 0.85rem 1.1rem;
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

    .auth-footer-switch {
      margin-top: 2rem;
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
      background-image: url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80');
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
export class RegistroComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  nombres: string = '';
  apellidos: string = '';
  email: string = '';
  password: string = '';
  mostrarPassword: boolean = false;
  telefono: string = '';
  direccion: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  cerrarModal(): void {
    this.router.navigate(['/catalogo']);
  }

  onSubmit(): void {
    if (!this.nombres || !this.apellidos || !this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios marcados con asterisco (*).';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.registerCliente({
      nombres: this.nombres,
      apellidos: this.apellidos,
      email: this.email,
      password: this.password,
      telefono: this.telefono || undefined,
      direccion: this.direccion || undefined
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/catalogo']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Error al crear la cuenta. Intenta con otro correo.';
      }
    });
  }
}
