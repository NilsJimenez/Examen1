
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, catchError, throwError, from, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { OfflineStorageService } from './offline-storage.service';
import { ToastService } from './toast.service';
import { OperacionOffline, ItemOperacionOffline } from '../models/offline.models';

export interface SincronizacionResultado {
  procesadas: number;
  confirmadas: number;
  rechazadas: number;
  detalles: any[];

}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private storage = inject(OfflineStorageService);
  private toast = inject(ToastService);

  private syncApiUrl = `${environment.apiUrl}/sync`;

  // Estados Reactivos con Signals
  public isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  public pendientesCount = signal<number>(0);
  public estadoDesactualizado = signal<{ desactualizado: boolean; horas: number; descargado_en: string | null }>({
    desactualizado: false,
    horas: 0,
    descargado_en: null
  });
  public sincronizando = signal<boolean>(false);

  constructor() {
    this.iniciarMonitoreoConectividad();
    this.actualizarMetricas();
    this.precargarCatalogoSiEsNecesario();
  }

  public async precargarCatalogoSiEsNecesario(): Promise<void> {
    try {
      const meta = await this.storage.obtenerMetaPaquete();
      if (!meta && this.isOnline()) {
        this.descargarPaqueteOffline().subscribe({
          next: () => {
            console.log('[PWA Sync] Paquete offline pre-cargado automáticamente en IndexedDB.');
            this.actualizarMetricas();
          },
          error: (err) => console.warn('[PWA Sync] No se pudo pre-cargar el paquete offline:', err)
        });
      }
    } catch (e) {
      console.warn('[PWA Sync] Error al verificar paquete offline inicial:', e);
    }
  }

  private iniciarMonitoreoConectividad(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[PWA Sync] Conectividad restablecida (Online)');
        this.isOnline.set(true);
        this.toast.success('Conexión Restablecida', 'Sincronizando operaciones pendientes...');
        this.sincronizarLotePendiente().subscribe({
          next: () => {},
          error: (err) => console.warn('[PWA Sync] Error en auto-sincronización:', err)
        });
      });

      window.addEventListener('offline', () => {
        console.warn('[PWA Sync] Conectividad perdida (Offline)');
        this.isOnline.set(false);
        this.toast.warning('Modo Sin Conexión', 'Se activó el almacenamiento local.');
      });
    }
  }

  public async actualizarMetricas(): Promise<void> {
    const cant = await this.storage.contarOperacionesPendientes();
    this.pendientesCount.set(cant);

    const est = await this.storage.esPaqueteDesactualizado();
    this.estadoDesactualizado.set(est);
  }

  private get authHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authService.token || ''}`
    });
  }

  private generarUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);

      return v.toString(16);
    });
  }


  // 
      })
    );
  }


  // 
      })
    );
  }
}


function switchMapMerge<T, R>(fn: (val: T) => Observable<R>) {
  return (source: Observable<T>) =>
    new Observable<R>((subscriber) => {
      source.subscribe({
        next: (val) => fn(val).subscribe(subscriber),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete()
      });
    });
}

function mapResult<T, R>(fn: (val: any, orig: any) => R) {
  return (source: Observable<any>) =>
    new Observable<R>((subscriber) => {
      source.subscribe({
        next: (val) => subscriber.next(fn(val, null)),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete()
      });
    });
}

