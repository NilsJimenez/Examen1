import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VentaService } from '../../services/venta.service';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container py-12 flex justify-center">
      <div class="card p-8" style="max-width: 640px; width: 100%;">
        
        <div *ngIf="pagoExitoso" class="text-center py-6">
          <div style="font-size: 4rem; color: #22c55e; margin-bottom: 1rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <h2 class="font-serif text-2xl font-bold mb-2" style="color: var(--text-main);">
            ¡Pago Aprobado Exitosamente!
          </h2>
          <p class="text-sm mb-6" style="color: var(--text-muted);">
            Tu compra ha sido procesada de forma segura y el stock de las prendas se ha descontado de nuestro inventario.
          </p>

          <div class="p-5 rounded-2xl text-left mb-6" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <div class="flex justify-between py-1.5 text-xs" style="color: var(--text-muted);">
              <span>Número de Comprobante:</span>
              <strong class="font-mono" style="color: var(--text-main);">{{ comprobanteNumero }}</strong>
            </div>
            <div class="flex justify-between py-1.5 text-xs" style="color: var(--text-muted);">
              <span>ID de Orden:</span>
              <strong style="color: var(--text-main);">#{{ ventaId }}</strong>
            </div>
            <div class="flex justify-between py-1.5 text-xs" style="color: var(--text-muted);">
              <span>Total Pagado:</span>
              <strong class="font-serif text-base" style="color: var(--accent);">Bs. {{ monto | number:'1.2-2' }}</strong>
            </div>
            <div class="flex justify-between py-1.5 text-xs" style="color: var(--text-muted);">
              <span>Estado:</span>
              <span class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid #22c55e; font-size: 0.7rem;">COMPLETADA</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <a routerLink="/mis-compras" class="btn btn-primary" style="flex: 1; padding: 0.85rem; text-align: center;">
              <i class="fa-solid fa-bag-shopping"></i> Ver Mis Compras
            </a>
            <a routerLink="/catalogo" class="btn btn-outline" style="flex: 1; padding: 0.85rem; text-align: center;">
              <i class="fa-solid fa-shirt"></i> Seguir Comprando
            </a>
          </div>
        </div>

        <div *ngIf="!pagoExitoso">
          <div class="text-center mb-7">
            <span style="font-size: 2.2rem; color: var(--accent);"><i class="fa-solid fa-shield-halved"></i></span>
            <h2 class="font-serif text-2xl font-bold mt-2" style="color: var(--text-main);">Pasarela de Pago Segura</h2>
            <p class="text-xs mt-1" style="color: var(--text-muted);">
              Procesa el pago de tu orden <strong style="color: var(--text-main);">#{{ ventaId }}</strong>
            </p>
          </div>

          <div *ngIf="errorMessage" class="p-4 mb-5 rounded-xl text-sm flex items-center gap-2" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
            <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
          </div>

          <div class="mb-6">
            <label class="form-label mb-3">Selecciona tu Método de Pago</label>
            <div class="grid grid-cols-2 gap-4">
              <button 
                type="button"
                (click)="metodoPago = 'tarjeta_credito'" 
                class="p-4 rounded-xl text-left flex items-center gap-3"
                [style.border]="metodoPago === 'tarjeta_credito' ? '1.5px solid var(--accent)' : '1px solid var(--border-color)'"
                [style.background]="metodoPago === 'tarjeta_credito' ? 'rgba(245,158,11,0.1)' : 'var(--card-bg)'"
              >
                <i class="fa-solid fa-credit-card text-base" style="color: var(--accent);"></i>
                <span class="text-xs font-bold" style="color: var(--text-main);">Crédito / Débito</span>
              </button>

              <button 
                type="button"
                (click)="metodoPago = 'qr'" 
                class="p-4 rounded-xl text-left flex items-center gap-3"
                [style.border]="metodoPago === 'qr' ? '1.5px solid var(--accent)' : '1px solid var(--border-color)'"
                [style.background]="metodoPago === 'qr' ? 'rgba(245,158,11,0.1)' : 'var(--card-bg)'"
              >
                <i class="fa-solid fa-qrcode text-base" style="color: var(--accent);"></i>
                <span class="text-xs font-bold" style="color: var(--text-main);">Pago QR Simple</span>
              </button>

              <button 
                type="button"
                (click)="metodoPago = 'transferencia'" 
                class="p-4 rounded-xl text-left flex items-center gap-3"
                [style.border]="metodoPago === 'transferencia' ? '1.5px solid var(--accent)' : '1px solid var(--border-color)'"
                [style.background]="metodoPago === 'transferencia' ? 'rgba(245,158,11,0.1)' : 'var(--card-bg)'"
              >
                <i class="fa-solid fa-building-columns text-base" style="color: var(--accent);"></i>
                <span class="text-xs font-bold" style="color: var(--text-main);">Transferencia</span>
              </button>

              <button 
                type="button"
                (click)="metodoPago = 'efectivo'" 
                class="p-4 rounded-xl text-left flex items-center gap-3"
                [style.border]="metodoPago === 'efectivo' ? '1.5px solid var(--accent)' : '1px solid var(--border-color)'"
                [style.background]="metodoPago === 'efectivo' ? 'rgba(245,158,11,0.1)' : 'var(--card-bg)'"
              >
                <i class="fa-solid fa-money-bill-wave text-base" style="color: var(--accent);"></i>
                <span class="text-xs font-bold" style="color: var(--text-main);">Efectivo al Retirar</span>
              </button>
            </div>
          </div>

          <div *ngIf="metodoPago === 'tarjeta_credito' || metodoPago === 'tarjeta_debito'" class="flex flex-col gap-4 mb-6 p-6 rounded-2xl" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <div class="form-group mb-0">
              <label class="form-label">Número de Tarjeta</label>
              <input type="text" [(ngModel)]="numTarjeta" placeholder="4532 •••• •••• 8890" class="form-input" />
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Titular de la Tarjeta</label>
              <input type="text" [(ngModel)]="titular" placeholder="Juan Pérez" class="form-input" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group mb-0">
                <label class="form-label">Expiración</label>
                <input type="text" [(ngModel)]="expiracion" placeholder="MM/AA" class="form-input" />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">CVV</label>
                <input type="password" [(ngModel)]="cvv" placeholder="•••" maxlength="4" class="form-input" />
              </div>
            </div>
          </div>

          <div *ngIf="metodoPago === 'qr'" class="text-center p-7 rounded-2xl mb-6" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <i class="fa-solid fa-qrcode text-6xl" style="color: var(--accent); margin-bottom: 0.75rem;"></i>
            <p class="text-xs font-bold mb-1" style="color: var(--text-main);">Código QR de Pago Habilitado</p>
            <p class="text-xs" style="color: var(--text-muted);">Al confirmar el pago se validará instantáneamente mediante el servicio bancario</p>
          </div>

          <div class="form-group mb-6">
            <label class="form-label">Monto a Pagar (Bs.)</label>
            <input type="number" [(ngModel)]="monto" class="form-input font-bold font-serif text-lg" style="color: var(--accent);" />
          </div>

          <button 
            (click)="procesarPago()" 
            [disabled]="loading" 
            class="btn btn-primary" 
            style="width: 100%; padding: 0.85rem; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
          >
            <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Conectando con Pasarela...</span>
            <span *ngIf="!loading"><i class="fa-solid fa-lock"></i> Confirmar y Pagar Bs. {{ monto | number:'1.2-2' }}</span>
          </button>

          <p class="text-xs text-center mt-4" style="color: var(--text-muted);">
            <i class="fa-solid fa-circle-info mr-1"></i> Entorno de pruebas seguro FashionStore — Simulación de Pasarela
          </p>
        </div>

      </div>
    </div>
  `
})
export class PagoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ventaService = inject(VentaService);

  ventaId: number = 0;
  metodoPago: string = 'tarjeta_credito';
  monto: number = 190.00;
  loading: boolean = false;
  pagoExitoso: boolean = false;
  comprobanteNumero: string = '';
  errorMessage: string = '';

  numTarjeta: string = '4532 8901 2345 6789';
  titular: string = 'Cliente FashionStore';
  expiracion: string = '12/28';
  cvv: string = '789';

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.ventaId = Number(params['id']) || 1;
    });
  }

  procesarPago(): void {
    if (this.monto <= 0) {
      this.errorMessage = 'El monto debe ser mayor a 0.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.ventaService.pagarVenta(this.ventaId, {
      metodo_pago: this.metodoPago,
      monto: this.monto
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.pagoExitoso = true;
        this.comprobanteNumero = res.numero_comprobante || 'COMP-FS2026';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Error al procesar el pago.';
      }
    });
  }
}
