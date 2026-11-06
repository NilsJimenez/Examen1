import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SaasService, CrearTenantDto } from '../../services/saas.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface PlanFeature {
  texto: string;
  incluido: boolean;
}

interface PlanCardConfig {
  id_plan: 'Basico' | 'Estandar' | 'Profesional';
  etiqueta_ribbon: string;
  precio_entero: string;
  precio_centavos: string;
  periodo: string;
  descripcion: string;
  ribbon_bg: string;
  ribbon_fold: string;
  ribbon_text: string;
  check_color: string;
  check_bg: string;
  btn_bg: string;
  btn_text: string;
  card_border: string;
  destacado?: boolean;
  beneficios: PlanFeature[];
}

@Component({
  selector: 'app-planes-saas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pricing-showcase-wrapper">
      
      <!-- Contenedor Principal con Ondas y Paleta FashionStore (Obsidiana, Carbón y Oro) -->
      <div class="pricing-board">
        
        <!-- Ondas Decorativas en Tonos Oro / Ámbar de Nuestra Paleta -->
        <div class="wave-shape wave-top-right"></div>
        <div class="wave-shape wave-bottom-left"></div>
        <div class="wave-shape wave-center-glow"></div>

        <!-- Barra Superior Interna -->
        <header class="board-topbar">
          <div class="brand-logo">
            <span class="logo-icon"><i class="fa-solid fa-vest-patches"></i></span>
            <div>
              <span class="logo-text font-serif">FashionStore</span>
              <span class="logo-sub">CLOUD SAAS MULTI-TENANT</span>
            </div>
          </div>

          <nav class="board-nav">
            <a routerLink="/planes" class="board-nav-link active">Planes</a>
            <a routerLink="/catalogo" class="board-nav-link">Catálogo</a>
            <a routerLink="/sucursales" class="board-nav-link">Sucursales</a>
            <a routerLink="/login" class="board-nav-link">Iniciar Sesión</a>
            <a routerLink="/login" class="board-user-icon" title="Acceso Empresas / SuperAdmin">
              <i class="fa-solid fa-user"></i>
            </a>
          </nav>
        </header>

        <!-- Encabezado Central "Price List" con Tipografía Editorial -->
        <div class="board-header">
          <span class="board-eyebrow">
            <i class="fa-solid fa-crown mr-1.5"></i> SUSCRIPCIONES EMPRESARIALES
          </span>
          <h1 class="board-title font-serif">Planes de Suscripción</h1>
          <p class="board-subtitle">
            Elige el plan ideal para tu tienda o cadena de ropa. Digitaliza tu inventario por talla y color,
            opera con punto de venta Offline-First, vestidores virtuales AR e Inteligencia Artificial.
          </p>
        </div>

        <!-- Grilla de 3 Tarjetas Verticales (Básico, Estándar, Profesional) -->
        <div class="pricing-cards-grid">
          
          <div 
            *ngFor="let plan of planesCards" 
            class="price-card"
            [class.price-card-featured]="plan.destacado"
            [style.border-color]="plan.card_border"
          >
            <!-- Listón 3D Superior Izquierdo (Ribbon Tab) -->
            <div 
              class="card-ribbon" 
              [style.background]="plan.ribbon_bg"
              [style.color]="plan.ribbon_text"
            >
              <span>{{ plan.etiqueta_ribbon }}</span>
              <div class="ribbon-fold" [style.border-top-color]="plan.ribbon_fold"></div>
            </div>

            <!-- Distintivo sutil en el Plan Profesional -->
            <div *ngIf="plan.destacado" class="popular-chip">
              <i class="fa-solid fa-star mr-1"></i> RECOMENDADO
            </div>

            <!-- Bloque de Precio Grande ($19.99 /Por Mes) -->
            <div class="card-price-block">
              <span class="price-symbol">$</span>
              <span class="price-main">{{ plan.precio_entero }}</span>
              <div class="price-right-stack">
                <span class="price-cents">.{{ plan.precio_centavos }}</span>
                <span class="price-period">{{ plan.periodo }}</span>
              </div>
            </div>

            <!-- Descripción Corta del Plan -->
            <p class="card-description">
              {{ plan.descripcion }}
            </p>

            <!-- Lista de Beneficios con Checkmarks (✓) y Cruces (✕) -->
            <ul class="card-features-list">
              <li *ngFor="let feat of plan.beneficios" class="feature-row" [class.feature-disabled]="!feat.incluido">
                <span 
                  *ngIf="feat.incluido" 
                  class="feature-icon-circle" 
                  [style.background]="plan.check_bg"
                  [style.color]="plan.check_color"
                  [style.border-color]="plan.check_color"
                >
                  <i class="fa-solid fa-check"></i>
                </span>
                <span 
                  *ngIf="!feat.incluido" 
                  class="feature-icon-circle feature-icon-cross"
                >
                  <i class="fa-solid fa-xmark"></i>
                </span>
                <span class="feature-label">{{ feat.texto }}</span>
              </li>
            </ul>

            <!-- Botón Inferior Píldora "ADQUIRIR AHORA" -->
            <div class="card-action-footer">
              <button 
                type="button"
                (click)="abrirModalSuscripcion(plan)"
                class="buy-now-pill-btn"
                [style.background]="plan.btn_bg"
                [style.color]="plan.btn_text"
              >
                ADQUIRIR AHORA
              </button>
            </div>
          </div>

        </div>

        <!-- Pie informativo -->
        <div class="board-footer-note">
          <span>
            <i class="fa-solid fa-shield-halved mr-1" style="color: var(--accent);"></i> 
            Aislamiento Multi-Tenant garantizado · Activación inmediata con sucursal principal incluida
          </span>
          <a routerLink="/catalogo" class="explore-catalog-link">
            Ir al Catálogo de Prendas <i class="fa-solid fa-arrow-right ml-1"></i>
          </a>
        </div>

      </div>

      <!-- ========================================================================= -->
      <!-- MODAL DE ADQUISICIÓN Y ALTA AUTOMÁTICA DE EMPRESA (ONBOARDING SAAS)       -->
      <!-- ========================================================================= -->
      <div *ngIf="mostrarModal" class="modal-backdrop" (click)="cerrarModal()">
        <div class="onboarding-modal" (click)="$event.stopPropagation()">
          
          <!-- Cabecera con el color del Plan elegido -->
          <div class="modal-top-banner" [style.border-bottom]="'2px solid ' + (planSeleccionado?.check_color || '#f59e0b')">
            <div>
              <span 
                class="modal-plan-pill"
                [style.background]="planSeleccionado?.ribbon_bg"
                [style.color]="planSeleccionado?.ribbon_text"
              >
                PLAN {{ planSeleccionado?.etiqueta_ribbon?.toUpperCase() }} — &#36;{{ planSeleccionado?.precio_entero }}.{{ planSeleccionado?.precio_centavos }} / Mes
              </span>
              <h3 class="modal-title font-serif">Suscribir mi Empresa</h3>
              <p class="modal-subtitle">
                Registra los datos de tu empresa para activar tu suscripción y acceder directamente a tu panel de administración.
              </p>
            </div>
            <button type="button" (click)="cerrarModal()" class="modal-close-btn">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form (ngSubmit)="confirmarSuscripcion()" class="modal-form-body">
            
            <!-- Selector rápido entre los 3 planes -->
            <div class="plan-switcher-bar">
              <button 
                *ngFor="let p of planesCards"
                type="button"
                (click)="cambiarPlanEnModal(p)"
                class="plan-switch-chip"
                [class.active]="form.plan_nombre === p.id_plan"
                [style.border-color]="form.plan_nombre === p.id_plan ? p.check_color : 'var(--border-color)'"
              >
                <span class="chip-name">{{ p.etiqueta_ribbon }}</span>
                <span class="chip-price" [style.color]="form.plan_nombre === p.id_plan ? p.check_color : 'var(--text-muted)'">
                  &#36;{{ p.precio_entero }}.{{ p.precio_centavos }}
                </span>
              </button>
            </div>

            <!-- Datos de la Empresa -->
            <div class="form-section-label">
              <i class="fa-solid fa-building mr-1" style="color: var(--accent);"></i> 1. Datos de la Empresa
            </div>

            <div class="form-row-2">
              <div class="form-field">
                <label>Razón Social / Nombre de Tienda *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.razon_social" 
                  name="razon_social" 
                  required 
                  placeholder="Ej: Boutique Elegance S.R.L." 
                />
              </div>
              <div class="form-field">
                <label>NIT Corporativo *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.nit" 
                  name="nit" 
                  required 
                  placeholder="Ej: 3049581015" 
                />
              </div>
            </div>

            <!-- Datos del Administrador -->
            <div class="form-section-label mt-2">
              <i class="fa-solid fa-user-shield mr-1" style="color: var(--accent);"></i> 2. Cuenta del Administrador de la Empresa
            </div>

            <div class="form-row-2">
              <div class="form-field">
                <label>Nombres *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.admin_nombre" 
                  name="admin_nombre" 
                  required 
                  placeholder="Ej: Gabriel" 
                />
              </div>
              <div class="form-field">
                <label>Apellidos *</label>
                <input 
                  type="text" 
                  [(ngModel)]="form.admin_apellido" 
                  name="admin_apellido" 
                  required 
                  placeholder="Ej: Quispe" 
                />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-field">
                <label>Correo Electrónico de Acceso *</label>
                <input 
                  type="email" 
                  [(ngModel)]="form.admin_email" 
                  name="admin_email" 
                  required 
                  placeholder="admin@miempresa.com" 
                />
              </div>
              <div class="form-field">
                <label>Contraseña *</label>
                <input 
                  type="password" 
                  [(ngModel)]="form.admin_password" 
                  name="admin_password" 
                  required 
                  placeholder="Mínimo 6 caracteres" 
                />
              </div>
            </div>

            <!-- Botón de Confirmación -->
            <div class="modal-footer-actions">
              <button type="button" (click)="cerrarModal()" class="btn-cancel">
                Cancelar
              </button>
              <button 
                type="submit" 
                [disabled]="enviando" 
                class="btn-confirm-buy"
                [style.background]="planSeleccionado?.btn_bg"
                [style.color]="planSeleccionado?.btn_text"
              >
                <i class="fa-solid" [class.fa-spinner]="enviando" [class.fa-spin]="enviando" [class.fa-check-circle]="!enviando"></i>
                <span>{{ enviando ? 'Activando Empresa...' : 'Activar Suscripción e Ingresar' }}</span>
              </button>
            </div>

          </form>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ==========================================================================
       PRICE LIST SAAS - PALETA DE LUJO FASHIONSTORE (ZINC OBSIDIANA & ORO/ÁMBAR)
       ========================================================================== */
    .pricing-showcase-wrapper {
      min-height: calc(100vh - 74px);
      width: 100%;
      background-color: var(--bg-main);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.25rem;
    }

    .pricing-board {
      position: relative;
      width: 100%;
      max-width: 1220px;
      background: linear-gradient(145deg, #09090b 0%, #141418 55%, #1c1917 100%);
      border: 1px solid #27272a;
      border-radius: 24px;
      padding: 2.5rem 2.75rem 2.75rem;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.55);
      overflow: hidden;
      z-index: 1;
    }

    /* Ondas suaves en tonos Oro / Ámbar / Bronce de FashionStore */
    .wave-shape {
      position: absolute;
      pointer-events: none;
      z-index: 0;
    }

    .wave-top-right {
      top: -140px;
      right: -100px;
      width: 580px;
      height: 580px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.05) 55%, transparent 75%);
    }

    .wave-bottom-left {
      bottom: -200px;
      left: -120px;
      width: 560px;
      height: 560px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, rgba(24, 24, 27, 0.05) 65%, transparent 80%);
    }

    .wave-center-glow {
      top: 15%;
      left: 48%;
      width: 650px;
      height: 650px;
      border-radius: 45%;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(217, 119, 6, 0.02) 100%);
      transform: rotate(-18deg);
    }

    /* Barra Superior Interna */
    .board-topbar {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      flex-wrap: wrap;
      gap: 1rem;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #f4f4f5;
    }

    .logo-icon {
      font-size: 1.5rem;
      color: #f59e0b;
    }

    .logo-text {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #ffffff;
      display: block;
      line-height: 1.1;
    }

    .logo-sub {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      color: #f59e0b;
      display: block;
    }

    .board-nav {
      display: flex;
      align-items: center;
      gap: 1.75rem;
    }

    .board-nav-link {
      color: #a1a1aa;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      padding-bottom: 4px;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }

    .board-nav-link:hover,
    .board-nav-link.active {
      color: #f59e0b;
      border-bottom-color: #f59e0b;
    }

    .board-user-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      text-decoration: none;
      transition: transform 0.2s ease, background 0.2s ease;
    }

    .board-user-icon:hover {
      transform: scale(1.08);
      background: #f59e0b;
      color: #18181b;
    }

    /* Encabezado "Planes de Suscripción" */
    .board-header {
      position: relative;
      z-index: 2;
      text-align: center;
      max-width: 680px;
      margin: 0 auto 2.75rem;
    }

    .board-eyebrow {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 0.3rem 0.9rem;
      border-radius: 999px;
      margin-bottom: 0.75rem;
    }

    .board-title {
      color: #ffffff;
      font-size: 2.6rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 0.65rem;
    }

    .board-subtitle {
      color: #a1a1aa;
      font-size: 0.86rem;
      line-height: 1.6;
    }

    /* Grilla de 3 Tarjetas Verticales */
    .pricing-cards-grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      max-width: 1040px;
      margin: 0 auto;
      align-items: stretch;
    }

    @media (max-width: 990px) {
      .pricing-cards-grid {
        grid-template-columns: 1fr;
        max-width: 420px;
      }
    }

    /* Tarjeta Vertical con la Paleta de FashionStore */
    .price-card {
      position: relative;
      background: #18181b;
      border: 1.5px solid #27272a;
      border-radius: 20px;
      padding: 4.4rem 1.85rem 2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.45);
      transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease, border-color 0.28s ease;
    }

    .price-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 26px 55px rgba(0, 0, 0, 0.65);
    }

    .price-card-featured {
      background: linear-gradient(165deg, #1f1f23 0%, #18181b 60%, rgba(245, 158, 11, 0.07) 100%);
      box-shadow: 0 22px 50px rgba(245, 158, 11, 0.14);
    }

    .popular-chip {
      position: absolute;
      top: 1.35rem;
      right: 1.35rem;
      background: rgba(245, 158, 11, 0.16);
      border: 1px solid rgba(245, 158, 11, 0.45);
      color: #fbbf24;
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 0.22rem 0.65rem;
      border-radius: 999px;
    }

    /* Listón 3D Superior Izquierdo (Ribbon Tab) */
    .card-ribbon {
      position: absolute;
      top: 1.25rem;
      left: -8px;
      padding: 0.42rem 1.65rem 0.42rem 1.25rem;
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      clip-path: polygon(0 0, 90% 0, 100% 100%, 0 100%);
      border-top-left-radius: 4px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }

    .ribbon-fold {
      position: absolute;
      bottom: -8px;
      left: 0;
      width: 0;
      height: 0;
      border-top: 8px solid #09090b;
      border-left: 8px solid transparent;
    }

    /* Bloque de Precio Grande */
    .card-price-block {
      display: flex;
      align-items: baseline;
      justify-content: center;
      color: #f4f4f5;
      margin: 0.35rem 0 0.9rem;
    }

    .price-symbol {
      font-size: 1.75rem;
      font-weight: 800;
      margin-right: 2px;
      align-self: flex-start;
      margin-top: 0.55rem;
      color: #f59e0b;
    }

    .price-main {
      font-size: 3.6rem;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.03em;
      color: #ffffff;
    }

    .price-right-stack {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-left: 3px;
    }

    .price-cents {
      font-size: 1.45rem;
      font-weight: 800;
      line-height: 1;
      color: #f4f4f5;
    }

    .price-period {
      font-size: 0.65rem;
      font-weight: 600;
      color: #a1a1aa;
      margin-top: 3px;
      white-space: nowrap;
    }

    /* Descripción Corta */
    .card-description {
      text-align: center;
      font-size: 0.78rem;
      line-height: 1.5;
      color: #a1a1aa;
      margin-bottom: 1.35rem;
      padding-bottom: 1.15rem;
      border-bottom: 1px solid #27272a;
      min-height: 58px;
    }

    /* Lista de Beneficios */
    .card-features-list {
      list-style: none;
      padding: 0;
      margin: 0 0 1.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.78rem;
      flex-grow: 1;
    }

    .feature-row {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #e4e4e7;
      line-height: 1.35;
    }

    .feature-row.feature-disabled {
      color: #52525b;
      text-decoration: line-through;
    }

    .feature-icon-circle {
      width: 21px;
      height: 21px;
      border-radius: 50%;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      flex-shrink: 0;
    }

    .feature-icon-cross {
      background: #27272a;
      color: #71717a;
      border-color: #3f3f46;
    }

    .feature-label {
      flex: 1;
    }

    /* Botón Píldora "ADQUIRIR AHORA" */
    .card-action-footer {
      text-align: center;
      margin-top: auto;
    }

    .buy-now-pill-btn {
      width: 100%;
      max-width: 200px;
      padding: 0.72rem 1.4rem;
      border-radius: 999px;
      border: none;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
      transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
    }

    .buy-now-pill-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
      box-shadow: 0 12px 24px rgba(245, 158, 11, 0.25);
    }

    /* Pie del Tablero */
    .board-footer-note {
      position: relative;
      z-index: 2;
      margin-top: 2.25rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      color: #a1a1aa;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .explore-catalog-link {
      color: #f59e0b;
      font-weight: 700;
      text-decoration: none;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      transition: background 0.2s ease, color 0.2s ease;
    }

    .explore-catalog-link:hover {
      background: #f59e0b;
      color: #18181b;
    }

    /* ==========================================================================
       MODAL DE SUSCRIPCIÓN Y ONBOARDING (PALETA FASHIONSTORE)
       ========================================================================== */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(9, 9, 11, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .onboarding-modal {
      width: 100%;
      max-width: 600px;
      background: var(--card-bg);
      color: var(--text-main);
      border: 1.5px solid var(--border-color);
      border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
    }

    .modal-top-banner {
      padding: 1.25rem 1.5rem;
      background: var(--table-th-bg);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .modal-plan-pill {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      margin-bottom: 0.4rem;
    }

    .modal-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }

    .modal-subtitle {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .modal-close-btn {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
    }

    .modal-form-body {
      padding: 1.25rem 1.5rem 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .plan-switcher-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
      margin-bottom: 0.25rem;
    }

    .plan-switch-chip {
      background: var(--table-th-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 10px;
      padding: 0.5rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .plan-switch-chip.active {
      background: rgba(245, 158, 11, 0.1);
      transform: translateY(-1px);
    }

    .chip-name {
      display: block;
      font-size: 0.74rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .chip-price {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .form-section-label {
      font-size: 0.74rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-main);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.3rem;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    @media (max-width: 540px) {
      .form-row-2 {
        grid-template-columns: 1fr;
      }
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .form-field label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .form-field input,
    .form-field select {
      padding: 0.58rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      font-size: 0.82rem;
      color: var(--text-main);
      background: var(--input-bg);
      outline: none;
    }

    .form-field input:focus,
    .form-field select:focus {
      border-color: var(--accent);
    }

    .modal-footer-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.5rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--border-color);
    }

    .btn-cancel {
      padding: 0.62rem 1.15rem;
      border-radius: 999px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-muted);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    .btn-confirm-buy {
      padding: 0.68rem 1.5rem;
      border-radius: 999px;
      border: none;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }

    .btn-confirm-buy:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class PlanesSaasComponent implements OnInit {
  private saasService = inject(SaasService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  mostrarModal = false;
  enviando = false;
  planSeleccionado: PlanCardConfig | null = null;

  form: CrearTenantDto = {
    razon_social: '',
    nit: '',
    plan_nombre: 'Profesional',
    admin_nombre: '',
    admin_apellido: '',
    admin_email: '',
    admin_password: ''
  };

  // 3 Planes Oficiales con la Paleta de Lujo de FashionStore (Platino/Carbón, Ámbar/Bronce y Oro Imperial)
  planesCards: PlanCardConfig[] = [
    {
      id_plan: 'Basico',
      etiqueta_ribbon: 'Básico',
      precio_entero: '19',
      precio_centavos: '99',
      periodo: '/Por Mes',
      descripcion: 'Ideal para boutiques independientes que inician la digitalización de su inventario y caja.',
      ribbon_bg: 'linear-gradient(135deg, #52525b, #3f3f46)',
      ribbon_fold: '#18181b',
      ribbon_text: '#f4f4f5',
      check_color: '#d4d4d8',
      check_bg: 'rgba(212, 212, 216, 0.12)',
      btn_bg: 'linear-gradient(135deg, #52525b, #3f3f46)',
      btn_text: '#ffffff',
      card_border: '#27272a',
      beneficios: [
        { texto: 'Hasta 2 Sucursales Físicas (RN04)', incluido: true },
        { texto: 'Inventario por Talla, Color y Lotes', incluido: true },
        { texto: 'Punto de Venta (POS) Offline-First', incluido: true },
        { texto: 'Catálogo Web y Reservas Online', incluido: true },
        { texto: 'Reportes Inteligentes con IA (RN23)', incluido: false },
        { texto: 'Predicción de Demanda ML', incluido: false }
      ]
    },
    {
      id_plan: 'Estandar',
      etiqueta_ribbon: 'Estándar',
      precio_entero: '39',
      precio_centavos: '99',
      periodo: '/Por Mes',
      descripcion: 'Para marcas de ropa en expansión con múltiples tiendas físicas y traslados de mercadería.',
      ribbon_bg: 'linear-gradient(135deg, #d97706, #b45309)',
      ribbon_fold: '#78350f',
      ribbon_text: '#ffffff',
      check_color: '#d97706',
      check_bg: 'rgba(217, 119, 6, 0.14)',
      btn_bg: 'linear-gradient(135deg, #d97706, #b45309)',
      btn_text: '#ffffff',
      card_border: '#3f3f46',
      beneficios: [
        { texto: 'Hasta 4 Sucursales Físicas (RN04)', incluido: true },
        { texto: 'Inventario por Talla, Color y Lotes', incluido: true },
        { texto: 'Punto de Venta (POS) Offline-First', incluido: true },
        { texto: 'Transferencias entre Sucursales y AR', incluido: true },
        { texto: 'Reportes Inteligentes con IA (RN23)', incluido: false },
        { texto: 'Predicción de Demanda ML', incluido: false }
      ]
    },
    {
      id_plan: 'Profesional',
      etiqueta_ribbon: 'Profesional',
      precio_entero: '79',
      precio_centavos: '99',
      periodo: '/Por Mes',
      descripcion: 'Potencia total con Inteligencia Artificial generativa, Machine Learning y hasta 10 sucursales.',
      ribbon_bg: 'linear-gradient(135deg, #fbbf24, #d97706)',
      ribbon_fold: '#78350f',
      ribbon_text: '#18181b',
      check_color: '#f59e0b',
      check_bg: 'rgba(245, 158, 11, 0.16)',
      btn_bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
      btn_text: '#18181b',
      card_border: '#f59e0b',
      destacado: true,
      beneficios: [
        { texto: 'Hasta 10 Sucursales Físicas (RN04)', incluido: true },
        { texto: 'Inventario, Transferencias y POS Offline', incluido: true },
        { texto: 'Vestidores Virtuales AR y Lookbook', incluido: true },
        { texto: 'Reportes en Lenguaje Natural con IA', incluido: true },
        { texto: 'Predicción de Demanda Machine Learning', incluido: true },
        { texto: 'Soporte Corporativo Prioritario 24/7', incluido: true }
      ]
    }
  ];

  ngOnInit(): void {}

  abrirModalSuscripcion(plan: PlanCardConfig): void {
    this.planSeleccionado = plan;
    this.form.plan_nombre = plan.id_plan;
    this.mostrarModal = true;
  }

  cambiarPlanEnModal(plan: PlanCardConfig): void {
    this.planSeleccionado = plan;
    this.form.plan_nombre = plan.id_plan;
  }

  cerrarModal(): void {
    if (!this.enviando) {
      this.mostrarModal = false;
    }
  }

  confirmarSuscripcion(): void {
    if (!this.form.razon_social.trim() || !this.form.nit.trim() || !this.form.admin_email.trim() || !this.form.admin_password.trim()) {
      this.toastService.warning('Datos incompletos', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    this.enviando = true;
    this.saasService.onboarding(this.form).subscribe({
      next: (res: any) => {
        this.enviando = false;
        this.mostrarModal = false;
        this.toastService.success(
          '¡Suscripción Activada!',
          `Tu empresa "${this.form.razon_social}" ya está activa con el Plan ${this.planSeleccionado?.etiqueta_ribbon}.`
        );

        if (res?.access_token) {
          localStorage.setItem('fashionstore_token', res.access_token);
          localStorage.setItem('fashionstore_user', JSON.stringify(res));
          window.location.href = '/admin';
        }
      },
      error: (err: any) => {
        this.enviando = false;
        const msg = err?.error?.detail || 'No se pudo procesar la suscripción. Verifica el NIT o correo.';
        this.toastService.error('Error en Suscripción', msg);
      }
    });
  }
}
