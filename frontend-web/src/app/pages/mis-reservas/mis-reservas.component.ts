import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReservaService } from '../../services/reserva.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container py-10">
      <div class="flex items-center justify-between mb-6 pb-4" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h1 class="font-serif text-3xl font-bold flex items-center gap-3" style="color: var(--text-main);">
            <i class="fa-solid fa-calendar-check" style="color: var(--accent);"></i> Mis Reservas para Probador
          </h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">
            Consulta el estado de tus prendas reservadas y muestra tu Pase QR al llegar a la tienda
          </p>
        </div>
        <a routerLink="/catalogo" class="btn btn-outline" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
          <i class="fa-solid fa-shirt"></i> Explorar Catálogo
        </a>
      </div>

      <div *ngIf="successMessage" class="p-4 mb-4 rounded-lg flex items-center gap-2 text-sm" style="background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3);">
        <i class="fa-solid fa-circle-check"></i> {{ successMessage }}
      </div>
      <div *ngIf="errorMessage" class="p-4 mb-4 rounded-lg flex items-center gap-2 text-sm" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
        <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
      </div>

      <div *ngIf="loading" class="text-center py-16">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
        <p class="text-sm mt-3" style="color: var(--text-muted);">Cargando tus reservas...</p>
      </div>

      <div *ngIf="!loading && reservas.length === 0" class="card text-center py-16 px-4">
        <div style="font-size: 3.5rem; color: var(--text-muted); margin-bottom: 1rem; opacity: 0.5;">
          <i class="fa-solid fa-calendar-xmark"></i>
        </div>
        <h2 class="font-serif text-2xl font-bold mb-2" style="color: var(--text-main);">No tienes reservas activas</h2>
        <p class="text-sm mb-6 max-w-md mx-auto" style="color: var(--text-muted);">
          Puedes apartar prendas desde el catálogo con tu talla y color para probártelas en los vestidores de tu sucursal favorita.
        </p>
        <a routerLink="/catalogo" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem;">
          <i class="fa-solid fa-cube"></i> Ir al Catálogo & Vestidores
        </a>
      </div>

      <div *ngIf="!loading && reservas.length > 0" class="flex flex-col gap-6">
        <div *ngFor="let r of reservas" class="card p-6">
          <div class="flex flex-wrap items-center justify-between gap-4 pb-4" style="border-bottom: 1px solid var(--border-color);">
            <div class="flex items-center gap-3">
              <span style="font-size: 1.5rem; color: var(--accent);">
                <i class="fa-solid fa-ticket"></i>
              </span>
              <div>
                <span class="font-mono font-bold text-base" style="color: var(--text-main);">{{ r.codigo_reserva }}</span>
                <div class="flex items-center gap-2 text-xs mt-0.5" style="color: var(--text-muted);">
                  <span><i class="fa-solid fa-shop mr-1"></i> {{ r.sucursal }}</span>
                  <span>•</span>
                  <span><i class="fa-regular fa-calendar mr-1"></i> {{ r.fecha }} a las {{ r.hora }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <span 
                class="badge" 
                [style.background]="getEstadoBg(r.estado)"
                [style.color]="getEstadoColor(r.estado)"
                [style.border]="'1px solid ' + getEstadoColor(r.estado)"
                style="padding: 0.35rem 0.8rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;"
              >
                {{ r.estado }}
              </span>

              <button 
                (click)="toggleDetalle(r.id)" 
                class="btn btn-outline" 
                style="padding: 0.4rem 0.8rem; font-size: 0.8rem;"
              >
                <i class="fa-solid" [class.fa-chevron-up]="reservaExpandida === r.id" [class.fa-chevron-down]="reservaExpandida !== r.id"></i>
                {{ reservaExpandida === r.id ? 'Ocultar' : 'Ver Pase QR' }}
              </button>
            </div>
          </div>

          <div *ngIf="reservaExpandida === r.id" class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div class="flex flex-col items-center justify-center p-4 rounded-xl text-center" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
              <div *ngIf="r.codigo_qr" class="p-2 bg-white rounded-lg shadow-sm" style="display: inline-block;">
                <img [src]="r.codigo_qr" alt="Pase QR de Reserva" style="width: 180px; height: 180px;" />
              </div>
              <span class="font-mono text-xs font-bold mt-3" style="color: var(--text-main);">{{ r.codigo_reserva }}</span>
              <p class="text-xs mt-1" style="color: var(--text-muted);">Muestra este código al llegar a recepción para check-in instantáneo</p>
            </div>

            <div class="md:col-span-2 flex flex-col justify-between">
              <div>
                <h4 class="font-serif font-bold text-base mb-3" style="color: var(--text-main);">
                  <i class="fa-solid fa-shirt mr-1" style="color: var(--accent);"></i> Prendas Apartadas para tu Vestidor:
                </h4>

                <div class="flex flex-col gap-2">
                  <div *ngFor="let item of r.items" class="p-3 rounded-lg flex items-center justify-between" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                    <div class="flex items-center gap-3">
                      <i class="fa-solid fa-tag" style="color: var(--accent);"></i>
                      <div>
                        <span class="font-bold text-sm block" style="color: var(--text-main);">{{ item.producto }}</span>
                        <span class="text-xs" style="color: var(--text-muted);">
                          Talla: <strong style="color: var(--text-main);">{{ item.talla }}</strong> • Color: <strong style="color: var(--text-main);">{{ item.color }}</strong>
                        </span>
                      </div>
                    </div>
                    <span class="badge" style="background: var(--table-th-bg); color: var(--text-main); font-weight: 700;">
                      {{ item.cantidad }} unidad(es)
                    </span>
                  </div>
                </div>
              </div>

              <div *ngIf="r.estado === 'pendiente' || r.estado === 'preparada'" class="mt-6 pt-4 flex justify-end" style="border-top: 1px solid var(--border-color);">
                <button 
                  (click)="cancelar(r.id)" 
                  class="btn btn-outline" 
                  style="color: #ef4444; border-color: rgba(239,68,68,0.4); padding: 0.5rem 1rem; font-size: 0.85rem;"
                >
                  <i class="fa-solid fa-xmark"></i> Cancelar esta Reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MisReservasComponent implements OnInit {
  private reservaService = inject(ReservaService);

  reservas: any[] = [];
  loading: boolean = true;
  reservaExpandida: number | null = null;
  successMessage: string = '';
  errorMessage: string = '';

  ngOnInit(): void {
    this.cargarReservas();
  }

  cargarReservas(): void {
    this.loading = true;
    this.reservaService.getMisReservas().subscribe({
      next: (data) => {
        this.reservas = data || [];
        if (this.reservas.length > 0) {
          this.reservaExpandida = this.reservas[0].id;
        }
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error al cargar tus reservas.';
        this.loading = false;
      }
    });
  }

  toggleDetalle(id: number): void {
    this.reservaExpandida = this.reservaExpandida === id ? null : id;
  }

  cancelar(id: number): void {
    if (!confirm('¿Estás seguro de que deseas cancelar esta reserva?')) return;
    this.reservaService.cancelarReserva(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Reserva cancelada exitosamente.';
        this.cargarReservas();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'No se pudo cancelar la reserva.';
      }
    });
  }

  getEstadoBg(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'rgba(245,158,11,0.15)';
      case 'preparada': return 'rgba(99,102,241,0.15)';
      case 'atendida': return 'rgba(34,197,94,0.15)';
      case 'cancelada': return 'rgba(239,68,68,0.15)';
      default: return 'var(--table-th-bg)';
    }
  }

  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'pendiente': return '#f59e0b';
      case 'preparada': return '#818cf8';
      case 'atendida': return '#22c55e';
      case 'cancelada': return '#ef4444';
      default: return 'var(--text-muted)';
    }
  }
}
