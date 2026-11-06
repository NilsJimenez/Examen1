import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VentaService } from '../../services/venta.service';
import { CarritoService } from '../../services/carrito.service';
import { SaasService } from '../../services/saas.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="checkout-page-wrapper">
      
      <!-- Tablero Principal (Inspirado en el diseño Checkout moderno con paleta FashionStore) -->
      <div class="checkout-board animate-fade-in">

        <!-- ================================================================= -->
        <!-- 1. STEPPER HORIZONTAL SUPERIOR (Order -> Shipping -> Payment -> Review) -->
        <!-- ================================================================= -->
        <div class="stepper-container">
          <div class="stepper-track">
            
            <!-- Paso 1: Orden / Plan -->
            <div class="step-item completed">
              <div class="step-dot"></div>
              <span class="step-label">{{ esSuscripcionSaas ? 'Plan' : 'Orden' }}</span>
            </div>

            <div class="step-line completed"></div>

            <!-- Paso 2: Datos / Envío -->
            <div class="step-item completed">
              <div class="step-dot"></div>
              <span class="step-label">{{ esSuscripcionSaas ? 'Empresa' : 'Envío' }}</span>
            </div>

            <div class="step-line completed"></div>

            <!-- Paso 3: Pago (Activo) -->
            <div class="step-item" [class.active]="!pagoExitoso" [class.completed]="pagoExitoso">
              <div class="step-dot">
                <span *ngIf="!pagoExitoso" class="step-dot-inner"></span>
              </div>
              <span class="step-label">Pago</span>
            </div>

            <div class="step-line" [class.completed]="pagoExitoso"></div>

            <!-- Paso 4: Confirmación / Review -->
            <div class="step-item" [class.active]="pagoExitoso">
              <div class="step-dot">
                <span *ngIf="pagoExitoso" class="step-dot-inner"></span>
              </div>
              <span class="step-label">Confirmación</span>
            </div>

          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 2. VISTA: PAGO EXITOSO / COMPROBANTE OFICIAL (PASO 4: REVIEW)     -->
        <!-- ================================================================= -->
        <div *ngIf="pagoExitoso" class="review-success-box animate-fade-in">
          <div class="success-icon-ring">
            <i class="fa-solid fa-check"></i>
          </div>

          <h2 class="font-serif text-3xl font-bold mb-2" style="color: var(--text-main);">
            {{ esSuscripcionSaas ? '¡Suscripción SaaS Activada!' : '¡Pago Aprobado Exitosamente!' }}
          </h2>
          <p class="text-sm max-w-md mx-auto mb-6" style="color: var(--text-muted);">
            {{ esSuscripcionSaas 
              ? 'Tu pago fue verificado. Tu espacio Multi-Tenant aislado y tu cuenta administradora ya están listos.' 
              : 'Tu transacción fue verificada. El inventario ha sido actualizado y tu orden está lista.' }}
          </p>

          <!-- Tarjeta de Comprobante -->
          <div class="receipt-card">
            <div class="receipt-header">
              <span class="receipt-title">
                <i class="fa-solid fa-receipt mr-1.5"></i> Comprobante Oficial
              </span>
              <span class="receipt-badge">PAGADO</span>
            </div>

            <div class="receipt-rows">
              <div class="receipt-row">
                <span>N° Comprobante</span>
                <strong class="font-mono">{{ comprobanteNumero }}</strong>
              </div>
              <div *ngIf="!esSuscripcionSaas" class="receipt-row">
                <span>N° de Orden</span>
                <strong>#{{ ventaId }}</strong>
              </div>
              <div *ngIf="esSuscripcionSaas" class="receipt-row">
                <span>Empresa (Tenant)</span>
                <strong>{{ saasPending?.razon_social }} (NIT: {{ saasPending?.nit }})</strong>
              </div>
              <div *ngIf="esSuscripcionSaas" class="receipt-row">
                <span>Plan Activado</span>
                <strong style="color: var(--accent);">Plan {{ saasPending?.plan_etiqueta }} ({{ saasPending?.max_sucursales }} sucursales)</strong>
              </div>
              <div class="receipt-row">
                <span>Método de Pago</span>
                <strong>{{ formatearMetodo(metodoPago) }}</strong>
              </div>
              <div class="receipt-row total">
                <span>Total Pagado</span>
                <span class="receipt-total-amount">Bs. {{ monto | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>

          <div *ngIf="!esSuscripcionSaas" class="flex flex-wrap justify-center gap-4 mt-6">
            <a routerLink="/mis-compras" class="pay-now-btn" style="max-width: 240px; text-decoration: none;">
              <i class="fa-solid fa-bag-shopping mr-2"></i> Ver Mis Compras
            </a>
            <a routerLink="/catalogo" class="secondary-outline-btn">
              <i class="fa-solid fa-shirt mr-2"></i> Seguir Comprando
            </a>
          </div>

          <div *ngIf="esSuscripcionSaas" class="flex justify-center mt-6">
            <button type="button" (click)="irAlPanelEmpresa()" class="pay-now-btn" style="max-width: 340px;">
              <i class="fa-solid fa-sliders mr-2"></i> Ir al Panel de mi Empresa
            </button>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 3. VISTA PRINCIPAL: 2 COLUMNAS (ITEMS + SUMMARY | CHECKOUT)       -->
        <!-- ================================================================= -->
        <div *ngIf="!pagoExitoso">

          <div *ngIf="cargandoOrden" class="text-center py-16">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
            <p class="text-sm mt-3" style="color: var(--text-muted);">Preparando pasarela de pago...</p>
          </div>

          <div *ngIf="!cargandoOrden" class="checkout-two-columns">
            
            <!-- ============================================================= -->
            <!-- COLUMNA IZQUIERDA: ITEMS ARRIBA + ORDER SUMMARY ABAJO          -->
            <!-- ============================================================= -->
            <div class="left-column-stack">
              
              <!-- SUB-CARD 1: ITEMS -->
              <div class="sub-panel items-panel">
                <div class="panel-header-row">
                  <h3 class="panel-heading font-serif">
                    {{ esSuscripcionSaas ? 'Suscripción' : 'Items' }}
                    <span class="items-count">
                      ({{ esSuscripcionSaas ? '1 plan' : ((orden?.items?.length || 1) + ' items') }})
                    </span>
                  </h3>

                  <a *ngIf="esSuscripcionSaas" routerLink="/planes" class="remove-all-link">
                    <i class="fa-solid fa-rotate mr-1"></i> Cambiar plan
                  </a>
                  <a *ngIf="!esSuscripcionSaas" routerLink="/carrito" class="remove-all-link">
                    <i class="fa-solid fa-arrow-left mr-1"></i> Volver al carrito
                  </a>
                </div>

                <!-- MODO SAAS: TARJETA DEL PLAN SELECCIONADO -->
                <div *ngIf="esSuscripcionSaas" class="item-cards-list">
                  <div class="checkout-item-card">
                    <div class="item-thumb saas-thumb">
                      <i class="fa-solid fa-crown"></i>
                    </div>

                    <div class="item-details">
                      <div class="item-top-line">
                        <h4 class="item-title">Plan {{ saasPending?.plan_etiqueta }}</h4>
                      </div>
                      <p class="item-meta">Empresa: {{ saasPending?.razon_social }}</p>
                      <p class="item-meta">NIT: {{ saasPending?.nit }}</p>
                      <p class="item-meta">Capacidad: Hasta {{ saasPending?.max_sucursales }} sucursales</p>

                      <div class="item-bottom-line">
                        <div class="qty-pills">
                          <span class="qty-badge-static">Mensual</span>
                          <span class="qty-number">1</span>
                          <span class="qty-badge-static">{{ saasPending?.permite_ia ? 'IA + ML' : 'POS Offline' }}</span>
                        </div>
                        <span class="item-price-tag">Bs. {{ monto | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- MODO TIENDA: LISTA DE PRENDAS DE LA ORDEN -->
                <div *ngIf="!esSuscripcionSaas" class="item-cards-list">
                  <div *ngFor="let item of orden?.items" class="checkout-item-card">
                    <div class="item-thumb">
                      <img 
                        *ngIf="item.imagen_url" 
                        [src]="item.imagen_url" 
                        [alt]="item.producto" 
                        (error)="item.imagen_url = ''"
                      />
                      <i *ngIf="!item.imagen_url" class="fa-solid fa-shirt"></i>
                    </div>

                    <div class="item-details">
                      <div class="item-top-line">
                        <h4 class="item-title">{{ item.producto }}</h4>
                      </div>
                      <p class="item-meta">Prenda de colección</p>
                      <p class="item-meta">Color: {{ item.color || 'Estándar' }}</p>
                      <p class="item-meta">Talla: {{ item.talla || 'Única' }}</p>

                      <div class="item-bottom-line">
                        <div class="qty-pills">
                          <span class="qty-btn-decor">−</span>
                          <span class="qty-number">{{ item.cantidad }}</span>
                          <span class="qty-btn-decor">+</span>
                        </div>
                        <span class="item-price-tag">Bs. {{ item.subtotal | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Si la orden no trajo desglose de items, mostrar resumen general -->
                  <div *ngIf="!orden?.items || orden?.items?.length === 0" class="checkout-item-card">
                    <div class="item-thumb saas-thumb">
                      <i class="fa-solid fa-bag-shopping"></i>
                    </div>
                    <div class="item-details">
                      <h4 class="item-title">Orden de Compra #{{ ventaId }}</h4>
                      <p class="item-meta">FashionStore Boutique</p>
                      <p class="item-meta">Entrega: {{ orden?.metodo_entrega === 'delivery' ? 'Envío a Domicilio' : 'Retiro en Tienda' }}</p>
                      <div class="item-bottom-line">
                        <div class="qty-pills">
                          <span class="qty-number">1</span>
                        </div>
                        <span class="item-price-tag">Bs. {{ monto | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <!-- SUB-CARD 2: ORDER SUMMARY (RESUMEN DE ORDEN) -->
              <div class="sub-panel summary-panel">
                <h3 class="panel-heading font-serif mb-4">Resumen de Orden</h3>

                <div class="summary-lines">
                  <div class="summary-line">
                    <span>Subtotal</span>
                    <strong>Bs. {{ (orden?.subtotal || monto) | number:'1.2-2' }}</strong>
                  </div>

                  <div *ngIf="esSuscripcionSaas" class="summary-line">
                    <span>Equivalente USD</span>
                    <strong>&#36;{{ saasPending?.precio_usd }} / mes</strong>
                  </div>

                  <div *ngIf="!esSuscripcionSaas" class="summary-line">
                    <span>Descuento</span>
                    <strong>Bs. 0.00</strong>
                  </div>

                  <div class="summary-line">
                    <span>{{ esSuscripcionSaas ? 'Activación Cloud' : 'Envío (Shipping)' }}</span>
                    <strong class="free-tag">
                      {{ (!esSuscripcionSaas && (orden?.costo_envio || 0) > 0) ? ('Bs. ' + (orden.costo_envio | number:'1.2-2')) : 'GRATIS' }}
                    </strong>
                  </div>

                  <div class="summary-total-line">
                    <span>Precio Total</span>
                    <span class="total-amount-highlight">Bs. {{ monto | number:'1.2-2' }}</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- ============================================================= -->
            <!-- COLUMNA DERECHA: PANEL CHECKOUT (TARJETA / QR / EFECTIVO)      -->
            <!-- ============================================================= -->
            <div class="sub-panel checkout-panel">
              <h3 class="panel-heading font-serif mb-4">Checkout</h3>

              <!-- Selector de Métodos de Pago (Estilo Cajas de Marca como en la imagen) -->
              <div class="payment-methods-row">
                
                <!-- 1. Tarjeta (Mastercard / Visa) -->
                <button 
                  type="button" 
                  (click)="metodoPago = 'tarjeta_credito'"
                  class="method-brand-box"
                  [class.selected]="metodoPago === 'tarjeta_credito'"
                >
                  <div class="brand-icons">
                    <span class="mc-circle mc-red"></span>
                    <span class="mc-circle mc-orange"></span>
                    <span class="visa-text">VISA</span>
                  </div>
                  <span class="method-sub-caption">Tarjeta</span>
                </button>

                <!-- 2. Pago QR Simple -->
                <button 
                  type="button" 
                  (click)="metodoPago = 'qr'"
                  class="method-brand-box"
                  [class.selected]="metodoPago === 'qr'"
                >
                  <div class="brand-icons">
                    <i class="fa-solid fa-qrcode qr-brand-icon"></i>
                  </div>
                  <span class="method-sub-caption">Pago QR</span>
                </button>

                <!-- 3. Efectivo -->
                <button 
                  type="button" 
                  (click)="metodoPago = 'efectivo'"
                  class="method-brand-box"
                  [class.selected]="metodoPago === 'efectivo'"
                >
                  <div class="brand-icons">
                    <i class="fa-solid fa-money-bill-wave cash-brand-icon"></i>
                  </div>
                  <span class="method-sub-caption">Efectivo</span>
                </button>

              </div>

              <!-- =========================================================== -->
              <!-- CONTENIDO MÉTODO 1: TARJETA (CAMPOS IDÉNTICOS A LA IMAGEN)  -->
              <!-- =========================================================== -->
              <div *ngIf="metodoPago === 'tarjeta_credito'" class="checkout-form-body animate-fade-in">
                
                <div class="checkout-field">
                  <label>Nombre del titular (Cardholder name)</label>
                  <input 
                    type="text" 
                    [(ngModel)]="titular" 
                    placeholder="Ej: GABRIEL QUISPE" 
                    class="checkout-input uppercase"
                  />
                </div>

                <div class="checkout-field">
                  <label>Número de tarjeta (Card number)</label>
                  <div class="input-with-icon">
                    <input 
                      type="text" 
                      [(ngModel)]="numTarjeta" 
                      (input)="formatearTarjeta($event)"
                      placeholder="4532 8901 2345 6789" 
                      maxlength="19"
                      class="checkout-input font-mono"
                    />
                    <i class="fa-brands fa-cc-visa input-trailing-icon"></i>
                  </div>
                </div>

                <div class="checkout-row-2">
                  <div class="checkout-field">
                    <label>Fecha expiración</label>
                    <input 
                      type="text" 
                      [(ngModel)]="expiracion" 
                      (input)="formatearFecha($event)"
                      placeholder="MM/AA" 
                      maxlength="5"
                      class="checkout-input font-mono"
                    />
                  </div>

                  <div class="checkout-field">
                    <label>CVC / CVV</label>
                    <input 
                      type="password" 
                      [(ngModel)]="cvv" 
                      placeholder="•••" 
                      maxlength="4"
                      class="checkout-input font-mono"
                    />
                  </div>
                </div>

                <!-- Switch compacto de Simulación de Rechazo para Examen -->
                <div class="exam-sim-box">
                  <div>
                    <span class="sim-title">
                      <i class="fa-solid fa-flask mr-1"></i> Simular Rechazo de Pasarela
                    </span>
                    <span class="sim-desc">Modo demostración: declinar tarjeta</span>
                  </div>
                  <input type="checkbox" [(ngModel)]="simularRechazo" class="sim-checkbox" />
                </div>

                <!-- Alerta si el pago fue rechazado -->
                <div *ngIf="mensajeErrorRechazo" class="declined-alert">
                  <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                  <div>
                    <strong>Transacción Declinada</strong>
                    <p>{{ mensajeErrorRechazo }}</p>
                  </div>
                </div>

                <button 
                  type="button"
                  (click)="procesarPago()" 
                  [disabled]="loading" 
                  class="pay-now-btn mt-auto"
                >
                  <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Procesando...</span>
                  <span *ngIf="!loading">Pagar ahora (Bs. {{ monto | number:'1.2-2' }})</span>
                </button>
              </div>

              <!-- =========================================================== -->
              <!-- CONTENIDO MÉTODO 2: PAGO QR INTEROPERABLE                   -->
              <!-- =========================================================== -->
              <div *ngIf="metodoPago === 'qr'" class="checkout-form-body animate-fade-in">
                
                <div class="qr-showcase-box">
                  <div class="qr-white-frame">
                    <img 
                      [src]="qrImage || obtenerFallbackQr()" 
                      alt="Código QR de Pago" 
                      class="qr-code-img"
                    />
                  </div>
                  <p class="qr-instructions">
                    Escanea desde la app de tu banco (<strong style="color: var(--text-main);">Banco Unión, BCP, BNB, Mercantil, Ganadero</strong>)
                  </p>
                  <div class="qr-ref-pill">
                    <span>Referencia:</span>
                    <strong>{{ esSuscripcionSaas ? ('SAAS-' + (saasPending?.plan_nombre || 'PRO').toUpperCase()) : ('ORDEN-#' + ventaId) }}</strong>
                  </div>
                </div>

                <div *ngIf="mensajeErrorRechazo" class="declined-alert">
                  <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                  <div>
                    <strong>Aviso del Sistema</strong>
                    <p>{{ mensajeErrorRechazo }}</p>
                  </div>
                </div>

                <button 
                  type="button"
                  (click)="procesarPago()" 
                  [disabled]="loading" 
                  class="pay-now-btn mt-auto"
                >
                  <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Verificando QR...</span>
                  <span *ngIf="!loading">
                    <i class="fa-solid fa-qrcode mr-1.5"></i> Pagar ahora con QR (Bs. {{ monto | number:'1.2-2' }})
                  </span>
                </button>
              </div>

              <!-- =========================================================== -->
              <!-- CONTENIDO MÉTODO 3: PAGO EN EFECTIVO                        -->
              <!-- =========================================================== -->
              <div *ngIf="metodoPago === 'efectivo'" class="checkout-form-body animate-fade-in">
                
                <div class="cash-info-box">
                  <div class="cash-icon-circle">
                    <i class="fa-solid fa-hand-holding-dollar"></i>
                  </div>
                  <h4 class="cash-title">
                    {{ esSuscripcionSaas ? 'Pago Presencial / Depósito' : (orden?.metodo_entrega === 'delivery' ? 'Pago Contra Entrega' : 'Pago en Caja de Sucursal') }}
                  </h4>
                  <p class="cash-desc">
                    {{ esSuscripcionSaas 
                      ? 'Se generará tu comprobante oficial y se activará tu suscripción empresarial inmediatamente.' 
                      : 'Cancela en efectivo al momento de recibir o retirar tus prendas presentando tu comprobante.' }}
                  </p>
                  <div class="cash-amount-pill">
                    <span>Total a cancelar:</span>
                    <strong>Bs. {{ monto | number:'1.2-2' }}</strong>
                  </div>
                </div>

                <button 
                  type="button"
                  (click)="procesarPago()" 
                  [disabled]="loading" 
                  class="pay-now-btn mt-auto"
                >
                  <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Registrando...</span>
                  <span *ngIf="!loading">Confirmar Pago en Efectivo (Bs. {{ monto | number:'1.2-2' }})</span>
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>

    </div>
  `,
  styles: [`
    /* ==========================================================================
       DISEÑO CHECKOUT MODERNO (INSPIRADO EN REFERENCIA + PALETA FASHIONSTORE)
       ========================================================================== */
    .checkout-page-wrapper {
      min-height: calc(100vh - 74px);
      width: 100%;
      background: var(--bg-main);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.25rem 1.25rem;
    }

    .checkout-board {
      width: 100%;
      max-width: 1080px;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 24px;
      padding: 2.5rem 2.75rem 2.75rem;
      box-shadow: 0 28px 65px rgba(0, 0, 0, 0.45);
      position: relative;
    }

    @media (max-width: 680px) {
      .checkout-board {
        padding: 1.5rem 1.25rem;
      }
    }

    /* 1. Stepper Horizontal Superior */
    .stepper-container {
      max-width: 560px;
      margin: 0 auto 2.5rem;
    }

    .stepper-track {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .step-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.45rem;
      position: relative;
      z-index: 2;
    }

    .step-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--card-bg);
      border: 2px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
    }

    .step-item.completed .step-dot {
      background: var(--accent);
      border-color: var(--accent);
    }

    .step-item.active .step-dot {
      width: 18px;
      height: 18px;
      border-color: var(--accent);
      background: rgba(245, 158, 11, 0.15);
      box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.15);
    }

    .step-dot-inner {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
    }

    .step-label {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .step-item.completed .step-label,
    .step-item.active .step-label {
      color: var(--text-main);
    }

    .step-line {
      flex: 1;
      height: 2px;
      background: var(--border-color);
      margin: 0 0.5rem;
      transform: translateY(-10px);
    }

    .step-line.completed {
      background: var(--accent);
    }

    /* 2. Layout 2 Columnas (Izquierda: Items + Summary | Derecha: Checkout) */
    .checkout-two-columns {
      display: grid;
      grid-template-columns: 1.08fr 1fr;
      gap: 2rem;
      align-items: stretch;
    }

    @media (max-width: 900px) {
      .checkout-two-columns {
        grid-template-columns: 1fr;
      }
    }

    .left-column-stack {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      justify-content: space-between;
    }

    .sub-panel {
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 1.6rem 1.75rem;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
    }

    .panel-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.2rem;
    }

    .panel-heading {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }

    .items-count {
      font-family: var(--font-sans);
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-left: 0.25rem;
    }

    .remove-all-link {
      font-size: 0.75rem;
      font-weight: 700;
      color: #ef4444;
      text-decoration: none;
      transition: opacity 0.2s ease;
    }

    .remove-all-link:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    /* Tarjetas de Ítems (Columna Izquierda Arriba) */
    .item-cards-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 290px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .checkout-item-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1rem 1.15rem;
      display: flex;
      align-items: center;
      gap: 1.1rem;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    }

    .item-thumb {
      width: 82px;
      height: 82px;
      border-radius: 12px;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      color: var(--accent);
      font-size: 1.75rem;
    }

    .item-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .saas-thumb {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.06));
      border-color: rgba(245, 158, 11, 0.4);
    }

    .item-details {
      flex: 1;
      min-width: 0;
    }

    .item-top-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.2rem;
    }

    .item-title {
      font-size: 0.96rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: 0.72rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.38;
    }

    .item-bottom-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.65rem;
    }

    .qty-pills {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .qty-btn-decor {
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: rgba(245, 158, 11, 0.16);
      color: var(--accent);
      font-weight: 800;
      font-size: 0.8rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .qty-badge-static {
      padding: 2px 7px;
      border-radius: 6px;
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent);
      font-size: 0.65rem;
      font-weight: 800;
    }

    .qty-number {
      font-size: 0.78rem;
      font-weight: 800;
      color: var(--text-main);
      padding: 0 2px;
    }

    .item-price-tag {
      font-size: 0.98rem;
      font-weight: 900;
      color: var(--accent);
    }

    /* Resumen de Orden (Columna Izquierda Abajo) */
    .summary-lines {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .summary-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
      padding-bottom: 0.55rem;
      border-bottom: 1px solid var(--border-color);
    }

    .summary-line strong {
      color: var(--text-main);
      font-weight: 700;
    }

    .free-tag {
      color: #10b981 !important;
      letter-spacing: 0.04em;
    }

    .summary-total-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.35rem;
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .total-amount-highlight {
      font-size: 1.2rem;
      font-weight: 900;
      color: var(--accent);
    }

    /* Columna Derecha: Checkout */
    .checkout-panel {
      display: flex;
      flex-direction: column;
    }

    /* Cajas de Selección de Método de Pago (Mastercard/Visa, QR, Efectivo) */
    .payment-methods-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .method-brand-box {
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 12px;
      padding: 0.7rem 0.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .method-brand-box:hover {
      border-color: rgba(245, 158, 11, 0.5);
      transform: translateY(-1px);
    }

    .method-brand-box.selected {
      border-color: var(--accent);
      background: rgba(245, 158, 11, 0.1);
      box-shadow: 0 6px 18px rgba(245, 158, 11, 0.18);
    }

    .brand-icons {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 24px;
    }

    .mc-circle {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
    }

    .mc-red {
      background: #eb001b;
    }

    .mc-orange {
      background: #f79e1b;
      margin-left: -6px;
      opacity: 0.9;
    }

    .visa-text {
      font-style: italic;
      font-weight: 900;
      font-size: 0.78rem;
      color: var(--text-main);
      margin-left: 6px;
      letter-spacing: 0.02em;
    }

    .qr-brand-icon {
      font-size: 1.35rem;
      color: var(--accent);
    }

    .cash-brand-icon {
      font-size: 1.3rem;
      color: #10b981;
    }

    .method-sub-caption {
      font-size: 0.68rem;
      font-weight: 800;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .method-brand-box.selected .method-sub-caption {
      color: var(--accent);
    }

    /* Cuerpo del Formulario Checkout */
    .checkout-form-body {
      display: flex;
      flex-direction: column;
      gap: 1.05rem;
      flex: 1;
    }

    .checkout-field {
      display: flex;
      flex-direction: column;
      gap: 0.38rem;
    }

    .checkout-field label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .checkout-input {
      width: 100%;
      padding: 0.72rem 0.95rem;
      border-radius: 10px;
      border: 1.5px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-main);
      font-size: 0.86rem;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .checkout-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.14);
    }

    .input-with-icon {
      position: relative;
    }

    .input-trailing-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--accent);
      font-size: 1.2rem;
    }

    .checkout-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }

    /* Simulación de rechazo compacta */
    .exam-sim-box {
      padding: 0.55rem 0.85rem;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.07);
      border: 1px dashed rgba(239, 68, 68, 0.35);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .sim-title {
      display: block;
      font-size: 0.72rem;
      font-weight: 800;
      color: #ef4444;
    }

    .sim-desc {
      display: block;
      font-size: 0.65rem;
      color: var(--text-muted);
    }

    .sim-checkbox {
      width: 16px;
      height: 16px;
      accent-color: #ef4444;
      cursor: pointer;
    }

    .declined-alert {
      padding: 0.75rem 0.9rem;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid #ef4444;
      color: #ef4444;
      font-size: 0.75rem;
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
    }

    .declined-alert p {
      margin: 2px 0 0;
      font-size: 0.7rem;
    }

    /* Vista QR dentro del Checkout */
    .qr-showcase-box {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .qr-white-frame {
      background: #ffffff;
      padding: 0.65rem;
      border-radius: 14px;
      border: 2px solid var(--accent);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      margin-bottom: 0.75rem;
    }

    .qr-code-img {
      width: 165px;
      height: 165px;
      object-fit: contain;
      display: block;
    }

    .qr-instructions {
      font-size: 0.74rem;
      color: var(--text-muted);
      max-width: 280px;
      line-height: 1.45;
      margin-bottom: 0.65rem;
    }

    .qr-ref-pill {
      width: 100%;
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: var(--text-muted);
    }

    .qr-ref-pill strong {
      color: var(--accent);
      font-family: monospace;
    }

    /* Vista Efectivo dentro del Checkout */
    .cash-info-box {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1.5rem 1.2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
    }

    .cash-icon-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.14);
      color: var(--accent);
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cash-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0;
    }

    .cash-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin: 0;
    }

    .cash-amount-pill {
      width: 100%;
      margin-top: 0.4rem;
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .cash-amount-pill strong {
      color: var(--accent);
    }

    /* Botón Principal "Pay now" con Gradiente Dorado-Ámbar de FashionStore */
    .pay-now-btn {
      width: 100%;
      padding: 0.9rem 1.4rem;
      border-radius: 10px;
      border: none;
      background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
      color: #18181b;
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(245, 158, 11, 0.3);
      transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .pay-now-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      filter: brightness(1.06);
      box-shadow: 0 14px 28px rgba(245, 158, 11, 0.4);
    }

    .pay-now-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .secondary-outline-btn {
      padding: 0.85rem 1.4rem;
      border-radius: 10px;
      border: 1.5px solid var(--border-color);
      background: transparent;
      color: var(--text-main);
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    /* Vista Paso 4: Comprobante Oficial (Review) */
    .review-success-box {
      text-align: center;
      padding: 1rem 0 0.5rem;
    }

    .success-icon-ring {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10b981;
      color: #10b981;
      font-size: 2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .receipt-card {
      max-width: 500px;
      margin: 0 auto;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 1.5rem;
      text-align: left;
    }

    .receipt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.75rem;
      margin-bottom: 0.85rem;
      border-bottom: 1px solid var(--border-color);
    }

    .receipt-title {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent);
    }

    .receipt-badge {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      font-size: 0.68rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .receipt-rows {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .receipt-row {
      display: flex;
      justify-content: space-between;
    }

    .receipt-row strong {
      color: var(--text-main);
    }

    .receipt-row.total {
      padding-top: 0.65rem;
      margin-top: 0.25rem;
      border-top: 1px dashed var(--border-color);
      font-size: 0.92rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .receipt-total-amount {
      color: var(--accent);
      font-size: 1.15rem;
      font-weight: 900;
    }
  `]
})
export class PagoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ventaService = inject(VentaService);
  private carritoService = inject(CarritoService);
  private saasService = inject(SaasService);
  private toastService = inject(ToastService);

  esSuscripcionSaas: boolean = false;
  saasPending: any = null;

  ventaId: number = 0;
  metodoPago: string = 'tarjeta_credito';
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
  simularRechazo: boolean = false;
  mensajeErrorRechazo: string = '';

  ngOnInit(): void {
    if (history.state?.orden) {
      this.asignarDatosOrden(history.state.orden);
    }

    this.route.params.subscribe(params => {
      const rawId = params['id'];

      // MODO 1: CHECKOUT DE SUSCRIPCIÓN SAAS (/pago/saas)
      if (rawId === 'saas') {
        const stored = sessionStorage.getItem('saas_pending_onboarding');
        if (!stored) {
          this.toastService.warning('Sin Plan Pendiente', 'Primero selecciona tu plan y registra los datos de tu empresa.');
          this.router.navigate(['/planes']);
          return;
        }
        this.esSuscripcionSaas = true;
        this.saasPending = JSON.parse(stored);
        this.monto = Number(this.saasPending.total_bs) || 139.00;
        this.titular = `${this.saasPending.admin_nombre || ''} ${this.saasPending.admin_apellido || ''}`.trim().toUpperCase() || 'ADMIN EMPRESA';
        this.cargandoOrden = false;
        this.generarQrFrontend();
        return;
      }

      // MODO 2: CHECKOUT DE COMPRA DE PRENDAS (/pago/:id)
      this.esSuscripcionSaas = false;
      this.ventaId = Number(rawId);
      if (this.ventaId) {
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
    if (this.esSuscripcionSaas && this.saasPending) {
      const payload = encodeURIComponent(`FASHIONSTORE-SAAS|NIT:${this.saasPending.nit}|PLAN:${this.saasPending.plan_nombre}|TOTAL:${totalVal}|BS`);
      return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${payload}`;
    }
    const idVal = this.ventaId || this.orden?.id || this.orden?.venta_id || 1;
    const payload = encodeURIComponent(`FASHIONSTORE|ORDEN:${idVal}|TOTAL:${totalVal}|BS|PAGOSIMPLE`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${payload}`;
  }

  generarQrFrontend(): void {
    if (!this.qrImage || !this.qrImage.startsWith('data:image')) {
      this.qrImage = this.obtenerFallbackQr();
    }
  }

  cargarOrden(): void {
    this.cargandoOrden = !this.orden;
    
    this.ventaService.getVenta(this.ventaId).subscribe({
      next: (res) => {
        this.asignarDatosOrden(res);
        this.cargandoOrden = false;

        if (res.estado === 'completada') {
          this.pagoExitoso = true;
          this.comprobanteNumero = res.numero_comprobante || 'COMP-' + this.ventaId;
        }
      },
      error: () => {
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
    this.mensajeErrorRechazo = '';

    // FLUJO 1: PAGO DE SUSCRIPCIÓN SAAS (ONBOARDING)
    if (this.esSuscripcionSaas && this.saasPending) {
      if (this.metodoPago === 'tarjeta_credito' && this.simularRechazo) {
        setTimeout(() => {
          this.loading = false;
          this.mensajeErrorRechazo = 'Transacción denegada por el banco emisor (Fondos insuficientes o tarjeta bloqueada). La suscripción SaaS no fue activada.';
          this.toastService.error('Pago Rechazado', this.mensajeErrorRechazo);
        }, 600);
        return;
      }

      this.saasService.onboarding({
        razon_social: this.saasPending.razon_social,
        nit: this.saasPending.nit,
        plan_nombre: this.saasPending.plan_nombre,
        admin_nombre: this.saasPending.admin_nombre,
        admin_apellido: this.saasPending.admin_apellido,
        admin_email: this.saasPending.admin_email,
        admin_password: this.saasPending.admin_password
      }).subscribe({
        next: (res: any) => {
          this.loading = false;
          this.pagoExitoso = true;
          this.comprobanteNumero = 'COMP-SAAS-' + (this.saasPending.nit || '2026');
          if (res?.access_token) {
            localStorage.setItem('fashionstore_token', res.access_token);
            localStorage.setItem('fashionstore_user', JSON.stringify(res));
          }
          sessionStorage.removeItem('saas_pending_onboarding');
          this.toastService.success('¡Suscripción Pagada y Activada!', `Comprobante ${this.comprobanteNumero} generado con éxito.`);
        },
        error: (err: any) => {
          this.loading = false;
          const msg = err?.error?.detail || 'No se pudo activar la suscripción. Verifica que el NIT o correo no estén duplicados.';
          this.mensajeErrorRechazo = msg;
          this.toastService.error('Error al Procesar Suscripción', msg);
        }
      });
      return;
    }

    // FLUJO 2: PAGO DE ORDEN DE PRENDAS NORMAL
    this.ventaService.pagarVenta(this.ventaId, {
      metodo_pago: this.metodoPago,
      monto: this.monto,
      simular_rechazo: this.simularRechazo,
      numero_tarjeta: this.numTarjeta
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.pagoExitoso = true;
        this.mensajeErrorRechazo = '';
        this.comprobanteNumero = res.numero_comprobante || 'COMP-FS2026';
        try {
          sessionStorage.removeItem('orden_activa');
          sessionStorage.removeItem('orden_' + this.ventaId);
        } catch (e) {}
        this.toastService.success('¡Pago Confirmado!', `Comprobante ${this.comprobanteNumero} generado con éxito.`, 6000);
        this.carritoService.refreshCount();
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.detail || 'Error al procesar la transacción.';
        this.mensajeErrorRechazo = msg;
        this.toastService.error('Pago No Procesado', msg);
      }
    });
  }

  irAlPanelEmpresa(): void {
    window.location.href = '/admin';
  }
}
