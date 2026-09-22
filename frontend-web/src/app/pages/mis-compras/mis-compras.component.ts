import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VentaService } from '../../services/venta.service';

@Component({
  selector: 'app-mis-compras',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container py-10">
      <div class="flex items-center justify-between mb-6 pb-4" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h1 class="font-serif text-3xl font-bold flex items-center gap-3" style="color: var(--text-main);">
            <i class="fa-solid fa-bag-shopping" style="color: var(--accent);"></i> Mis Compras & Pedidos
          </h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">
            Historial de tus compras realizadas en web o en tiendas físicas
          </p>
        </div>
        <a routerLink="/catalogo" class="btn btn-outline" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
          <i class="fa-solid fa-shirt"></i> Seguir Comprando
        </a>
      </div>

      <div *ngIf="loading" class="text-center py-16">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
        <p class="text-sm mt-3" style="color: var(--text-muted);">Cargando tu historial de compras...</p>
      </div>

      <div *ngIf="!loading && compras.length === 0" class="card text-center py-16 px-4">
        <div style="font-size: 3.5rem; color: var(--text-muted); margin-bottom: 1rem; opacity: 0.5;">
          <i class="fa-solid fa-bag-shopping"></i>
        </div>
        <h2 class="font-serif text-2xl font-bold mb-2" style="color: var(--text-main);">No tienes compras registradas</h2>
        <p class="text-sm mb-6 max-w-md mx-auto" style="color: var(--text-muted);">
          Explora nuestra colección y adquiere las mejores prendas con entrega a domicilio o retiro en tienda.
        </p>
        <a routerLink="/catalogo" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem;">
          <i class="fa-solid fa-shirt"></i> Ir al Catálogo
        </a>
      </div>

      <div *ngIf="!loading && compras.length > 0" class="flex flex-col gap-7">
        <div *ngFor="let c of compras" class="card p-6">
          <div class="flex flex-wrap items-center justify-between gap-5">
            <div class="flex items-center gap-3.5">
              <span style="font-size: 1.6rem; color: var(--accent);">
                <i class="fa-solid fa-receipt"></i>
              </span>
              <div>
                <span class="font-bold text-base block" style="color: var(--text-main);">
                  Orden #{{ c.id }}
                  <span *ngIf="c.numero_comprobante" class="font-mono text-xs ml-2" style="color: var(--text-muted);">({{ c.numero_comprobante }})</span>
                </span>
                <span class="text-xs mt-0.5 block" style="color: var(--text-muted);">
                  <i class="fa-regular fa-clock mr-1"></i> {{ c.fecha | date:'dd/MM/yyyy HH:mm' }} • Modalidad: <strong style="color: var(--text-main); text-transform: capitalize;">{{ c.tipo }}</strong>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-5">
              <span 
                class="badge" 
                [style.background]="c.estado === 'completada' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'"
                [style.color]="c.estado === 'completada' ? '#22c55e' : '#f59e0b'"
                [style.border]="'1px solid ' + (c.estado === 'completada' ? '#22c55e' : '#f59e0b')"
                style="padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 700; text-transform: uppercase;"
              >
                {{ c.estado }}
              </span>

              <span class="font-serif text-lg font-bold" style="color: var(--accent); min-width: 100px; text-align: right;">
                Bs. {{ c.total | number:'1.2-2' }}
              </span>

              <button 
                (click)="toggleDetalle(c.id)" 
                class="btn btn-outline" 
                style="padding: 0.4rem 0.8rem; font-size: 0.8rem;"
              >
                <i class="fa-solid" [class.fa-chevron-up]="compraExpandida === c.id" [class.fa-chevron-down]="compraExpandida !== c.id"></i>
              </button>
            </div>
          </div>

          <div *ngIf="compraExpandida === c.id" class="mt-6 pt-6" style="border-top: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase tracking-wider mb-4" style="color: var(--text-muted);">Prendas Adquiridas:</h4>
            <div class="flex flex-col gap-3.5">
              <div *ngFor="let item of c.items" class="flex flex-wrap items-center justify-between p-4 rounded-xl gap-4" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
                
                <div class="flex items-center gap-4">
                  <img 
                    [src]="item.imagen_url || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=150'" 
                    [alt]="item.producto" 
                    referrerpolicy="no-referrer"
                    style="width: 58px; height: 58px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border-color); flex-shrink: 0;"
                  />
                  <div>
                    <strong class="font-serif block text-sm font-bold" style="color: var(--text-main);">{{ item.producto }}</strong>
                    
                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                      <!-- Badge de Talla -->
                      <span class="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-color); color: var(--text-main);">
                        Talla: <strong class="ml-1" style="color: var(--accent); font-weight: 700;">{{ item.talla }}</strong>
                      </span>

                      <!-- Badge de Color con Muestra Visual -->
                      <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-color); color: var(--text-main);">
                        <span 
                          [style.background-color]="item.color_hex" 
                          style="width: 11px; height: 11px; border-radius: 50%; display: inline-block; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 1px 3px rgba(0,0,0,0.3);"
                        ></span>
                        <span>Color: <strong style="color: var(--text-main); font-weight: 700;">{{ item.color }}</strong></span>
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-5 text-right">
                  <span class="text-xs" style="color: var(--text-muted);">{{ item.cantidad }} ud. x Bs. {{ item.precio_unitario | number:'1.2-2' }}</span>
                  <strong class="font-serif text-sm" style="color: var(--accent); min-width: 85px;">Bs. {{ (item.cantidad * item.precio_unitario) | number:'1.2-2' }}</strong>
                </div>

              </div>
            </div>

            <div *ngIf="c.estado === 'pendiente_pago'" class="mt-3 flex justify-end">
              <a [routerLink]="['/pago', c.id]" class="btn btn-primary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                <i class="fa-solid fa-credit-card"></i> Pagar Orden Pendiente
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MisComprasComponent implements OnInit {
  private ventaService = inject(VentaService);

  compras: any[] = [];
  loading: boolean = true;
  compraExpandida: number | null = null;

  ngOnInit(): void {
    this.cargarCompras();
  }

  cargarCompras(): void {
    this.loading = true;
    this.ventaService.getMisCompras().subscribe({
      next: (data) => {
        this.compras = data || [];
        this.loading = false;
        if (this.compras.length > 0) {
          this.compraExpandida = this.compras[0].id;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  toggleDetalle(id: number): void {
    this.compraExpandida = this.compraExpandida === id ? null : id;
  }
}
