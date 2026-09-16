import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CarritoService } from '../../services/carrito.service';
import { VentaService } from '../../services/venta.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container py-10">
      <div class="flex items-center justify-between mb-6 pb-4" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h1 class="font-serif text-3xl font-bold flex items-center gap-3" style="color: var(--text-main);">
            <i class="fa-solid fa-cart-shopping" style="color: var(--accent);"></i> Carrito de Compras
          </h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">
            Revisa tus prendas seleccionadas antes de proceder al pago seguro
          </p>
        </div>
        <button *ngIf="items.length > 0" (click)="vaciar()" class="btn btn-outline" style="font-size: 0.85rem; padding: 0.45rem 0.9rem;">
          <i class="fa-solid fa-trash"></i> Vaciar Carrito
        </button>
      </div>

      <div *ngIf="errorMessage" class="p-4 mb-4 rounded-lg flex items-center gap-2 text-sm" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
        <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
      </div>

      <div *ngIf="!loading && items.length === 0" class="card text-center py-16 px-4">
        <div style="font-size: 3.5rem; color: var(--text-muted); margin-bottom: 1rem; opacity: 0.5;">
          <i class="fa-solid fa-cart-shopping"></i>
        </div>
        <h2 class="font-serif text-2xl font-bold mb-2" style="color: var(--text-main);">Tu carrito está vacío</h2>
        <p class="text-sm mb-6 max-w-md mx-auto" style="color: var(--text-muted);">
          Aún no has agregado ninguna prenda a tu carrito. Explora nuestro catálogo y pruébate prendas en Realidad Aumentada.
        </p>
        <a routerLink="/catalogo" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem;">
          <i class="fa-solid fa-shirt"></i> Explorar Catálogo
        </a>
      </div>

      <div *ngIf="loading" class="text-center py-16">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
        <p class="text-sm mt-3" style="color: var(--text-muted);">Cargando tu carrito...</p>
      </div>

      <div *ngIf="!loading && items.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div *ngFor="let item of items" class="card p-4 flex items-center justify-between gap-4">
            <div class="flex items-center gap-4 min-w-0">
              <img 
                [src]="item.imagen_url || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=200'" 
                [alt]="item.producto" 
                style="width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);"
              />
              <div class="min-w-0">
                <h3 class="font-serif font-bold text-base truncate" style="color: var(--text-main);">{{ item.producto }}</h3>
                <div class="flex items-center gap-2 mt-1 text-xs" style="color: var(--text-muted);">
                  <span>Talla: <strong style="color: var(--text-main);">{{ item.talla }}</strong></span>
                  <span>•</span>
                  <span class="flex items-center gap-1">
                    Color:
                    <span [style.background-color]="item.color_hex" style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--border-color);"></span>
                    <strong style="color: var(--text-main);">{{ item.color }}</strong>
                  </span>
                </div>
                <div class="text-xs mt-1" style="color: var(--text-muted);">
                  SKU: <code>{{ item.sku }}</code>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-6 flex-shrink-0">
              <div class="flex items-center gap-2">
                <button 
                  (click)="cambiarCantidad(item, item.cantidad - 1)" 
                  class="btn btn-outline" 
                  style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"
                  title="Disminuir"
                >
                  <i class="fa-solid fa-minus"></i>
                </button>
                <span class="font-bold text-sm px-2" style="color: var(--text-main); min-width: 24px; text-align: center;">{{ item.cantidad }}</span>
                <button 
                  (click)="cambiarCantidad(item, item.cantidad + 1)" 
                  class="btn btn-outline" 
                  style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"
                  title="Aumentar"
                >
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>

              <div class="text-right" style="min-width: 90px;">
                <span class="block text-xs" style="color: var(--text-muted);">Bs. {{ item.precio_unitario | number:'1.2-2' }} c/u</span>
                <span class="font-serif font-bold text-base" style="color: var(--accent);">Bs. {{ item.subtotal | number:'1.2-2' }}</span>
              </div>

              <button 
                (click)="eliminar(item.id)" 
                style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 6px; font-size: 1rem; opacity: 0.8;"
                title="Eliminar prenda"
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <div class="card p-6 flex flex-col gap-5 sticky top-24">
            <h2 class="font-serif text-xl font-bold pb-3" style="color: var(--text-main); border-bottom: 1px solid var(--border-color);">
              Resumen de Compra
            </h2>

            <div>
              <label class="form-label mb-2">Método de Entrega</label>
              <div class="flex flex-col gap-2">
                <label 
                  class="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
                  [style.border]="metodoEntrega === 'retiro_tienda' ? '1.5px solid var(--accent)' : '1px solid var(--border-color)'"
                  [style.background]="metodoEntrega === 'retiro_tienda' ? 'rgba(245,158,11,0.08)' : 'var(--card-bg)'"
                >
                  <input type="radio" name="metodoEntrega" value="retiro_tienda" [(ngModel)]="metodoEntrega" />
                  <div class="text-sm">
                    <span class="font-bold block" style="color: var(--text-main);">
                      <i class="fa-solid fa-shop mr-1" style="color: var(--accent);"></i> Retiro en Tienda
                    </span>
                    <span class="text-xs" style="color: var(--text-muted);">Gratis en cualquiera de nuestras sucursales</span>
                  </div>
                </label>

                <label 
                  class="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
                  [style.border]="metodoEntrega === 'delivery' ? '1.5px solid var(--accent)' : '1px solid var(--border-color)'"
                  [style.background]="metodoEntrega === 'delivery' ? 'rgba(245,158,11,0.08)' : 'var(--card-bg)'"
                >
                  <input type="radio" name="metodoEntrega" value="delivery" [(ngModel)]="metodoEntrega" />
                  <div class="text-sm">
                    <span class="font-bold block" style="color: var(--text-main);">
                      <i class="fa-solid fa-truck-fast mr-1" style="color: var(--accent);"></i> Envío a Domicilio (+Bs. 30.00)
                    </span>
                    <span class="text-xs" style="color: var(--text-muted);">Entrega en 24-48 horas a tu puerta</span>
                  </div>
                </label>
              </div>
            </div>

            <div *ngIf="metodoEntrega === 'delivery'" class="form-group">
              <label class="form-label">Dirección de Entrega</label>
              <input 
                type="text" 
                [(ngModel)]="direccionEnvio" 
                placeholder="Calle, Número, Zona o Edificio" 
                class="form-input" 
              />
            </div>

            <div class="flex flex-col gap-2 pt-3 text-sm" style="border-top: 1px solid var(--border-color);">
              <div class="flex justify-between" style="color: var(--text-muted);">
                <span>Subtotal ({{ totalItems }} prendas)</span>
                <span class="font-semibold" style="color: var(--text-main);">Bs. {{ subtotal | number:'1.2-2' }}</span>
              </div>
              <div class="flex justify-between" style="color: var(--text-muted);">
                <span>Costo de Envío</span>
                <span class="font-semibold" style="color: var(--text-main);">
                  {{ metodoEntrega === 'delivery' ? 'Bs. 30.00' : 'Gratis' }}
                </span>
              </div>
              <div class="flex justify-between text-base font-bold pt-2" style="border-top: 1px dashed var(--border-color); color: var(--text-main);">
                <span>Total a Pagar</span>
                <span class="font-serif text-xl" style="color: var(--accent);">
                  Bs. {{ (subtotal + (metodoEntrega === 'delivery' ? 30 : 0)) | number:'1.2-2' }}
                </span>
              </div>
            </div>

            <button 
              (click)="iniciarCheckout()" 
              [disabled]="checkoutLoading" 
              class="btn btn-primary" 
              style="width: 100%; padding: 0.85rem; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
            >
              <span *ngIf="checkoutLoading"><i class="fa-solid fa-circle-notch fa-spin"></i> Procesando Orden...</span>
              <span *ngIf="!checkoutLoading"><i class="fa-solid fa-credit-card"></i> Proceder al Pago Seguro</span>
            </button>

            <p class="text-xs text-center" style="color: var(--text-muted);">
              <i class="fa-solid fa-lock text-xs mr-1"></i> Transacción protegida con cifrado SSL de 256 bits
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CarritoComponent implements OnInit {
  private carritoService = inject(CarritoService);
  private ventaService = inject(VentaService);
  private authService = inject(AuthService);
  private router = inject(Router);

  items: any[] = [];
  subtotal: number = 0;
  totalItems: number = 0;
  loading: boolean = true;
  checkoutLoading: boolean = false;
  errorMessage: string = '';

  metodoEntrega: string = 'retiro_tienda';
  direccionEnvio: string = '';

  ngOnInit(): void {
    this.cargarCarrito();
  }

  cargarCarrito(): void {
    this.loading = true;
    this.carritoService.getCarrito().subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.subtotal = res.subtotal || 0;
        this.totalItems = res.total_items || 0;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Inicia sesión como cliente para ver tu carrito.';
        this.loading = false;
      }
    });
  }

  cambiarCantidad(item: any, nuevaCantidad: number): void {
    if (nuevaCantidad <= 0) {
      this.eliminar(item.id);
      return;
    }
    this.carritoService.actualizarItem(item.id, nuevaCantidad).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.subtotal = res.subtotal || 0;
        this.totalItems = res.total_items || 0;
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'No se pudo actualizar la cantidad.';
      }
    });
  }

  eliminar(itemId: number): void {
    this.carritoService.eliminarItem(itemId).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.subtotal = res.subtotal || 0;
        this.totalItems = res.total_items || 0;
      }
    });
  }

  vaciar(): void {
    this.carritoService.vaciarCarrito().subscribe({
      next: () => {
        this.items = [];
        this.subtotal = 0;
        this.totalItems = 0;
      }
    });
  }

  iniciarCheckout(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.metodoEntrega === 'delivery' && !this.direccionEnvio.trim()) {
      this.errorMessage = 'Por favor ingresa tu dirección para el envío a domicilio.';
      return;
    }

    this.checkoutLoading = true;
    this.errorMessage = '';

    this.ventaService.checkout({
      metodo_entrega: this.metodoEntrega,
      direccion_envio: this.metodoEntrega === 'delivery' ? this.direccionEnvio : undefined
    }).subscribe({
      next: (res) => {
        this.checkoutLoading = false;
        this.router.navigate(['/pago', res.venta_id]);
      },
      error: (err) => {
        this.checkoutLoading = false;
        this.errorMessage = err.error?.detail || 'Error al iniciar el checkout.';
      }
    });
  }
}
