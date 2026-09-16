import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservaService } from '../../services/reserva.service';
import { InventarioService } from '../../services/inventario.service';

@Component({
  selector: 'app-encargado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container py-10">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h1 class="font-serif text-3xl font-bold flex items-center gap-3" style="color: var(--text-main);">
            <i class="fa-solid fa-warehouse" style="color: var(--accent);"></i> Panel de Gestión de Sucursal
          </h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">
            Atención de reservas en probadores, check-in QR y control de inventario local
          </p>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-xs font-bold" style="color: var(--text-muted);">Sucursal ID:</label>
          <input 
            type="number" 
            [(ngModel)]="sucursalId" 
            (change)="recargarTodo()" 
            class="form-input" 
            style="width: 70px; padding: 0.35rem 0.5rem; text-align: center; font-weight: bold;" 
          />
          <button (click)="recargarTodo()" class="btn btn-outline" style="padding: 0.4rem 0.7rem; font-size: 0.8rem;">
            <i class="fa-solid fa-arrows-rotate"></i>
          </button>
        </div>
      </div>

      <div *ngIf="successMessage" class="p-3 mb-4 rounded-lg flex items-center gap-2 text-sm" style="background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3);">
        <i class="fa-solid fa-circle-check"></i> {{ successMessage }}
      </div>
      <div *ngIf="errorMessage" class="p-3 mb-4 rounded-lg flex items-center gap-2 text-sm" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
        <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
      </div>

      <div class="flex gap-2 mb-6" style="border-bottom: 1px solid var(--border-color); padding-bottom: 2px;">
        <button 
          (click)="tabActiva = 'reservas'" 
          [class.tab-btn-active]="tabActiva === 'reservas'"
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-calendar-days mr-2"></i> Reservas de Sucursal ({{ reservas.length }})
        </button>

        <button 
          (click)="tabActiva = 'qr'" 
          [class.tab-btn-active]="tabActiva === 'qr'"
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-qrcode mr-2"></i> Check-in Instantáneo QR
        </button>

        <button 
          (click)="tabActiva = 'inventario'" 
          [class.tab-btn-active]="tabActiva === 'inventario'"
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-boxes-stacked mr-2"></i> Inventario & Kárdex Local
        </button>
      </div>

      <!-- PESTAÑA 1: Reservas de Sucursal -->
      <div *ngIf="tabActiva === 'reservas'">
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-serif text-lg font-bold" style="color: var(--text-main);">
              Reservas Agendadas en Sucursal #{{ sucursalId }}
            </h3>
            <button (click)="cargarReservas()" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.35rem 0.7rem;">
              <i class="fa-solid fa-arrows-rotate"></i> Actualizar
            </button>
          </div>

          <div *ngIf="loadingReservas" class="text-center py-8">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl" style="color: var(--accent);"></i>
          </div>

          <div *ngIf="!loadingReservas && reservas.length === 0" class="text-center py-12" style="color: var(--text-muted);">
            <i class="fa-solid fa-inbox text-4xl mb-2 opacity-50"></i>
            <p>No hay reservas pendientes en esta sucursal.</p>
          </div>

          <div *ngIf="!loadingReservas && reservas.length > 0" class="flex flex-col gap-4">
            <div *ngFor="let r of reservas" class="p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
              <div>
                <div class="flex items-center gap-2">
                  <strong class="font-mono" style="color: var(--accent);">{{ r.codigo_reserva }}</strong>
                  <span class="badge" [style.background]="r.estado === 'preparada' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)'" [style.color]="r.estado === 'preparada' ? '#818cf8' : '#f59e0b'" style="font-size: 0.7rem;">
                    {{ r.estado }}
                  </span>
                </div>
                <div class="text-xs mt-1" style="color: var(--text-main);">
                  Cliente: <strong>{{ r.cliente }}</strong> • Cita: {{ r.fecha }} {{ r.hora }}
                </div>
                <div class="text-xs mt-2 flex flex-wrap gap-2">
                  <span *ngFor="let it of r.items" class="px-2 py-0.5 rounded" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-muted);">
                    {{ it.producto }} ({{ it.talla }} - {{ it.color }}) x{{ it.cantidad }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button 
                  *ngIf="r.estado === 'pendiente'" 
                  (click)="marcarPreparada(r.id)" 
                  class="btn btn-primary" 
                  style="font-size: 0.8rem; padding: 0.45rem 0.8rem;"
                >
                  <i class="fa-solid fa-box-open mr-1"></i> Marcar Preparada
                </button>
                <button 
                  *ngIf="r.estado === 'preparada'" 
                  (click)="marcarAtendida(r.id)" 
                  class="btn btn-outline" 
                  style="font-size: 0.8rem; padding: 0.45rem 0.8rem; color: #22c55e; border-color: rgba(34,197,94,0.4);"
                >
                  <i class="fa-solid fa-person-booth mr-1"></i> Cliente en Probador
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 2: Check-in QR -->
      <div *ngIf="tabActiva === 'qr'">
        <div class="card p-6" style="max-width: 600px; margin: 0 auto;">
          <h3 class="font-serif text-xl font-bold mb-2 text-center" style="color: var(--text-main);">
            <i class="fa-solid fa-qrcode" style="color: var(--accent);"></i> Lector de Pase QR
          </h3>
          <p class="text-xs text-center mb-6" style="color: var(--text-muted);">
            Ingresa o escanea el código alfanumérico del pase QR de reserva que presenta el cliente
          </p>

          <div class="flex gap-2 mb-6">
            <input 
              type="text" 
              [(ngModel)]="codigoQREscaneado" 
              placeholder="Ej: RES-A1B2C3D4E5" 
              class="form-input font-mono font-bold uppercase" 
              style="letter-spacing: 0.05em;" 
              (keyup.enter)="verificarQR()"
            />
            <button (click)="verificarQR()" [disabled]="loadingQR" class="btn btn-primary" style="padding: 0.6rem 1.2rem;">
              <span *ngIf="loadingQR"><i class="fa-solid fa-circle-notch fa-spin"></i></span>
              <span *ngIf="!loadingQR"><i class="fa-solid fa-magnifying-glass"></i> Validar</span>
            </button>
          </div>

          <div *ngIf="resultadoQR" class="p-4 rounded-xl" style="background: var(--table-th-bg); border: 1.5px solid var(--accent);">
            <div class="flex items-center justify-between pb-3 mb-3" style="border-bottom: 1px solid var(--border-color);">
              <div>
                <span class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid #22c55e; font-size: 0.75rem;">
                  <i class="fa-solid fa-check"></i> PASE VÁLIDO
                </span>
                <h4 class="font-bold text-base mt-1" style="color: var(--text-main);">{{ resultadoQR.cliente }}</h4>
              </div>
              <div class="text-right">
                <span class="text-xs block" style="color: var(--text-muted);">Vestidor Asignado:</span>
                <span class="font-serif font-bold text-base" style="color: var(--accent);">Vestidor #2</span>
              </div>
            </div>

            <div class="text-xs mb-3" style="color: var(--text-muted);">
              Cita: <strong>{{ resultadoQR.fecha }}</strong> a las <strong>{{ resultadoQR.hora }}</strong> • Estado: <strong style="text-transform: uppercase;">{{ resultadoQR.estado }}</strong>
            </div>

            <h5 class="text-xs font-bold mb-2 uppercase" style="color: var(--text-main);">Prendas preparadas para probar:</h5>
            <div class="flex flex-col gap-1.5 mb-4">
              <div *ngFor="let it of resultadoQR.items" class="p-2 rounded flex items-center justify-between text-xs" style="background: var(--card-bg);">
                <span style="color: var(--text-main);">{{ it.producto }} (Talla: {{ it.talla }})</span>
                <span style="color: var(--accent); font-weight: bold;">{{ it.cantidad }} ud.</span>
              </div>
            </div>

            <button (click)="marcarAtendida(resultadoQR.reserva_id)" class="btn btn-primary" style="width: 100%; padding: 0.6rem;">
              <i class="fa-solid fa-door-open mr-1"></i> Asignar y Abrir Vestidor
            </button>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 3: Inventario & Kárdex Local -->
      <div *ngIf="tabActiva === 'inventario'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-serif text-lg font-bold" style="color: var(--text-main);">
              Existencias en Sucursal #{{ sucursalId }}
            </h3>
            <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ inventarioItems.length }} variantes</span>
          </div>

          <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>Prenda & SKU</th>
                  <th>Talla / Color</th>
                  <th style="text-align: center;">Disponible</th>
                  <th style="text-align: center;">Reservado</th>
                  <th style="text-align: center;">Libre</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let it of inventarioItems">
                  <td>
                    <strong style="color: var(--text-main); font-size: 0.85rem;">{{ it.producto }}</strong>
                    <code class="block text-xs" style="color: var(--text-muted);">{{ it.sku }}</code>
                  </td>
                  <td>
                    <span class="badge" style="background: var(--table-th-bg); color: var(--text-main); margin-right: 4px;">{{ it.talla }}</span>
                    <span class="inline-flex items-center gap-1 text-xs" style="color: var(--text-muted);">
                      <span [style.background-color]="it.color_hex" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block;"></span>
                      {{ it.color }}
                    </span>
                  </td>
                  <td style="text-align: center; font-weight: bold; color: var(--text-main);">{{ it.cantidad_disponible }}</td>
                  <td style="text-align: center; color: #f59e0b; font-weight: bold;">{{ it.cantidad_reservada }}</td>
                  <td style="text-align: center; font-weight: bold; color: var(--accent);">{{ it.stock_libre }}</td>
                  <td>
                    <span *ngIf="it.bajo_stock" class="badge" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid #ef4444; font-size: 0.65rem;">
                      Bajo Stock
                    </span>
                    <span *ngIf="!it.bajo_stock" class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e; font-size: 0.65rem;">
                      Óptimo
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="lg:col-span-1 card p-6 flex flex-col gap-4">
          <h3 class="font-serif text-lg font-bold pb-2" style="color: var(--text-main); border-bottom: 1px solid var(--border-color);">
            <i class="fa-solid fa-truck-ramp-box" style="color: var(--accent);"></i> Registrar Movimiento
          </h3>

          <div class="form-group">
            <label class="form-label">Tipo de Movimiento</label>
            <select [(ngModel)]="movTipo" class="form-input">
              <option value="ingreso">Ingreso de Mercadería (+)</option>
              <option value="devolucion">Devolución de Prenda (+)</option>
              <option value="ajuste">Ajuste de Inventario (+)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Variante de Prenda</label>
            <select [(ngModel)]="movVarianteId" class="form-input">
              <option *ngFor="let it of inventarioItems" [value]="it.variante_id">
                {{ it.producto }} - {{ it.talla }} / {{ it.color }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Cantidad Física</label>
            <input type="number" [(ngModel)]="movCantidad" min="1" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Observaciones (Opcional)</label>
            <textarea [(ngModel)]="movObservaciones" placeholder="Ej: Lote recibido en buen estado" class="form-input" rows="2"></textarea>
          </div>

          <button (click)="guardarMovimiento()" class="btn btn-primary" style="width: 100%; padding: 0.75rem;">
            <i class="fa-solid fa-floppy-disk"></i> Registrar Movimiento
          </button>
        </div>
      </div>
    </div>
  `
})
export class EncargadoComponent implements OnInit {
  private reservaService = inject(ReservaService);
  private inventarioService = inject(InventarioService);

  sucursalId: number = 1;
  tabActiva: string = 'reservas';

  reservas: any[] = [];
  loadingReservas: boolean = false;

  codigoQREscaneado: string = '';
  resultadoQR: any = null;
  loadingQR: boolean = false;

  inventarioItems: any[] = [];
  movTipo: string = 'ingreso';
  movVarianteId: number = 1;
  movCantidad: number = 10;
  movObservaciones: string = '';

  successMessage: string = '';
  errorMessage: string = '';

  ngOnInit(): void {
    this.recargarTodo();
  }

  recargarTodo(): void {
    this.cargarReservas();
    this.cargarInventario();
  }

  cargarReservas(): void {
    this.loadingReservas = true;
    this.reservaService.getReservasSucursal(this.sucursalId).subscribe({
      next: (data) => {
        this.reservas = data || [];
        this.loadingReservas = false;
      },
      error: () => {
        this.loadingReservas = false;
      }
    });
  }

  marcarPreparada(id: number): void {
    this.reservaService.prepararReserva(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Reserva preparada.';
        this.cargarReservas();
      }
    });
  }

  marcarAtendida(id: number): void {
    this.reservaService.atenderReserva(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Reserva atendida.';
        this.resultadoQR = null;
        this.cargarReservas();
      }
    });
  }

  verificarQR(): void {
    if (!this.codigoQREscaneado.trim()) return;
    this.loadingQR = true;
    this.errorMessage = '';
    this.resultadoQR = null;

    this.reservaService.checkinQR(this.codigoQREscaneado.trim().toUpperCase()).subscribe({
      next: (res) => {
        this.resultadoQR = res;
        this.loadingQR = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Código QR no válido.';
        this.loadingQR = false;
      }
    });
  }

  cargarInventario(): void {
    this.inventarioService.getInventarioSucursal(this.sucursalId).subscribe({
      next: (res) => {
        this.inventarioItems = res.items || [];
        if (this.inventarioItems.length > 0) {
          this.movVarianteId = this.inventarioItems[0].variante_id;
        }
      }
    });
  }

  guardarMovimiento(): void {
    this.inventarioService.registrarMovimiento({
      variante_id: Number(this.movVarianteId),
      sucursal_id: Number(this.sucursalId),
      tipo_movimiento: this.movTipo,
      cantidad: Number(this.movCantidad),
      observaciones: this.movObservaciones
    }).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Movimiento registrado.';
        this.cargarInventario();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error al registrar movimiento.';
      }
    });
  }
}
