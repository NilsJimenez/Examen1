import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SaasService, CrearTenantDto } from '../../services/saas.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';

export interface PlanCardUI {
  id: 'Basico' | 'Estandar' | 'Profesional' | 'Especial';
  etiqueta: string;
  precioEntero: string;
  precioCentavos: string;
  precioBs: string;
  descripcion: string;
  colorPrimario: string;
  colorSecundario: string;
  colorSombraPliegue: string;
  maxSucursales: number;
  incluyeIA: boolean;
  beneficios: { texto: string; incluido: boolean }[];
}

@Component({
  selector: 'app-planes-saas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pricing-landing-wrapper">
      <!-- Formas decorativas curvas de fondo (idénticas a la referencia) -->
      <div class="bg-wave-shape shape-1"></div>
      <div class="bg-wave-shape shape-2"></div>

      <!-- Contenedor Principal Estilo Tarjeta Panorámica SaaS -->
      <div class="pricing-main-stage animate-fade-in">
        
        <!-- Barra Superior Interna -->
        <div class="stage-top-bar">
          <div class="brand-logo">
            <span class="logo-dash"></span>
            <i class="fa-solid fa-vest-patches mr-2"></i>
            <span>FashionStore <strong>SaaS</strong></span>
          </div>

          <div class="stage-nav-links">
            <a routerLink="/planes" class="stage-link active">Planes</a>
            <a routerLink="/catalogo" class="stage-link">Tienda &amp; Catálogo</a>
            <a routerLink="/sucursales" class="stage-link">Sucursales</a>
            <a *ngIf="!authService.isLoggedIn" routerLink="/login" class="stage-link-btn">
              <i class="fa-regular fa-user mr-1.5"></i> Iniciar Sesión
            </a>
            <a *ngIf="authService.isLoggedIn && authService.isAdmin" routerLink="/admin" class="stage-link-btn">
              <i class="fa-solid fa-sliders mr-1.5"></i> Ir a Mi Panel
            </a>
          </div>
        </div>

        <!-- Cabecera Central: Price List -->
        <div class="pricing-header">
          <h1 class="pricing-title">Planes de Suscripción</h1>
          <p class="pricing-subtitle">
            Digitaliza tu marca de moda o cadena de boutiques en nuestra plataforma Multi-Tenant.
            Elige el plan que mejor se adapte a tu empresa, obtén aislamiento seguro de datos, punto de venta Offline-First
            e Inteligencia Artificial para potenciar tus ventas.
          </p>
        </div>

        <!-- Grid de las 4 Tarjetas de Suscripción -->
        <div class="pricing-cards-grid">
          
          <div 
            *ngFor="let plan of planesUI" 
            class="price-card"
          >
            <!-- Cinta / Ribbon Superior Izquierda con Pliegue 3D -->
            <div 
              class="card-ribbon"
              [style.background]="'linear-gradient(135deg, ' + plan.colorPrimario + ', ' + plan.colorSecundario + ')'"
            >
              <span class="ribbon-text">{{ plan.etiqueta }}</span>
              <span class="ribbon-fold" [style.border-top-color]="plan.colorSombraPliegue"></span>
            </div>

            <!-- Bloque de Precio Grande -->
            <div class="price-value-block">
              <span class="currency-symbol">$</span>
              <span class="price-integer">{{ plan.precioEntero }}</span>
              <div class="price-Right-meta">
                <span class="price-cents">.{{ plan.precioCentavos }}</span>
                <span class="price-period">/ Por Mes</span>
              </div>
            </div>
            <div class="price-bs-tag">Equivalente a {{ plan.precioBs }} / mes</div>

            <!-- Descripción del Plan -->
            <p class="card-description">
              {{ plan.descripcion }}
            </p>

            <!-- Lista de Beneficios con Checkmarks de Color y Cruces Grises -->
            <ul class="benefits-list">
              <li *ngFor="let b of plan.beneficios" class="benefit-item" [class.disabled-benefit]="!b.incluido">
                <!-- Icono Incluido -->
                <span 
                  *ngIf="b.incluido" 
                  class="benefit-icon included"
                  [style.background]="plan.colorPrimario"
                >
                  <i class="fa-solid fa-check"></i>
                </span>
                <!-- Icono No Incluido -->
                <span 
                  *ngIf="!b.incluido" 
                  class="benefit-icon excluded"
                >
                  <i class="fa-solid fa-xmark"></i>
                </span>
                <span class="benefit-text">{{ b.texto }}</span>
              </li>
            </ul>

            <!-- Botón Inferior Redondeado: ADQUIRIR AHORA -->
            <div class="card-action-footer">
              <button 
                type="button" 
                (click)="abrirModalAdquirir(plan)" 
                class="buy-now-btn"
                [style.background]="'linear-gradient(90deg, ' + plan.colorPrimario + ', ' + plan.colorSecundario + ')'"
              >
                ADQUIRIR AHORA
              </button>
            </div>
          </div>

        </div>

        <!-- Pie de Página Rápido para SuperAdmin y Empresas Registradas -->
        <div class="stage-bottom-bar">
          <span>¿Tu empresa ya cuenta con una suscripción activa o eres el SuperAdmin de la plataforma?</span>
          <a routerLink="/login" class="bottom-login-link">
            Acceder al Panel de Control <i class="fa-solid fa-arrow-right ml-1"></i>
          </a>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- MODAL LIMPIO DE ADQUISICIÓN DE SUSCRIPCIÓN (CU01 ONBOARDING)        -->
      <!-- =================================================================== -->
      <div *ngIf="mostrarModal && planElegido" class="modal-backdrop-saas" (click)="cerrarModal($event)">
        <div class="modal-card-saas animate-fade-in" (click)="$event.stopPropagation()">
          
          <!-- Botón Cerrar -->
          <button type="button" (click)="mostrarModal = false" class="modal-close-btn">
            <i class="fa-solid fa-xmark"></i>
          </button>

          <!-- Cabecera con el color del Plan Elegido -->
          <div class="modal-plan-header" [style.background]="'linear-gradient(135deg, ' + planElegido.colorPrimario + ', ' + planElegido.colorSecundario + ')'">
            <div class="modal-plan-badge">SUSCRIPCIÓN EMPRESARIAL SAAS</div>
            <div class="flex items-baseline justify-between flex-wrap gap-2 mt-1">
              <h2 class="modal-plan-title">Plan {{ planElegido.etiqueta }}</h2>
              <div class="modal-plan-price">
                <span>\${{ planElegido.precioEntero }}.{{ planElegido.precioCentavos }}</span>
                <small>/ mes ({{ planElegido.precioBs }})</small>
              </div>
            </div>
            <p class="modal-plan-summary">
              Incluye hasta {{ planElegido.maxSucursales }} sucursales activas
              {{ planElegido.incluyeIA ? ' + Reportes IA Gemini y Machine Learning' : ' + Punto de Venta Offline-First' }}
            </p>
          </div>

          <!-- Formulario de Registro de Empresa -->
          <form (ngSubmit)="confirmarSuscripcion()" class="modal-form-body">
            
            <div class="form-row-2">
              <div class="field-box">
                <label>Razón Social de la Empresa *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.razon_social" 
                  name="razon_social" 
                  required 
                  placeholder="Ej: Boutique Aurora S.R.L." 
                />
              </div>

              <div class="field-box">
                <label>NIT Empresarial *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.nit" 
                  name="nit" 
                  required 
                  placeholder="Ej: 1023451010" 
                />
              </div>
            </div>

            <div class="form-row-2">
              <div class="field-box">
                <label>Nombre del Administrador *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.admin_nombre" 
                  name="admin_nombre" 
                  required 
                  placeholder="Ej: Jorge" 
                />
              </div>

              <div class="field-box">
                <label>Apellidos del Administrador *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.admin_apellido" 
                  name="admin_apellido" 
                  required 
                  placeholder="Ej: Quispe" 
                />
              </div>
            </div>

            <div class="field-box">
              <label>Correo Corporativo de Acceso *</label>
              <input 
                type="email" 
                [(ngModel)]="form.admin_email" 
                name="admin_email" 
                required 
                placeholder="admin@tuempresa.com" 
              />
            </div>

            <div class="form-row-2">
              <div class="field-box">
                <label>Contraseña del Administrador *</label>
                <input 
                  type="password" 
                  [(ngModel)]="form.admin_password" 
                  name="admin_password" 
                  required 
                  placeholder="Mínimo 6 caracteres" 
                />
              </div>

              <div class="field-box">
                <label>Duración de Suscripción</label>
                <select [(ngModel)]="form.meses_vigencia" name="meses_vigencia">
                  <option [ngValue]="1">1 Mes</option>
                  <option [ngValue]="6">6 Meses</option>
                  <option [ngValue]="12">12 Meses (1 Año)</option>
                  <option [ngValue]="24">24 Meses (2 Años)</option>
                </select>
              </div>
            </div>

            <!-- Botón de Confirmación -->
            <button 
              type="submit" 
              [disabled]="enviando" 
              class="modal-submit-btn"
              [style.background]="'linear-gradient(90deg, ' + planElegido.colorPrimario + ', ' + planElegido.colorSecundario + ')'"
            >
              <span *ngIf="enviando">
                <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Creando entorno empresarial...
              </span>
              <span *ngIf="!enviando">
                <i class="fa-solid fa-check-circle mr-2"></i> ACTIVAR SUSCRIPCIÓN Y ENTRAR AL PANEL
              </span>
            </button>

          </form>

        </div>
      </div>

    </div>
  `,
  styles: [`
    /* Lienzo Principal con Gradiente Moderno Azul-Violeta como la imagen */
    .pricing-landing-wrapper {
      min-height: calc(100vh - 74px);
      width: 100%;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%);
      padding: 2.5rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    /* Ondas Decorativas Suaves de Fondo */
    .bg-wave-shape {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }
    .shape-1 {
      width: 850px;
      height: 850px;
      background: linear-gradient(180deg, rgba(56, 189, 248, 0.35) 0%, rgba(99, 102, 241, 0.1) 100%);
      top: -250px;
      left: -200px;
      filter: blur(2px);
    }
    .shape-2 {
      width: 750px;
      height: 750px;
      background: linear-gradient(180deg, rgba(236, 72, 153, 0.28) 0%, rgba(139, 92, 246, 0.1) 100%);
      bottom: -250px;
      right: -150px;
    }

    /* Contenedor Panorámico Interior */
    .pricing-main-stage {
      position: relative;
      z-index: 1;
      max-width: 1280px;
      width: 100%;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.78) 0%, rgba(124, 58, 237, 0.85) 55%, rgba(56, 189, 248, 0.75) 100%);
      backdrop-filter: blur(16px);
      border-radius: 28px;
      padding: 2.5rem 2.5rem 3rem;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    @media (max-width: 640px) {
      .pricing-main-stage {
        padding: 1.5rem 1.2rem 2rem;
      }
    }

    /* Barra Superior dentro del Stage */
    .stage-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 2.5rem;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      color: #ffffff;
      font-size: 1.15rem;
      letter-spacing: 0.02em;
    }

    .logo-dash {
      display: inline-block;
      width: 18px;
      height: 4px;
      background: #ffffff;
      border-radius: 4px;
      margin-right: 8px;
    }

    .stage-nav-links {
      display: flex;
      align-items: center;
      gap: 1.75rem;
      flex-wrap: wrap;
    }

    .stage-link {
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 600;
      transition: all 0.2s;
      padding-bottom: 4px;
      border-bottom: 2px solid transparent;
    }

    .stage-link:hover, .stage-link.active {
      color: #ffffff;
      border-bottom-color: #ffffff;
    }

    .stage-link-btn {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 0.45rem 1rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      transition: all 0.2s;
    }

    .stage-link-btn:hover {
      background: #ffffff;
      color: #4f46e5;
    }

    /* Cabecera Price List */
    .pricing-header {
      text-align: center;
      max-width: 720px;
      margin: 0 auto 3.25rem;
    }

    .pricing-title {
      color: #ffffff;
      font-size: 2.6rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 0.85rem;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    }

    .pricing-subtitle {
      color: rgba(255, 255, 255, 0.88);
      font-size: 0.86rem;
      line-height: 1.65;
      margin: 0;
    }

    /* Grid de 4 Columnas */
    .pricing-cards-grid {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 1.75rem;
      align-items: stretch;
    }

    @media (min-width: 680px) {
      .pricing-cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1120px) {
      .pricing-cards-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    /* Tarjeta Blanca Vertical */
    .price-card {
      background: #ffffff;
      border-radius: 22px;
      padding: 4.5rem 1.6rem 2rem;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
    }

    .price-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 26px 55px rgba(15, 23, 42, 0.28);
    }

    /* Cinta / Ribbon en la esquina superior izquierda */
    .card-ribbon {
      position: absolute;
      top: 22px;
      left: -10px;
      padding: 0.48rem 1.65rem 0.48rem 1.35rem;
      color: #ffffff;
      font-weight: 800;
      font-size: 0.92rem;
      letter-spacing: 0.02em;
      clip-path: polygon(0 0, 100% 0, 86% 100%, 0% 100%);
      border-top-left-radius: 6px;
      box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
    }

    .ribbon-fold {
      position: absolute;
      bottom: -8px;
      left: 0;
      width: 0;
      height: 0;
      border-top: 8px solid #0e7490;
      border-left: 10px solid transparent;
    }

    /* Bloque del Precio */
    .price-value-block {
      display: flex;
      align-items: baseline;
      justify-content: center;
      color: #1e1b4b;
      margin-top: 0.5rem;
    }

    .currency-symbol {
      font-size: 1.75rem;
      font-weight: 800;
      margin-right: 2px;
      color: #1e1b4b;
    }

    .price-integer {
      font-size: 3.7rem;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.04em;
      color: #1e1b4b;
    }

    .price-Right-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-left: 3px;
    }

    .price-cents {
      font-size: 1.45rem;
      font-weight: 800;
      line-height: 1;
      color: #1e1b4b;
    }

    .price-period {
      font-size: 0.65rem;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
    }

    .price-bs-tag {
      text-align: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: #6366f1;
      margin-top: 0.25rem;
      margin-bottom: 1rem;
    }

    /* Descripción corta */
    .card-description {
      text-align: center;
      font-size: 0.75rem;
      line-height: 1.5;
      color: #64748b;
      margin: 0 0 1.35rem;
      min-height: 52px;
    }

    /* Lista de Beneficios */
    .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0 0 1.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      border-top: 1px solid #f1f5f9;
      padding-top: 1.15rem;
    }

    .benefit-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.76rem;
      font-weight: 600;
      color: #334155;
    }

    .benefit-item.disabled-benefit {
      color: #94a3b8;
      text-decoration: line-through;
      opacity: 0.75;
    }

    .benefit-icon {
      width: 20px;
      height: 20px;
      min-width: 20px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: #ffffff;
    }

    .benefit-icon.excluded {
      background: #cbd5e1;
      color: #ffffff;
    }

    .benefit-text {
      line-height: 1.3;
    }

    /* Botón BUY NOW / ADQUIRIR AHORA */
    .card-action-footer {
      text-align: center;
      margin-top: auto;
    }

    .buy-now-btn {
      width: 100%;
      max-width: 185px;
      padding: 0.72rem 1.2rem;
      border-radius: 9999px;
      border: none;
      color: #ffffff;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
      transition: all 0.25s ease;
    }

    .buy-now-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 12px 26px rgba(99, 102, 241, 0.5);
      filter: brightness(1.06);
    }

    /* Barra Inferior del Stage */
    .stage-bottom-bar {
      margin-top: 2.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.85rem;
    }

    .bottom-login-link {
      color: #ffffff;
      font-weight: 800;
      text-decoration: underline;
    }

    /* Modal de Suscripción */
    .modal-backdrop-saas {
      position: fixed;
      inset: 0;
      z-index: 999;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card-saas {
      background: #ffffff;
      color: #1e293b;
      max-width: 540px;
      width: 100%;
      border-radius: 24px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
    }

    .modal-close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #ffffff;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .modal-close-btn:hover {
      background: rgba(255, 255, 255, 0.35);
    }

    .modal-plan-header {
      padding: 1.75rem 2rem;
      color: #ffffff;
    }

    .modal-plan-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      background: rgba(255, 255, 255, 0.22);
      padding: 3px 10px;
      border-radius: 9999px;
    }

    .modal-plan-title {
      font-size: 1.65rem;
      font-weight: 900;
      margin: 0;
    }

    .modal-plan-price span {
      font-size: 1.5rem;
      font-weight: 900;
    }

    .modal-plan-price small {
      font-size: 0.75rem;
      opacity: 0.9;
      margin-left: 4px;
    }

    .modal-plan-summary {
      font-size: 0.78rem;
      opacity: 0.92;
      margin: 0.5rem 0 0;
    }

    .modal-form-body {
      padding: 1.75rem 2rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 520px) {
      .form-row-2 {
        grid-template-columns: 1fr;
      }
    }

    .field-box {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .field-box label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }

    .field-box input, .field-box select {
      padding: 0.68rem 0.9rem;
      border-radius: 10px;
      border: 1.5px solid #cbd5e1;
      font-size: 0.85rem;
      color: #0f172a;
      background: #f8fafc;
      outline: none;
      transition: border-color 0.2s;
    }

    .field-box input:focus, .field-box select:focus {
      border-color: #6366f1;
      background: #ffffff;
    }

    .modal-submit-btn {
      margin-top: 0.5rem;
      padding: 0.9rem;
      border-radius: 9999px;
      border: none;
      color: #ffffff;
      font-weight: 800;
      font-size: 0.85rem;
      letter-spacing: 0.04em;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(99, 102, 241, 0.35);
      transition: all 0.2s;
    }

    .modal-submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      filter: brightness(1.05);
    }
  `]
})
export class PlanesSaasComponent {
  private saasService = inject(SaasService);
  private toastService = inject(ToastService);
  public authService = inject(AuthService);
  private router = inject(Router);

  mostrarModal = false;
  enviando = false;
  planElegido: PlanCardUI | null = null;

  form: CrearTenantDto = {
    razon_social: '',
    nit: '',
    plan_nombre: 'Profesional',
    admin_nombre: '',
    admin_apellido: '',
    admin_email: '',
    admin_password: '',
    meses_vigencia: 12
  };

  planesUI: PlanCardUI[] = [
    {
      id: 'Basico',
      etiqueta: 'Básico',
      precioEntero: '19',
      precioCentavos: '99',
      precioBs: 'Bs 140',
      descripcion: 'Ideal para boutiques independientes que inician su digitalización con inventario y punto de venta offline.',
      colorPrimario: '#06b6d4',
      colorSecundario: '#22d3ee',
      colorSombraPliegue: '#0e7490',
      maxSucursales: 2,
      incluyeIA: false,
      beneficios: [
        { texto: 'Hasta 2 Sucursales Físicas', incluido: true },
        { texto: 'Caja POS Offline-First', incluido: true },
        { texto: 'Inventario por Talla y Color', incluido: true },
        { texto: 'Reservas QR de Vestidor', incluido: false },
        { texto: 'Reportes con IA Gemini NLP', incluido: false },
        { texto: 'Machine Learning de Demanda', incluido: false }
      ]
    },
    {
      id: 'Estandar',
      etiqueta: 'Estándar',
      precioEntero: '39',
      precioCentavos: '99',
      precioBs: 'Bs 280',
      descripcion: 'Perfecto para tiendas en crecimiento que requieren reservas de probadores VIP y catálogo interactivo.',
      colorPrimario: '#4f46e5',
      colorSecundario: '#818cf8',
      colorSombraPliegue: '#3730a3',
      maxSucursales: 4,
      incluyeIA: false,
      beneficios: [
        { texto: 'Hasta 4 Sucursales Físicas', incluido: true },
        { texto: 'Caja POS Offline-First', incluido: true },
        { texto: 'Inventario por Talla y Color', incluido: true },
        { texto: 'Reservas QR de Vestidor', incluido: true },
        { texto: 'Reportes con IA Gemini NLP', incluido: false },
        { texto: 'Machine Learning de Demanda', incluido: false }
      ]
    },
    {
      id: 'Profesional',
      etiqueta: 'Profesional',
      precioEntero: '79',
      precioCentavos: '99',
      precioBs: 'Bs 550',
      descripcion: 'Potencia total con Inteligencia Artificial Gemini y Machine Learning para cadenas de moda consolidadas.',
      colorPrimario: '#7e22ce',
      colorSecundario: '#a855f7',
      colorSombraPliegue: '#581c87',
      maxSucursales: 10,
      incluyeIA: true,
      beneficios: [
        { texto: 'Hasta 10 Sucursales Físicas', incluido: true },
        { texto: 'Caja POS Offline-First', incluido: true },
        { texto: 'Inventario por Talla y Color', incluido: true },
        { texto: 'Reservas QR de Vestidor', incluido: true },
        { texto: 'Reportes con IA Gemini NLP', incluido: true },
        { texto: 'Machine Learning de Demanda', incluido: true }
      ]
    },
    {
      id: 'Especial',
      etiqueta: 'Especial',
      precioEntero: '149',
      precioCentavos: '99',
      precioBs: 'Bs 990',
      descripcion: 'Solución corporativa para grandes franquicias con sucursales expandidas, Realidad Aumentada y soporte 24/7.',
      colorPrimario: '#db2777',
      colorSecundario: '#f472b6',
      colorSombraPliegue: '#9d174d',
      maxSucursales: 25,
      incluyeIA: true,
      beneficios: [
        { texto: 'Hasta 25 Sucursales en Red', incluido: true },
        { texto: 'POS Offline-First Prioritario', incluido: true },
        { texto: 'Vestidor Virtual AR + QR VIP', incluido: true },
        { texto: 'Cambios de Prenda (CU14)', incluido: true },
        { texto: 'Reportes IA Gemini Ilimitados', incluido: true },
        { texto: 'ML Predictivo + Soporte 24/7', incluido: true }
      ]
    }
  ];

  abrirModalAdquirir(plan: PlanCardUI): void {
    this.planElegido = plan;
    this.form = {
      razon_social: '',
      nit: '',
      plan_nombre: plan.id,
      admin_nombre: '',
      admin_apellido: '',
      admin_email: '',
      admin_password: '',
      meses_vigencia: 12
    };
    this.mostrarModal = true;
  }

  cerrarModal(event: MouseEvent): void {
    this.mostrarModal = false;
  }

  confirmarSuscripcion(): void {
    if (!this.form.razon_social.trim() || !this.form.nit.trim()) {
      this.toastService.warning('Datos incompletos', 'Ingresa la Razón Social y el NIT de la empresa.');
      return;
    }
    if (!this.form.admin_email.trim() || !this.form.admin_password.trim()) {
      this.toastService.warning('Datos incompletos', 'Ingresa el correo y la contraseña del administrador.');
      return;
    }

    this.enviando = true;
    this.saasService.onboarding(this.form).subscribe({
      next: (res) => {
        this.enviando = false;
        this.mostrarModal = false;
        this.toastService.success(
          '¡Suscripción Activada!',
          `Empresa "${res.tenant_nombre}" registrada con el Plan ${res.plan}.`
        );

        localStorage.setItem('fashionstore_token', res.access_token);
        localStorage.setItem('fashionstore_user', JSON.stringify({
          access_token: res.access_token,
          role: res.role,
          user_type: res.user_type,
          user_id: res.user_id,
          nombre_completo: res.nombre_completo,
          email: res.email,
          tenant_id: res.tenant_id,
          tenant_nombre: res.tenant_nombre,
          plan: res.plan,
          permite_reportes_ia: res.permite_reportes_ia,
          max_sucursales: res.max_sucursales
        }));

        window.location.href = '/admin';
      },
      error: (err) => {
        this.enviando = false;
        this.toastService.error(
          'No se pudo completar la suscripción',
          err.error?.detail || 'Verifica que el NIT y correo no estén registrados previamente.'
        );
      }
    });
  }
}
