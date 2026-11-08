import { Component, OnInit, OnDestroy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CajaService, CajaTurno } from '../../services/caja.service';
import { ProductoService } from '../../services/producto.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-caja-turno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="caja-wrapper animate-fade-in">
      
      <!-- CABECERA PRINCIPAL -->
      <div class="caja-header-card">
        <div class="caja-header-left">
          <div class="caja-badges-row">
            <span class="badge-gold">
              <i class="fa-solid fa-vault"></i> APORTE PROPIO &bull; CU30
            </span>
            <span class="badge-dark">
              <i class="fa-solid fa-shield-halved"></i> Control de Caja, Arqueo Físico & Cierre por Turno
            </span>
            <span class="badge-pill" [class.badge-open]="esTurnoAbierto" [class.badge-closed]="!esTurnoAbierto">
              <i class="fa-solid" [class.fa-lock-open]="esTurnoAbierto" [class.fa-lock]="!esTurnoAbierto"></i>
              {{ esTurnoAbierto ? 'TURNO ACTIVO EN CURSO' : 'CAJA CERRADA' }}
            </span>
          </div>
          <h2 class="caja-main-title">Control de Caja y Turnos de Cajero</h2>
          <p class="caja-main-subtitle">
            Apertura con fondo de cambio, monitoreo de ventas en efectivo en tiempo real, arqueo ciego y auditoría de discrepancias (sobrantes/faltantes).
          </p>
        </div>

        <div class="caja-header-right">
          <div class="sucursal-box" *ngIf="sucursales.length > 0">
            <label class="caja-mini-label">Sucursal:</label>
            <select
              [(ngModel)]="sucursalSeleccionadaId"
              (ngModelChange)="onSucursalChange($event)"
              class="caja-select"
              [disabled]="procesando"
            >
              <option *ngFor="let s of sucursales" [ngValue]="s.id">{{ s.nombre }}</option>
            </select>
          </div>
          <button type="button" (click)="recargarTodo()" class="caja-btn-refresh" [disabled]="cargando" title="Refrescar estado">
            <i class="fa-solid fa-rotate" [class.fa-spin]="cargando"></i>
          </button>
        </div>
      </div>

      <!-- CARGANDO SPINNER -->
      <div *ngIf="cargando" class="caja-loading">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
        <p class="mt-2 text-sm text-gray-400">Consultando estado de turno de caja...</p>
      </div>

      <!-- CONTENIDO PRINCIPAL CUANDO NO ESTÁ CARGANDO -->
      <div *ngIf="!cargando" class="caja-body">

        <!-- ========================================================= -->
        <!-- ESTADO 1: CAJA CERRADA -> FORMULARIO DE APERTURA DE TURNO -->
        <!-- ========================================================= -->
        <div *ngIf="!turnoActivo" class="card-apertura">
          <div class="apertura-hero">
            <div class="apertura-icon-wrap">
              <i class="fa-solid fa-cash-register"></i>
            </div>
            <div>
              <h3 class="text-xl font-bold text-white">No hay un turno de caja abierto en esta sucursal</h3>
              <p class="text-sm text-gray-400 mt-1">
                Para comenzar a facturar en el punto de venta o recibir cobros en efectivo, debes registrar la apertura del turno indicando el fondo inicial de cambio.
              </p>
            </div>
          </div>

          <div class="apertura-form-grid">
            <div class="form-group">
              <label class="form-label">
                <i class="fa-solid fa-money-bill-wave text-amber-500 mr-1"></i> Fondo Inicial en Efectivo (Bs.) *
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                [(ngModel)]="formApertura.monto_apertura"
                placeholder="Ej. 150.00"
                class="form-input"
              />
              <span class="form-hint">Efectivo físico entregado al cajero para dar vuelto / cambio inicial.</span>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i class="fa-solid fa-comment text-gray-400 mr-1"></i> Observaciones de Turno (Opcional)
              </label>
              <input
                type="text"
                [(ngModel)]="formApertura.observaciones"
                placeholder="Ej. Turno Mañana - Cajero Principal"
                class="form-input"
              />
              <span class="form-hint">Detalle adicional sobre el turno o la asignación.</span>
            </div>
          </div>

          <div class="apertura-actions">
            <button
              type="button"
              (click)="abrirCaja()"
              [disabled]="procesando || formApertura.monto_apertura < 0"
              class="btn-abrir-caja"
            >
              <i class="fa-solid fa-lock-open mr-2"></i>
              <span>{{ procesando ? 'Registrando Apertura...' : 'Abrir Turno de Caja' }}</span>
            </button>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- ESTADO 2: CAJA ABIERTA -> MONITOREO DE VENTAS & ARQUEO    -->
        <!-- ========================================================= -->
        <div *ngIf="turnoActivo" class="card-turno-activo">
          
          <!-- Banner de información de turno -->
          <div class="turno-info-banner">
            <div class="turno-info-col">
              <span class="info-tag">TURNO #{{ turnoActivo.id }}</span>
              <h3 class="turno-title">
                <i class="fa-solid fa-circle text-emerald-400 text-xs animate-ping mr-2"></i>
                Caja Operativa &bull; {{ turnoActivo.sucursal_nombre }}
              </h3>
              <p class="turno-cajero">
                <i class="fa-solid fa-user-tie text-amber-400 mr-1"></i> Responsable: <strong>{{ turnoActivo.cajero_nombre }}</strong>
                <span class="mx-2 text-gray-600">|</span>
                <i class="fa-regular fa-clock text-gray-400 mr-1"></i> Apertura: {{ formatearFecha(turnoActivo.fecha_apertura) }}
              </p>
            </div>
            <div class="turno-banner-actions">
              <button
                type="button"
                (click)="mostrarModalCierre = true; prepararCierre()"
                class="btn-iniciar-arqueo"
              >
                <i class="fa-solid fa-scale-balanced mr-2"></i>
                <span>Arqueo y Cierre de Caja</span>
              </button>
            </div>
          </div>

          <!-- Métricas del turno en tiempo real -->
          <div class="metricas-grid">
            <div class="metrica-card">
              <div class="metrica-header">
                <span class="metrica-label">Fondo de Apertura</span>
                <i class="fa-solid fa-wallet text-amber-400"></i>
              </div>
              <div class="metrica-value">Bs. {{ (turnoActivo.monto_apertura || 0) | number:'1.2-2' }}</div>
              <div class="metrica-sub">Fondo inicial para cambio</div>
            </div>

            <div class="metrica-card highlight-green">
              <div class="metrica-header">
                <span class="metrica-label">Ventas en Efectivo</span>
                <i class="fa-solid fa-money-bill-wave text-emerald-400"></i>
              </div>
              <div class="metrica-value text-emerald-400">Bs. {{ (turnoActivo.total_ventas_efectivo || 0) | number:'1.2-2' }}</div>
              <div class="metrica-sub">{{ turnoActivo.cantidad_ventas || 0 }} transacciones registradas</div>
            </div>

            <div class="metrica-card">
              <div class="metrica-header">
                <span class="metrica-label">Cobros Digitales / QR</span>
                <i class="fa-solid fa-qrcode text-indigo-400"></i>
              </div>
              <div class="metrica-value text-indigo-300">Bs. {{ (turnoActivo.total_ventas_digitales || 0) | number:'1.2-2' }}</div>
              <div class="metrica-sub">Tarjetas y transferencias</div>
            </div>

            <div class="metrica-card highlight-gold">
              <div class="metrica-header">
                <span class="metrica-label">Efectivo Total en Gaveta</span>
                <i class="fa-solid fa-vault text-amber-400"></i>
              </div>
              <div class="metrica-value text-amber-300 font-bold">Bs. {{ (turnoActivo.monto_esperado_en_caja || 0) | number:'1.2-2' }}</div>
              <div class="metrica-sub font-mono text-xs text-amber-200/70">Apertura + Ventas Efectivo</div>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- MODAL O PANEL DE ARQUEO FÍSICO Y CIERRE FORMAL            -->
        <!-- ========================================================= -->
        <div *ngIf="mostrarModalCierre && turnoActivo" class="modal-overlay">
          <div class="modal-content animate-scale-up">
            <div class="modal-header">
              <div class="flex items-center gap-3">
                <span class="modal-icon"><i class="fa-solid fa-scale-balanced"></i></span>
                <div>
                  <h3 class="modal-title">Arqueo Físico y Cierre de Turno #{{ turnoActivo.id }}</h3>
                  <p class="modal-subtitle">Conteo a ciegas para auditoría de consistencia de caja</p>
                </div>
              </div>
              <button type="button" (click)="mostrarModalCierre = false" class="modal-close">&times;</button>
            </div>

            <div class="modal-body">
              <div class="audit-summary-box">
                <div class="audit-row">
                  <span class="text-gray-400">Fondo Inicial Apertura:</span>
                  <span class="font-bold text-white">Bs. {{ (turnoActivo.monto_apertura || 0) | number:'1.2-2' }}</span>
                </div>
                <div class="audit-row">
                  <span class="text-gray-400">+ Ventas en Efectivo del Turno:</span>
                  <span class="font-bold text-emerald-400">+ Bs. {{ (turnoActivo.total_ventas_efectivo || 0) | number:'1.2-2' }}</span>
                </div>
                <div class="audit-row font-bold text-base pt-2 border-t border-gray-700">
                  <span class="text-amber-400">Total Esperado en Sistema:</span>
                  <span class="text-amber-300">Bs. {{ (turnoActivo.monto_esperado_en_caja || 0) | number:'1.2-2' }}</span>
                </div>
              </div>

              <!-- Input de conteo físico -->
              <div class="form-group mt-4">
                <label class="form-label">
                  <i class="fa-solid fa-hand-holding-dollar text-amber-400 mr-1"></i>
                  Efectivo Físico Contado en Gaveta (Bs.) *
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  [(ngModel)]="formCierre.monto_cierre_real"
                  (ngModelChange)="calcularDiferencia()"
                  placeholder="Ingresa el monto exacto contado"
                  class="form-input text-lg font-bold"
                  style="letter-spacing: 0.05em;"
                />
                <span class="form-hint">Cuenta todos los billetes y monedas presentes en la gaveta física.</span>
              </div>

              <!-- Indicador de Discrepancia / Auditoría en Vivo -->
              <div class="discrepancia-card" [ngClass]="diferenciaClase">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <i class="fa-solid" [ngClass]="diferenciaIcono"></i>
                    <span class="font-bold uppercase text-xs tracking-wider">{{ diferenciaTitulo }}</span>
                  </div>
                  <span class="font-mono text-base font-extrabold">
                    {{ diferenciaMonto >= 0 ? '+' : '' }}Bs. {{ diferenciaMonto | number:'1.2-2' }}
                  </span>
                </div>
                <p class="text-xs mt-1 opacity-90">{{ diferenciaDescripcion }}</p>
              </div>

              <div class="form-group mt-4">
                <label class="form-label">
                  <i class="fa-solid fa-pen-to-square text-gray-400 mr-1"></i>
                  Observaciones de Cierre / Justificación
                </label>
                <input
                  type="text"
                  [(ngModel)]="formCierre.observaciones"
                  placeholder="Ej. Cierre regular turno tarde, sin incidentes"
                  class="form-input"
                />
              </div>
            </div>

            <div class="modal-footer">
              <button
                type="button"
                (click)="mostrarModalCierre = false"
                class="btn-cancelar"
                [disabled]="procesando"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmarCierre()"
                [disabled]="procesando || formCierre.monto_cierre_real < 0"
                class="btn-confirmar-cierre"
              >
                <i class="fa-solid fa-lock mr-2"></i>
                <span>{{ procesando ? 'Cerrando Turno...' : 'Confirmar Cierre y Arqueo' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- HISTORIAL Y BITÁCORA DE TURNOS DE CAJA CERRADOS           -->
        <!-- ========================================================= -->
        <div class="historial-section">
          <div class="historial-header">
            <div>
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <i class="fa-solid fa-clock-rotate-left text-amber-500"></i> Bitácora de Turnos y Auditoría de Arqueo
              </h3>
              <p class="text-xs text-gray-400 mt-0.5">Histórico de turnos cerrados con registro de discrepancias y cajero responsable.</p>
            </div>
            <button
              type="button"
              (click)="cargarHistorial()"
              class="btn-refresh-sm"
              title="Actualizar historial"
            >
              <i class="fa-solid fa-arrows-rotate"></i> Actualizar
            </button>
          </div>

          <div *ngIf="historial.length === 0" class="empty-historial">
            <i class="fa-solid fa-receipt text-3xl text-gray-600 mb-2"></i>
            <p class="text-sm text-gray-400">No se registran turnos cerrados en esta sucursal aún.</p>
          </div>

          <div *ngIf="historial.length > 0" class="table-responsive">
            <table class="caja-table">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Cajero &bull; Sucursal</th>
                  <th>Apertura (Fondo)</th>
                  <th>Ventas Efec.</th>
                  <th>Esperado</th>
                  <th>Real Contado</th>
                  <th>Diferencia</th>
                  <th>Cierre / Obs.</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of historial">
                  <td class="font-mono font-bold text-amber-400">#{{ t.id }}</td>
                  <td>
                    <div class="font-bold text-white text-xs">{{ t.cajero_nombre }}</div>
                    <div class="text-xs text-gray-400">{{ t.sucursal_nombre }}</div>
                  </td>
                  <td>
                    <div class="font-mono text-xs">Bs. {{ t.monto_apertura | number:'1.2-2' }}</div>
                    <div class="text-[10px] text-gray-500">{{ formatearFechaCorta(t.fecha_apertura) }}</div>
                  </td>
                  <td class="text-emerald-400 font-mono text-xs font-semibold">
                    +Bs. {{ (t.total_ventas_efectivo || 0) | number:'1.2-2' }}
                  </td>
                  <td class="font-mono text-xs text-gray-300">
                    Bs. {{ (t.monto_cierre_esperado || 0) | number:'1.2-2' }}
                  </td>
                  <td class="font-mono text-xs font-bold text-white">
                    Bs. {{ (t.monto_cierre_real || 0) | number:'1.2-2' }}
                  </td>
                  <td>
                    <span
                      class="diferencia-badge"
                      [class.badge-diff-zero]="(t.diferencia || 0) === 0"
                      [class.badge-diff-pos]="(t.diferencia || 0) > 0"
                      [class.badge-diff-neg]="(t.diferencia || 0) < 0"
                    >
                      <i
                        class="fa-solid mr-1"
                        [class.fa-check]="(t.diferencia || 0) === 0"
                        [class.fa-arrow-trend-up]="(t.diferencia || 0) > 0"
                        [class.fa-arrow-trend-down]="(t.diferencia || 0) < 0"
                      ></i>
                      {{ (t.diferencia || 0) === 0 ? 'Cuadrada' : ((t.diferencia || 0) > 0 ? '+Bs. ' + (t.diferencia | number:'1.2-2') : '-Bs. ' + (Math.abs(t.diferencia || 0) | number:'1.2-2')) }}
                    </span>
                  </td>
                  <td class="text-xs text-gray-400">
                    <div>{{ formatearFecha(t.fecha_cierre) }}</div>
                    <div *ngIf="t.observaciones_cierre" class="text-[11px] text-gray-500 italic truncate max-w-xs" [title]="t.observaciones_cierre">
                      "{{ t.observaciones_cierre }}"
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .caja-wrapper {
      max-width: 1280px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      color: #e5e7eb;
    }

    .caja-header-card {
      background: linear-gradient(145deg, #18181b 0%, #0f172a 100%);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 14px;
      padding: 1.75rem;
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }

    .caja-badges-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .badge-gold {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 0.2rem 0.65rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .badge-dark {
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.2rem 0.65rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
    }

    .badge-pill {
      padding: 0.2rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      letter-spacing: 0.05em;
    }

    .badge-open {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.5);
    }

    .badge-closed {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .caja-main-title {
      font-size: 1.65rem;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .caja-main-subtitle {
      font-size: 0.88rem;
      color: #94a3b8;
      margin: 0.35rem 0 0;
      max-width: 720px;
    }

    .caja-header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sucursal-box {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .caja-mini-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .caja-select {
      background: #090d16;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.5rem 0.85rem;
      border-radius: 8px;
      font-size: 0.88rem;
      min-width: 220px;
      outline: none;
      cursor: pointer;
    }

    .caja-select:focus {
      border-color: #f59e0b;
    }

    .caja-btn-refresh {
      background: #1e293b;
      border: 1px solid #334155;
      color: #f59e0b;
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.2s;
    }

    .caja-btn-refresh:hover:not(:disabled) {
      background: #334155;
      border-color: #f59e0b;
    }

    .caja-loading {
      text-align: center;
      padding: 4rem 1rem;
    }

    /* CARD APERTURA */
    .card-apertura {
      background: #111827;
      border: 1px dashed #374151;
      border-radius: 12px;
      padding: 2.25rem;
      margin-bottom: 2rem;
    }

    .apertura-hero {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #1f2937;
    }

    .apertura-icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      flex-shrink: 0;
    }

    .apertura-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .form-input {
      background: #0f172a;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 0.7rem 1rem;
      border-radius: 8px;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      border-color: #f59e0b;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
    }

    .form-hint {
      font-size: 0.74rem;
      color: #64748b;
    }

    .apertura-actions {
      display: flex;
      justify-content: flex-end;
    }

    .btn-abrir-caja {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #0b0f19;
      font-weight: 800;
      padding: 0.85rem 1.75rem;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      display: inline-flex;
      align-items: center;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);
      transition: transform 0.15s, opacity 0.15s;
    }

    .btn-abrir-caja:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
    }

    .btn-abrir-caja:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* CARD TURNO ACTIVO */
    .card-turno-activo {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 1.75rem;
      margin-bottom: 2.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .turno-info-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 1.75rem;
    }

    .info-tag {
      font-size: 0.7rem;
      font-family: monospace;
      font-weight: 800;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 0.35rem;
    }

    .turno-title {
      font-size: 1.35rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      display: flex;
      align-items: center;
    }

    .turno-cajero {
      font-size: 0.85rem;
      color: #94a3b8;
      margin: 0.4rem 0 0;
    }

    .btn-iniciar-arqueo {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      font-weight: 800;
      padding: 0.75rem 1.5rem;
      border-radius: 9px;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.35);
      transition: all 0.2s;
    }

    .btn-iniciar-arqueo:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
    }

    /* GRID METRICAS */
    .metricas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .metrica-card {
      background: #182234;
      border: 1px solid #233149;
      border-radius: 10px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
    }

    .metrica-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .metrica-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
    }

    .metrica-value {
      font-size: 1.6rem;
      font-weight: 800;
      font-family: monospace;
      color: #ffffff;
      line-height: 1.1;
    }

    .metrica-sub {
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 0.5rem;
    }

    .highlight-green {
      border-color: rgba(16, 185, 129, 0.3);
      background: linear-gradient(145deg, #182234 0%, rgba(16, 185, 129, 0.08) 100%);
    }

    .highlight-gold {
      border-color: rgba(245, 158, 11, 0.35);
      background: linear-gradient(145deg, #182234 0%, rgba(245, 158, 11, 0.09) 100%);
    }

    /* MODAL */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-content {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 14px;
      width: 100%;
      max-width: 540px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      overflow: hidden;
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
    }

    .modal-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
    }

    .modal-subtitle {
      font-size: 0.75rem;
      color: #94a3b8;
      margin: 0.15rem 0 0;
    }

    .modal-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .audit-summary-box {
      background: #1e293b;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .audit-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .discrepancia-card {
      border-radius: 8px;
      padding: 0.9rem 1.1rem;
      margin-top: 1rem;
      transition: all 0.2s;
    }

    .diff-zero {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
    }

    .diff-pos {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }

    .diff-neg {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #1e293b;
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: #090d16;
    }

    .btn-cancelar {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-weight: 600;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      cursor: pointer;
    }

    .btn-confirmar-cierre {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      font-weight: 800;
      padding: 0.65rem 1.5rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }

    /* HISTORIAL */
    .historial-section {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
    }

    .historial-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .btn-refresh-sm {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.78rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .btn-refresh-sm:hover {
      background: #334155;
      color: #ffffff;
    }

    .empty-historial {
      text-align: center;
      padding: 2.5rem 1rem;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .caja-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      text-align: left;
    }

    .caja-table th {
      background: #182234;
      color: #94a3b8;
      padding: 0.75rem 1rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #334155;
    }

    .caja-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
    }

    .caja-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .diferencia-badge {
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
    }

    .badge-diff-zero {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .badge-diff-pos {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .badge-diff-neg {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
  `]
})
export class CajaTurnoComponent implements OnInit, OnDestroy {
  @Input() sucursalIdInput?: number;

  private cajaService = inject(CajaService);
  private productoService = inject(ProductoService);
  public authService = inject(AuthService);
  private toastService = inject(ToastService);

  sucursalSeleccionadaId: number = 0;
  sucursales: Sucursal[] = [];
  cargando: boolean = false;
  procesando: boolean = false;

  turnoActivo: CajaTurno | null = null;
  historial: CajaTurno[] = [];

  // Formulario Apertura
  formApertura = {
    monto_apertura: 100.0,
    observaciones: 'Turno Regular'
  };

  // Formulario Cierre
  mostrarModalCierre: boolean = false;
  formCierre = {
    monto_cierre_real: 0.0,
    observaciones: ''
  };

  diferenciaMonto: number = 0;
  diferenciaClase: string = 'diff-zero';
  diferenciaIcono: string = 'fa-check';
  diferenciaTitulo: string = 'Caja Cuadrada';
  diferenciaDescripcion: string = 'El conteo físico coincide exactamente con el monto esperado.';

  private timerInterval: any = null;
  public Math = Math;

  get esTurnoAbierto(): boolean {
    return this.turnoActivo !== null && this.turnoActivo.estado === 'ABIERTA';
  }

  ngOnInit(): void {
    this.cargarSucursales();
    // Auto refresco cada 45 segundos para mantener las ventas en vivo
    this.timerInterval = setInterval(() => {
      if (this.turnoActivo && !this.mostrarModalCierre) {
        this.consultarTurnoActivo(false);
      }
    }, 45000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  cargarSucursales(): void {
    this.cargando = true;
    this.productoService.getSucursales().subscribe({
      next: (data) => {
        this.sucursales = data || [];
        if (this.sucursalIdInput && this.sucursales.some(s => s.id === this.sucursalIdInput)) {
          this.sucursalSeleccionadaId = this.sucursalIdInput;
        } else if (this.sucursales.length > 0) {
          this.sucursalSeleccionadaId = this.sucursales[0].id;
        }
        this.recargarTodo();
      },
      error: (err) => {
        console.error('Error cargando sucursales:', err);
        this.cargando = false;
      }
    });
  }

  onSucursalChange(id: number): void {
    this.sucursalSeleccionadaId = id;
    this.recargarTodo();
  }

  recargarTodo(): void {
    this.consultarTurnoActivo(true);
    this.cargarHistorial();
  }

  consultarTurnoActivo(showLoading = true): void {
    if (showLoading) this.cargando = true;
    this.cajaService.getTurnoActivo(this.sucursalSeleccionadaId).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res.activo && res.turno) {
          this.turnoActivo = res.turno;
        } else {
          this.turnoActivo = null;
        }
      },
      error: (err) => {
        this.cargando = false;
        console.error('Error consultando turno activo:', err);
      }
    });
  }

  abrirCaja(): void {
    if (this.formApertura.monto_apertura < 0) {
      this.toastService.warning('Monto Inválido', 'El monto de apertura no puede ser negativo.');
      return;
    }
    this.procesando = true;
    this.cajaService.abrirCaja({
      sucursal_id: this.sucursalSeleccionadaId,
      monto_apertura: this.formApertura.monto_apertura,
      observaciones: this.formApertura.observaciones
    }).subscribe({
      next: (res) => {
        this.procesando = false;
        this.toastService.success('Caja Abierta', res.mensaje || 'Turno iniciado correctamente.');
        this.consultarTurnoActivo(true);
        this.cargarHistorial();
      },
      error: (err) => {
        this.procesando = false;
        const msg = err.error?.detail || 'No se pudo abrir la caja.';
        this.toastService.error('Error al Abrir Caja', msg);
      }
    });
  }

  prepararCierre(): void {
    if (!this.turnoActivo) return;
    this.formCierre.monto_cierre_real = this.turnoActivo.monto_esperado_en_caja || 0;
    this.formCierre.observaciones = '';
    this.calcularDiferencia();
  }

  calcularDiferencia(): void {
    if (!this.turnoActivo) return;
    const esperado = this.turnoActivo.monto_esperado_en_caja || 0;
    const real = this.formCierre.monto_cierre_real || 0;
    const diff = Math.round((real - esperado) * 100) / 100;
    this.diferenciaMonto = diff;

    if (diff === 0) {
      this.diferenciaClase = 'diff-zero';
      this.diferenciaIcono = 'fa-check';
      this.diferenciaTitulo = 'Caja Cuadrada (Exacta)';
      this.diferenciaDescripcion = 'El dinero físico en gaveta coincide con las ventas y fondo registrado en el sistema.';
    } else if (diff > 0) {
      this.diferenciaClase = 'diff-pos';
      this.diferenciaIcono = 'fa-arrow-trend-up';
      this.diferenciaTitulo = 'Sobrante de Caja';
      this.diferenciaDescripcion = `Hay un excedente físico de +Bs. ${diff.toFixed(2)} por encima de lo registrado en sistema.`;
    } else {
      this.diferenciaClase = 'diff-neg';
      this.diferenciaIcono = 'fa-arrow-trend-down';
      this.diferenciaTitulo = 'Faltante de Caja';
      this.diferenciaDescripcion = `Faltan -Bs. ${Math.abs(diff).toFixed(2)} para completar el total esperado en sistema.`;
    }
  }

  confirmarCierre(): void {
    if (!this.turnoActivo) return;
    if (this.formCierre.monto_cierre_real < 0) {
      this.toastService.warning('Monto Inválido', 'El efectivo contado no puede ser negativo.');
      return;
    }

    this.procesando = true;
    this.cajaService.cerrarCaja({
      turno_id: this.turnoActivo.id,
      monto_cierre_real: this.formCierre.monto_cierre_real,
      observaciones: this.formCierre.observaciones
    }).subscribe({
      next: (res) => {
        this.procesando = false;
        this.mostrarModalCierre = false;
        this.toastService.success(
          'Turno Cerrado',
          `${res.mensaje} Arqueo: ${res.diagnostico_arqueo}`
        );
        this.turnoActivo = null;
        this.recargarTodo();
      },
      error: (err) => {
        this.procesando = false;
        const msg = err.error?.detail || 'No se pudo cerrar la caja.';
        this.toastService.error('Error al Cerrar Caja', msg);
      }
    });
  }

  cargarHistorial(): void {
    this.cajaService.getHistorial(this.sucursalSeleccionadaId, 20).subscribe({
      next: (data) => {
        this.historial = data || [];
      },
      error: (err) => {
        console.error('Error cargando historial:', err);
      }
    });
  }

  formatearFecha(fechaStr?: string): string {
    if (!fechaStr) return '-';
    const d = new Date(fechaStr);
    return d.toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatearFechaCorta(fechaStr?: string): string {
    if (!fechaStr) return '-';
    const d = new Date(fechaStr);
    return d.toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
