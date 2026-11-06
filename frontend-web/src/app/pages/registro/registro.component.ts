import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface PlanResumen {
  id: 'Basico' | 'Estandar' | 'Profesional';
  nombre: string;
  precioUsd: number;
  precioBs: number;
  sucursales: number;
  ia: boolean;
  color: string;
}

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
            <h2 class="auth-title">
              {{ esSuscripcionSaas ? 'CREA TU CUENTA EMPRESARIAL' : 'CREA TU CUENTA' }}
            </h2>
            <div class="auth-title-line"></div>
          </div>

          <!-- BANNER DEL PLAN SELECCIONADO (CUANDO VIENE DESDE /PLANES) -->
          <div *ngIf="esSuscripcionSaas && planInfoActual" class="saas-plan-banner">
            <div class="flex items-center justify-between mb-2">
              <span class="saas-plan-badge" [style.color]="planInfoActual.color" [style.border-color]="planInfoActual.color">
                <i class="fa-solid fa-crown mr-1"></i> PLAN {{ planInfoActual.nombre.toUpperCase() }} SELECCIONADO
              </span>
              <span class="font-serif font-extrabold text-sm" style="color: var(--accent);">
                &#36;{{ planInfoActual.precioUsd }} / mes (Bs. {{ planInfoActual.precioBs | number:'1.2-2' }})
              </span>
            </div>
            <p class="text-xs mb-2.5" style="color: var(--text-muted);">
              Incluye hasta <strong>{{ planInfoActual.sucursales }} sucursales físicas</strong>, POS Offline-First y {{ planInfoActual.ia ? 'Reportes IA + Machine Learning' : 'Control de Inventario Matriz' }}.
            </p>
            <!-- Selector rápido para cambiar entre los 3 planes -->
            <div class="plan-mini-Booking-grid">
              <button 
                *ngFor="let p of planesDisponibles"
                type="button"
                (click)="seleccionarPlan(p.id)"
                class="plan-mini-btn"
                [class.active]="planSeleccionado === p.id"
                [style.border-color]="planSeleccionado === p.id ? p.color : 'var(--border-color)'"
              >
                <span class="block font-bold" style="font-size: 0.7rem; color: var(--text-main);">{{ p.nombre }}</span>
                <span class="block font-semibold" style="font-size: 0.65rem;" [style.color]="p.color">&#36;{{ p.precioUsd }}/m</span>
              </button>
            </div>
          </div>

          <!-- Mensaje de Error -->
          <div *ngIf="errorMessage" class="auth-alert-error">
            <i class="fa-solid fa-circle-exclamation mr-2"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <form (ngSubmit)="onSubmit()" class="auth-form">
            
            <!-- Campos de Empresa (Solo cuando está adquiriendo un Plan SaaS) -->
            <div *ngIf="esSuscripcionSaas" class="auth-row-2col">
              <div class="auth-field-group">
                <label class="auth-label">
                  RAZÓN SOCIAL / EMPRESA <span class="required-star">*</span>
                </label>
                <input 
                  type="text" 
                  name="razonSocial"
                  [(ngModel)]="razonSocial" 
                  required
                  placeholder="Ej: Boutique Elegance S.R.L."
                  class="auth-input" 
                />
              </div>

              <div class="auth-field-group">
                <label class="auth-label">
                  NIT CORPORATIVO <span class="required-star">*</span>
                </label>
                <input 
                  type="text" 
                  name="nit"
                  [(ngModel)]="nit" 
                  required
                  placeholder="Ej: 3049581015"
                  class="auth-input" 
                />
              </div>
            </div>

            <!-- Fila: Nombres y Apellidos (2 columnas) -->
            <div class="auth-row-2col">
              <div class="auth-field-group">
                <label class="auth-label">
                  {{ esSuscripcionSaas ? 'NOMBRES DEL ADMINISTRADOR' : 'NOMBRES' }} <span class="required-star">*</span>
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
                  {{ esSuscripcionSaas ? 'APELLIDOS DEL ADMINISTRADOR' : 'APELLIDOS' }} <span class="required-star">*</span>
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
                [placeholder]="esSuscripcionSaas ? 'admin@tuempresa.com' : 'tu.correo@ejemplo.com'"
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

            <!-- Fila Opcional: Teléfono y Ciudad/Dirección (Solo en modo Cliente) -->
            <div *ngIf="!esSuscripcionSaas" class="auth-row-2col">
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
              <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> PROCESANDO...</span>
              <span *ngIf="!loading && esSuscripcionSaas">
                <i class="fa-solid fa-shield-halved mr-2"></i> CONTINUAR A LA PASARELA DE PAGO (Bs. {{ planInfoActual?.precioBs | number:'1.2-2' }})
              </span>
              <span *ngIf="!loading && !esSuscripcionSaas">CREAR CUENTA DE CLIENTE</span>
            </button>

          </form>

          <!-- Enlace a Iniciar Sesión (Conserva el plan si viene desde /planes) -->
          <div class="auth-footer-switch">
            <span>¿Ya tienes una cuenta registrada?</span>
            <a [routerLink]="['/login']" [queryParams]="esSuscripcionSaas ? { plan: planSeleccionado } : {}" class="switch-link">
              Inicia sesión aquí
            </a>
          </div>

        </div>

        <!-- ================================================================= -->
        <!-- COLUMNA DERECHA: FASHION EDITORIAL BANNER (MODA DE ALTA COSTURA)  -->
        <!-- ================================================================= -->
        <div class="auth-image-column">
          
          <!-- Botón de Cerrar (X) -->
          <button (click)="cerrarModal()" class="close-modal-btn" title="Cerrar y volver">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <!-- Capa de Gradiente Oscuro para Legibilidad -->
          <div class="auth-image-overlay"></div>

          <!-- Contenido Tipográfico de Alta Costura sobre la Imagen -->
          <div class="auth-image-content">
            <span class="editorial-tag">
              <i class="fa-solid fa-crown mr-1.5"></i> {{ esSuscripcionSaas ? 'PLATAFORMA CLOUD SAAS' : 'CLUB DE CLIENTES VIP' }}
            </span>
            <h3 class="editorial-brand">{{ esSuscripcionSaas ? 'EXPANDE TU MARCA' : 'EXPERIENCIA EXCLUSIVA' }}</h3>
            <p class="editorial-headline">
              {{ esSuscripcionSaas ? 'PASARELA DE PAGO SEGURA CON QR Y TARJETA' : 'RESERVA TUS PRENDAS FAVORITAS' }}
            </p>
            <div class="editorial-separator"></div>
            <p class="editorial-subtext">
              {{ esSuscripcionSaas 
                ? 'Crea tu cuenta administradora, paga tu suscripción mediante QR Simple o Tarjeta de Crédito/Débito y activa tus sucursales al instante.' 
                : 'Pruébate ropa en Realidad Aumentada desde tu hogar o agenda tu visita en probadores físicos para tener tu vestidor preparado al llegar.' }}
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
      padding: 2.5rem 1.5rem;
      background: var(--bg-main);
    }

    .auth-split-card {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      max-width: 1060px;
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
        max-width: 540px;
      }
      .auth-image-column {
        display: none;
      }
    }

    .auth-form-column {
      padding: 2.5rem 2.5rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: var(--card-bg);
    }

    .auth-header {
      margin-bottom: 1.35rem;
    }

    .auth-title {
      font-family: var(--font-sans);
      font-size: 1.2rem;
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
      margin-top: 0.5rem;
    }

    /* Banner del Plan SaaS */
    .saas-plan-banner {
      background: var(--table-th-bg);
      border: 1.5px solid var(--accent);
      border-radius: 14px;
      padding: 0.9rem 1.1rem;
      margin-bottom: 1.25rem;
    }

    .saas-plan-badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      padding: 0.18rem 0.6rem;
      border-radius: 999px;
      border: 1px solid;
      background: rgba(245, 158, 11, 0.1);
    }

    .plan-mini-Booking-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    .plan-mini-btn {
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      padding: 0.35rem 0.5rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .plan-mini-btn.active {
      background: rgba(245, 158, 11, 0.12);
    }

    .auth-alert-error {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 0.85rem 1.15rem;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 1.2rem;
      display: flex;
      align-items: center;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }

    .auth-row-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 520px) {
      .auth-row-2col {
        grid-template-columns: 1fr;
      }
    }

    .auth-field-group {
      display: flex;
      flex-direction: column;
    }

    .auth-label {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }

    .required-star {
      color: #ef4444;
      font-weight: bold;
    }

    .auth-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      background: var(--input-bg);
      color: var(--text-main);
      font-size: 0.88rem;
      transition: all 0.2s ease;
      outline: none;
      box-sizing: border-box;
    }

    .auth-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
    }

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
    }

    .auth-submit-btn {
      width: 100%;
      padding: 0.95rem;
      background: var(--accent);
      color: #18181b;
      font-family: var(--font-sans);
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 0.5rem;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.25);
    }

    .auth-submit-btn:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    .auth-footer-switch {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.84rem;
      color: var(--text-muted);
    }

    .switch-link {
      font-weight: 800;
      color: var(--accent);
      text-decoration: none;
      margin-left: 0.35rem;
    }

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
export class RegistroComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);

  esSuscripcionSaas: boolean = false;
  planSeleccionado: 'Basico' | 'Estandar' | 'Profesional' = 'Profesional';
  razonSocial: string = '';
  nit: string = '';

  nombres: string = '';
  apellidos: string = '';
  email: string = '';
  password: string = '';
  mostrarPassword: boolean = false;
  telefono: string = '';
  direccion: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  planesDisponibles: PlanResumen[] = [
    { id: 'Basico', nombre: 'Básico', precioUsd: 19.99, precioBs: 139.00, sucursales: 2, ia: false, color: '#a1a1aa' },
    { id: 'Estandar', nombre: 'Estándar', precioUsd: 39.99, precioBs: 278.00, sucursales: 4, ia: false, color: '#d97706' },
    { id: 'Profesional', nombre: 'Profesional', precioUsd: 79.99, precioBs: 556.00, sucursales: 10, ia: true, color: '#f59e0b' }
  ];

  get planInfoActual(): PlanResumen | undefined {
    return this.planesDisponibles.find(p => p.id === this.planSeleccionado);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const planParam = params['plan'];
      if (planParam === 'Basico' || planParam === 'Estandar' || planParam === 'Profesional') {
        this.esSuscripcionSaas = true;
        this.planSeleccionado = planParam;
      }
    });
  }

  seleccionarPlan(id: 'Basico' | 'Estandar' | 'Profesional'): void {
    this.planSeleccionado = id;
  }

  toggleMostrarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  cerrarModal(): void {
    this.router.navigate([this.esSuscripcionSaas ? '/planes' : '/catalogo']);
  }

  onSubmit(): void {
    if (!this.nombres || !this.apellidos || !this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios marcados con asterisco (*).';
      this.toastService.error('Campos Incompletos', this.errorMessage);
      return;
    }

    // MODO 1: SUSCRIPCIÓN EMPRESARIAL SAAS -> IR A LA PASARELA DE PAGO (/pago/saas)
    if (this.esSuscripcionSaas) {
      if (!this.razonSocial.trim() || !this.nit.trim()) {
        this.errorMessage = 'Por favor ingresa la Razón Social y el NIT de tu empresa.';
        this.toastService.warning('Datos de Empresa Requeridos', this.errorMessage);
        return;
      }

      const plan = this.planInfoActual!;
      const pendingSaas = {
        tipo_checkout: 'SAAS_ONBOARDING',
        razon_social: this.razonSocial.trim(),
        nit: this.nit.trim(),
        plan_nombre: this.planSeleccionado,
        plan_etiqueta: plan.nombre,
        precio_usd: plan.precioUsd,
        total_bs: plan.precioBs,
        max_sucursales: plan.sucursales,
        permite_ia: plan.ia,
        admin_nombre: this.nombres.trim(),
        admin_apellido: this.apellidos.trim(),
        admin_email: this.email.trim(),
        admin_password: this.password
      };

      sessionStorage.setItem('saas_pending_onboarding', JSON.stringify(pendingSaas));
      this.toastService.success('Cuenta Preparada', `Redirigiendo a la Pasarela de Pago para activar el Plan ${plan.nombre}.`);
      this.router.navigate(['/pago/saas']);
      return;
    }

    // MODO 2: REGISTRO NORMAL DE CLIENTE COMPRADOR
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
        this.toastService.success('¡Registro Exitoso!', `Bienvenido a FashionStore, ${this.nombres}. Tu cuenta ha sido creada.`);
        this.router.navigate(['/catalogo']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Error al crear la cuenta. Intenta con otro correo.';
        this.toastService.error('Error de Registro', this.errorMessage);
      }
    });
  }
}
