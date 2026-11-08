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

  // =========================================================================
  // 1. DESCARGA DEL PAQUETE OFFLINE (CATÁLOGO, PRECIOS, STOCK)
  // =========================================================================

  descargarPaqueteOffline(sucursalId?: number): Observable<any> {
    const url = sucursalId
      ? `${this.syncApiUrl}/paquete-offline?sucursal_id=${sucursalId}`
      : `${this.syncApiUrl}/paquete-offline`;

    return this.http.get<any>(url, { headers: this.authHeaders }).pipe(
      tap(async (paquete) => {
        await this.storage.guardarPaqueteOffline(paquete);
        await this.actualizarMetricas();
        console.log('[PWA Sync] Paquete offline descargado y almacenado en IndexedDB con éxito.');
      }),
      catchError((err) => {
        console.error('[PWA Sync] Error descargando paquete offline:', err);
        return throwError(() => err);
      })
    );
  }

  // =========================================================================
  // 2. REGISTRO DE VENTA OFFLINE (REGLA 7.2: SÓLO EFECTIVO / CONTADO)
  // =========================================================================

  async registrarVentaOffline(datos: {
    sucursal_id: number;
    sucursal_nombre?: string;
    items: ItemOperacionOffline[];
    cliente_id?: number;
    cliente_nombre?: string;
  }): Promise<OperacionOffline> {
    const uuid = this.generarUUID();
    const ahora = new Date().toISOString();

    const montoTotal = datos.items.reduce((acc, it) => acc + (it.cantidad * it.precio_unitario), 0);

    // 1. Descontar stock libre localmente en IndexedDB
    const exitoStock = await this.storage.descontarStockLocalVenta(
      datos.sucursal_id,
      datos.items.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad }))
    );

    if (!exitoStock) {
      throw new Error('Stock local insuficiente para una o más prendas seleccionadas.');
    }

    const payload = {
      operation_id: uuid,
      tipo: 'VENTA',
      client_local_id: uuid,
      sucursal_id: datos.sucursal_id,
      cliente_id: datos.cliente_id || null,
      metodo_pago: 'efectivo', // Regla 7.2
      fecha_local: ahora,
      total_local: montoTotal,
      items: datos.items.map(it => ({
        variante_id: it.variante_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
      }))
    };

    const operacion: OperacionOffline = {
      id: uuid,
      tipo: 'venta',
      sucursal_id: datos.sucursal_id,
      sucursal_nombre: datos.sucursal_nombre,
      timestamp_local: ahora,
      estado: 'registrada_local',
      monto_total: montoTotal,
      items: datos.items,
      payload: payload,
      cliente_id: datos.cliente_id,
      cliente_nombre: datos.cliente_nombre,
      intentos_sincronizacion: 0
    };

    // Guardar en IndexedDB
    await this.storage.guardarOperacion(operacion);
    await this.actualizarMetricas();

    // Si hay red, sincronizar en background
    if (this.isOnline()) {
      this.sincronizarLotePendiente().subscribe({
        next: () => {},
        error: (e) => console.warn('[PWA Sync] Fallo auto-sincronización tras venta:', e)
      });
    }

    return operacion;
  }

  // =========================================================================
  // 3. REGISTRO DE RESERVA OFFLINE
  // =========================================================================

  async registrarReservaOffline(datos: {
    sucursal_id: number;
    sucursal_nombre?: string;
    items: ItemOperacionOffline[];
    fecha_reserva?: string;
    cliente_id?: number;
    cliente_nombre?: string;
  }): Promise<OperacionOffline> {
    const uuid = this.generarUUID();
    const ahora = new Date().toISOString();
    const fechaReserva = datos.fecha_reserva || ahora.split('T')[0];

    const montoTotal = datos.items.reduce((acc, it) => acc + (it.cantidad * it.precio_unitario), 0);

    const exitoStock = await this.storage.reservarStockLocal(
      datos.sucursal_id,
      datos.items.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad }))
    );

    if (!exitoStock) {
      throw new Error('Stock local insuficiente para reservar las prendas indicadas.');
    }

    const payload = {
      operation_id: uuid,
      tipo: 'RESERVA',
      client_local_id: uuid,
      sucursal_id: datos.sucursal_id,
      cliente_id: datos.cliente_id || null,
      metodo_pago: 'efectivo',
      fecha_local: ahora,
      fecha_reserva: fechaReserva,
      total_local: montoTotal,
      items: datos.items.map(it => ({
        variante_id: it.variante_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
      }))
    };

    const operacion: OperacionOffline = {
      id: uuid,
      tipo: 'reserva',
      sucursal_id: datos.sucursal_id,
      sucursal_nombre: datos.sucursal_nombre,
      timestamp_local: ahora,
      estado: 'registrada_local',
      monto_total: montoTotal,
      items: datos.items,
      payload: payload,
      cliente_id: datos.cliente_id,
      cliente_nombre: datos.cliente_nombre,
      intentos_sincronizacion: 0
    };

    await this.storage.guardarOperacion(operacion);
    await this.actualizarMetricas();

    if (this.isOnline()) {
      this.sincronizarLotePendiente().subscribe({
        next: () => {},
        error: (e) => console.warn('[PWA Sync] Fallo auto-sincronización tras reserva:', e)
      });
    }

    return operacion;
  }

  // =========================================================================
  // 4. SINCRONIZACIÓN POR LOTES (POST /api/v1/sync/lote)
  // =========================================================================

  sincronizarLotePendiente(): Observable<SincronizacionResultado> {
    if (!this.isOnline()) {
      return of({ procesadas: 0, confirmadas: 0, rechazadas: 0, detalles: [] });
    }

    this.sincronizando.set(true);

    return from(this.storage.obtenerOperacionesPendientes()).pipe(
      tap(async (pendientes) => {
        if (!pendientes || pendientes.length === 0) {
          this.sincronizando.set(false);
        }
      }),
      switchMapMerge((pendientes) => {
        if (!pendientes || pendientes.length === 0) {
          return of({ procesadas: 0, confirmadas: 0, rechazadas: 0, detalles: [] });
        }

        const loteBody = {
          operaciones: pendientes.map(op => ({
            operation_id: op.id,
            tipo: op.tipo === 'venta' ? 'VENTA' : 'RESERVA',
            client_local_id: op.id,
            sucursal_id: op.sucursal_id,
            cliente_id: op.cliente_id || null,
            cliente_offline: op.cliente_nombre ? {
              nombres: op.cliente_nombre,
              apellidos: 'Mostrador',
              email: null,
              telefono: null
            } : null,
            metodo_pago: 'efectivo',
            fecha_local: op.timestamp_local,
            fecha_reserva: op.tipo === 'reserva' ? (op.payload?.fecha_reserva || op.timestamp_local.split('T')[0]) : null,
            total_local: op.monto_total,
            items: op.items.map(it => ({
              variante_id: it.variante_id,
              cantidad: it.cantidad,
              precio_unitario: it.precio_unitario
            }))
          }))
        };

        return this.http.post<any>(`${this.syncApiUrl}/lote`, loteBody, { headers: this.authHeaders }).pipe(
          tap(async (respuestaBackend) => {
            const resultados = respuestaBackend.resultados || [];
            let confirmadas = 0;
            let rechazadas = 0;

            for (const res of resultados) {
              const opLocal = pendientes.find(p => p.id === String(res.operation_id));
              if (opLocal) {
                if (res.estado === 'CONFIRMADA') {
                  confirmadas++;
                  await this.storage.actualizarOperacion(opLocal.id, {
                    estado: 'confirmada',
                    respuesta_servidor: res,
                    sincronizado_en: new Date().toISOString(),
                    error_mensaje: undefined
                  });
                } else {
                  rechazadas++;
                  await this.storage.actualizarOperacion(opLocal.id, {
                    estado: res.estado === 'EN_CONFLICTO' ? 'en_conflicto' : 'rechazada',
                    error_mensaje: res.motivo || 'Rechazo en servidor / Conflicto de inventario',
                    respuesta_servidor: res,
                    intentos_sincronizacion: (opLocal.intentos_sincronizacion || 0) + 1
                  });
                }
              }
            }

            await this.actualizarMetricas();
            this.sincronizando.set(false);
          }),
          mapResult((res, pendientes) => ({
            procesadas: res.total_operaciones || res.confirmadas || 0,
            confirmadas: res.confirmadas || 0,
            rechazadas: res.rechazadas || 0,
            detalles: res.resultados || []
          })),
          catchError(async (err) => {
            this.sincronizando.set(false);
            console.error('[PWA Sync] Error HTTP al sincronizar lote:', err);
            return {
              procesadas: 0,
              confirmadas: 0,
              rechazadas: pendientes.length,
              detalles: [{ error: err.message || 'Error de comunicación' }]
            };
          })
        );
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
