import { Component, OnInit, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentaService } from '../../services/venta.service';
import { ProductoService } from '../../services/producto.service';
import { ToastService } from '../../services/toast.service';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-pos-cambio-prenda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pos-cu13-wrapper animate-fade-in">

      <!-- ================================================================= -->
      <!-- CABECERA OPERACIÓN COMERCIAL: POS (CU12) & CAMBIO DE PRENDA (CU13)-->
      <!-- ================================================================= -->
      <div class="pos-header-card">
        <div class="pos-header-left">
          <div class="pos-badges-row">
            <span class="pos-badge-gold">
              <i class="fa-solid fa-arrows-rotate"></i> PAQUETE B • OPERACIÓN COMERCIAL
            </span>
            <span class="pos-badge-dark">
              <i class="fa-solid fa-scale-balanced"></i> RN20 (Plazo 15 días) &amp; RN21 (Kárdex Atómico)
            </span>
          </div>
          <h2 class="pos-main-title">Punto de Venta (POS) &amp; Cambio de Prenda</h2>
          <p class="pos-main-subtitle">
            Gestiona cambios de talla, color o modelo sobre ventas confirmadas (CU13) y registra ventas presenciales en caja (CU12).
          </p>
        </div>

        <div class="pos-header-right">
          <!-- Selector de Sucursal si no viene fijo -->
          <div class="pos-branch-box" *ngIf="sucursales.length > 0">
            <label class="pos-mini-label">Sucursal Operativa:</label>
            <select
              [(ngModel)]="sucursalActivaId"
              (ngModelChange)="onSucursalChange($event)"
              class="pos-branch-select"
            >
              <option *ngFor="let s of sucursales" [ngValue]="s.id">{{ s.nombre }}</option>
            </select>
          </div>

          <!-- Conmutador Sub-Modo: Cambio de Prenda (CU13) vs Caja POS (CU12) -->
          <div class="pos-mode-switcher">
            <button
              type="button"
              (click)="subModo = 'cambio'"
              class="pos-mode-btn"
              [class.active]="subModo === 'cambio'"
            >
              <i class="fa-solid fa-right-left"></i>
              <span>Cambio de Prenda (CU13)</span>
            </button>
            <button
              type="button"
              (click)="subModo = 'pos'"
              class="pos-mode-btn"
              [class.active]="subModo === 'pos'"
            >
              <i class="fa-solid fa-cash-register"></i>
              <span>Nueva Venta POS (CU12)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- MODO 1: GESTIONAR CAMBIO DE PRENDA (CU13 - RN20 & RN21)           -->
      <!-- ================================================================= -->
      <div *ngIf="subModo === 'cambio'" class="pos-cu13-grid">

        <!-- COLUMNA IZQUIERDA: PASO 1 (BUSCAR VENTA) + PASO 2 (PLAZO RN20) -->
        <div class="pos-panel-card">
          <div class="pos-step-header">
            <span class="pos-step-number">1</span>
            <div>
              <h3 class="pos-step-title">Buscar Comprobante de Venta Original</h3>
              <p class="pos-step-desc">Ingresa el N° de comprobante (ej. POS-XXXX o COMP-XXXX) o selecciona una venta reciente</p>
            </div>
          </div>

          <!-- Buscador por Comprobante -->
          <div class="pos-search-bar">
            <div class="pos-search-input-wrap">
              <i class="fa-solid fa-receipt pos-search-icon"></i>
              <input
                type="text"
                [(ngModel)]="terminoComprobante"
                (keyup.enter)="buscarPorComprobante()"
                placeholder="Ej: POS-BOU-001 o ID de venta..."
                class="pos-search-input"
              />
            </div>
            <button
              type="button"
              (click)="buscarPorComprobante()"
              [disabled]="buscandoComprobante"
              class="btn btn-primary pos-search-btn"
            >
              <i class="fa-solid" [ngClass]="buscandoComprobante ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'"></i>
              <span>Buscar</span>
            </button>
          </div>

          <!-- Chips Rápidos de Ventas Recientes de la Empresa -->
          <div class="pos-recent-sales-box" *ngIf="ventasRecientes.length > 0">
            <div class="pos-recent-header">
              <span><i class="fa-solid fa-clock-rotate-left"></i> Comprobantes Recientes de tu Empresa (1 Clic):</span>
              <button type="button" (click)="cargarDatosSucursal()" class="pos-link-btn">
                <i class="fa-solid fa-rotate"></i> Actualizar
              </button>
            </div>
            <div class="pos-recent-chips">
              <button
                type="button"
                *ngFor="let vr of ventasRecientes.slice(0, 8)"
                (click)="seleccionarVentaParaCambio(vr)"
                class="pos-sale-chip"
                [class.selected]="ventaSeleccionada?.id === vr.id"
                [class.expired]="!vr.dentro_plazo_rn20"
              >
                <span class="comp-code">{{ vr.numero_comprobante }}</span>
                <span class="comp-meta">
                  Bs. {{ vr.total | number:'1.2-2' }} •
                  <strong [style.color]="vr.dentro_plazo_rn20 ? '#34d399' : '#f87171'">
                    {{ vr.dias_transcurridos }}d {{ vr.dentro_plazo_rn20 ? '✓' : '⚠️ >15d' }}
                  </strong>
                </span>
              </button>
            </div>
          </div>

          <!-- ============================================================= -->
          <!-- PASO 2: VERIFICACIÓN AUTOMÁTICA DE PLAZO 15 DÍAS (RN20)       -->
          <!-- ============================================================= -->
          <div *ngIf="ventaSeleccionada" class="pos-rn20-container animate-fade-in">
            <div class="pos-step-header" style="margin-top: 1.25rem;">
              <span class="pos-step-number">2</span>
              <div>
                <h3 class="pos-step-title">Validación de Vigencia para Cambio (Regla RN20)</h3>
                <p class="pos-step-desc">Plazo máximo estándar: {{ ventaSeleccionada.plazo_maximo_dias }} días calendario desde la fecha de venta</p>
              </div>
            </div>

            <!-- Banner Vigente (<= 15 días) -->
            <div *ngIf="ventaSeleccionada.dentro_plazo_rn20" class="pos-rn20-alert valid">
              <div class="pos-rn20-icon">
                <i class="fa-solid fa-circle-check"></i>
              </div>
              <div class="pos-rn20-body">
                <div class="pos-rn20-title">
                  ✅ DENTRO DEL PLAZO PERMITIDO (RN20)
                </div>
                <p class="pos-rn20-text">
                  Comprobante <strong>{{ ventaSeleccionada.numero_comprobante }}</strong> emitido hace
                  <strong>{{ ventaSeleccionada.dias_transcurridos }} día(s)</strong> (Plazo límite: 15 días). El cambio está habilitado directamente.
                </p>
              </div>
            </div>

            <!-- Banner Vencido (> 15 días) + Flujo Alterno A1 (Autorización de Gerente/Encargado) -->
            <div *ngIf="!ventaSeleccionada.dentro_plazo_rn20" class="pos-rn20-alert expired">
              <div class="pos-rn20-icon">
                <i class="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div class="pos-rn20-body">
                <div class="pos-rn20-title">
                  ⚠️ PLAZO ESTÁNDAR DE 15 DÍAS VENCIDO ({{ ventaSeleccionada.dias_transcurridos }} DÍAS TRANSCURRIDOS)
                </div>
                <p class="pos-rn20-text">
                  Según la <strong>Regla RN20</strong>, esta venta supera los 15 días. Solo puede procesarse activando el
                  <strong>Flujo Alterno A1: Autorización Excepcional de Gerente / Encargado</strong>.
                </p>

                <div class="pos-exception-box">
                  <label class="pos-exception-toggle">
                    <input type="checkbox" [(ngModel)]="autorizadoExcepcion" />
                    <span>🔓 Autorizar Excepción de Plazo como Gerente / Encargado (Flujo Alterno A1)</span>
                  </label>

                  <div *ngIf="autorizadoExcepcion" class="pos-exception-input-wrap animate-fade-in">
                    <label class="pos-mini-label">Justificación Obligatoria de la Autorización *</label>
                    <input
                      type="text"
                      [(ngModel)]="justificacionExcepcion"
                      placeholder="Ej: Cliente VIP de provincia / Defecto de costura verificado por gerencia..."
                      class="pos-form-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Paso 2.2: Seleccionar qué ítem del recibo devuelve el cliente -->
            <div class="pos-items-origin-box">
              <label class="pos-mini-label" style="margin-bottom: 0.5rem; display: block;">
                Selecciona la Prenda que el Cliente Devuelve del Comprobante {{ ventaSeleccionada.numero_comprobante }}:
              </label>

              <div class="pos-origin-items-list">
                <div
                  *ngFor="let item of ventaSeleccionada.items"
                  (click)="seleccionarPrendaDevuelta(item)"
                  class="pos-origin-item-card"
                  [class.selected]="itemDevueltoSeleccionado?.variante_id === item.variante_id"
                >
                  <img
                    [src]="item.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100'"
                    alt="Prenda"
                    class="pos-origin-thumb"
                  />
                  <div class="pos-origin-info">
                    <div class="pos-origin-name">{{ item.producto }}</div>
                    <div class="pos-origin-attrs">
                      <span class="pos-tag">Talla {{ item.talla }}</span>
                      <span class="pos-tag">
                        <span class="color-dot" [style.background]="item.color_hex"></span>
                        {{ item.color }}
                      </span>
                      <span class="pos-tag">Cant. comprada: {{ item.cantidad }}</span>
                    </div>
                  </div>
                  <div class="pos-origin-price">
                    <span>Bs. {{ item.precio_unitario | number:'1.2-2' }}</span>
                    <i *ngIf="itemDevueltoSeleccionado?.variante_id === item.variante_id" class="fa-solid fa-circle-check check-gold"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Estado vacío si aún no seleccionó venta -->
          <div *ngIf="!ventaSeleccionada" class="pos-empty-placeholder">
            <i class="fa-solid fa-receipt"></i>
            <h4>Selecciona o busca un comprobante</h4>
            <p>Haz clic en cualquiera de los comprobantes recientes de arriba para cargar sus prendas al instante.</p>
          </div>
        </div>

        <!-- COLUMNA DERECHA: PASO 3 (PRENDA NUEVA + DIFERENCIA) + PASO 4 (CONFIRMAR RN21) -->
        <div class="pos-panel-card">
          <div class="pos-step-header">
            <span class="pos-step-number">3</span>
            <div>
              <h3 class="pos-step-title">Seleccionar Prenda Nueva de Reemplazo</h3>
              <p class="pos-step-desc">Elige la variante que se llevará el cliente del stock disponible en la sucursal</p>
            </div>
          </div>

          <!-- Filtro rápido de variantes en stock de la sucursal -->
          <div class="pos-search-bar" style="margin-bottom: 0.85rem;">
            <div class="pos-search-input-wrap">
              <i class="fa-solid fa-shirt pos-search-icon"></i>
              <input
                type="text"
                [(ngModel)]="filtroVarianteNueva"
                placeholder="Filtrar por prenda, talla (S, M, L), color o SKU..."
                class="pos-search-input"
              />
            </div>
          </div>

          <!-- Lista de Variantes Disponibles en la Sucursal -->
          <div class="pos-replacement-list">
            <div
              *ngFor="let v of variantesSucursalFiltradas"
              (click)="seleccionarVarianteNueva(v)"
              class="pos-replacement-card"
              [class.selected]="varianteNuevaSeleccionada?.variante_id === v.variante_id"
              [class.disabled]="v.cantidad_disponible <= 0 || v.variante_id === itemDevueltoSeleccionado?.variante_id"
            >
              <img
                [src]="v.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100'"
                alt="Variante"
                class="pos-origin-thumb"
              />
              <div class="pos-origin-info">
                <div class="pos-origin-name">
                  {{ v.producto_nombre }}
                  <span *ngIf="v.producto_id === itemDevueltoSeleccionado?.producto_id" class="pos-same-model-badge">
                    Mismo Modelo
                  </span>
                </div>
                <div class="pos-origin-attrs">
                  <span class="pos-tag">Talla <strong>{{ v.talla }}</strong></span>
                  <span class="pos-tag">
                    <span class="color-dot" [style.background]="v.color_hex"></span>
                    {{ v.color }}
                  </span>
                  <span class="pos-tag" [style.color]="v.cantidad_disponible > 0 ? '#34d399' : '#f87171'">
                    Stock: {{ v.cantidad_disponible }} uds.
                  </span>
                </div>
              </div>
              <div class="pos-origin-price">
                <span>Bs. {{ v.precio_unitario | number:'1.2-2' }}</span>
                <i *ngIf="varianteNuevaSeleccionada?.variante_id === v.variante_id" class="fa-solid fa-circle-check check-gold"></i>
              </div>
            </div>
          </div>

          <!-- ============================================================= -->
          <!-- PASO 4: LIQUIDACIÓN DE DIFERENCIA Y TRANSACCIÓN KÁRDEX (RN21) -->
          <!-- ============================================================= -->
          <div class="pos-settlement-card" *ngIf="ventaSeleccionada && itemDevueltoSeleccionado && varianteNuevaSeleccionada">
            <div class="pos-settlement-grid">
              <div>
                <label class="pos-mini-label">Cantidad a Cambiar</label>
                <input
                  type="number"
                  min="1"
                  [max]="itemDevueltoSeleccionado.cantidad"
                  [(ngModel)]="cantidadCambio"
                  class="pos-form-input"
                />
              </div>
              <div>
                <label class="pos-mini-label">Motivo del Cambio *</label>
                <select [(ngModel)]="motivoCambio" class="pos-form-input">
                  <option value="Cambio de talla solicitado por el cliente">Cambio de talla solicitado por el cliente</option>
                  <option value="Cambio de color de la misma prenda">Cambio de color de la misma prenda</option>
                  <option value="Cambio por otro modelo de mayor/menor valor">Cambio por otro modelo de catálogo</option>
                  <option value="Cambio por observación en costura o acabado">Cambio por observación de acabado</option>
                </select>
              </div>
            </div>

            <!-- Comparativa Financiera -->
            <div class="pos-financial-summary">
              <div class="pos-fin-row">
                <span><i class="fa-solid fa-arrow-rotate-left" style="color: #34d399;"></i> Entra al Stock (Devuelta): {{ itemDevueltoSeleccionado.producto }} ({{ itemDevueltoSeleccionado.talla }}/{{ itemDevueltoSeleccionado.color }}) x{{ cantidadCambio }}</span>
                <strong>Bs. {{ subtotalDevuelto | number:'1.2-2' }}</strong>
              </div>
              <div class="pos-fin-row">
                <span><i class="fa-solid fa-arrow-right-from-bracket" style="color: #fbbf24;"></i> Sale del Stock (Nueva): {{ varianteNuevaSeleccionada.producto_nombre }} ({{ varianteNuevaSeleccionada.talla }}/{{ varianteNuevaSeleccionada.color }}) x{{ cantidadCambio }}</span>
                <strong>Bs. {{ subtotalEntregado | number:'1.2-2' }}</strong>
              </div>
              <div class="pos-fin-divider"></div>
              <div class="pos-fin-total-row">
                <div>
                  <span class="pos-fin-total-label">
                    {{ diferenciaPrecio === 0 ? 'CAMBIO PARITARIO (SIN CARGO ADICIONAL)' : (diferenciaPrecio > 0 ? 'DIFERENCIA A COBRAR AL CLIENTE' : 'SALDO A FAVOR DEL CLIENTE') }}
                  </span>
                </div>
                <span
                  class="pos-fin-total-amount"
                  [style.color]="diferenciaPrecio === 0 ? '#34d399' : (diferenciaPrecio > 0 ? '#fbbf24' : '#60a5fa')"
                >
                  {{ diferenciaPrecio > 0 ? '+Bs. ' : 'Bs. ' }}{{ diferenciaPrecio | number:'1.2-2' }}
                </span>
              </div>
            </div>

            <!-- Selector de método de pago si hay diferencia positiva -->
            <div *ngIf="diferenciaPrecio > 0" class="pos-diff-pay-row">
              <label class="pos-mini-label">Método de Cobro de la Diferencia (+Bs. {{ diferenciaPrecio | number:'1.2-2' }}):</label>
              <div class="pos-pay-chips">
                <button type="button" (click)="metodoPagoDiferencia = 'efectivo'" class="pos-pay-chip" [class.active]="metodoPagoDiferencia === 'efectivo'">
                  💵 Efectivo
                </button>
                <button type="button" (click)="metodoPagoDiferencia = 'qr'" class="pos-pay-chip" [class.active]="metodoPagoDiferencia === 'qr'">
                  📱 QR Simple
                </button>
                <button type="button" (click)="metodoPagoDiferencia = 'tarjeta_debito'" class="pos-pay-chip" [class.active]="metodoPagoDiferencia === 'tarjeta_debito'">
                  💳 Tarjeta POS
                </button>
              </div>
            </div>

            <button
              type="button"
              (click)="confirmarCambioPrenda()"
              [disabled]="procesandoCambio"
              class="pos-confirm-exchange-btn"
            >
              <i class="fa-solid" [ngClass]="procesandoCambio ? 'fa-spinner fa-spin' : 'fa-check-double'"></i>
              <span>
                {{ procesandoCambio ? 'Actualizando Kárdex...' : 'Confirmar Cambio de Prenda y Emitir Comprobante CAM (RN21)' }}
              </span>
            </button>
          </div>

          <!-- Comprobante de Cambio Recién Emitido -->
          <div *ngIf="ultimoCambioExitoso" class="pos-receipt-success animate-fade-in">
            <div class="pos-receipt-header">
              <span class="pos-receipt-badge">
                <i class="fa-solid fa-circle-check"></i> KÁRDEX ACTUALIZADO ATÓMICAMENTE (RN21)
              </span>
              <strong class="pos-receipt-code">{{ ultimoCambioExitoso.numero_comprobante_cambio }}</strong>
            </div>
            <p class="pos-receipt-body">
              Cambio aplicado sobre comprobante <strong>{{ ultimoCambioExitoso.comprobante_original }}</strong> •
              Diferencia: <strong>Bs. {{ ultimoCambioExitoso.diferencia | number:'1.2-2' }}</strong> •
              Notificación Push enviada al celular.
            </p>
          </div>
        </div>

      </div>

      <!-- ================================================================= -->
      <!-- MODO 2: CAJA REGISTRADORA POS PRESENCIAL (CU12)                   -->
      <!-- ================================================================= -->
      <div *ngIf="subModo === 'pos'" class="pos-cu13-grid animate-fade-in">
        <!-- Catálogo rápido de sucursal -->
        <div class="pos-panel-card">
          <div class="pos-step-header">
            <span class="pos-step-number"><i class="fa-solid fa-shirt"></i></span>
            <div>
              <h3 class="pos-step-title">Catálogo con Stock en Sucursal (CU12)</h3>
              <p class="pos-step-desc">Haz clic en cualquier prenda para agregarla al ticket de venta presencial</p>
            </div>
          </div>

          <div class="pos-search-bar" style="margin-bottom: 0.85rem;">
            <div class="pos-search-input-wrap">
              <i class="fa-solid fa-magnifying-glass pos-search-icon"></i>
              <input
                type="text"
                [(ngModel)]="filtroVarianteNueva"
                placeholder="Buscar prenda por nombre, talla, color o SKU..."
                class="pos-search-input"
              />
            </div>
          </div>

          <div class="pos-replacement-list" style="max-height: 430px;">
            <div
              *ngFor="let v of variantesSucursalFiltradas"
              (click)="agregarAlCarritoPos(v)"
              class="pos-replacement-card"
              [class.disabled]="v.cantidad_disponible <= 0"
            >
              <img
                [src]="v.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100'"
                alt="Prenda"
                class="pos-origin-thumb"
              />
              <div class="pos-origin-info">
                <div class="pos-origin-name">{{ v.producto_nombre }}</div>
                <div class="pos-origin-attrs">
                  <span class="pos-tag">Talla {{ v.talla }}</span>
                  <span class="pos-tag">
                    <span class="color-dot" [style.background]="v.color_hex"></span>
                    {{ v.color }}
                  </span>
                  <span class="pos-tag" style="color: #34d399;">Disponible: {{ v.cantidad_disponible }} uds.</span>
                </div>
              </div>
              <div class="pos-origin-price">
                <span>Bs. {{ v.precio_unitario | number:'1.2-2' }}</span>
                <span class="pos-add-pill"><i class="fa-solid fa-plus"></i> Agregar</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Ticket de Caja POS -->
        <div class="pos-panel-card">
          <div class="pos-step-header">
            <span class="pos-step-number"><i class="fa-solid fa-cash-register"></i></span>
            <div>
              <h3 class="pos-step-title">Ticket de Venta en Caja</h3>
              <p class="pos-step-desc">Emite comprobante POS inmediato y descuenta el inventario de la sucursal</p>
            </div>
          </div>

          <div *ngIf="carritoPos.length === 0" class="pos-empty-placeholder">
            <i class="fa-solid fa-basket-shopping"></i>
            <h4>Ticket vacío</h4>
            <p>Selecciona prendas de la columna izquierda para armar la venta en caja.</p>
          </div>

          <div *ngIf="carritoPos.length > 0" class="pos-cart-list">
            <div *ngFor="let item of carritoPos; let i = index" class="pos-cart-row">
              <div class="pos-cart-info">
                <strong>{{ item.producto_nombre }}</strong>
                <span>Talla {{ item.talla }} • {{ item.color }} • Bs. {{ item.precio_unitario | number:'1.2-2' }} c/u</span>
              </div>
              <div class="pos-cart-actions">
                <span class="pos-cart-qty">x{{ item.cantidad }}</span>
                <strong class="pos-cart-sub">Bs. {{ (item.cantidad * item.precio_unitario) | number:'1.2-2' }}</strong>
                <button type="button" (click)="quitarDelCarritoPos(i)" class="pos-cart-del">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>

            <div class="pos-diff-pay-row" style="margin-top: 1rem;">
              <label class="pos-mini-label">Método de Pago en Caja:</label>
              <div class="pos-pay-chips">
                <button type="button" (click)="metodoPagoPos = 'efectivo'" class="pos-pay-chip" [class.active]="metodoPagoPos === 'efectivo'">
                  💵 Efectivo
                </button>
                <button type="button" (click)="metodoPagoPos = 'qr'" class="pos-pay-chip" [class.active]="metodoPagoPos === 'qr'">
                  📱 QR Simple
                </button>
                <button type="button" (click)="metodoPagoPos = 'tarjeta_debito'" class="pos-pay-chip" [class.active]="metodoPagoPos === 'tarjeta_debito'">
                  💳 Tarjeta Débito/Crédito
                </button>
              </div>
            </div>

            <div class="pos-fin-total-row" style="margin: 1.1rem 0;">
              <span class="pos-fin-total-label">TOTAL A COBRAR EN CAJA:</span>
              <span class="pos-fin-total-amount" style="color: #fbbf24;">Bs. {{ totalCarritoPos | number:'1.2-2' }}</span>
            </div>

            <button
              type="button"
              (click)="confirmarVentaPos()"
              [disabled]="procesandoPos"
              class="pos-confirm-exchange-btn"
            >
              <i class="fa-solid" [ngClass]="procesandoPos ? 'fa-spinner fa-spin' : 'fa-receipt'"></i>
              <span>{{ procesandoPos ? 'Emitiendo Comprobante POS...' : 'Cobrar y Emitir Comprobante POS (CU12)' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- HISTORIAL DE CAMBIOS DE PRENDA REALIZADOS EN LA EMPRESA (CU13)    -->
      <!-- ================================================================= -->
      <div class="pos-history-card" *ngIf="historialCambios.length > 0">
        <div class="pos-history-header">
          <div>
            <h3 class="pos-step-title">
              <i class="fa-solid fa-clock-rotate-left" style="color: #f59e0b; margin-right: 0.4rem;"></i>
              Historial de Cambios de Prenda y Movimientos CAM (CU13)
            </h3>
            <p class="pos-step-desc">Registro auditable de devoluciones y entregas procesadas bajo RN20 y RN21</p>
          </div>
          <span class="pos-badge-gold">{{ historialCambios.length }} cambio(s) registrado(s)</span>
        </div>

        <div class="table-responsive">
          <table class="table" style="width: 100%;">
            <thead>
              <tr>
                <th>Comprobante Cambio</th>
                <th>Venta Origen</th>
                <th>Prenda Devuelta (+Stock)</th>
                <th>Prenda Entregada (-Stock)</th>
                <th style="text-align: right;">Diferencia</th>
                <th>Motivo / Autorización RN20</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of historialCambios">
                <td>
                  <span class="pos-cam-pill">{{ c.numero_comprobante_cambio }}</span>
                </td>
                <td>
                  <strong style="color: var(--text-main); font-family: monospace;">{{ c.comprobante_original }}</strong>
                </td>
                <td style="color: #34d399; font-weight: 600;">
                  +{{ c.cantidad }} {{ c.prenda_devuelta }}
                </td>
                <td style="color: #fbbf24; font-weight: 600;">
                  -{{ c.cantidad }} {{ c.prenda_entregada }}
                </td>
                <td style="text-align: right; font-weight: 800;" [style.color]="c.diferencia > 0 ? '#fbbf24' : (c.diferencia < 0 ? '#60a5fa' : '#34d399')">
                  {{ c.diferencia > 0 ? '+Bs. ' : 'Bs. ' }}{{ c.diferencia | number:'1.2-2' }}
                </td>
                <td>
                  <span style="font-size: 0.78rem; color: var(--text-muted);">{{ c.motivo }}</span>
                  <span *ngIf="c.autorizado_excepcion" class="pos-exc-badge" title="{{ c.justificacion_excepcion }}">
                    🔓 Excepción Gerente
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .pos-cu13-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      width: 100%;
    }
    .pos-header-card {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      padding: 1.5rem 1.75rem;
      background: linear-gradient(145deg, #14141b, #1b1b24);
      border: 1.5px solid rgba(245, 158, 11, 0.3);
      border-radius: 20px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
    }
    .pos-badges-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.45rem;
    }
    .pos-badge-gold {
      background: rgba(245, 158, 11, 0.16);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.22rem 0.7rem;
      border-radius: 999px;
      letter-spacing: 0.04em;
    }
    .pos-badge-dark {
      background: #22222e;
      color: #a1a1aa;
      border: 1px solid #323242;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.22rem 0.7rem;
      border-radius: 999px;
    }
    .pos-main-title {
      font-family: var(--font-serif);
      font-size: 1.65rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }
    .pos-main-subtitle {
      font-size: 0.83rem;
      color: #a1a1aa;
      margin: 0.25rem 0 0 0;
    }
    .pos-header-right {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
    }
    .pos-branch-box {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .pos-mini-label {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #a1a1aa;
    }
    .pos-branch-select {
      background: #0e0e13;
      color: #ffffff;
      border: 1.5px solid #2e2e3d;
      border-radius: 10px;
      padding: 0.5rem 0.85rem;
      font-size: 0.84rem;
      font-weight: 700;
      outline: none;
    }
    .pos-mode-switcher {
      display: inline-flex;
      background: #0e0e13;
      padding: 0.3rem;
      border-radius: 14px;
      border: 1px solid #2c2c3a;
      gap: 0.3rem;
    }
    .pos-mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.1rem;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #a1a1aa;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .pos-mode-btn.active {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #09090b;
      font-weight: 800;
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
    }

    .pos-cu13-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 1024px) {
      .pos-cu13-grid {
        grid-template-columns: 1fr;
      }
    }
    .pos-panel-card {
      background: var(--card-bg, #14141b);
      border: 1.5px solid var(--border-color, #272732);
      border-radius: 20px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .pos-step-header {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .pos-step-number {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: rgba(245, 158, 11, 0.16);
      border: 1.5px solid #f59e0b;
      color: #fbbf24;
      font-weight: 900;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .pos-step-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--text-main, #ffffff);
      margin: 0;
    }
    .pos-step-desc {
      font-size: 0.76rem;
      color: var(--text-muted, #a1a1aa);
      margin: 0.1rem 0 0 0;
    }
    .pos-search-bar {
      display: flex;
      gap: 0.6rem;
    }
    .pos-search-input-wrap {
      position: relative;
      flex: 1;
    }
    .pos-search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #f59e0b;
    }
    .pos-search-input {
      width: 100%;
      padding: 0.7rem 0.9rem 0.7rem 2.4rem;
      border-radius: 12px;
      border: 1.5px solid var(--border-color, #2e2e3d);
      background: #0e0e13;
      color: #ffffff;
      font-size: 0.88rem;
      box-sizing: border-box;
      outline: none;
    }
    .pos-search-input:focus {
      border-color: #f59e0b;
    }
    .pos-search-btn {
      padding: 0 1.2rem;
      border-radius: 12px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .pos-recent-sales-box {
      background: #0e0e13;
      border: 1px solid #252532;
      border-radius: 14px;
      padding: 0.85rem;
    }
    .pos-recent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: #a1a1aa;
      margin-bottom: 0.6rem;
    }
    .pos-link-btn {
      background: none;
      border: none;
      color: #fbbf24;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
    }
    .pos-recent-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .pos-sale-chip {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0.45rem 0.75rem;
      border-radius: 10px;
      background: #16161f;
      border: 1.5px solid #2b2b3a;
      color: #ffffff;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pos-sale-chip:hover {
      border-color: #f59e0b;
    }
    .pos-sale-chip.selected {
      background: rgba(245, 158, 11, 0.15);
      border-color: #f59e0b;
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.25);
    }
    .pos-sale-chip .comp-code {
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 800;
      color: #fbbf24;
    }
    .pos-sale-chip .comp-meta {
      font-size: 0.68rem;
      color: #a1a1aa;
    }

    .pos-rn20-alert {
      display: flex;
      gap: 0.85rem;
      padding: 1rem;
      border-radius: 14px;
      margin-top: 0.65rem;
    }
    .pos-rn20-alert.valid {
      background: rgba(16, 185, 129, 0.1);
      border: 1.5px solid rgba(16, 185, 129, 0.4);
    }
    .pos-rn20-alert.expired {
      background: rgba(239, 68, 68, 0.1);
      border: 1.5px solid rgba(239, 68, 68, 0.45);
    }
    .pos-rn20-icon {
      font-size: 1.4rem;
      padding-top: 0.1rem;
    }
    .pos-rn20-alert.valid .pos-rn20-icon { color: #34d399; }
    .pos-rn20-alert.expired .pos-rn20-icon { color: #f87171; }
    .pos-rn20-title {
      font-size: 0.8rem;
      font-weight: 900;
      letter-spacing: 0.03em;
      color: #ffffff;
    }
    .pos-rn20-text {
      font-size: 0.76rem;
      color: #d4d4d8;
      margin: 0.25rem 0 0 0;
      line-height: 1.45;
    }
    .pos-exception-box {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px dashed rgba(248, 113, 113, 0.35);
    }
    .pos-exception-toggle {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      font-size: 0.78rem;
      font-weight: 800;
      color: #fbbf24;
      cursor: pointer;
    }
    .pos-exception-input-wrap {
      margin-top: 0.6rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .pos-form-input {
      width: 100%;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      border: 1.5px solid #2e2e3d;
      background: #0e0e13;
      color: #ffffff;
      font-size: 0.82rem;
      box-sizing: border-box;
    }

    .pos-origin-items-list, .pos-replacement-list {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      max-height: 290px;
      overflow-y: auto;
      padding-right: 0.25rem;
    }
    .pos-origin-item-card, .pos-replacement-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.7rem 0.9rem;
      border-radius: 12px;
      background: #0e0e13;
      border: 1.5px solid #252533;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pos-origin-item-card:hover, .pos-replacement-card:hover:not(.disabled) {
      border-color: #f59e0b;
    }
    .pos-origin-item-card.selected, .pos-replacement-card.selected {
      background: rgba(245, 158, 11, 0.12);
      border-color: #f59e0b;
    }
    .pos-replacement-card.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
    .pos-origin-thumb {
      width: 46px;
      height: 46px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #2e2e3d;
      flex-shrink: 0;
    }
    .pos-origin-info {
      flex: 1;
      min-width: 0;
    }
    .pos-origin-name {
      font-size: 0.84rem;
      font-weight: 800;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .pos-same-model-badge {
      background: rgba(52, 211, 153, 0.15);
      color: #34d399;
      font-size: 0.64rem;
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
      border: 1px solid rgba(52, 211, 153, 0.35);
    }
    .pos-origin-attrs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.25rem;
    }
    .pos-tag {
      font-size: 0.7rem;
      color: #a1a1aa;
      background: #181822;
      padding: 0.12rem 0.5rem;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .color-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .pos-origin-price {
      text-align: right;
      font-weight: 800;
      font-size: 0.86rem;
      color: #fbbf24;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .check-gold {
      color: #f59e0b;
      font-size: 1rem;
    }
    .pos-add-pill {
      font-size: 0.68rem;
      background: rgba(245, 158, 11, 0.16);
      color: #fbbf24;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
    }

    .pos-settlement-card {
      margin-top: 0.5rem;
      padding: 1rem;
      border-radius: 16px;
      background: #0e0e13;
      border: 1.5px solid rgba(245, 158, 11, 0.35);
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .pos-settlement-grid {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 0.75rem;
    }
    .pos-financial-summary {
      background: #15151e;
      border-radius: 12px;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .pos-fin-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.76rem;
      color: #d4d4d8;
    }
    .pos-fin-divider {
      height: 1px;
      background: #2b2b3a;
      margin: 0.2rem 0;
    }
    .pos-fin-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pos-fin-total-label {
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #a1a1aa;
    }
    .pos-fin-total-amount {
      font-family: var(--font-serif);
      font-size: 1.35rem;
      font-weight: 900;
    }
    .pos-diff-pay-row {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .pos-pay-chips {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .pos-pay-chip {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border-radius: 10px;
      border: 1.5px solid #2b2b3a;
      background: #15151e;
      color: #d4d4d8;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
    }
    .pos-pay-chip.active {
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.16);
      color: #fbbf24;
    }
    .pos-confirm-exchange-btn {
      width: 100%;
      padding: 0.9rem 1.2rem;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #09090b;
      font-size: 0.88rem;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      box-shadow: 0 8px 22px rgba(245, 158, 11, 0.3);
    }
    .pos-confirm-exchange-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .pos-receipt-success {
      padding: 0.95rem 1.1rem;
      border-radius: 14px;
      background: rgba(16, 185, 129, 0.12);
      border: 1.5px solid #10b981;
    }
    .pos-receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.3rem;
    }
    .pos-receipt-badge {
      font-size: 0.7rem;
      font-weight: 900;
      color: #34d399;
    }
    .pos-receipt-code {
      font-family: monospace;
      font-size: 0.95rem;
      color: #ffffff;
      background: #065f46;
      padding: 0.15rem 0.6rem;
      border-radius: 6px;
    }
    .pos-receipt-body {
      font-size: 0.76rem;
      color: #d4d4d8;
      margin: 0;
    }

    .pos-empty-placeholder {
      text-align: center;
      padding: 2.5rem 1rem;
      color: #71717a;
      border: 1.5px dashed #272732;
      border-radius: 16px;
    }
    .pos-empty-placeholder i {
      font-size: 2rem;
      color: #f59e0b;
      opacity: 0.5;
      margin-bottom: 0.5rem;
    }
    .pos-empty-placeholder h4 {
      color: #d4d4d8;
      margin: 0.2rem 0;
      font-size: 0.95rem;
    }
    .pos-empty-placeholder p {
      font-size: 0.76rem;
      margin: 0;
    }

    .pos-cart-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .pos-cart-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 0.85rem;
      background: #0e0e13;
      border: 1px solid #262634;
      border-radius: 10px;
    }
    .pos-cart-info strong {
      display: block;
      font-size: 0.83rem;
      color: #ffffff;
    }
    .pos-cart-info span {
      font-size: 0.72rem;
      color: #a1a1aa;
    }
    .pos-cart-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .pos-cart-qty {
      font-weight: 800;
      color: #fbbf24;
      font-size: 0.82rem;
    }
    .pos-cart-sub {
      color: #ffffff;
      font-size: 0.85rem;
    }
    .pos-cart-del {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 7px;
      cursor: pointer;
    }

    .pos-history-card {
      background: var(--card-bg, #14141b);
      border: 1.5px solid var(--border-color, #272732);
      border-radius: 20px;
      padding: 1.5rem;
    }
    .pos-history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .pos-cam-pill {
      font-family: monospace;
      font-weight: 800;
      font-size: 0.78rem;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
    }
    .pos-exc-badge {
      display: inline-block;
      margin-left: 0.4rem;
      font-size: 0.68rem;
      font-weight: 800;
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      padding: 0.1rem 0.45rem;
      border-radius: 6px;
    }
  `]
})
export class PosCambioPrendaComponent implements OnInit, OnChanges {
  private ventaService = inject(VentaService);
  private productoService = inject(ProductoService);
  private toastService = inject(ToastService);

  @Input() sucursalIdInput: number | null = null;

  subModo: 'cambio' | 'pos' = 'cambio';
  sucursales: Sucursal[] = [];
  sucursalActivaId: number = 1;

  // Datos CU13: Cambio de Prenda
  terminoComprobante: string = '';
  buscandoComprobante: boolean = false;
  ventasRecientes: any[] = [];
  ventaSeleccionada: any = null;
  itemDevueltoSeleccionado: any = null;
  variantesSucursal: any[] = [];
  filtroVarianteNueva: string = '';
  varianteNuevaSeleccionada: any = null;

  cantidadCambio: number = 1;
  motivoCambio: string = 'Cambio de talla solicitado por el cliente';
  metodoPagoDiferencia: string = 'efectivo';
  autorizadoExcepcion: boolean = false;
  justificacionExcepcion: string = '';
  procesandoCambio: boolean = false;
  ultimoCambioExitoso: any = null;
  historialCambios: any[] = [];

  // Datos CU12: Caja Registradora POS
  carritoPos: any[] = [];
  metodoPagoPos: string = 'efectivo';
  procesandoPos: boolean = false;

  ngOnInit(): void {
    this.productoService.getSucursales().subscribe({
      next: (sucs) => {
        this.sucursales = sucs || [];
        if (this.sucursalIdInput) {
          this.sucursalActivaId = this.sucursalIdInput;
        } else if (this.sucursales.length > 0) {
          this.sucursalActivaId = this.sucursales[0].id;
        }
        this.cargarDatosSucursal();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sucursalIdInput'] && this.sucursalIdInput) {
      this.sucursalActivaId = this.sucursalIdInput;
      this.cargarDatosSucursal();
    }
  }

  onSucursalChange(nuevoId: number): void {
    this.sucursalActivaId = Number(nuevoId);
    this.cargarDatosSucursal();
  }

  cargarDatosSucursal(): void {
    if (!this.sucursalActivaId) return;

    this.ventaService.getVentasRecientesPos(this.sucursalActivaId).subscribe({
      next: (ventas) => {
        this.ventasRecientes = ventas || [];
        if (!this.ventaSeleccionada && this.ventasRecientes.length > 0) {
          this.seleccionarVentaParaCambio(this.ventasRecientes[0]);
        }
      }
    });

    this.ventaService.getCatalogoVariantesSucursal(this.sucursalActivaId).subscribe({
      next: (vars) => {
        this.variantesSucursal = vars || [];
      }
    });

    this.ventaService.getHistorialCambios(this.sucursalActivaId).subscribe({
      next: (hist) => {
        this.historialCambios = hist || [];
      }
    });
  }

  buscarPorComprobante(): void {
    const q = (this.terminoComprobante || '').trim();
    if (!q) {
      this.toastService.error('Campo Requerido', 'Ingresa un número de comprobante (ej: POS-XXXX) o ID de venta.');
      return;
    }
    this.buscandoComprobante = true;
    this.ventaService.buscarVentaPorComprobante(q).subscribe({
      next: (venta) => {
        this.buscandoComprobante = false;
        this.seleccionarVentaParaCambio(venta);
        this.toastService.success('Comprobante Encontrado', `Venta ${venta.numero_comprobante} cargada para cambio.`);
      },
      error: (err) => {
        this.buscandoComprobante = false;
        this.toastService.error('No Encontrado', err.error?.detail || 'No se encontró ese comprobante en tu empresa.');
      }
    });
  }

  seleccionarVentaParaCambio(venta: any): void {
    this.ventaSeleccionada = venta;
    this.terminoComprobante = venta.numero_comprobante || '';
    this.autorizadoExcepcion = false;
    this.justificacionExcepcion = '';
    this.ultimoCambioExitoso = null;
    if (venta.items && venta.items.length > 0) {
      this.seleccionarPrendaDevuelta(venta.items[0]);
    } else {
      this.itemDevueltoSeleccionado = null;
    }
  }

  seleccionarPrendaDevuelta(item: any): void {
    this.itemDevueltoSeleccionado = item;
    this.cantidadCambio = 1;
    // Preseleccionar otra variante con stock si existe
    const candidata = this.variantesSucursal.find(
      v => v.cantidad_disponible > 0 && v.variante_id !== item.variante_id
    );
    if (candidata) {
      this.varianteNuevaSeleccionada = candidata;
    }
  }

  get variantesSucursalFiltradas(): any[] {
    const q = (this.filtroVarianteNueva || '').trim().toLowerCase();
    let lista = this.variantesSucursal;
    if (q) {
      lista = lista.filter(v =>
        (v.producto_nombre || '').toLowerCase().includes(q) ||
        (v.talla || '').toLowerCase().includes(q) ||
        (v.color || '').toLowerCase().includes(q) ||
        (v.sku || '').toLowerCase().includes(q)
      );
    }
    // Priorizar variantes del mismo producto primero para facilitar cambios de talla/color
    const prodId = this.itemDevueltoSeleccionado?.producto_id;
    return [...lista].sort((a, b) => {
      const aSame = a.producto_id === prodId ? 0 : 1;
      const bSame = b.producto_id === prodId ? 0 : 1;
      return aSame - bSame;
    });
  }

  seleccionarVarianteNueva(v: any): void {
    if (v.cantidad_disponible <= 0 || v.variante_id === this.itemDevueltoSeleccionado?.variante_id) {
      return;
    }
    this.varianteNuevaSeleccionada = v;
  }

  get subtotalDevuelto(): number {
    if (!this.itemDevueltoSeleccionado) return 0;
    return Number(this.itemDevueltoSeleccionado.precio_unitario || 0) * (this.cantidadCambio || 1);
  }

  get subtotalEntregado(): number {
    if (!this.varianteNuevaSeleccionada) return 0;
    return Number(this.varianteNuevaSeleccionada.precio_unitario || 0) * (this.cantidadCambio || 1);
  }

  get diferenciaPrecio(): number {
    return Math.round((this.subtotalEntregado - this.subtotalDevuelto) * 100) / 100;
  }

  confirmarCambioPrenda(): void {
    if (!this.ventaSeleccionada || !this.itemDevueltoSeleccionado || !this.varianteNuevaSeleccionada) {
      return;
    }
    if (!this.ventaSeleccionada.dentro_plazo_rn20) {
      if (!this.autorizadoExcepcion || !(this.justificacionExcepcion || '').trim()) {
        this.toastService.error(
          'Plazo RN20 Vencido',
          'Esta venta supera los 15 días. Activa la casilla de Autorización de Gerente/Encargado y escribe la justificación.'
        );
        return;
      }
    }

    this.procesandoCambio = true;
    this.ventaService.registrarCambioPrenda({
      venta_id: this.ventaSeleccionada.id,
      sucursal_id: this.sucursalActivaId,
      variante_devuelta_id: this.itemDevueltoSeleccionado.variante_id,
      variante_entregada_id: this.varianteNuevaSeleccionada.variante_id,
      cantidad: Number(this.cantidadCambio || 1),
      motivo: this.motivoCambio,
      metodo_pago_diferencia: this.metodoPagoDiferencia,
      autorizado_excepcion: this.autorizadoExcepcion,
      justificacion_excepcion: this.justificacionExcepcion
    }).subscribe({
      next: (res) => {
        this.procesandoCambio = false;
        this.ultimoCambioExitoso = res;
        this.toastService.success(
          `¡Cambio ${res.numero_comprobante_cambio} Registrado!`,
          'El Kárdex incrementó la prenda devuelta y descontó la prenda entregada.'
        );
        this.cargarDatosSucursal();
      },
      error: (err) => {
        this.procesandoCambio = false;
        this.toastService.error('Error en Cambio (CU13)', err.error?.detail || 'No se pudo procesar el cambio de prenda.');
      }
    });
  }

  // --- Métodos Modo 2: Venta Presencial POS (CU12) ---
  agregarAlCarritoPos(v: any): void {
    if (v.cantidad_disponible <= 0) return;
    const existente = this.carritoPos.find(i => i.variante_id === v.variante_id);
    if (existente) {
      if (existente.cantidad < v.cantidad_disponible) {
        existente.cantidad++;
      } else {
        this.toastService.error('Stock Límite', 'Ya agregaste el máximo stock disponible de esta variante.');
      }
    } else {
      this.carritoPos.push({
        variante_id: v.variante_id,
        producto_nombre: v.producto_nombre,
        talla: v.talla,
        color: v.color,
        precio_unitario: v.precio_unitario,
        cantidad: 1
      });
    }
  }

  quitarDelCarritoPos(index: number): void {
    this.carritoPos.splice(index, 1);
  }

  get totalCarritoPos(): number {
    return this.carritoPos.reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0);
  }

  confirmarVentaPos(): void {
    if (this.carritoPos.length === 0) return;
    this.procesandoPos = true;
    this.ventaService.ventaPos({
      sucursal_id: this.sucursalActivaId,
      metodo_pago: this.metodoPagoPos,
      items: this.carritoPos.map(i => ({
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario
      }))
    }).subscribe({
      next: (res) => {
        this.procesandoPos = false;
        this.carritoPos = [];
        this.toastService.success(
          `¡Venta POS ${res.numero_comprobante} Registrada!`,
          `Total cobrado: Bs. ${Number(res.total).toFixed(2)}. Ya aparece en comprobantes recientes.`
        );
        this.cargarDatosSucursal();
      },
      error: (err) => {
        this.procesandoPos = false;
        this.toastService.error('Error en Venta POS', err.error?.detail || 'No se pudo registrar la venta.');
      }
    });
  }
}
