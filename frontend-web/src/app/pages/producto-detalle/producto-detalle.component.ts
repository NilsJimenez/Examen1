import { Component, OnInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { ToastService } from '../../services/toast.service';
import { CarritoService } from '../../services/carrito.service';
import { ReservaService } from '../../services/reserva.service';
import { InventarioService } from '../../services/inventario.service';
import { AuthService } from '../../services/auth.service';
import { Producto, Variante, Color, Talla } from '../../models/producto.models';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Contenedor Principal de la Página -->
    <div class="product-page-wrapper" *ngIf="producto; else loadingTpl">
      
      <!-- =================================================================== -->
      <!-- ESCENARIO PRINCIPAL INTERACTIVO (ESTILO REFERENCIA DE VIDEO)        -->
      <!-- =================================================================== -->
      <div 
        class="product-stage-card" 
        [style.--ambient-color]="ambientGlowColor"
      >
        <!-- Capa de Luz Ambiental Dinámica -->
        <div class="ambient-glow-layer"></div>

        <!-- =============================================================== -->
        <!-- 1. BARRA SUPERIOR DENTRO DEL ESCENARIO                          -->
        <!-- =============================================================== -->
        <header class="stage-top-bar">
          
          <!-- Lado Izquierdo: Marca & Migas de Pan -->
          <div class="stage-brand-breadcrumbs">
            <a routerLink="/catalogo" class="brand-back-btn" title="Volver al catálogo">
              <i class="fa-solid fa-arrow-left mr-1.5"></i>
              <span>CATÁLOGO</span>
            </a>
            <span class="crumb-separator">/</span>
            <span class="crumb-cat">{{ producto.categoria?.nombre || 'COLECCIÓN' }}</span>
          </div>

          <!-- Centro: Selector Rápido de Sucursal / Tienda Física -->
          <div class="stage-store-selector">
            <i class="fa-solid fa-store" style="color: var(--accent);"></i>
            <span class="store-selector-label">Tienda:</span>
            <select 
              [(ngModel)]="sucursalSeleccionadaId" 
              (change)="onCambiarSucursal()" 
              class="store-select-native"
            >
              <option *ngFor="let s of stockSucursales" [value]="s.sucursal_id">
                {{ s.sucursal_nombre }} ({{ s.stock_libre }} uds.)
              </option>
            </select>
          </div>

          <!-- Lado Derecho: Acceso Rápido Carrito y Favorito -->
          <div class="stage-top-actions">
            <a routerLink="/carrito" class="stage-action-circle" title="Ver carrito de compras">
              <i class="fa-solid fa-cart-shopping"></i>
              <span *ngIf="carritoService.carritoCount() > 0" class="cart-pill-badge">
                {{ carritoService.carritoCount() }}
              </span>
            </a>
          </div>

        </header>

        <!-- =============================================================== -->
        <!-- 2. CONTENIDO PRINCIPAL: 3 COLUMNAS EDITORIALES                 -->
        <!-- =============================================================== -->
        <div class="stage-main-grid">
          
          <!-- ------------------------------------------------------------- -->
          <!-- COLUMNA IZQUIERDA: CONTROLES < >, TITULAR, DESCRIPCIÓN & CTA  -->
          <!-- ------------------------------------------------------------- -->
          <div class="stage-col-left">
            
            <!-- Flechas de Navegación entre Prendas (Estilo Video) -->
            <div class="nav-arrows-row">
              <button 
                (click)="navegarPrenda('prev')" 
                class="nav-arrow-btn" 
                title="Prenda anterior"
                type="button"
              >
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <button 
                (click)="navegarPrenda('next')" 
                class="nav-arrow-btn" 
                title="Siguiente prenda"
                type="button"
              >
                <i class="fa-solid fa-chevron-right"></i>
              </button>
              <span class="collection-pill-tag">
                <i class="fa-solid fa-sparkles mr-1"></i> COLECCIÓN 2026
              </span>
            </div>

            <!-- Gran Titular de la Prenda -->
            <h1 class="stage-product-title font-serif">
              {{ producto.nombre }}
            </h1>

            <!-- Descripción de la Prenda -->
            <p class="stage-product-desc">
              {{ producto.descripcion || 'Confeccionada con fibras de alta durabilidad y corte sastre moderno, diseñada para una caída impecable tanto en ocasiones formales como urbanas.' }}
            </p>

            <!-- Disponibilidad en Tienda Física Activa -->
            <div class="stage-stock-indicator">
              <span 
                class="stock-status-dot" 
                [style.background-color]="estadoActualSucursalColor"
              ></span>
              <span class="stock-store-name">{{ sucursalActualNombre }}:</span>
              <span 
                class="stock-count-text font-bold"
                [style.color]="estadoActualSucursalColor"
              >
                {{ estadoActualSucursalTexto }}
              </span>
            </div>

            <!-- Botones de Acción Primarios -->
            <div class="stage-actions-group">
              
              <!-- Botón 1: Reservar Cita en Probador con Pase QR -->
              <button 
                (click)="abrirReserva()" 
                class="btn btn-primary stage-cta-btn"
                type="button"
              >
                <i class="fa-solid fa-calendar-check mr-2"></i>
                <span>Reservar para Probador (Pase QR)</span>
              </button>

              <!-- Botón 2: Agregar al Carrito Digital -->
              <button 
                (click)="agregarAlCarrito()" 
                [disabled]="agregandoCarrito" 
                class="btn btn-outline stage-subcta-btn"
                type="button"
              >
                <i *ngIf="!agregandoCarrito" class="fa-solid fa-cart-plus mr-2"></i>
                <i *ngIf="agregandoCarrito" class="fa-solid fa-circle-notch fa-spin mr-2"></i>
                <span>{{ agregandoCarrito ? 'Agregando...' : 'Agregar al Carrito' }}</span>
              </button>

            </div>

            <!-- Slogan de Marca Inferior Izquierdo -->
            <div class="stage-brand-footer">
              <span class="footer-tagline">
                <i class="fa-solid fa-gem mr-1 text-amber-500"></i>
                Alta Costura & Probadores Inteligentes
              </span>
            </div>

          </div>

          <!-- ------------------------------------------------------------- -->
          <!-- COLUMNA CENTRAL: PRENDA FLOTANTE O VISOR 3D / AR              -->
          <!-- ------------------------------------------------------------- -->
          <div class="stage-col-center">
            
            <!-- A. VISTA FOTOGRAFÍA (Prenda Flotante con Movimiento Suave) -->
            <div 
              *ngIf="vistaActiva === 'foto'" 
              class="floating-garment-container animate-fade-in"
            >
              <div class="garment-glow-pedestal"></div>
              
              <img 
                [src]="imagenPrendaActual" 
                [alt]="producto.nombre" 
                class="floating-garment-img"
                referrerpolicy="no-referrer"
                (error)="onImgError($event)"
                [class.animate-garment-switch]="animatingSwitch"
              />

              <!-- Subtexto Central Inferior (Estilo Video: "Confidence, wrapped in warmth") -->
              <div class="stage-center-slogan">
                <span class="slogan-main">Elegancia Definida.</span>
                <span class="slogan-sub">Confección de alta presencia para tu estilo</span>
              </div>
            </div>

            <!-- C. VISTA ESPEJO AR (Webcam + Canvas) -->
            <div 
              *ngIf="vistaActiva === 'espejo'" 
              class="model-viewer-stage-container animate-fade-in"
              style="background: black; overflow: hidden; position: relative;"
            >
              <div *ngIf="cargandoEspejo" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: white; z-index: 5;">
                 <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--accent); margin-bottom: 10px;"></i>
                 <p>Iniciando Espejo Virtual...</p>
                 <p style="font-size: 0.8rem;">(Si tu navegador lo solicita, concede permiso a la cámara)</p>
              </div>
              <video id="detalle-video" style="display: none;" playsinline></video>
              <canvas id="detalle-canvas" width="640" height="480" style="width: 100%; height: 100%; object-fit: cover;"></canvas>
            </div>

            

          </div>

          <!-- ------------------------------------------------------------- -->
          <!-- COLUMNA DERECHA: PRECIO, TALLAS CIRCULARES Y COLORES          -->
          <!-- ------------------------------------------------------------- -->
          <div class="stage-col-right">
            
            <!-- Precio Destacado de Alta Costura -->
            <div class="stage-price-box">
              <div class="price-currency-tag">PRECIO DE BOUTIQUE</div>
              <div class="price-figures-row">
                <span class="price-amount font-serif">
                  Bs. {{ producto.precio_base | number:'1.2-2' }}
                </span>
                <span class="price-strikethrough">
                  Bs. {{ (producto.precio_base * 1.25) | number:'1.2-2' }}
                </span>
              </div>
            </div>

            <!-- Selector de Tallas (Estilo Chips Redondos del Video) -->
            <div class="stage-size-selector-block">
              <div class="selector-header">
                <span class="selector-label">Elige tu talla:</span>
                <span class="selector-current-val font-bold">
                  {{ selectedVariante?.talla?.nombre ? 'Talla ' + selectedVariante?.talla?.nombre : 'Selecciona una' }}
                </span>
              </div>

              <div class="stage-size-chips-grid">
                <button 
                  *ngFor="let t of tallasDisponibles"
                  (click)="seleccionarTalla(t)"
                  [class.size-chip-active]="selectedVariante?.talla?.nombre === t"
                  class="stage-size-chip"
                  type="button"
                >
                  {{ t }}
                </button>
              </div>
            </div>

            <!-- Selector de Colores (Swatches con Cambio Dinámico de Escena) -->
            <div class="stage-color-selector-block">
              <div class="selector-header">
                <span class="selector-label">Color disponible:</span>
                <span class="selector-current-val font-bold" style="color: var(--accent);">
                  {{ selectedVariante?.color?.nombre || 'Selecciona uno' }}
                </span>
              </div>

              <div class="stage-color-swatches-row">
                <button 
                  *ngFor="let col of coloresDisponibles"
                  (click)="seleccionarColor(col.nombre)"
                  [class.color-swatch-active]="selectedVariante?.color?.nombre === col.nombre"
                  class="stage-color-swatch"
                  [title]="col.nombre"
                  type="button"
                >
                  <span 
                    class="swatch-inner-dot" 
                    [style.background-color]="col.codigo_hex || '#18181b'"
                  ></span>
                </button>
              </div>
            </div>

            <!-- Código SKU y Botón para ver existencias de todas las tiendas -->
            <div class="stage-sku-block">
              <span class="sku-label">CÓDIGO DE PRENDA:</span>
              <code class="sku-code">{{ selectedVariante?.sku || 'SKU-GENERAL' }}</code>
              
              <button 
                (click)="consultarStockPorSucursal()" 
                class="stock-overview-trigger-btn"
                type="button"
              >
                <i class="fa-solid fa-boxes-stacked mr-1.5" style="color: var(--accent);"></i>
                <span>{{ mostrarStock ? 'Ocultar stock por sucursal' : 'Consultar todas las tiendas' }}</span>
              </button>
            </div>

          </div>

        </div>

        <!-- =============================================================== -->
        <!-- 3. BOTÓN FLOTANTE VESTIDOR 3D / AR (EL ELEMENTO DEL VIDEO)      -->
        <!-- =============================================================== -->
        <div class="floating-3d-button-anchor">
          <button 
            (click)="toggleVista3D()" 
            class="floating-3d-widget-btn"
            [class.widget-btn-active]="vistaActiva === 'espejo'"
            title="Activar o alternar el Vestidor 3D y Realidad Aumentada"
            type="button"
          >
            <!-- Mini icono / preview 3D animado -->
            <div class="widget-3d-icon-circle">
                <i *ngIf="vistaActiva === 'foto'" class="fa-solid fa-camera fa-fade"></i>
                <i *ngIf="vistaActiva === 'espejo'" class="fa-solid fa-image"></i>
              </div>

            <div class="widget-3d-labels">
              <span class="widget-tag">
                {{ vistaActiva === 'foto' ? 'ESPEJO AR' : 'VER FOTO' }}
              </span>
              <span class="widget-title">
                {{ vistaActiva === 'foto' ? 'Probar en Cámara' : 'Volver a Foto' }}
              </span>
            </div>

            <div class="widget-arrow-dot">
              <i class="fa-solid" [class.fa-arrow-up-right-from-square]="vistaActiva === 'foto'" [class.fa-rotate-left]="vistaActiva === 'espejo'"></i>
            </div>
          </button>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- MODAL / DRAWER: CONSULTAR STOCK EN TODAS LAS SUCURSALES (CU-11)     -->
      <!-- =================================================================== -->
      <div *ngIf="mostrarStock" class="modal-overlay animate-fade-in" (click)="mostrarStock = false">
        <div class="card modal-drawer-card p-6" (click)="$event.stopPropagation()">
          
          <div class="flex items-center justify-between pb-4 mb-4 border-b" style="border-color: var(--border-color);">
            <div class="flex items-center gap-3">
              <div class="modal-icon-circle">
                <i class="fa-solid fa-store" style="color: var(--accent);"></i>
              </div>
              <div>
                <h3 class="font-serif text-lg font-bold" style="color: var(--text-main);">
                  Disponibilidad en Tiendas Físicas
                </h3>
                <p class="text-xs" style="color: var(--text-muted);">
                  {{ producto.nombre }} — Talla {{ selectedVariante?.talla?.nombre }}
                </p>
              </div>
            </div>
            <button (click)="mostrarStock = false" class="btn btn-outline btn-sm">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div *ngIf="loadingStock" class="text-center py-8 text-xs" style="color: var(--text-muted);">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2" style="color: var(--accent);"></i>
            <p>Consultando existencias en La Paz y Santa Cruz...</p>
          </div>

          <div *ngIf="!loadingStock && stockSucursales.length > 0" class="flex flex-col gap-3">
            <div 
              *ngFor="let s of stockSucursales" 
              class="p-4 rounded-xl flex items-center justify-between"
              style="background: var(--table-th-bg); border: 1px solid var(--border-color);"
            >
              <div>
                <div class="font-bold text-sm" style="color: var(--text-main);">
                  <i class="fa-solid fa-location-dot mr-1.5" style="color: var(--accent);"></i>
                  {{ s.sucursal_nombre }}
                </div>
                <span class="text-xs block mt-0.5" style="color: var(--text-muted);">
                  Stock libre: <strong style="color: var(--text-main);">{{ s.stock_libre }}</strong> unidades
                  <span *ngIf="s.cantidad_reservada > 0" class="ml-1 text-[11px] font-semibold" style="color: #f59e0b;">
                    • {{ s.cantidad_reservada }} en probador/reservadas
                  </span>
                </span>
              </div>

              <div class="flex items-center gap-3">
                <span 
                  class="badge" 
                  [style.background]="s.estado === 'disponible' ? 'rgba(16,185,129,0.15)' : (s.estado === 'reservado' ? 'rgba(245,158,11,0.18)' : (s.estado === 'ultimas_unidades' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'))"
                  [style.color]="s.estado === 'disponible' ? '#10b981' : (s.estado === 'reservado' ? '#f59e0b' : (s.estado === 'ultimas_unidades' ? '#f59e0b' : '#ef4444'))"
                  [style.border]="'1px solid ' + (s.estado === 'disponible' ? '#10b981' : (s.estado === 'reservado' ? '#f59e0b' : (s.estado === 'ultimas_unidades' ? '#f59e0b' : '#ef4444')))"
                  style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase;"
                >
                  {{ s.estado === 'ultimas_unidades' ? 'Últimas Uds.' : (s.estado === 'reservado' ? 'Reservado' : s.estado) }}
                </span>

                <button 
                  *ngIf="s.stock_libre > 0" 
                  (click)="seleccionarSucursalDirecta(s.sucursal_id)"
                  class="btn btn-outline btn-sm text-xs"
                >
                  Seleccionar
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- =================================================================== -->
      <!-- MODAL: AGENDAR CITA EN PROBADOR CON PASE QR (CU-14)                 -->
      <!-- =================================================================== -->
      <div *ngIf="mostrarFormReserva" class="modal-overlay animate-fade-in" (click)="mostrarFormReserva = false">
        <div class="card modal-reserva-card p-8" (click)="$event.stopPropagation()">
          
          <div class="flex items-center justify-between pb-4 mb-6 border-b" style="border-color: var(--border-color);">
            <div class="flex items-center gap-3">
              <div class="modal-icon-circle">
                <i class="fa-solid fa-calendar-check" style="color: var(--accent);"></i>
              </div>
              <div>
                <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">
                  Agendar Probador Inteligente
                </h3>
                <p class="text-xs" style="color: var(--text-muted);">
                  Tus prendas estarán preparadas en el vestidor antes de que llegues a la tienda
                </p>
              </div>
            </div>
            <button (click)="mostrarFormReserva = false" class="btn btn-outline btn-sm">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">
                Sucursal para la Visita:
              </label>
              <select [(ngModel)]="reservaSucursalId" (change)="onCambiarSucursalReserva()" class="form-input">
                <option *ngFor="let suc of stockSucursales" [value]="suc.sucursal_id" [disabled]="suc.stock_libre <= 0">
                  {{ suc.sucursal_nombre }} — {{ suc.stock_libre > 0 ? '(' + suc.stock_libre + ' disponibles)' : (suc.cantidad_reservada > 0 ? '(Prendas Reservadas)' : '(Agotado)') }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">
                Fecha Estimada:
              </label>
              <input type="date" [(ngModel)]="reservaFecha" class="form-input" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">
                Horario de Cita:
              </label>
              <input type="time" [(ngModel)]="reservaHora" class="form-input" />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">
                Cantidad de Prendas:
              </label>
              <input type="number" [(ngModel)]="reservaCantidad" min="1" [max]="stockSucursalReserva || 1" class="form-input" />
            </div>
          </div>

          <!-- Resumen de Prenda -->
          <div class="p-3.5 rounded-xl mb-6 flex items-center justify-between text-xs" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <div class="flex items-center gap-3">
              <img [src]="producto.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100'" [alt]="producto.nombre" referrerpolicy="no-referrer" (error)="onImgError($event)" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <strong style="color: var(--text-main);">{{ producto.nombre }}</strong>
                <span class="block" style="color: var(--text-muted);">
                  Talla: {{ selectedVariante?.talla?.nombre }} • Color: {{ selectedVariante?.color?.nombre }}
                </span>
              </div>
            </div>
            <span class="font-bold text-sm" style="color: var(--accent);">
              Bs. {{ producto.precio_base | number:'1.2-2' }}
            </span>
          </div>

          <div class="flex items-center gap-3">
            <button 
              (click)="confirmarReserva()" 
              [disabled]="creandoReserva" 
              class="btn btn-primary" 
              style="flex: 1; padding: 0.85rem;"
            >
              <span *ngIf="creandoReserva"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Generando Pase QR...</span>
              <span *ngIf="!creandoReserva"><i class="fa-solid fa-qrcode mr-2"></i> Confirmar y Generar Pase QR</span>
            </button>
            <button (click)="mostrarFormReserva = false" class="btn btn-outline" style="padding: 0.85rem 1.5rem;">
              Cancelar
            </button>
          </div>

        </div>
      </div>

    </div>

    <!-- Plantilla de Carga Inicial -->
    <ng-template #loadingTpl>
      <div class="container py-28 text-center">
        <div class="loading-spinner-circle mx-auto mb-4">
          <i class="fa-solid fa-circle-notch fa-spin text-4xl" style="color: var(--accent);"></i>
        </div>
        <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">Preparando vestidor virtual...</h3>
        <p class="text-xs mt-1" style="color: var(--text-muted);">Cargando modelo 3D y especificaciones de alta costura</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .product-page-wrapper {
      padding: 2rem 1.5rem 5rem 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* ===================================================================== */
    /* ESCENARIO PRINCIPAL (STAGE CARD INSPIRADO EN EL VIDEO)               */
    /* ===================================================================== */
    .product-stage-card {
      position: relative;
      background-color: #121215;
      border: 1.5px solid var(--border-color);
      border-radius: 32px;
      padding: 2.75rem 3.5rem;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
      overflow: hidden;
      min-height: 720px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: background 0.5s ease;
    }

    @media (max-width: 960px) {
      .product-stage-card {
        padding: 2rem 1.75rem;
        border-radius: 24px;
      }
    }

    /* Capa de Luz Ambiental Dinámica que cambia con el color */
    .ambient-glow-layer {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        circle at 50% 50%, 
        var(--ambient-color, rgba(245, 158, 11, 0.28)) 0%, 
        rgba(18, 18, 21, 0.6) 45%, 
        rgba(9, 9, 11, 0.95) 100%
      );
      pointer-events: none;
      z-index: 1;
      transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* ===================================================================== */
    /* 1. BARRA SUPERIOR DENTRO DEL ESCENARIO                                */
    /* ===================================================================== */
    .stage-top-bar {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 2.5rem;
    }

    .stage-brand-breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    .brand-back-btn {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s ease;
      display: inline-flex;
      align-items: center;
    }

    .brand-back-btn:hover {
      color: var(--accent);
    }

    .crumb-separator {
      color: rgba(255, 255, 255, 0.2);
    }

    .crumb-cat {
      color: var(--accent);
      text-transform: uppercase;
    }

    .stage-store-selector {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(24, 24, 27, 0.7);
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      padding: 0.4rem 1rem;
      backdrop-filter: blur(10px);
    }

    .store-selector-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .store-select-native {
      background: transparent;
      border: none;
      color: var(--text-main);
      font-size: 0.82rem;
      font-weight: 600;
      outline: none;
      cursor: pointer;
    }

    .stage-top-actions {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .stage-action-circle {
      position: relative;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(24, 24, 27, 0.7);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: all 0.2s ease;
      font-size: 0.95rem;
    }

    .stage-action-circle:hover {
      border-color: var(--accent);
      color: var(--accent);
      transform: translateY(-2px);
    }

    .cart-pill-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 800;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #18181b;
    }

    /* ===================================================================== */
    /* 2. GRID PRINCIPAL EN 3 COLUMNAS                                       */
    /* ===================================================================== */
    .stage-main-grid {
      position: relative;
      z-index: 10;
      display: grid;
      grid-template-columns: 1.15fr 1.7fr 1.15fr;
      gap: 3.5rem;
      align-items: center;
      flex: 1;
    }

    @media (max-width: 1120px) {
      .stage-main-grid {
        grid-template-columns: 1fr;
        gap: 3rem;
      }
    }

    /* COLUMNA IZQUIERDA */
    .stage-col-left {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .nav-arrows-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 1.5rem;
    }

    .nav-arrow-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s ease;
    }

    .nav-arrow-btn:hover {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      transform: scale(1.08);
    }

    .collection-pill-tag {
      margin-left: 0.5rem;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: var(--accent);
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 9999px;
      padding: 0.3rem 0.75rem;
    }

    .stage-product-title {
      font-size: 2.85rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.15;
      margin: 0 0 1.25rem 0;
      letter-spacing: -0.01em;
    }

    @media (max-width: 600px) {
      .stage-product-title {
        font-size: 2.2rem;
      }
    }

    .stage-product-desc {
      font-size: 0.95rem;
      line-height: 1.7;
      color: var(--text-muted);
      margin: 0 0 1.75rem 0;
    }

    .stage-stock-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      background: rgba(24, 24, 27, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      padding: 0.45rem 1rem;
      font-size: 0.8rem;
      margin-bottom: 2rem;
      width: fit-content;
      backdrop-filter: blur(8px);
    }

    .stock-status-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .stock-store-name {
      color: var(--text-muted);
    }

    .stage-actions-group {
      display: flex;
      flex-direction: column;
      gap: 0.95rem;
      margin-bottom: 2rem;
    }

    .stage-cta-btn {
      padding: 1.05rem 1.6rem;
      font-size: 0.92rem;
      font-weight: 800;
      border-radius: 12px;
      letter-spacing: 0.04em;
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);
    }

    .stage-subcta-btn {
      padding: 0.95rem 1.6rem;
      font-size: 0.92rem;
      font-weight: 700;
      border-radius: 12px;
    }

    .stage-brand-footer {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    /* COLUMNA CENTRAL (PRENDA FLOTANTE) */
    .stage-col-center {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 480px;
    }

    .floating-garment-container {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .garment-glow-pedestal {
      position: absolute;
      width: 280px;
      height: 40px;
      bottom: 60px;
      background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.6) 0%, transparent 70%);
      filter: blur(10px);
      z-index: 1;
    }

    .floating-garment-img {
      position: relative;
      z-index: 2;
      max-width: 100%;
      max-height: 460px;
      object-fit: contain;
      animation: floatMotion 4.5s ease-in-out infinite;
      filter: drop-shadow(0 20px 35px rgba(0, 0, 0, 0.65));
      transition: transform 0.4s ease, opacity 0.3s ease;
    }

    @keyframes floatMotion {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-14px) rotate(0.8deg);
      }
    }

    .animate-garment-switch {
      animation: switchEffect 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes switchEffect {
      0% {
        opacity: 0.2;
        transform: scale(0.92) translateY(20px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .stage-center-slogan {
      margin-top: 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .slogan-main {
      font-size: 0.82rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-main);
    }

    .slogan-sub {
      font-size: 0.74rem;
      color: var(--text-muted);
    }

    /* VISOR 3D INTEGRADO */
    .model-viewer-stage-container {
      width: 100%;
      height: 480px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .stage-3d-model {
      width: 100%;
      height: 420px;
      background: transparent;
      outline: none;
    }

    .ar-camera-btn {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
      padding: 0.65rem 1.25rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 800;
    }

    .stage-3d-instructions {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }

    /* COLUMNA DERECHA */
    .stage-col-right {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2rem;
    }

    .stage-price-box {
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 1.5rem;
    }

    .price-currency-tag {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }

    .price-figures-row {
      display: flex;
      align-items: baseline;
      gap: 0.85rem;
    }

    .price-amount {
      font-size: 2.4rem;
      font-weight: 800;
      color: var(--accent);
    }

    .price-strikethrough {
      font-size: 1.1rem;
      color: var(--text-muted);
      text-decoration: line-through;
      opacity: 0.6;
    }

    /* SELECTOR DE TALLAS (CHIPS CIRCULARES ESTILO VIDEO) */
    .stage-size-selector-block {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .selector-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
    }

    .selector-label {
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
      font-size: 0.72rem;
      letter-spacing: 0.06em;
    }

    .selector-current-val {
      color: var(--text-main);
    }

    .stage-size-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .stage-size-chip {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(24, 24, 27, 0.7);
      border: 1.5px solid var(--border-color);
      color: var(--text-main);
      font-size: 0.88rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .stage-size-chip:hover {
      border-color: var(--accent);
      transform: scale(1.1);
      color: var(--accent);
    }

    .size-chip-active {
      background: var(--accent) !important;
      border-color: var(--accent) !important;
      color: #09090b !important;
      transform: scale(1.12);
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.45);
    }

    /* SELECTOR DE COLORES (SWATCHES ESTILO VIDEO) */
    .stage-color-selector-block {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .stage-color-swatches-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .stage-color-swatch {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(24, 24, 27, 0.6);
      border: 2px solid transparent;
      padding: 3px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .stage-color-swatch:hover {
      transform: scale(1.15);
      border-color: rgba(255, 255, 255, 0.4);
    }

    .color-swatch-active {
      border-color: var(--accent) !important;
      transform: scale(1.2);
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.5);
    }

    .swatch-inner-dot {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* SKU & DISPONIBILIDAD */
    .stage-sku-block {
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .sku-label {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }

    .sku-code {
      font-size: 0.85rem;
      color: var(--text-main);
      font-weight: 700;
    }

    .stock-overview-trigger-btn {
      background: transparent;
      border: 1px dashed var(--border-color);
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      margin-top: 0.4rem;
      transition: all 0.2s ease;
      width: fit-content;
    }

    .stock-overview-trigger-btn:hover {
      border-color: var(--accent);
      color: var(--text-main);
      background: rgba(245, 158, 11, 0.06);
    }

    /* ===================================================================== */
    /* 3. BOTÓN FLOTANTE VESTIDOR 3D / AR (EL ELEMENTO CLAVE DEL VIDEO)     */
    /* ===================================================================== */
    .floating-3d-button-anchor {
      position: absolute;
      bottom: 2rem;
      right: 2.5rem;
      z-index: 50;
    }

    @media (max-width: 800px) {
      .floating-3d-button-anchor {
        position: static;
        margin-top: 2rem;
        display: flex;
        justify-content: center;
      }
    }

    .floating-3d-widget-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.85rem;
      background: rgba(24, 24, 27, 0.88);
      border: 1.5px solid var(--accent);
      border-radius: 9999px;
      padding: 0.65rem 1.25rem 0.65rem 0.75rem;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.25);
      backdrop-filter: blur(16px);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      animation: floatBadge 3.5s ease-in-out infinite;
    }

    .floating-3d-widget-btn:hover {
      transform: translateY(-4px) scale(1.04);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.45);
      background: rgba(39, 39, 42, 0.95);
    }

    @keyframes floatBadge {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-6px);
      }
    }

    .widget-btn-active {
      border-color: #10b981 !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 25px rgba(16, 185, 129, 0.35) !important;
    }

    .widget-3d-icon-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .widget-btn-active .widget-3d-icon-circle {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: #10b981;
    }

    .widget-3d-labels {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .widget-tag {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--accent);
    }

    .widget-btn-active .widget-tag {
      color: #10b981;
    }

    .widget-title {
      font-size: 0.88rem;
      font-weight: 800;
      color: #ffffff;
    }

    .widget-arrow-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      margin-left: 0.25rem;
    }

    /* ===================================================================== */
    /* MODALES Y OVERLAYS (ESTILO BOUTIQUE)                                  */
    /* ===================================================================== */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 9, 11, 0.75);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .modal-drawer-card {
      max-width: 580px;
      width: 100%;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    }

    .modal-reserva-card {
      max-width: 640px;
      width: 100%;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    }

    .modal-icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
    }

  `]
})
export class ProductoDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productoService = inject(ProductoService);
  private toastService = inject(ToastService);
  carritoService = inject(CarritoService);
  private reservaService = inject(ReservaService);
  private inventarioService = inject(InventarioService);
  private authService = inject(AuthService);

  producto: Producto | null = null;
  todosLosProductos: Producto[] = [];
  selectedVariante: Variante | null = null;
  haSeleccionadoColor: boolean = false;
  vistaActiva: 'foto' | 'espejo' = 'foto';
  animatingSwitch: boolean = false;

  // Variables Espejo Magico AR
  cargandoEspejo = false;
  private videoElement!: HTMLVideoElement;
  private canvasElement!: HTMLCanvasElement;
  private canvasCtx!: CanvasRenderingContext2D | null;
  private pose: any;
  private camera: any;
  imagenesCargadas: {[url: string]: HTMLImageElement} = {};

  ngOnDestroy() {
    this.apagarEspejo();
  }

  async encenderEspejo() {
    this.cargandoEspejo = true;
    
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');

    setTimeout(() => this.iniciarCamara(), 500);
  }

  apagarEspejo() {
    if(this.camera) {
      this.camera.stop();
    }
  }

  loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }

  iniciarCamara() {
    this.videoElement = document.getElementById('detalle-video') as HTMLVideoElement;
    this.canvasElement = document.getElementById('detalle-canvas') as HTMLCanvasElement;
    if(!this.canvasElement || !this.videoElement) return;
    this.canvasCtx = this.canvasElement.getContext('2d');

    this.pose = new (window as any).Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results: any) => this.onPoseResults(results));

    this.camera = new (window as any).Camera(this.videoElement, {
      onFrame: async () => {
        await this.pose.send({ image: this.videoElement });
      },
      width: 640,
      height: 480
    });

    this.camera.start().then(() => {
        this.cargandoEspejo = false;
    });
  }

  onPoseResults(results: any) {
    if (!this.canvasCtx || !this.canvasElement) return;
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Espejar
    this.canvasCtx.translate(this.canvasElement.width, 0);
    this.canvasCtx.scale(-1, 1);
    
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

    if (results.poseLandmarks) {
      const lShoulder = results.poseLandmarks[12]; 
      const rShoulder = results.poseLandmarks[11]; 
      const lHip = results.poseLandmarks[24];
      const rHip = results.poseLandmarks[23];

      if(lShoulder && rShoulder && lHip && rHip) {
        const lsX = lShoulder.x * this.canvasElement.width;
        const lsY = lShoulder.y * this.canvasElement.height;
        const rsX = rShoulder.x * this.canvasElement.width;
        const rsY = rShoulder.y * this.canvasElement.height;
        
        const lhX = lHip.x * this.canvasElement.width;
        const lhY = lHip.y * this.canvasElement.height;
        const rhX = rHip.x * this.canvasElement.width;
        const rhY = rHip.y * this.canvasElement.height;

        const shoulderWidth = Math.abs(lsX - rsX);
        const hipWidth = Math.abs(lhX - rhX);

        const imgUrl = this.imagenPrendaActual;
        if(imgUrl) {
          // Inferir si es prenda inferior por categoria o nombre
          const catNombre = (this.producto?.categoria?.nombre || '').toLowerCase();
          const pNombre = (this.producto?.nombre || '').toLowerCase();
          
          const esInferior = catNombre.includes('pantal') || catNombre.includes('short') || catNombre.includes('falda') || catNombre.includes('jean') || pNombre.includes('pantal') || pNombre.includes('short') || pNombre.includes('falda');
          
          if(esInferior) {
            this.dibujarPrenda(imgUrl, (lhX + rhX)/2, (lhY + rhY)/2, hipWidth * 2.5, false);
          } else {
            this.dibujarPrenda(imgUrl, (lsX + rsX)/2, (lsY + rsY)/2, shoulderWidth * 2.2, true);
          }
        }
      }
    }
    this.canvasCtx.restore();
  }

  dibujarPrenda(url: string, centerX: number, centerY: number, width: number, isSuperior: boolean) {
    if(!this.imagenesCargadas[url]) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      this.imagenesCargadas[url] = img;
    }
    
    const img = this.imagenesCargadas[url];
    if(img.complete && this.canvasCtx) {
      const aspect = img.height / img.width;
      const h = width * aspect;
      const offsetY = isSuperior ? h * 0.15 : h * 0.1; 
      
      this.canvasCtx.globalCompositeOperation = "multiply"; 
      this.canvasCtx.drawImage(img, centerX - width/2, centerY - offsetY, width, h);
      this.canvasCtx.globalCompositeOperation = "source-over";
    }
  }


  agregandoCarrito: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  mostrarLinkCarrito: boolean = false;
  private errorTimer: any = null;
  private successTimer: any = null;

  // CU-11: Stock por sucursal
  mostrarStock: boolean = false;
  loadingStock: boolean = false;
  stockSucursales: any[] = [];
  sucursalSeleccionadaId: number = 1;

  // CU-14: Reserva en Vestidor
  mostrarFormReserva: boolean = false;
  creandoReserva: boolean = false;
  reservaSucursalId: number = 1;
  reservaFecha: string = '';
  reservaHora: string = '15:00';
  reservaCantidad: number = 1;

  // Tallas y Colores Únicos para los Selectores del Video
  get tallasDisponibles(): string[] {
    if (!this.producto?.variantes) return [];
    const set = new Set<string>();
    this.producto.variantes.forEach(v => {
      if (v.talla?.nombre) set.add(v.talla.nombre);
    });
    return Array.from(set);
  }

  get coloresDisponibles(): { nombre: string; codigo_hex: string }[] {
    if (!this.producto?.variantes) return [];
    const map = new Map<string, string>();
    this.producto.variantes.forEach(v => {
      if (v.color?.nombre) {
        map.set(v.color.nombre, v.color.codigo_hex || '#18181b');
      }
    });
    return Array.from(map.entries()).map(([nombre, codigo_hex]) => ({ nombre, codigo_hex }));
  }

  // Luz Ambiental Dinámica según el Color de la Prenda
  get ambientGlowColor(): string {
    if (!this.selectedVariante?.color) return 'rgba(245, 158, 11, 0.25)';
    
    const hex = (this.selectedVariante.color.codigo_hex || '').toLowerCase();
    const nombre = (this.selectedVariante.color.nombre || '').toLowerCase();

    if (hex === '#ffffff' || hex === '#fff' || nombre.includes('blanco')) {
      return 'rgba(240, 245, 255, 0.22)';
    }
    if (hex === '#000000' || hex === '#000' || nombre.includes('negro')) {
      return 'rgba(60, 60, 75, 0.45)';
    }
    if (nombre.includes('azul') || nombre.includes('navy')) {
      return 'rgba(30, 58, 138, 0.45)';
    }
    if (nombre.includes('rojo') || nombre.includes('vino') || nombre.includes('gala')) {
      return 'rgba(225, 29, 72, 0.45)';
    }
    if (nombre.includes('verde')) {
      return 'rgba(16, 185, 129, 0.4)';
    }
    if (nombre.includes('beige') || nombre.includes('marron') || nombre.includes('tierra')) {
      return 'rgba(217, 119, 6, 0.35)';
    }

    return 'rgba(245, 158, 11, 0.32)';
  }

  onImgError(event: any): void {
    if (event?.target) {
      event.target.onerror = null;
      event.target.src = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800';
    }
  }

  // Imagen activa de la prenda (prioriza la del producto inicialmente, luego cambia si eligen color)
  get imagenPrendaActual(): string {
    if (this.haSeleccionadoColor && this.selectedVariante?.imagen_url) {
      return this.selectedVariante.imagen_url;
    }
    return this.producto?.imagen_url || this.selectedVariante?.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800';
  }

  get sucursalActualNombre(): string {
    const s = this.stockSucursales.find(item => item.sucursal_id === Number(this.sucursalSeleccionadaId));
    return s ? s.sucursal_nombre : 'Sucursal Central La Paz';
  }

  get sucursalActualData(): any {
    return this.stockSucursales.find(item => item.sucursal_id === Number(this.sucursalSeleccionadaId)) || null;
  }

  get estadoActualSucursal(): 'disponible' | 'ultimas_unidades' | 'reservado' | 'agotado' {
    const s = this.sucursalActualData;
    if (!s) return 'agotado';
    if (s.stock_libre >= 5) return 'disponible';
    if (s.stock_libre > 0) return 'ultimas_unidades';
    if (s.cantidad_reservada > 0) return 'reservado';
    return 'agotado';
  }

  get estadoActualSucursalColor(): string {
    switch (this.estadoActualSucursal) {
      case 'disponible': return '#10b981'; // Verde
      case 'ultimas_unidades': return '#f59e0b'; // Naranja / Ámbar
      case 'reservado': return '#f59e0b'; // Ámbar (Prendas apartadas)
      case 'agotado': return '#ef4444'; // Rojo (Sin stock)
    }
  }

  get estadoActualSucursalTexto(): string {
    const s = this.sucursalActualData;
    if (!s) return 'Consultando stock...';
    if (s.stock_libre > 0) {
      return `${s.stock_libre} uds. disponibles`;
    }
    if (s.cantidad_reservada > 0) {
      return `Reservado (${s.cantidad_reservada} en probador)`;
    }
    return 'Agotado en esta tienda';
  }

  get stockActualSucursal(): number {
    const s = this.stockSucursales.find(item => item.sucursal_id === Number(this.sucursalSeleccionadaId));
    return s ? s.stock_libre : 0;
  }

  get stockSucursalReserva(): number {
    const s = this.stockSucursales.find(item => item.sucursal_id === Number(this.reservaSucursalId));
    return s ? s.stock_libre : 0;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.cargarProducto(+idParam);
      }
    });

    // Cargar lista general para navegar entre prendas con < >
    this.productoService.getProductos().subscribe({
      next: (list) => this.todosLosProductos = list || [],
      error: () => {}
    });

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    this.reservaFecha = manana.toISOString().split('T')[0];
  }

  cargarProducto(id: number): void {
    this.productoService.getProductoById(id).subscribe({
      next: (data) => {
        this.producto = data;
        if (data.variantes && data.variantes.length > 0) {
          // Pre-cargar todas las imágenes de variantes en caché del navegador (0ms latencia)
          data.variantes.forEach(v => {
            if (v.imagen_url) {
              const img = new Image();
              img.src = v.imagen_url;
            }
          });

          this.selectedVariante = data.variantes[0];
          this.cargarStockVariante(this.selectedVariante.id);
        }
        this.triggerGarmentAnimation();
      },
      error: (err) => console.error('Error cargando producto:', err)
    });
  }

  seleccionarTalla(tallaNombre: string): void {
    if (!this.producto?.variantes) return;
    const variante = this.producto.variantes.find(v => 
      v.talla?.nombre === tallaNombre && 
      (!this.selectedVariante?.color || v.color?.nombre === this.selectedVariante.color.nombre)
    ) || this.producto.variantes.find(v => v.talla?.nombre === tallaNombre);

    if (variante) {
      this.seleccionarVariante(variante);
    }
  }

  seleccionarColor(colorNombre: string): void {
    if (!this.producto?.variantes) return;
    this.haSeleccionadoColor = true;
    const variante = this.producto.variantes.find(v => 
      v.color?.nombre?.toLowerCase() === colorNombre.toLowerCase() && 
      (!this.selectedVariante?.talla || v.talla?.nombre === this.selectedVariante.talla.nombre)
    ) || this.producto.variantes.find(v => v.color?.nombre?.toLowerCase() === colorNombre.toLowerCase());

    if (variante) {
      this.seleccionarVariante(variante);
    }
  }

  seleccionarVariante(v: Variante): void {
    this.selectedVariante = v;
    this.cargarStockVariante(v.id);
    this.triggerGarmentAnimation();
  }

  triggerGarmentAnimation(): void {
    this.animatingSwitch = true;
    setTimeout(() => {
      this.animatingSwitch = false;
    }, 450);
  }

  toggleVista3D(): void {
    if (this.vistaActiva === 'foto') {
      this.vistaActiva = 'espejo';
      this.encenderEspejo();
    } else {
      this.vistaActiva = 'foto';
      this.apagarEspejo();
    }
  }

  navegarPrenda(direccion: 'prev' | 'next'): void {
    if (!this.producto || this.todosLosProductos.length <= 1) return;
    const currentIndex = this.todosLosProductos.findIndex(p => p.id === this.producto!.id);
    if (currentIndex === -1) return;

    let targetIndex = direccion === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= this.todosLosProductos.length) targetIndex = 0;
    if (targetIndex < 0) targetIndex = this.todosLosProductos.length - 1;

    const nextProd = this.todosLosProductos[targetIndex];
    if (nextProd) {
      this.router.navigate(['/producto', nextProd.id]);
    }
  }

  cargarStockVariante(varianteId: number): void {
    this.loadingStock = true;
    this.inventarioService.getStockPorVariante(varianteId).subscribe({
      next: (res) => {
        this.stockSucursales = res.stock_por_sucursal || [];
        this.loadingStock = false;
        if (this.stockSucursales.length > 0) {
          const sucParam = this.route.snapshot.queryParamMap.get('sucursal');
          const sucursalTarget = sucParam ? this.stockSucursales.find(s => s.sucursal_id === Number(sucParam)) : null;

          if (sucursalTarget) {
            this.sucursalSeleccionadaId = sucursalTarget.sucursal_id;
            this.reservaSucursalId = sucursalTarget.sucursal_id;
          } else {
            const conStock = this.stockSucursales.find(s => s.stock_libre > 0);
            if (conStock) {
              this.sucursalSeleccionadaId = conStock.sucursal_id;
              this.reservaSucursalId = conStock.sucursal_id;
            } else {
              this.sucursalSeleccionadaId = this.stockSucursales[0].sucursal_id;
              this.reservaSucursalId = this.stockSucursales[0].sucursal_id;
            }
          }
        }
      },
      error: () => {
        this.loadingStock = false;
      }
    });
  }

  onCambiarSucursal(): void {
    this.reservaSucursalId = this.sucursalSeleccionadaId;
  }

  onCambiarSucursalReserva(): void {
    this.sucursalSeleccionadaId = this.reservaSucursalId;
  }

  seleccionarSucursalDirecta(sucursalId: number): void {
    this.sucursalSeleccionadaId = sucursalId;
    this.reservaSucursalId = sucursalId;
    this.mostrarStock = false;
    this.mostrarExito(`Tienda seleccionada: ${this.sucursalActualNombre}`);
  }

  consultarStockPorSucursal(): void {
    this.mostrarStock = !this.mostrarStock;
  }

  mostrarError(msg: string): void {
    this.toastService.error('Aviso del Sistema', msg);
  }

  mostrarExito(msg: string, conCarrito: boolean = false): void {
    if (conCarrito) {
      this.toastService.success('Operación Exitosa', msg, 6500, 'Ir al Carrito', '/carrito');
    } else {
      this.toastService.success('Operación Exitosa', msg, 5000);
    }
  }

  agregarAlCarrito(): void {
    if (!this.selectedVariante) {
      this.mostrarError('Por favor selecciona una talla y color antes de agregar al carrito.');
      return;
    }

    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.stockActualSucursal <= 0) {
      this.mostrarError(`No es posible agregar al carrito: No hay stock disponible en ${this.sucursalActualNombre}. Por favor selecciona una sucursal con prendas disponibles.`);
      return;
    }

    this.agregandoCarrito = true;
    this.carritoService.agregarItem(this.selectedVariante.id, 1).subscribe({
      next: () => {
        this.agregandoCarrito = false;
        this.mostrarExito(`"${this.producto?.nombre}" (Talla: ${this.selectedVariante?.talla?.nombre}) agregada a tu carrito.`, true);
      },
      error: (err) => {
        this.agregandoCarrito = false;
        this.mostrarError(err.error?.detail || 'No se pudo agregar al carrito.');
      }
    });
  }

  abrirReserva(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.stockActualSucursal <= 0) {
      const otraConStock = this.stockSucursales.find(s => s.stock_libre > 0);
      if (otraConStock) {
        this.mostrarError(`No hay existencias en ${this.sucursalActualNombre}. Hay disponibilidad en: ${otraConStock.sucursal_nombre}.`);
        this.sucursalSeleccionadaId = otraConStock.sucursal_id;
        this.reservaSucursalId = otraConStock.sucursal_id;
      } else {
        this.mostrarError('Esta prenda se encuentra temporalmente agotada en todas las sucursales.');
        return;
      }
    }

    this.mostrarFormReserva = true;
  }

  confirmarReserva(): void {
    if (!this.selectedVariante) {
      this.mostrarError('Por favor selecciona una talla y color.');
      return;
    }

    const suc = this.stockSucursales.find(s => s.sucursal_id === Number(this.reservaSucursalId));
    if (!suc || suc.stock_libre <= 0) {
      this.mostrarError(`Esta prenda no cuenta con stock en la sucursal seleccionada (${suc ? suc.sucursal_nombre : 'Elegida'}). Elige una tienda con disponibilidad.`);
      return;
    }

    if (this.reservaCantidad > suc.stock_libre) {
      this.mostrarError(`Solo hay ${suc.stock_libre} unidad(es) disponible(s) en ${suc.sucursal_nombre}. Reduce la cantidad solicitada.`);
      return;
    }

    if (!this.reservaFecha || !this.reservaHora) {
      this.mostrarError('Por favor selecciona la fecha y hora de tu cita.');
      return;
    }

    this.creandoReserva = true;
    this.reservaService.crearReserva({
      sucursal_id: Number(this.reservaSucursalId),
      fecha_reserva: this.reservaFecha,
      horario_atencion: this.reservaHora + ':00',
      items: [
        {
          variante_id: this.selectedVariante.id,
          cantidad: Number(this.reservaCantidad)
        }
      ]
    }).subscribe({
      next: (res) => {
        this.creandoReserva = false;
        this.mostrarFormReserva = false;
        this.mostrarExito(`¡Reserva creada exitosamente! Código: ${res.codigo_reserva}`);
        setTimeout(() => {
          this.router.navigate(['/mis-reservas']);
        }, 1500);
      },
      error: (err) => {
        this.creandoReserva = false;
        const backendMsg = err.error?.detail;
        if (backendMsg && backendMsg.toLowerCase().includes('no disponible')) {
          this.mostrarError('La prenda seleccionada no está disponible en esa sucursal.');
        } else {
          this.mostrarError(backendMsg || 'No se pudo crear la reserva.');
        }
      }
    });
  }
}
