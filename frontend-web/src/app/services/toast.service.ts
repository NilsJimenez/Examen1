import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  icon?: string;
  durationMs?: number;
  actionLabel?: string;
  actionUrl?: string;
  timeoutId?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(options: {
    type?: ToastType;
    title?: string;
    message: string;
    icon?: string;
    durationMs?: number;
    actionLabel?: string;
    actionUrl?: string;
  }): string {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const type: ToastType = options.type || 'info';
    
    // Títulos por defecto si no se especifican
    let defaultTitle = 'Aviso del Sistema';
    if (type === 'success') defaultTitle = 'Operación Exitosa';
    else if (type === 'error') defaultTitle = 'Error';
    else if (type === 'warning') defaultTitle = 'Atención';
    else if (type === 'info') defaultTitle = 'Información';

    const title = options.title || defaultTitle;
    const duration = options.durationMs !== undefined ? options.durationMs : (type === 'error' ? 6000 : 4500);

    const toast: Toast = {
      id,
      type,
      title,
      message: options.message,
      icon: options.icon,
      durationMs: duration,
      actionLabel: options.actionLabel,
      actionUrl: options.actionUrl
    };

    if (duration > 0) {
      toast.timeoutId = setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    // Mantenemos como máximo 5 toasts activos simultáneamente
    this.toasts.update(current => {
      const updated = [...current, toast];
      if (updated.length > 5) {
        const oldest = updated.shift();
        if (oldest?.timeoutId) clearTimeout(oldest.timeoutId);
      }
      return updated;
    });

    return id;
  }

  success(title: string, message: string, durationMs = 4500, actionLabel?: string, actionUrl?: string): string {
    return this.show({
      type: 'success',
      title,
      message,
      durationMs,
      actionLabel,
      actionUrl,
      icon: 'fa-solid fa-circle-check'
    });
  }

  error(title: string, message: string, durationMs = 6000): string {
    return this.show({
      type: 'error',
      title,
      message,
      durationMs,
      icon: 'fa-solid fa-circle-exclamation'
    });
  }

  warning(title: string, message: string, durationMs = 5000): string {
    return this.show({
      type: 'warning',
      title,
      message,
      durationMs,
      icon: 'fa-solid fa-triangle-exclamation'
    });
  }

  info(title: string, message: string, durationMs = 5000, icon = 'fa-solid fa-circle-info'): string {
    return this.show({
      type: 'info',
      title,
      message,
      durationMs,
      icon
    });
  }

  remove(id: string): void {
    this.toasts.update(current => {
      const found = current.find(t => t.id === id);
      if (found?.timeoutId) {
        clearTimeout(found.timeoutId);
      }
      return current.filter(t => t.id !== id);
    });
  }

  clear(): void {
    this.toasts().forEach(t => {
      if (t.timeoutId) clearTimeout(t.timeoutId);
    });
    this.toasts.set([]);
  }
}
