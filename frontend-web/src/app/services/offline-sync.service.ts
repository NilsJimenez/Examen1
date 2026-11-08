import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';

export interface CatalogoOfflineItem {
  inventario_id: number;
  variante_id: number;
  producto_id: number;
  sku: string;
  nombre: string;
  categoria: string;
  talla: string;
  color: string;
  color_hex: string;
  imagen_url?: string;
  precio_unitario: number;
  sucursal_id: number;
  sucursal_nombre: string;
  cantidad_disponible: number;
  cantidad_reservada: number;
  existencia_local_conocida: number;
}

export interface OperacionLocalOffline {
  operation_id: string;
  tipo: 'VENTA' | 'RESERVA';
  sucursal_id: number;
  sucursal_nombre?: string;
  cliente_id?: number | null;
  cliente_nombre: string;
  metodo_pago: 'efectivo';
  fecha_local: string;
  fecha_reserva?: string;
  horario_atencion?: string;
  observaciones?: string;
  estado_local: 'REGISTRADA_LOCAL' | 'ENVIADA' | 'CONFIRMADA' | 'EN_CONFLICTO' | 'RECHAZADA' | 'ANULADA';
  motivo_servidor?: string;
  entidad_id_servidor?: string;
  total_bs: number;
  items: {
    variante_id: number;
    sku: string;
    nombre: string;
    talla: string;
    color: string;
    cantidad: number;
    precio_unitario: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private apiUrl = `${environment.apiUrl}/sync`;
  private dbName = 'fashionstore_pwa_db';
  private dbVersion = 1;

  // Signals reactivos para la barra superior (RF32) y paneles
  isNavigatorOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  modoOfflineSimulado = signal<boolean>(false);
  enLinea = computed(() => this.isNavigatorOnline() && !this.modoOfflineSimulado());

  catalogoLocal = signal<CatalogoOfflineItem[]>([]);
  sucursalesLocales = signal<any[]>([]);
  clientesLocales = signal<any[]>([]);
  fechaUltimaDescarga = signal<string | null>(null);
  operacionesLocales = signal<OperacionLocalOffline[]>([]);

  pendientesCount = computed(() =>
    this.operacionesLocales().filter(o => o.estado_local === 'REGISTRADA_LOCAL').length
  );
  conflictosCount = computed(() =>
    this.operacionesLocales().filter(o => o.estado_local === 'EN_CONFLICTO' || o.estado_local === 'RECHAZADA').length
  );

  constructor(private http: HttpClient) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.isNavigatorOnline.set(true));
      window.addEventListener('offline', () => this.isNavigatorOnline.set(false));
      this.cargarDesdeAlmacenamientoLocal();
    }
  }

  toggleModoOfflineSimulado(): void {
    this.modoOfflineSimulado.set(!this.modoOfflineSimulado());
  }

  generarUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ===========================================================================
  // PERSISTENCIA EN INDEXEDDB + ESPEJO EN LOCALSTORAGE (RF24, RNF03, CP-F26)
  // ===========================================================================
  private abrirIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject('IndexedDB no disponible');
        return;
      }
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('catalogo_local')) {
          db.createObjectStore('catalogo_local', { keyPath: 'inventario_id' });
        }
        if (!db.objectStoreNames.contains('operaciones_pendientes')) {
          db.createObjectStore('operaciones_pendientes', { keyPath: 'operation_id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'clave' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async guardarEstadoLocal(): Promise<void> {
    try {
      localStorage.setItem('fs_pwa_catalogo', JSON.stringify(this.catalogoLocal()));
      localStorage.setItem('fs_pwa_sucursales', JSON.stringify(this.sucursalesLocales()));
      localStorage.setItem('fs_pwa_clientes', JSON.stringify(this.clientesLocales()));
      localStorage.setItem('fs_pwa_fecha_descarga', this.fechaUltimaDescarga() || '');
      localStorage.setItem('fs_pwa_operaciones', JSON.stringify(this.operacionesLocales()));

      const db = await this.abrirIndexedDB();
      const tx = db.transaction(['catalogo_local', 'operaciones_pendientes', 'meta'], 'readwrite');
      const catStore = tx.objectStore('catalogo_local');
      catStore.clear();
      for (const item of this.catalogoLocal()) {
        catStore.put(item);
      }

      const opStore = tx.objectStore('operaciones_pendientes');
      opStore.clear();
      for (const op of this.operacionesLocales()) {
        opStore.put(op);
      }

      const metaStore = tx.objectStore('meta');
      metaStore.put({ clave: 'fecha_descarga', valor: this.fechaUltimaDescarga() });
      db.close();
    } catch (e) {
      // Fallback en localStorage ya completado
    }
  }

  async cargarDesdeAlmacenamientoLocal(): Promise<void> {
    try {
      const catRaw = localStorage.getItem('fs_pwa_catalogo');
      const sucRaw = localStorage.getItem('fs_pwa_sucursales');
      const cliRaw = localStorage.getItem('fs_pwa_clientes');
      const fecRaw = localStorage.getItem('fs_pwa_fecha_descarga');
      const opsRaw = localStorage.getItem('fs_pwa_operaciones');

      if (catRaw) this.catalogoLocal.set(JSON.parse(catRaw));
      if (sucRaw) this.sucursalesLocales.set(JSON.parse(sucRaw));
      if (cliRaw) this.clientesLocales.set(JSON.parse(cliRaw));
      if (fecRaw) this.fechaUltimaDescarga.set(fecRaw);
      if (opsRaw) this.operacionesLocales.set(JSON.parse(opsRaw));
    } catch (e) {
      console.error('Error cargando almacenamiento offline:', e);
    }
  }

  // ===========================================================================
  // CU15: DESCARGAR SUBCONJUNTO DEL CATALOGO PARA USO OFFLINE
  // ===========================================================================
  descargarCatalogoServidor(sucursalId?: number): Observable<any> {
    let url = `${this.apiUrl}/catalogo-descarga`;
    if (sucursalId) {
      url += `?sucursal_id=${sucursalId}`;
    }
    return this.http.get<any>(url).pipe(
      tap(res => {
        this.catalogoLocal.set(res.catalogo || []);
        this.sucursalesLocales.set(res.sucursales || []);
        this.clientesLocales.set(res.clientes || []);
        this.fechaUltimaDescarga.set(res.fecha_descarga || new Date().toISOString());
        this.guardarEstadoLocal();
      })
    );
  }

  // ===========================================================================
  // CU17 & CU18: REGISTRAR VENTA DE CONTADO O RESERVA OFFLINE (RN11)
  // ===========================================================================
  registrarOperacionLocal(op: Omit<OperacionLocalOffline, 'operation_id' | 'fecha_local' | 'estado_local'>): OperacionLocalOffline {
    const nuevaOp: OperacionLocalOffline = {
      ...op,
      operation_id: this.generarUUID(),
      fecha_local: new Date().toISOString(),
      estado_local: 'REGISTRADA_LOCAL'
    };

    // Descontar existencia local conocida en IndexedDB (RF31)
    const catActualizado = this.catalogoLocal().map(item => {
      const linea = nuevaOp.items.find(
        i => i.variante_id === item.variante_id && nuevaOp.sucursal_id === item.sucursal_id
      );
      if (linea) {
        return {
          ...item,
          existencia_local_conocida: Math.max(0, item.existencia_local_conocida - linea.cantidad)
        };
      }
      return item;
    });
    this.catalogoLocal.set(catActualizado);

    this.operacionesLocales.set([nuevaOp, ...this.operacionesLocales()]);
    this.guardarEstadoLocal();
    return nuevaOp;
  }

  // ===========================================================================
  // CU20: SINCRONIZAR LOTE DE OPERACIONES PENDIENTES CON EL SERVIDOR
  // ===========================================================================
  sincronizarPendientes(): Observable<any> {
    const pendientes = this.operacionesLocales().filter(o => o.estado_local === 'REGISTRADA_LOCAL');
    const payload = {
      operaciones: pendientes.map(p => ({
        operation_id: p.operation_id,
        tipo: p.tipo,
        sucursal_id: p.sucursal_id,
        cliente_id: p.cliente_id || null,
        cliente_nombre: p.cliente_nombre,
        metodo_pago: 'efectivo',
        fecha_local: p.fecha_local,
        fecha_reserva: p.fecha_reserva,
        horario_atencion: p.horario_atencion || '15:00',
        observaciones: p.observaciones,
        items: p.items
      }))
    };

    return this.http.post<any>(this.apiUrl, payload).pipe(
      tap(res => {
        const resultadosMap = new Map<string, any>();
        for (const r of (res.resultados || [])) {
          resultadosMap.set(r.operation_id, r);
        }
        const actualizadas = this.operacionesLocales().map(op => {
          const r = resultadosMap.get(op.operation_id);
          if (r) {
            return {
              ...op,
              estado_local: r.estado as any,
              motivo_servidor: r.motivo,
              entidad_id_servidor: r.entidad_id
            };
          }
          return op;
        });
        this.operacionesLocales.set(actualizadas);
        this.guardarEstadoLocal();
      })
    );
  }

  // ===========================================================================
  // CU21 & CU22: BITACORA Y RESOLUCION DE CONFLICTOS EN SERVIDOR
  // ===========================================================================
  obtenerBitacoraServidor(estado?: string): Observable<any> {
    let url = `${this.apiUrl}/resultados`;
    if (estado) {
      url += `?estado=${estado}`;
    }
    return this.http.get<any>(url);
  }

  resolverConflictoServidor(operationId: string, body: { accion: 'ajustar_reenviar' | 'anular'; justificacion: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/conflictos/${operationId}/resolver`, body).pipe(
      tap(res => {
        // Actualizar estado en la cola local
        const actualizadas = this.operacionesLocales().map(op => {
          if (op.operation_id === operationId) {
            return {
              ...op,
              estado_local: 'ANULADA' as const,
              motivo_servidor: res.mensaje
            };
          }
          return op;
        });
        this.operacionesLocales.set(actualizadas);
        this.guardarEstadoLocal();
      })
    );
  }
}
