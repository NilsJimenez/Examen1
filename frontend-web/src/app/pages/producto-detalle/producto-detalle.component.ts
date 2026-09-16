import { Component, OnInit, inject, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { CarritoService } from '../../services/carrito.service';
import { ReservaService } from '../../services/reserva.service';
import { InventarioService } from '../../services/inventario.service';
import { AuthService } from '../../services/auth.service';
import { Producto, Variante } from '../../models/producto.models';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Toast Flotante de Error en Esquina Superior Derecha -->
    <div 
      *ngIf="errorMessage" 
      class="animate-slide-in"
      style="
        position: fixed;
        top: 88px;
        right: 24px;
        z-index: 99999;
        max-width: 400px;
        background: #18181b;
        color: #f4f4f5;
        border: 1.5px solid #ef4444;
        box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 25px rgba(239,68,68,0.25);
        border-radius: 12px;
        padding: 1rem 1.25rem;
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
      "
    >
      <div style="color: #ef4444; font-size: 1.35rem; line-height: 1; margin-top: 1px;">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>
      <div style="flex: 1;">
        <h5 style="font-weight: 700; font-size: 0.9rem; margin: 0 0 3px 0; color: #ef4444;">Sin Disponibilidad</h5>
        <p style="font-size: 0.82rem; margin: 0; color: #d4d4d8; line-height: 1.4;">{{ errorMessage }}</p>
      </div>
      <button 
        (click)="errorMessage = ''" 
        style="background: none; border: none; color: #a1a1aa; cursor: pointer; padding: 2px; font-size: 1rem;"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Toast Flotante de Exito en Esquina Superior Derecha -->
    <div 
      *ngIf="successMessage" 
      class="animate-slide-in"
      style="
        position: fixed;
        top: 88px;
        right: 24px;
        z-index: 99999;
        max-width: 400px;
        background: #18181b;
        color: #f4f4f5;
        border: 1.5px solid #22c55e;
        box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 25px rgba(34,197,94,0.25);
        border-radius: 12px;
        padding: 1rem 1.25rem;
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
      "
    >
      <div style="color: #22c55e; font-size: 1.35rem; line-height: 1; margin-top: 1px;">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <div style="flex: 1;">
        <h5 style="font-weight: 700; font-size: 0.9rem; margin: 0 0 3px 0; color: #22c55e;">Operacion Exitosa</h5>
        <p style="font-size: 0.82rem; margin: 0; color: #d4d4d8; line-height: 1.4;">{{ successMessage }}</p>
        <div *ngIf="mostrarLinkCarrito" class="mt-2.5">
          <a routerLink="/carrito" class="btn btn-primary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; display: inline-flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-cart-shopping"></i> Ver en el Carrito
          </a>
        </div>
      </div>
      <button 
        (click)="successMessage = ''" 
        style="background: none; border: none; color: #a1a1aa; cursor: pointer; padding: 2px; font-size: 1rem;"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="container py-10" *ngIf="producto; else loadingTpl">
      
      <!-- Migas de Pan (Breadcrumbs) -->
      <nav class="flex items-center gap-2 text-sm mb-6" style="color: var(--text-muted);">
        <a routerLink="/catalogo" class="hover:underline" style="color: var(--text-muted);">Catálogo</a>
        <span>/</span>
        <span>{{ producto.categoria?.nombre }}</span>
        <span>/</span>
        <span class="font-semibold" style="color: var(--text-main);">{{ producto.nombre }}</span>
      </nav>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
        
        <!-- Columna Izquierda: Visualizador 3D / AR y Fotografia -->
        <div class="flex flex-col gap-4">
          
          <div class="card viewer-container">
            <!-- Pestanas de Vista: Foto vs Modelo 3D AR -->
            <div class="viewer-tabs">
              <button 
                (click)="vistaActiva = 'foto'" 
                [class.tab-active]="vistaActiva === 'foto'" 
                class="tab-btn"
              >
                <i class="fa-regular fa-image"></i> Fotografía
              </button>
              <button 
                *ngIf="producto.modelo_ar_url" 
                (click)="vistaActiva = 'ar'" 
                [class.tab-active]="vistaActiva === 'ar'" 
                class="tab-btn"
              >
                <i class="fa-solid fa-cube"></i> Vestidor 3D / AR
              </button>
            </div>

            <!-- Vista Fotografia -->
            <div *ngIf="vistaActiva === 'foto'" class="image-box" style="position: relative;">
              <!-- Etiqueta Flotante de Disponibilidad sobre la Imagen -->
              <div 
                style="
                  position: absolute;
                  top: 14px;
                  left: 14px;
                  z-index: 20;
                  backdrop-filter: blur(12px);
                  background: rgba(24, 24, 27, 0.88);
                  border: 1px solid var(--border-color);
                  border-radius: 9999px;
                  padding: 0.4rem 0.95rem;
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                "
              >
                <span 
                  style="width: 8px; height: 8px; border-radius: 50%; display: inline-block;"
                  [style.background-color]="stockActualSucursal > 0 ? '#22c55e' : '#ef4444'"
                ></span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #f4f4f5;">
                  {{ sucursalActualNombre }}:
                </span>
                <span 
                  style="font-size: 0.75rem; font-weight: 800;"
                  [style.color]="stockActualSucursal > 0 ? '#22c55e' : '#ef4444'"
                >
                  {{ stockActualSucursal > 0 ? stockActualSucursal + ' prendas disponibles' : 'Agotado en esta tienda' }}
                </span>
              </div>

              <img [src]="producto.imagen_url" [alt]="producto.nombre" class="main-image" />
            </div>

            <!-- Vista 3D / Realidad Aumentada (Google Model-Viewer) -->
            <div *ngIf="vistaActiva === 'ar'" class="ar-box" style="position: relative;">
              <!-- Etiqueta Flotante de Disponibilidad sobre el Visor 3D -->
              <div 
                style="
                  position: absolute;
                  top: 14px;
                  left: 14px;
                  z-index: 20;
                  backdrop-filter: blur(12px);
                  background: rgba(24, 24, 27, 0.88);
                  border: 1px solid var(--border-color);
                  border-radius: 9999px;
                  padding: 0.4rem 0.95rem;
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                "
              >
                <span 
                  style="width: 8px; height: 8px; border-radius: 50%; display: inline-block;"
                  [style.background-color]="stockActualSucursal > 0 ? '#22c55e' : '#ef4444'"
                ></span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #f4f4f5;">
                  {{ sucursalActualNombre }}:
                </span>
                <span 
                  style="font-size: 0.75rem; font-weight: 800;"
                  [style.color]="stockActualSucursal > 0 ? '#22c55e' : '#ef4444'"
                >
                  {{ stockActualSucursal > 0 ? stockActualSucursal + ' prendas disponibles' : 'Agotado en esta tienda' }}
                </span>
              </div>

              <model-viewer
                [src]="producto.modelo_ar_url"
                alt="Modelo 3D de la prenda"
                ar
                ar-modes="webxr scene-viewer quick-look"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                style="width: 100%; height: 420px; background-color: var(--table-th-bg);"
              >
                <button slot="ar-button" class="btn btn-accent ar-activate-btn">
                  <i class="fa-solid fa-camera"></i> Probar en tu Cámara (AR)
                </button>
              </model-viewer>
              <div class="text-center p-2 text-xs" style="color: var(--text-muted);">
                <i class="fa-solid fa-arrows-rotate"></i> Haz clic y arrastra para rotar en 360°. En móviles, presiona "Probar en tu Cámara".
              </div>
            </div>

          </div>

        </div>

        <!-- Columna Derecha: Informacion, Tallas, Colores y Acciones -->
        <div class="flex flex-col justify-between">
          
          <div>
            <div class="flex items-center justify-between gap-3 mb-2">
              <span class="badge" style="background-color: var(--table-th-bg); color: var(--text-muted); border: 1px solid var(--border-color);">
                {{ producto.categoria?.nombre }}
              </span>

              <!-- Selector Rapido de Sucursal / Tienda -->
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold" style="color: var(--text-muted);">
                  <i class="fa-solid fa-location-dot" style="color: var(--accent);"></i> Tienda:
                </span>
                <select 
                  [(ngModel)]="sucursalSeleccionadaId" 
                  (change)="onCambiarSucursal()" 
                  class="form-input" 
                  style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; font-weight: 600;"
                >
                  <option *ngFor="let s of stockSucursales" [value]="s.sucursal_id">
                    {{ s.sucursal_nombre }} ({{ s.stock_libre }} uds.)
                  </option>
                </select>
              </div>
            </div>

            <h1 class="font-serif text-3xl font-bold mb-3" style="color: var(--text-main);">
              {{ producto.nombre }}
            </h1>

            <div class="flex items-baseline gap-3 mb-6">
              <span class="text-3xl font-extrabold" style="color: var(--accent);">
                Bs. {{ producto.precio_base | number:'1.2-2' }}
              </span>
              
              <!-- Badge de Disponibilidad segun la Tienda Elegida -->
              <span 
                class="badge" 
                [style.background]="stockActualSucursal > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'" 
                [style.color]="stockActualSucursal > 0 ? '#22c55e' : '#ef4444'" 
                [style.border]="'1px solid ' + (stockActualSucursal > 0 ? '#22c55e' : '#ef4444')" 
                style="font-size: 0.75rem; font-weight: 700;"
              >
                <i class="fa-solid" [class.fa-check]="stockActualSucursal > 0" [class.fa-xmark]="stockActualSucursal <= 0"></i>
                {{ stockActualSucursal > 0 ? stockActualSucursal + ' disponibles en ' + sucursalActualNombre : 'Agotado en ' + sucursalActualNombre }}
              </span>
            </div>

            <p class="leading-relaxed mb-6 text-sm" style="color: var(--text-muted);">
              {{ producto.descripcion }}
            </p>

            <!-- Selector de Variantes (Tallas y Colores) -->
            <div *ngIf="producto.variantes && producto.variantes.length > 0" class="mb-6 card p-4">
              <h4 class="font-bold text-sm mb-3" style="color: var(--text-main);">Selecciona tu Talla y Color:</h4>
              <div class="flex flex-wrap gap-2">
                <button 
                  *ngFor="let v of producto.variantes"
                  (click)="seleccionarVariante(v)"
                  [class.variante-active]="selectedVariante?.id === v.id"
                  class="variante-chip"
                >
                  <span class="color-dot" [style.background-color]="v.color.codigo_hex || '#000'"></span>
                  Talla {{ v.talla.nombre }} - {{ v.color.nombre }}
                </button>
              </div>
              <div *ngIf="selectedVariante" class="mt-3 text-xs flex items-center justify-between" style="color: var(--text-muted);">
                <span>Código SKU: <code style="color: var(--text-main);">{{ selectedVariante.sku }}</code></span>
                <button 
                  (click)="consultarStockPorSucursal()" 
                  class="btn btn-outline" 
                  style="padding: 0.25rem 0.6rem; font-size: 0.75rem;"
                >
                  <i class="fa-solid fa-shop"></i> {{ mostrarStock ? 'Ocultar Resumen' : 'Ver Todas las Tiendas' }}
                </button>
              </div>
            </div>

            <!-- CU-11: Despliegue de Stock de Todas las Sucursales -->
            <div *ngIf="mostrarStock" class="mb-6 card p-4 animate-fade-in" style="background: var(--table-th-bg);">
              <h4 class="font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-boxes-stacked" style="color: var(--accent);"></i> Disponibilidad en Todas las Tiendas:
              </h4>

              <div *ngIf="loadingStock" class="text-center py-4 text-xs" style="color: var(--text-muted);">
                <i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Consultando existencias...
              </div>

              <div *ngIf="!loadingStock && stockSucursales.length === 0" class="text-xs" style="color: var(--text-muted);">
                No se encontraron datos de stock para esta variante.
              </div>

              <div *ngIf="!loadingStock && stockSucursales.length > 0" class="flex flex-col gap-2">
                <div *ngFor="let s of stockSucursales" class="p-2.5 rounded-lg flex items-center justify-between text-xs" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                  <div>
                    <strong style="color: var(--text-main);">{{ s.sucursal_nombre }}</strong>
                    <span class="block" style="color: var(--text-muted);">{{ s.stock_libre }} unidades disponibles</span>
                  </div>
                  <span 
                    class="badge" 
                    [style.background]="s.estado === 'disponible' ? 'rgba(34,197,94,0.15)' : (s.estado === 'ultimas_unidades' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)')"
                    [style.color]="s.estado === 'disponible' ? '#22c55e' : (s.estado === 'ultimas_unidades' ? '#f59e0b' : '#ef4444')"
                    style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase;"
                  >
                    {{ s.estado === 'ultimas_unidades' ? 'Últimas Uds.' : s.estado }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Formulario Desplegable para Reservar en Vestidor -->
            <div *ngIf="mostrarFormReserva" class="mb-6 card p-4 animate-fade-in" style="border: 1.5px solid var(--accent); background: var(--table-th-bg);">
              <h4 class="font-bold text-sm mb-3 flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-calendar-check" style="color: var(--accent);"></i> Agendar Cita en Probador:
              </h4>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.75rem;">Sucursal para Probarte</label>
                  <select [(ngModel)]="reservaSucursalId" (change)="onCambiarSucursalReserva()" class="form-input" style="padding: 0.4rem; font-size: 0.8rem;">
                    <option *ngFor="let suc of stockSucursales" [value]="suc.sucursal_id" [disabled]="suc.stock_libre <= 0">
                      {{ suc.sucursal_nombre }} — {{ suc.stock_libre > 0 ? '(' + suc.stock_libre + ' disponibles)' : '(Agotado)' }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-size: 0.75rem;">Fecha de Visita</label>
                  <input type="date" [(ngModel)]="reservaFecha" class="form-input" style="padding: 0.4rem; font-size: 0.8rem;" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div class="form-group">
                  <label class="form-label" style="font-size: 0.75rem;">Horario Estimado</label>
                  <input type="time" [(ngModel)]="reservaHora" class="form-input" style="padding: 0.4rem; font-size: 0.8rem;" />
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-size: 0.75rem;">Prendas a Apartar</label>
                  <input type="number" [(ngModel)]="reservaCantidad" min="1" [max]="stockSucursalReserva || 1" class="form-input" style="padding: 0.4rem; font-size: 0.8rem;" />
                </div>
              </div>

              <div class="flex gap-2">
                <button (click)="confirmarReserva()" [disabled]="creandoReserva" class="btn btn-primary" style="flex: 1; padding: 0.5rem; font-size: 0.85rem;">
                  <span *ngIf="creandoReserva"><i class="fa-solid fa-circle-notch fa-spin"></i> Agendando...</span>
                  <span *ngIf="!creandoReserva"><i class="fa-solid fa-check"></i> Confirmar Reserva con Pase QR</span>
                </button>
                <button (click)="mostrarFormReserva = false" class="btn btn-outline" style="padding: 0.5rem 0.8rem; font-size: 0.85rem;">
                  Cancelar
                </button>
              </div>
            </div>

          </div>

          <!-- Botones de Accion de Compra y Reserva -->
          <div class="flex flex-col gap-3 pt-6 border-t" style="border-color: var(--border-color);">
            
            <!-- Boton 1: Reservar para probarse en tienda fisica -->
            <button 
              (click)="abrirReserva()" 
              class="btn btn-accent" 
              style="padding: 0.85rem; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
            >
              <i class="fa-solid fa-calendar-check"></i> Reservar para Probar en Tienda Física (Pase QR)
            </button>

            <!-- Boton 2: Agregar al Carrito Digital -->
            <button 
              (click)="agregarAlCarrito()" 
              [disabled]="agregandoCarrito" 
              class="btn btn-primary" 
              style="padding: 0.85rem; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
            >
              <span *ngIf="agregandoCarrito"><i class="fa-solid fa-circle-notch fa-spin"></i> Agregando...</span>
              <span *ngIf="!agregandoCarrito"><i class="fa-solid fa-cart-plus"></i> Agregar al Carrito Digital</span>
            </button>

            <a routerLink="/catalogo" class="btn btn-outline text-center mt-2">
              <i class="fa-solid fa-arrow-left"></i> Volver al Catálogo
            </a>

          </div>

        </div>

      </div>

    </div>

    <!-- Plantilla de Carga -->
    <ng-template #loadingTpl>
      <div class="container py-24 text-center">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--accent);"></i>
        <p class="mt-4" style="color: var(--text-muted);">Cargando prenda y modelo 3D...</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .viewer-container {
      overflow: hidden;
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
    }
    .viewer-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
    }
    .tab-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      border: none;
      background: var(--table-th-bg);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }
    .tab-active {
      background: var(--card-bg);
      color: var(--text-main);
      border-bottom: 2px solid var(--accent);
    }
    .image-box {
      width: 100%;
      height: 420px;
      overflow: hidden;
    }
    .main-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ar-box {
      position: relative;
    }
    .ar-activate-btn {
      position: absolute;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .variante-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.85rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: var(--card-bg);
      color: var(--text-main);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .variante-active {
      border-color: var(--accent) !important;
      background: var(--primary) !important;
      color: var(--primary-text) !important;
    }
    .color-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }
    .animate-slide-in {
      animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class ProductoDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productoService = inject(ProductoService);
  private carritoService = inject(CarritoService);
  private reservaService = inject(ReservaService);
  private inventarioService = inject(InventarioService);
  private authService = inject(AuthService);

  producto: Producto | null = null;
  selectedVariante: Variante | null = null;
  vistaActiva: 'foto' | 'ar' = 'foto';

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

  // CU-14: Reserva
  mostrarFormReserva: boolean = false;
  creandoReserva: boolean = false;
  reservaSucursalId: number = 1;
  reservaFecha: string = '';
  reservaHora: string = '15:00';
  reservaCantidad: number = 1;

  get sucursalActualNombre(): string {
    const s = this.stockSucursales.find(item => item.sucursal_id === Number(this.sucursalSeleccionadaId));
    return s ? s.sucursal_nombre : 'Sucursal';
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
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.cargarProducto(+idParam);
    }

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    this.reservaFecha = manana.toISOString().split('T')[0];
  }

  cargarProducto(id: number): void {
    this.productoService.getProductoById(id).subscribe({
      next: (data) => {
        this.producto = data;
        if (data.variantes && data.variantes.length > 0) {
          this.selectedVariante = data.variantes[0];
          this.cargarStockVariante(this.selectedVariante.id);
        }
      },
      error: (err) => console.error('Error cargando producto:', err)
    });
  }

  seleccionarVariante(v: Variante): void {
    this.selectedVariante = v;
    this.cargarStockVariante(v.id);
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

  consultarStockPorSucursal(): void {
    this.mostrarStock = !this.mostrarStock;
  }

  mostrarError(msg: string): void {
    this.errorMessage = msg;
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.errorMessage = '';
    }, 6000);
  }

  mostrarExito(msg: string, conCarrito: boolean = false): void {
    this.successMessage = msg;
    this.mostrarLinkCarrito = conCarrito;
    if (this.successTimer) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => {
      this.successMessage = '';
    }, 6000);
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

    this.mostrarFormReserva = !this.mostrarFormReserva;
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
