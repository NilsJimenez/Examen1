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

      <div *ngIf="!loading && reservas.length > 0" class="flex flex-col gap-8">
        <div *ngFor="let r of reservas" class="card p-7">
          <div class="flex flex-wrap items-center justify-between gap-5 pb-5" style="border-bottom: 1px solid var(--border-color);">
            <div class="flex items-center gap-3.5">
              <span style="font-size: 1.6rem; color: var(--accent);">
                <i class="fa-solid fa-ticket"></i>
              </span>
              <div>
                <span class="font-mono font-bold text-base" style="color: var(--text-main);">{{ r.codigo_reserva }}</span>
                <div class="flex items-center gap-2.5 text-xs mt-1" style="color: var(--text-muted);">
                  <span><i class="fa-solid fa-shop mr-1"></i> {{ r.sucursal }}</span>
                  <span>•</span>
                  <span><i class="fa-regular fa-calendar mr-1"></i> {{ r.fecha }} a las {{ r.hora }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <span 
                class="badge" 
                [style.background]="getEstadoBg(r.estado)"
                [style.color]="getEstadoColor(r.estado)"
                [style.border]="'1px solid ' + getEstadoColor(r.estado)"
                style="padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;"
              >
                {{ r.estado }}
              </span>

              <button 
                (click)="toggleDetalle(r.id)" 
                class="btn btn-outline" 
                style="padding: 0.45rem 0.9rem; font-size: 0.82rem;"
              >
                <i class="fa-solid" [class.fa-chevron-up]="reservaExpandida === r.id" [class.fa-chevron-down]="reservaExpandida !== r.id"></i>
                {{ reservaExpandida === r.id ? 'Ocultar' : 'Ver Pase QR' }}
              </button>
            </div>
          </div>

          <div *ngIf="reservaExpandida === r.id" class="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            <div class="flex flex-col items-center justify-center p-6 rounded-2xl text-center" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
              <div *ngIf="r.codigo_qr" class="p-2.5 bg-white rounded-xl shadow-sm" style="display: inline-block;">
                <img [src]="r.codigo_qr" alt="Pase QR de Reserva" style="width: 180px; height: 180px;" />
              </div>
              <span class="font-mono text-xs font-bold mt-3" style="color: var(--text-main);">{{ r.codigo_reserva }}</span>
              <p class="text-xs mt-1 mb-4" style="color: var(--text-muted);">Muestra este código al llegar a recepción para check-in instantáneo</p>
              
              <div class="flex flex-wrap gap-2.5 justify-center w-full mt-1">
                <button (click)="descargarPase(r)" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.4rem 0.75rem;">
                  <i class="fa-solid fa-download mr-1"></i> Descargar Pase
                </button>
                <button (click)="verPantallaCompleta(r)" class="btn btn-primary" style="font-size: 0.75rem; padding: 0.4rem 0.75rem;">
                  <i class="fa-solid fa-expand mr-1"></i> Pantalla Completa
                </button>
              </div>
            </div>

            <div class="md:col-span-2 flex flex-col justify-between">
              <div>
                <h4 class="font-serif font-bold text-base mb-4" style="color: var(--text-main);">
                  <i class="fa-solid fa-shirt mr-1" style="color: var(--accent);"></i> Prendas Apartadas para tu Vestidor:
                </h4>

                <div class="flex flex-col gap-3.5">
                  <div *ngFor="let item of r.items" class="p-4 rounded-xl flex items-center justify-between" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                    <div class="flex items-center gap-3.5">
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

    <!-- Modal Pase QR en Pantalla Completa (Alto Contraste) -->
    <div *ngIf="qrPantallaCompleta" class="modal-overlay" style="z-index: 99999; display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">
      <div class="card text-center p-8 max-w-sm w-full mx-4" style="background: #ffffff; color: #18181b; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <span class="badge mb-2" style="background: #fef3c7; color: #92400e; font-weight: 800; font-size: 0.72rem; padding: 0.25rem 0.75rem; border-radius: 9999px;">
          <i class="fa-solid fa-crown mr-1"></i> PASE VIP DE VESTIDOR
        </span>
        <h3 class="font-serif text-2xl font-bold mb-1" style="color: #18181b;">{{ qrPantallaCompleta.sucursal }}</h3>
        <p class="text-xs mb-4" style="color: #71717a;">Cita: <strong>{{ qrPantallaCompleta.fecha }}</strong> a las <strong>{{ qrPantallaCompleta.hora }}</strong></p>
        
        <div class="p-3 bg-white rounded-2xl border-2 border-gray-100 shadow-inner inline-block mb-3">
          <img [src]="qrPantallaCompleta.codigo_qr" alt="QR" style="width: 220px; height: 220px; display: block;" />
        </div>
        
        <div class="font-mono text-sm font-extrabold tracking-widest mb-6 px-3 py-1.5 rounded-lg inline-block" style="background: #f4f4f5; color: #18181b; border: 1px dashed #d4d4d8;">
          {{ qrPantallaCompleta.codigo_reserva }}
        </div>
        
        <div class="flex gap-2">
          <button (click)="descargarPase(qrPantallaCompleta)" class="btn flex-1" style="background: #f4f4f5; color: #18181b; border: 1px solid #d4d4d8; font-size: 0.82rem; padding: 0.65rem;">
            <i class="fa-solid fa-download mr-1"></i> Descargar
          </button>
          <button (click)="qrPantallaCompleta = null" class="btn btn-primary flex-1" style="font-size: 0.82rem; padding: 0.65rem;">
            <i class="fa-solid fa-xmark mr-1"></i> Cerrar
          </button>
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
  qrPantallaCompleta: any = null;
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

  descargarPase(r: any): void {
    if (!r || !r.codigo_qr) return;
    const link = document.createElement('a');
    link.href = r.codigo_qr;
    link.download = `Pase-Vestidor-${r.codigo_reserva}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  verPantallaCompleta(r: any): void {
    this.qrPantallaCompleta = r;
  }
}

