import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OfflineSyncService } from '../../services/offline-sync.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- 1. BANNER CUANDO ESTÁ OFFLINE O HAY PENDIENTES O ESTÁ DESACTUALIZADO -->
    <aside
      *ngIf="!syncService.isOnline() || syncService.pendientesCount() > 0 || syncService.estadoDesactualizado().desactualizado"
      class="pwa-offline-banner animate-slide-down"
      [ngClass]="{
        'banner-offline': !syncService.isOnline(),
        'banner-warning': syncService.isOnline() && syncService.estadoDesactualizado().desactualizado,
        'banner-pending': syncService.isOnline() && !syncService.estadoDesactualizado().desactualizado && syncService.pendientesCount() > 0
      }"
      role="alert"
    >
      <div class="banner-container">
        
        <!-- Icono y Texto de Estado -->
        <div class="banner-info">
          <span class="status-indicator-dot" [class.offline]="!syncService.isOnline()"></span>
          
          <div class="banner-text">
            <strong class="banner-title">
              <i *ngIf="!syncService.isOnline()" class="fa-solid fa-wifi-slash mr-1"></i>
              <i *ngIf="syncService.isOnline() && syncService.estadoDesactualizado().desactualizado" class="fa-solid fa-triangle-exclamation mr-1"></i>
              <i *ngIf="syncService.isOnline() && !syncService.estadoDesactualizado().desactualizado" class="fa-solid fa-rotate mr-1"></i>
              {{ !syncService.isOnline() ? 'MODO SIN CONEXIÓN ACTIVO' : (syncService.estadoDesactualizado().desactualizado ? 'CATÁLOGO DESACTUALIZADO' : 'SINCRONIZACIÓN PENDIENTE') }}
            </strong>
            <span class="banner-msg">
              <ng-container *ngIf="!syncService.isOnline()">
                Operando desde almacenamiento local IndexedDB. Ventas de contado (Regla 7.2) y reservas habilitadas.
              </ng-container>
              <ng-container *ngIf="syncService.isOnline() && syncService.estadoDesactualizado().desactualizado">
                El catálogo local tiene más de 12 horas ({{ syncService.estadoDesactualizado().horas }}h) y puede estar desactualizado.
              </ng-container>
              <ng-container *ngIf="syncService.isOnline() && !syncService.estadoDesactualizado().desactualizado && syncService.pendientesCount() > 0">
                Tienes {{ syncService.pendientesCount() }} operación(es) local(es) listas para sincronizar con el backend central.
              </ng-container>
            </span>
          </div>
        </div>

        <!-- Acciones Rápidas -->
        <div class="banner-actions">
          
          <!-- Contador de Pendientes -->
          <span *ngIf="syncService.pendientesCount() > 0" class="badge-pendientes">
            <i class="fa-solid fa-cloud-arrow-up mr-1"></i>
            {{ syncService.pendientesCount() }} pendiente(s)
          </span>

          <!-- Botón Sincronizar Ahora (si hay red) -->
          <button
            *ngIf="syncService.isOnline() && syncService.pendientesCount() > 0"
            (click)="sincronizarAhora()"
            [disabled]="syncService.sincronizando()"
            class="btn-banner-action"
          >
            <i class="fa-solid fa-rotate mr-1.5" [class.fa-spin]="syncService.sincronizando()"></i>
            {{ syncService.sincronizando() ? 'Sincronizando...' : 'Sincronizar ahora' }}
          </button>

          <!-- Botón Ir al Centro Offline -->
          <a routerLink="/offline" class="btn-banner-link">
            <i class="fa-solid fa-sliders mr-1.5"></i>
            Centro Offline
          </a>
        </div>

      </div>
    </aside>
  `,
  styles: [`
    .pwa-offline-banner {
      position: sticky;
      top: 0;
      z-index: 1000;
      width: 100%;
      padding: 0.65rem 1.25rem;
      font-size: 0.85rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }
    .banner-offline {
      background: linear-gradient(90deg, #7c2d12 0%, #9a3412 100%);
      color: #ffedd5;
    }
    .banner-warning {
      background: linear-gradient(90deg, #854d0e 0%, #a16207 100%);
      color: #fef08a;
    }
    .banner-pending {
      background: linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 100%);
      color: #dbeafe;
    }
    .banner-container {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .banner-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .status-indicator-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      display: inline-block;
    }
    .status-indicator-dot.offline {
      background-color: #ef4444;
      box-shadow: 0 0 8px #ef4444;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }
    .banner-text {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }
    .banner-title {
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .banner-msg {
      font-size: 0.78rem;
      opacity: 0.92;
    }
    .banner-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge-pendientes {
      background: rgba(0, 0, 0, 0.3);
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .btn-banner-action {
      background-color: #ffffff;
      color: #18181b;
      border: none;
      padding: 0.35rem 0.85rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-banner-action:hover:not(:disabled) {
      background-color: #f4f4f5;
    }
    .btn-banner-link {
      background: rgba(255, 255, 255, 0.15);
      color: inherit;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-weight: 500;
      text-decoration: none;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
    .btn-banner-link:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  `]
})
export class OfflineBannerComponent {
  public syncService = inject(OfflineSyncService);
  private toast = inject(ToastService);

  sincronizarAhora(): void {
    this.syncService.sincronizarLotePendiente().subscribe({
      next: (res) => {
        if (res.confirmadas > 0) {
          this.toast.success('Sincronización Exitosa', `${res.confirmadas} operación(es) confirmadas.`);
        }
        if (res.rechazadas > 0) {
          this.toast.error('Conflicto en Servidor', `${res.rechazadas} operación(es) rechazadas.`);
        }
      },
      error: () => {
        this.toast.error('Error de Conexión', 'No se pudo comunicar con el backend central.');
      }
    });
  }
}
