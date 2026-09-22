import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VentaService } from '../../services/venta.service';
import { CarritoService } from '../../services/carrito.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container py-10 flex justify-center">
      <div class="w-full" style="max-width: 820px;">

        <!-- PANTALLA: PAGO EXITOSO / COMPROBANTE -->
        <div *ngIf="pagoExitoso" class="card p-8 sm:p-10 text-center animate-fade-in">
          <div class="inline-flex items-center justify-center rounded-full mb-4" style="width: 80px; height: 80px; background: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 2.75rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <h2 class="font-serif text-3xl font-bold mb-2" style="color: var(--text-main);">
            ¡Pago Aprobado Exitosamente!
          </h2>
          <p class="text-sm max-w-md mx-auto mb-6" style="color: var(--text-muted);">
            Tu transacción fue verificada. El inventario ha sido actualizado y tu orden está siendo preparada para entrega.
          </p>

          <!-- Tarjeta de Comprobante -->
          <div class="p-6 rounded-2xl text-left mb-8 max-w-lg mx-auto" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <div class="flex items-center justify-between pb-3 mb-3" style="border-bottom: 1px solid var(--border-color);">
              <span class="text-xs uppercase tracking-wider font-bold" style="color: var(--accent);">
                <i class="fa-solid fa-receipt mr-1.5"></i> Comprobante Oficial
              </span>
              <span class="font-mono text-xs font-bold px-2 py-0.5 rounded" style="background: rgba(34, 197, 94, 0.2); color: #22c55e;">
                PAGADO
              </span>
            </div>

            <div class="flex flex-col gap-2.5 text-xs">
              <div class="flex justify-between" style="color: var(--text-muted);">
                <span>N° Comprobante:</span>
                <strong class="font-mono text-sm" style="color: var(--text-main);">{{ comprobanteNumero }}</strong>
              </div>
              <div class="flex justify-between" style="color: var(--text-muted);">
                <span>N° de Orden:</span>
                <strong style="color: var(--text-main);">#{{ ventaId }}</strong>
              </div>
              <div class="flex justify-between" style="color: var(--text-muted);">
                <span>Método de Pago:</span>
                <span class="capitalize font-semibold" style="color: var(--text-main);">{{ formatearMetodo(metodoPago) }}</span>
              </div>
              <div class="flex justify-between" style="color: var(--text-muted);">
                <span>Entrega:</span>
                <span class="font-semibold" style="color: var(--text-main);">{{ orden?.metodo_entrega === 'delivery' ? 'Envío a Domicilio' : 'Retiro en Tienda' }}</span>
              </div>
              <div class="flex justify-between pt-3 text-sm font-bold" style="border-top: 1px dashed var(--border-color); color: var(--text-main);">
                <span>Total Pagado:</span>
                <span class="font-serif text-lg" style="color: var(--accent);">Bs. {{ monto | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap justify-center gap-4">
            <a routerLink="/mis-compras" class="btn btn-primary" style="padding: 0.75rem 1.6rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-bag-shopping"></i> Ver Mis Compras
            </a>
            <a routerLink="/catalogo" class="btn btn-outline" style="padding: 0.75rem 1.6rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-shirt"></i> Seguir Comprando
            </a>
          </div>
        </div>

        <!-- PANTALLA: PASARELA DE PAGO -->
        <div *ngIf="!pagoExitoso">
          
          <!-- Encabezado -->
          <div class="flex items-center justify-between mb-6 pb-4" style="border-bottom: 1px solid var(--border-color);">
            <div>
              <h1 class="font-serif text-2xl sm:text-3xl font-bold flex items-center gap-3" style="color: var(--text-main);">
                <i class="fa-solid fa-shield-halved" style="color: var(--accent);"></i> Pasarela de Pago
              </h1>
              <p class="text-xs sm:text-sm mt-1" style="color: var(--text-muted);">
                Selecciona tu forma de pago para liquidar la orden <strong style="color: var(--text-main);">#{{ ventaId }}</strong>
              </p>
            </div>
            <div class="text-right">
              <span class="block text-xs" style="color: var(--text-muted);">Total a Cancelar</span>
              <span class="font-serif text-xl sm:text-2xl font-bold" style="color: var(--accent);">
                Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }}
              </span>
            </div>
          </div>

          <div *ngIf="cargandoOrden" class="card text-center py-16">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
            <p class="text-sm mt-3" style="color: var(--text-muted);">Cargando detalles de tu orden...</p>
          </div>

          <div *ngIf="!cargandoOrden" class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <!-- Columna Izquierda: Métodos de Pago y Formularios (8 cols) -->
            <div class="lg:col-span-7 flex flex-col gap-6">

              <!-- Selector de Métodos de Pago -->
              <div class="card p-6">
                <label class="form-label mb-3 font-bold text-xs uppercase tracking-wider" style="color: var(--text-muted);">
                  1. Selecciona tu Forma de Pago
                </label>
                <div class="grid grid-cols-3 gap-3">
                  
                  <!-- Opción QR Simple -->
                  <button 
                    type="button"
                    (click)="metodoPago = 'qr'" 
                    class="p-4 rounded-xl text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                    [style.border]="metodoPago === 'qr' ? '2px solid var(--accent)' : '1px solid var(--border-color)'"
                    [style.background]="metodoPago === 'qr' ? 'rgba(245,158,11,0.12)' : 'var(--card-bg)'"
                  >
                    <i class="fa-solid fa-qrcode text-2xl" [style.color]="metodoPago === 'qr' ? 'var(--accent)' : 'var(--text-muted)'"></i>
                    <span class="text-xs font-bold" style="color: var(--text-main);">Pago QR</span>
                  </button>

                  <!-- Opción Tarjeta -->
                  <button 
                    type="button"
                    (click)="metodoPago = 'tarjeta_credito'" 
                    class="p-4 rounded-xl text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                    [style.border]="metodoPago === 'tarjeta_credito' ? '2px solid var(--accent)' : '1px solid var(--border-color)'"
                    [style.background]="metodoPago === 'tarjeta_credito' ? 'rgba(245,158,11,0.12)' : 'var(--card-bg)'"
                  >
                    <i class="fa-solid fa-credit-card text-2xl" [style.color]="metodoPago === 'tarjeta_credito' ? 'var(--accent)' : 'var(--text-muted)'"></i>
                    <span class="text-xs font-bold" style="color: var(--text-main);">Tarjeta</span>
                  </button>

                  <!-- Opción Efectivo -->
                  <button 
                    type="button"
                    (click)="metodoPago = 'efectivo'" 
                    class="p-4 rounded-xl text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                    [style.border]="metodoPago === 'efectivo' ? '2px solid var(--accent)' : '1px solid var(--border-color)'"
                    [style.background]="metodoPago === 'efectivo' ? 'rgba(245,158,11,0.12)' : 'var(--card-bg)'"
                  >
                    <i class="fa-solid fa-money-bill-wave text-2xl" [style.color]="metodoPago === 'efectivo' ? 'var(--accent)' : 'var(--text-muted)'"></i>
                    <span class="text-xs font-bold" style="color: var(--text-main);">Efectivo</span>
                  </button>

                </div>
              </div>

              <!-- Resguardo: Entrada de Monto si la orden no cargó el total -->
              <div *ngIf="monto <= 0 && !cargandoOrden" class="card p-4 flex items-center justify-between animate-fade-in" style="border: 1px dashed var(--accent); background: rgba(245,158,11,0.06);">
                <div class="text-xs">
                  <strong class="block text-sm" style="color: var(--text-main);">
                    <i class="fa-solid fa-calculator mr-1.5" style="color: var(--accent);"></i> Indicar Monto a Cancelar
                  </strong>
                  <span style="color: var(--text-muted);">Ingresa el total de la orden para actualizar el código QR y el comprobante:</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm" style="color: var(--accent);">Bs.</span>
                  <input 
                    type="number" 
                    [(ngModel)]="monto" 
                    (ngModelChange)="onMontoChange()" 
                    placeholder="0.00" 
                    min="1" 
                    class="form-input font-mono font-bold text-sm text-right" 
                    style="width: 110px; padding: 6px 10px;"
                  />
                </div>
              </div>

              <!-- CONTENIDO: PAGO QR -->
              <div *ngIf="metodoPago === 'qr'" class="card p-6 flex flex-col items-center text-center animate-fade-in">
                <div class="flex items-center gap-2 text-xs uppercase tracking-wider font-bold mb-4" style="color: var(--accent);">
                  <i class="fa-solid fa-mobile-screen-button"></i> Escaneo QR Interoperable
                </div>

                <!-- Marco QR -->
                <div class="p-3 bg-white rounded-2xl shadow-lg mb-4 inline-block" style="border: 2px solid var(--accent);">
                  <img 
                    [src]="qrImage || obtenerFallbackQr()" 
                    alt="Código QR de Pago FashionStore" 
                    style="width: 200px; height: 200px; object-fit: contain; display: block;" 
                  />
                </div>

                <div class="text-xs max-w-sm mb-4" style="color: var(--text-muted);">
                  Escanea este código desde la app de tu banco favorito (<strong style="color: var(--text-main);">Banco Unión, BCP, BNB, Mercantil, Ganadero, Bisa</strong>). El cobro por <strong style="color: var(--accent);">Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }}</strong> se acreditará al instante.
                </div>

                <div class="w-full p-3 rounded-xl mb-5 flex items-center justify-between text-xs" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
                  <span style="color: var(--text-muted);">Concepto:</span>
                  <span class="font-mono font-bold" style="color: var(--text-main);">FASHIONSTORE-ORDEN-{{ ventaId }}</span>
                </div>

                <button 
                  (click)="procesarPago()" 
                  [disabled]="loading" 
                  class="btn btn-primary w-full"
                  style="padding: 0.85rem; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
                >
                  <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Verificando Transferencia QR...</span>
                  <span *ngIf="!loading"><i class="fa-solid fa-check-circle"></i> He Escaneado y Pagado (Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }})</span>
                </button>
              </div>

              <!-- CONTENIDO: TARJETA DE CRÉDITO / DÉBITO -->
              <div *ngIf="metodoPago === 'tarjeta_credito'" class="card p-6 flex flex-col gap-5 animate-fade-in">
                
                <!-- Mockup Visual Tarjeta -->
                <div class="p-5 rounded-2xl relative overflow-hidden shadow-xl" style="background: linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%); border: 1px solid rgba(245,158,11,0.3); color: #fff; min-height: 180px;">
                  <div class="flex justify-between items-center mb-6">
                    <span class="font-serif tracking-widest text-xs font-bold" style="color: var(--accent);">FASHIONSTORE PLATINUM</span>
                    <i class="fa-brands fa-cc-visa text-2xl opacity-90"></i>
                  </div>
                  <!-- Chip -->
                  <div class="w-9 h-7 rounded mb-4" style="background: linear-gradient(135deg, #fbbf24, #d97706); border: 1px solid #b45309;"></div>
                  <!-- Número -->
                  <div class="font-mono text-lg tracking-wider mb-4 font-bold" style="letter-spacing: 2px;">
                    {{ numTarjeta || '•••• •••• •••• ••••' }}
                  </div>
                  <div class="flex justify-between items-end text-xs opacity-80 uppercase">
                    <div>
                      <div class="text-[9px] opacity-60">Titular</div>
                      <div class="font-semibold">{{ titular || 'NOMBRE DEL CLIENTE' }}</div>
                    </div>
                    <div>
                      <div class="text-[9px] opacity-60">Vence</div>
                      <div class="font-mono font-semibold">{{ expiracion || 'MM/AA' }}</div>
                    </div>
                  </div>
                </div>

                <!-- Formulario Tarjeta -->
                <div class="flex flex-col gap-3">
                  <div class="form-group mb-0">
                    <label class="form-label text-xs">Número de Tarjeta (16 dígitos)</label>
                    <input 
                      type="text" 
                      [(ngModel)]="numTarjeta" 
                      placeholder="4532 8901 2345 6789" 
                      maxlength="19"
                      (input)="formatearTarjeta($event)"
                      class="form-input font-mono" 
                    />
                  </div>

                  <div class="form-group mb-0">
                    <label class="form-label text-xs">Nombre del Titular (como aparece en el plástico)</label>
                    <input 
                      type="text" 
                      [(ngModel)]="titular" 
                      placeholder="JUAN PEREZ" 
                      class="form-input uppercase" 
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div class="form-group mb-0">
                      <label class="form-label text-xs">Fecha Expiración (MM/AA)</label>
                      <input 
                        type="text" 
                        [(ngModel)]="expiracion" 
                        placeholder="12/28" 
                        maxlength="5"
                        (input)="formatearFecha($event)"
                        class="form-input font-mono" 
                      />
                    </div>
                    <div class="form-group mb-0">
                      <label class="form-label text-xs">Código de Seguridad (CVV)</label>
                      <input 
                        type="password" 
                        [(ngModel)]="cvv" 
                        placeholder="•••" 
                        maxlength="4" 
                        class="form-input font-mono" 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  (click)="procesarPago()" 
                  [disabled]="loading" 
                  class="btn btn-primary w-full mt-2"
                  style="padding: 0.85rem; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
                >
                  <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Procesando Transacción Bancaria...</span>
                  <span *ngIf="!loading"><i class="fa-solid fa-lock"></i> Pagar con Tarjeta Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }}</span>
                </button>
              </div>

              <!-- CONTENIDO: PAGO EN EFECTIVO -->
              <div *ngIf="metodoPago === 'efectivo'" class="card p-6 flex flex-col gap-4 animate-fade-in">
                <div class="flex items-center gap-3 p-4 rounded-xl" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25);">
                  <i class="fa-solid fa-hand-holding-dollar text-3xl" style="color: var(--accent);"></i>
                  <div class="text-xs">
                    <strong class="block text-sm mb-0.5" style="color: var(--text-main);">
                      {{ orden?.metodo_entrega === 'delivery' ? 'Pago Contra Entrega' : 'Pago en Caja de Sucursal' }}
                    </strong>
                    <span style="color: var(--text-muted);">
                      {{ orden?.metodo_entrega === 'delivery' 
                        ? 'Pagarás en efectivo directamente al repartidor al recibir el paquete en tu dirección registrada.' 
                        : 'Pagarás en caja al momento de recoger tus prendas en nuestra sucursal presentando tu número de orden.' }}
                    </span>
                  </div>
                </div>

                <div class="p-4 rounded-xl text-xs flex flex-col gap-2" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
                  <div class="flex justify-between" style="color: var(--text-muted);">
                    <span>Monto Exacto a Preparar:</span>
                    <strong class="font-serif text-sm" style="color: var(--accent);">Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }}</strong>
                  </div>
                  <div *ngIf="orden?.direccion_envio" class="flex justify-between" style="color: var(--text-muted);">
                    <span>Dirección de Cobro:</span>
                    <span class="font-semibold" style="color: var(--text-main);">{{ orden?.direccion_envio }}</span>
                  </div>
                </div>

                <button 
                  (click)="procesarPago()" 
                  [disabled]="loading" 
                  class="btn btn-primary w-full mt-2"
                  style="padding: 0.85rem; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
                >
                  <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Registrando Pedido...</span>
                  <span *ngIf="!loading"><i class="fa-solid fa-check"></i> Confirmar Pedido en Efectivo (Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }})</span>
                </button>
              </div>

              <p class="text-xs text-center" style="color: var(--text-muted);">
                <i class="fa-solid fa-shield-halved text-xs mr-1"></i> Transacción cifrada con protocolo TLS / PCI-DSS
              </p>

            </div>

            <!-- Columna Derecha: Resumen de Orden (5 cols) -->
            <div class="lg:col-span-5 flex flex-col gap-4">
              <div class="card p-6 sticky top-24">
                <h3 class="font-serif text-lg font-bold pb-3 mb-3 flex items-center justify-between" style="color: var(--text-main); border-bottom: 1px solid var(--border-color);">
                  <span>Detalle de tu Orden</span>
                  <span class="text-xs font-mono font-normal" style="color: var(--text-muted);">#{{ ventaId }}</span>
                </h3>

                <!-- Lista de Prendas -->
                <div class="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1 mb-4">
                  <div *ngFor="let item of orden?.items" class="flex items-center justify-between text-xs py-1.5" style="border-bottom: 1px dashed var(--border-color);">
                    <div class="min-w-0 pr-2">
                      <span class="font-semibold block truncate" style="color: var(--text-main);">{{ item.producto }}</span>
                      <span style="color: var(--text-muted);">Talla {{ item.talla }} • {{ item.color }} (x{{ item.cantidad }})</span>
                    </div>
                    <span class="font-bold flex-shrink-0" style="color: var(--text-main);">
                      Bs. {{ item.subtotal | number:'1.2-2' }}
                    </span>
                  </div>
                </div>

                <!-- Totales -->
                <div class="flex flex-col gap-2 pt-2 text-xs" style="border-top: 1px solid var(--border-color);">
                  <div class="flex justify-between" style="color: var(--text-muted);">
                    <span>Subtotal:</span>
                    <span class="font-semibold" style="color: var(--text-main);">Bs. {{ (orden?.subtotal || (monto > 0 ? monto : 0)) | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between" style="color: var(--text-muted);">
                    <span>Costo de Envío:</span>
                    <span class="font-semibold" style="color: var(--text-main);">
                      {{ (orden?.costo_envio || 0) > 0 ? ('Bs. ' + (orden.costo_envio | number:'1.2-2')) : 'Gratis' }}
                    </span>
                  </div>
                  <div class="flex justify-between text-sm font-bold pt-2 mt-1" style="border-top: 1px dashed var(--border-color); color: var(--text-main);">
                    <span>Total a Pagar:</span>
                    <span class="font-serif text-lg" style="color: var(--accent);">Bs. {{ (monto > 0 ? monto : (orden?.total || 0)) | number:'1.2-2' }}</span>
                  </div>
                </div>

                <div class="mt-4 pt-3 text-[11px] flex items-center gap-2" style="color: var(--text-muted); border-top: 1px solid var(--border-color);">
                  <i class="fa-solid fa-truck" style="color: var(--accent);"></i>
                  <span>Método de entrega: <strong>{{ orden?.metodo_entrega === 'delivery' ? 'Envío a Domicilio' : 'Retiro en Tienda' }}</strong></span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `
})
export class PagoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ventaService = inject(VentaService);
  private carritoService = inject(CarritoService);
  private toastService = inject(ToastService);

  ventaId: number = 0;
  metodoPago: string = 'qr';
  monto: number = 0;
  loading: boolean = false;
  cargandoOrden: boolean = true;
  pagoExitoso: boolean = false;
  comprobanteNumero: string = '';
  qrImage: string = '';
  orden: any = null;

  numTarjeta: string = '4532 8901 2345 6789';
  titular: string = 'CLIENTE FASHIONSTORE';
  expiracion: string = '12/28';
  cvv: string = '789';

  ngOnInit(): void {
    // 1. Si la orden viene en history.state (desde el checkout directo del carrito)
    if (history.state?.orden) {
      this.asignarDatosOrden(history.state.orden);
    }

    // 2. Suscribirse al id de la ruta
    this.route.params.subscribe(params => {
      this.ventaId = Number(params['id']);
      if (this.ventaId) {
        // Chequear si existe en sessionStorage
        try {
          const spec = sessionStorage.getItem('orden_' + this.ventaId);
          const activa = sessionStorage.getItem('orden_activa');
          if (spec) {
            this.asignarDatosOrden(JSON.parse(spec));
          } else if (activa) {
            const parsed = JSON.parse(activa);
            if (Number(parsed.id) === this.ventaId || Number(parsed.venta_id) === this.ventaId) {
              this.asignarDatosOrden(parsed);
            }
          }
        } catch (e) {}

        this.generarQrFrontend();
        this.cargarOrden();
      } else {
        this.toastService.error('Orden Inválida', 'No se especificó un número de orden válido.');
        this.router.navigate(['/catalogo']);
      }
    });
  }

  asignarDatosOrden(data: any): void {
    if (!data) return;
    this.orden = data;
    const numTotal = Number(data.total);
    if (!isNaN(numTotal) && numTotal > 0) {
      this.monto = numTotal;
    }
    if (data.qr_image) {
      this.qrImage = data.qr_image;
    }
    this.generarQrFrontend();
    this.cargandoOrden = false;
  }

  obtenerFallbackQr(): string {
    const totalVal = (this.monto > 0 ? this.monto : (Number(this.orden?.total) || 0)).toFixed(2);
    const idVal = this.ventaId || this.orden?.id || this.orden?.venta_id || 1;
    const payload = encodeURIComponent(`FASHIONSTORE|ORDEN:${idVal}|TOTAL:${totalVal}|BS|PAGOSIMPLE`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${payload}`;
  }

  generarQrFrontend(): void {
    if (!this.qrImage || !this.qrImage.startsWith('data:image')) {
      this.qrImage = this.obtenerFallbackQr();
    }
  }

  onMontoChange(): void {
    this.qrImage = '';
    this.generarQrFrontend();
  }

  cargarOrden(): void {
    this.cargandoOrden = !this.orden; // Solo mostrar loading si no teníamos datos previos
    
    this.ventaService.getVenta(this.ventaId).subscribe({
      next: (res) => {
        this.asignarDatosOrden(res);
        this.cargandoOrden = false;

        // Si la orden ya estaba completada (pagada con anterioridad)
        if (res.estado === 'completada') {
          this.pagoExitoso = true;
          this.comprobanteNumero = res.numero_comprobante || 'COMP-' + this.ventaId;
        }
      },
      error: () => {
        // FALLBACK si el backend tarda o da 404
        this.ventaService.getMisCompras().subscribe({
          next: (compras) => {
            const v = compras.find((c: any) => c.id === this.ventaId);
            if (v) {
              this.asignarDatosOrden(v);
              if (v.estado === 'completada') {
                this.pagoExitoso = true;
                this.comprobanteNumero = v.numero_comprobante || 'COMP-' + this.ventaId;
              }
            } else {
              this.cargandoOrden = false;
              this.generarQrFrontend();
            }
          },
          error: () => {
            this.cargandoOrden = false;
            this.generarQrFrontend();
          }
        });
      }
    });
  }

  formatearTarjeta(event: any): void {
    let valor = event.target.value.replace(/\D/g, '');
    let formateado = valor.match(/.{1,4}/g)?.join(' ') || valor;
    this.numTarjeta = formateado.substring(0, 19);
  }

  formatearFecha(event: any): void {
    let valor = event.target.value.replace(/\D/g, '');
    if (valor.length >= 3) {
      this.expiracion = valor.substring(0, 2) + '/' + valor.substring(2, 4);
    } else {
      this.expiracion = valor;
    }
  }

  formatearMetodo(metodo: string): string {
    switch (metodo) {
      case 'qr': return 'Pago QR Simple';
      case 'tarjeta_credito': return 'Tarjeta de Crédito/Débito';
      case 'efectivo': return 'Efectivo';
      default: return metodo;
    }
  }

  procesarPago(): void {
    if (!this.monto || this.monto <= 0) {
      if (this.orden?.total > 0) {
        this.monto = Number(this.orden.total);
      }
    }

    if (!this.monto || this.monto <= 0) {
      this.toastService.error('Monto Inválido', 'El monto a pagar debe ser mayor a 0 Bs.');
      return;
    }

    if (this.metodoPago === 'tarjeta_credito') {
      const limpia = this.numTarjeta.replace(/\s+/g, '');
      if (limpia.length < 13) {
        this.toastService.warning('Tarjeta Inválida', 'Por favor ingresa un número de tarjeta válido.');
        return;
      }
    }

    this.loading = true;

    this.ventaService.pagarVenta(this.ventaId, {
      metodo_pago: this.metodoPago,
      monto: this.monto
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.pagoExitoso = true;
        this.comprobanteNumero = res.numero_comprobante || 'COMP-FS2026';
        try {
          sessionStorage.removeItem('orden_activa');
          sessionStorage.removeItem('orden_' + this.ventaId);
        } catch (e) {}
        this.toastService.success('¡Pago Confirmado!', `Comprobante ${this.comprobanteNumero} generado con éxito.`, 6000);
        // Refrescar contador del carrito a 0
        this.carritoService.refreshCount();
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.detail || 'Error al procesar la transacción.';
        this.toastService.error('Pago No Procesado', msg);
      }
    });
  }
}

