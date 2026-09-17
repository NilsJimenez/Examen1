import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="toast-container" *ngIf="toastService.toasts().length > 0">
      <div 
        *ngFor="let toast of toastService.toasts(); trackBy: trackById"
        class="toast-card"
        [ngClass]="'toast-' + toast.type"
      >
        <!-- Icono temático -->
        <div class="toast-icon-wrapper">
          <i [class]="toast.icon || getDefaultIcon(toast.type)"></i>
        </div>

        <!-- Cuerpo del Toast -->
        <div class="toast-content">
          <div class="toast-header-row">
            <h5 class="toast-title">{{ toast.title }}</h5>
          </div>
          <p class="toast-message">{{ toast.message }}</p>

          <!-- Botón de acción opcional (ej: Ir al Carrito) -->
          <div *ngIf="toast.actionUrl && toast.actionLabel" class="toast-action-row">
            <a [routerLink]="toast.actionUrl" (click)="toastService.remove(toast.id)" class="toast-action-btn">
              <span>{{ toast.actionLabel }}</span>
              <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
          </div>
        </div>

        <!-- Botón Descartar (X) -->
        <button 
          (click)="toastService.remove(toast.id)" 
          class="toast-close-btn"
          aria-label="Cerrar notificación"
          title="Cerrar"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 86px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 420px;
      width: calc(100vw - 48px);
      pointer-events: none;
    }

    .toast-card {
      pointer-events: auto;
      position: relative;
      background: rgba(24, 24, 27, 0.96);
      color: #f4f4f5;
      border-radius: 14px;
      padding: 1rem 1.15rem;
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      border: 1.5px solid transparent;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .toast-card:hover {
      transform: translateY(-2px);
    }

    /* Éxito - Verde Esmeralda */
    .toast-success {
      border-color: rgba(34, 197, 94, 0.8);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(34, 197, 94, 0.22);
    }
    .toast-success .toast-icon-wrapper {
      color: #22c55e;
      background: rgba(34, 197, 94, 0.12);
    }
    .toast-success .toast-title {
      color: #22c55e;
    }

    /* Error - Rojo Carmesí */
    .toast-error {
      border-color: rgba(239, 68, 68, 0.85);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(239, 68, 68, 0.25);
    }
    .toast-error .toast-icon-wrapper {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.12);
    }
    .toast-error .toast-title {
      color: #ef4444;
    }

    /* Advertencia / Alerta / Naranja - Ámbar Dorado de la captura */
    .toast-warning {
      border-color: rgba(245, 158, 11, 0.85);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.25);
    }
    .toast-warning .toast-icon-wrapper {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.15);
    }
    .toast-warning .toast-title {
      color: #f59e0b;
    }

    /* Info / GPS - Ámbar Boutique Cálido */
    .toast-info {
      border-color: rgba(245, 158, 11, 0.85);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.25);
    }
    .toast-info .toast-icon-wrapper {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.15);
    }
    .toast-info .toast-title {
      color: #f59e0b;
    }

    /* Estructura Interna */
    .toast-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      font-size: 1.15rem;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast-content {
      flex: 1;
      min-width: 0;
    }

    .toast-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }

    .toast-title {
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: -0.01em;
      margin: 0;
    }

    .toast-message {
      margin: 0;
      font-size: 0.83rem;
      line-height: 1.45;
      color: #e4e4e7;
      word-break: break-word;
    }

    .toast-action-row {
      margin-top: 0.65rem;
    }

    .toast-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #f59e0b;
      color: #18181b;
      font-size: 0.76rem;
      font-weight: 700;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s ease;
    }

    .toast-action-btn:hover {
      background: #d97706;
    }

    .toast-close-btn {
      background: transparent;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      padding: 4px;
      margin-left: 2px;
      font-size: 0.95rem;
      line-height: 1;
      border-radius: 6px;
      transition: color 0.15s ease, background 0.15s ease;
    }

    .toast-close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    @keyframes toastSlideIn {
      from {
        opacity: 0;
        transform: translateX(60px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @media (max-width: 640px) {
      .toast-container {
        top: 76px;
        right: 12px;
        left: 12px;
        width: auto;
        max-width: 100%;
      }
    }
  `]
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  trackById(index: number, item: Toast): string {
    return item.id;
  }

  getDefaultIcon(type: string): string {
    switch (type) {
      case 'success': return 'fa-solid fa-circle-check';
      case 'error': return 'fa-solid fa-circle-exclamation';
      case 'warning': return 'fa-solid fa-triangle-exclamation';
      default: return 'fa-solid fa-circle-info';
    }
  }
}
