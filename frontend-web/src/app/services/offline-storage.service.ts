import { Producto } from '../models/producto.models';
import { Injectable } from '@angular/core';
import {
  ProductoOffline,
  VarianteOffline,
  InventarioOffline,
  OperacionOffline,
  PaqueteOfflineMeta,
  EstadoOperacionOffline
} from '../models/offline.models';

const DB_NAME = 'FashionStoreOfflineDB';
const DB_VERSION = 1;

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.getDB();
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB no está disponible en este entorno.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. Productos
        if (!db.objectStoreNames.contains('productos')) {
          db.createObjectStore('productos', { keyPath: 'id' });
        }

        // 2. Variantes
        if (!db.objectStoreNames.contains('variantes')) {
          const store = db.createObjectStore('variantes', { keyPath: 'id' });
          store.createIndex('producto_id', 'producto_id', { unique: false });
        }

        // 3. Inventario
        if (!db.objectStoreNames.contains('inventario')) {
          const store = db.createObjectStore('inventario', { keyPath: 'id' });
          store.createIndex('sucursal_variante', ['sucursal_id', 'variante_id'], { unique: false });
        }

        // 4. Sucursales
        if (!db.objectStoreNames.contains('sucursales')) {
          db.createObjectStore('sucursales', { keyPath: 'id' });
        }

        // 5. Operaciones Pendientes y Sincronizadas
        if (!db.objectStoreNames.contains('operaciones')) {
          const store = db.createObjectStore('operaciones', { keyPath: 'id' });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('timestamp_local', 'timestamp_local', { unique: false });
        }

        // 6. Metadatos de sincronización
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'clave' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // =========================================================================
  // GESTIÓN DE PAQUETE OFFLINE (CATÁLOGO, VARIANTES, INVENTARIO)
  // =========================================================================

  async guardarPaqueteOffline(paquete: any): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['productos', 'variantes', 'inventario', 'sucursales', 'meta'], 'readwrite');

    const prodStore = tx.objectStore('productos');
    const varStore = tx.objectStore('variantes');
    const invStore = tx.objectStore('inventario');
    const sucStore = tx.objectStore('sucursales');
    const metaStore = tx.objectStore('meta');

    // Limpiar catálogo previo del tenant para consistencia
    prodStore.clear();
    varStore.clear();
    invStore.clear();
    sucStore.clear();

    // 1. Guardar sucursales
    if (Array.isArray(paquete.sucursales)) {
      for (const s of paquete.sucursales) {
        sucStore.put(s);
      }
    }

    // 2. Guardar productos
    if (Array.isArray(paquete.productos)) {
      for (const p of paquete.productos) {
        prodStore.put({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio_base: Number(p.precio_base || p.precio || 0),
          categoria_id: p.categoria_id,
          categoria_nombre: p.categoria_nombre,
          imagen_url: p.imagen_url
        });
      }
    }

    // 3. Guardar variantes
    if (Array.isArray(paquete.variantes)) {
      for (const v of paquete.variantes) {
        varStore.put({
          id: v.id,
          producto_id: v.producto_id,
          sku: v.sku,
          talla: v.talla,
          color: v.color,
          precio: Number(v.precio || 0),
          codigo_barra: v.codigo_barra
        });
      }
    }

    // 4. Guardar inventario con cálculo de stock libre
    if (Array.isArray(paquete.inventario)) {
      for (const inv of paquete.inventario) {
        const disp = Number(inv.cantidad_disponible || 0);
        const res = Number(inv.cantidad_reservada || 0);
        invStore.put({
          id: inv.id || `${inv.sucursal_id}_${inv.variante_id}`,
          sucursal_id: inv.sucursal_id,
          variante_id: inv.variante_id,
          stock_disponible: disp,
          stock_reservado: res,
          stock_libre: Math.max(0, disp - res)
        });
      }
    }

    // 5. Guardar metadatos
    const meta: PaqueteOfflineMeta = {
      clave: 'paquete_meta',
      tenant_id: paquete.tenant_id || '',
      tenant_nombre: paquete.tenant_nombre || 'Boutique FashionStore',
      descargado_en: new Date().toISOString(),
      total_productos: paquete.productos?.length || 0,
      total_variantes: paquete.variantes?.length || 0,
      sucursal_id: paquete.sucursal_id
    };
    metaStore.put(meta);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async obtenerProductosOffline(categoriaId?: number, search?: string): Promise<ProductoOffline[]> {
    const db = await this.getDB();
    const tx = db.transaction('productos', 'readonly');
    const store = tx.objectStore('productos');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        let prods: ProductoOffline[] = request.result || [];
        if (categoriaId) {
          prods = prods.filter(p => p.categoria_id === categoriaId);
        }
        if (search && search.trim() !== '') {
          const q = search.toLowerCase().trim();
          const qRoot = (q.endsWith('s') && q.length > 3) ? q.slice(0, -1) : q;
          prods = prods.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            p.nombre.toLowerCase().includes(qRoot) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
            (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(q)) ||
            (p.categoria_nombre && p.categoria_nombre.toLowerCase().includes(qRoot))
          );
        }
        resolve(prods);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async obtenerVariantesProducto(productoId: number): Promise<VarianteOffline[]> {
    const db = await this.getDB();
    const tx = db.transaction('variantes', 'readonly');
    const store = tx.objectStore('variantes');
    const index = store.index('producto_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(productoId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async obtenerInventarioVariante(sucursalId: number, varianteId: number): Promise<InventarioOffline | null> {
    const db = await this.getDB();
    const tx = db.transaction('inventario', 'readonly');
    const store = tx.objectStore('inventario');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items: InventarioOffline[] = request.result || [];
        const match = items.find(i => i.sucursal_id === sucursalId && i.variante_id === varianteId);
        resolve(match || null);
      };
      request.onerror = () => reject(request.error);
    });
  }


  async obtenerSucursalesOffline(): Promise<any[]> {
    const db = await this.getDB();
    const tx = db.transaction('sucursales', 'readonly');
    const store = tx.objectStore('sucursales');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async obtenerCategoriasOffline(): Promise<any[]> {
    const db = await this.getDB();
    const tx = db.transaction('productos', 'readonly');
    const store = tx.objectStore('productos');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const prods = request.result || [];
        const catMap = new Map<number, string>();
        for (const p of prods) {
          if (p.categoria_id && p.categoria_nombre) {
            catMap.set(p.categoria_id, p.categoria_nombre);
          }
        }
        const cats = Array.from(catMap.entries()).map(([id, nombre]) => ({ id, nombre }));
        resolve(cats);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async obtenerCatalogoCompletoOffline(categoriaId?: number, search?: string, sucursalId?: number): Promise<Producto[]> {
    const db = await this.getDB();
    const prods = await this.obtenerProductosOffline(categoriaId, search);

    const tx = db.transaction(['variantes', 'inventario'], 'readonly');
    const varStore = tx.objectStore('variantes');
    const invStore = tx.objectStore('inventario');

    const [todasVariantes, todoInventario] = await Promise.all([
      new Promise<any[]>((res) => {
        const req = varStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      }),
      new Promise<any[]>((res) => {
        const req = invStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      })
    ]);

    return prods.map(p => {
      const pVars = todasVariantes.filter(v => v.producto_id === p.id);
      let stockTotalProd = 0;
      let stockSucursalProd = 0;

      const varsFormateadas = pVars.map(v => {
        const invs = todoInventario.filter(i => i.variante_id === v.id);
        const stockTotalVar = invs.reduce((acc, curr) => acc + (curr.stock_libre ?? curr.stock_disponible ?? 0), 0);
        stockTotalProd += stockTotalVar;

        if (sucursalId) {
          const invSuc = invs.find(i => i.sucursal_id === sucursalId);
          stockSucursalProd += invSuc ? (invSuc.stock_libre ?? invSuc.stock_disponible ?? 0) : 0;
        }

        const tallaObj = typeof v.talla === 'object' && v.talla !== null ? v.talla : { id: 1, nombre: v.talla || 'Única', orden: 1 };
        const colorObj = typeof v.color === 'object' && v.color !== null ? v.color : { id: 1, nombre: v.color || 'Estándar', codigo_hex: '#18181b' };

        return {
          id: v.id,
          sku: v.sku || `SKU-${v.id}`,
          precio_adicional: 0,
          imagen_url: v.imagen_url || p.imagen_url,
          activo: true,
          talla: tallaObj,
          color: colorObj,
          stock: stockTotalVar
        };
      });

      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio_base: p.precio_base,
        imagen_url: p.imagen_url,
        categoria_id: p.categoria_id,
        categoria: p.categoria_nombre ? { id: p.categoria_id || 1, nombre: p.categoria_nombre } : undefined,
        activo: true,
        variantes: varsFormateadas,
        stock_total: stockTotalProd,
        stock_sucursal_seleccionada: sucursalId ? stockSucursalProd : stockTotalProd
      } as Producto;
    });
  }


  // =========================================================================
  // GESTIÓN DE STOCK LOCAL Y OPERACIONES COMERCIALES
  // =========================================================================

  async descontarStockLocalVenta(
    sucursalId: number,
    items: { variante_id: number; cantidad: number }[]
  ): Promise<boolean> {
    const db = await this.getDB();
    const tx = db.transaction('inventario', 'readwrite');
    const store = tx.objectStore('inventario');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const registros: InventarioOffline[] = request.result || [];

        // Validar primero si todas las variantes tienen stock suficiente
        for (const item of items) {
          const reg = registros.find(r => r.sucursal_id === sucursalId && r.variante_id === item.variante_id);
          const stockLibre = reg ? reg.stock_libre : 0;
          if (stockLibre < item.cantidad) {
            tx.abort();
            resolve(false);
            return;
          }
        }

        // Si todas tienen stock suficiente, descontar
        for (const item of items) {
          const reg = registros.find(r => r.sucursal_id === sucursalId && r.variante_id === item.variante_id);
          if (reg) {
            reg.stock_disponible -= item.cantidad;
            reg.stock_libre = Math.max(0, reg.stock_disponible - reg.stock_reservado);
            store.put(reg);
          }
        }

        tx.oncomplete = () => resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async reservarStockLocal(
    sucursalId: number,
    items: { variante_id: number; cantidad: number }[]
  ): Promise<boolean> {
    const db = await this.getDB();
    const tx = db.transaction('inventario', 'readwrite');
    const store = tx.objectStore('inventario');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const registros: InventarioOffline[] = request.result || [];

        for (const item of items) {
          const reg = registros.find(r => r.sucursal_id === sucursalId && r.variante_id === item.variante_id);
          const stockLibre = reg ? reg.stock_libre : 0;
          if (stockLibre < item.cantidad) {
            tx.abort();
            resolve(false);
            return;
          }
        }

        for (const item of items) {
          const reg = registros.find(r => r.sucursal_id === sucursalId && r.variante_id === item.variante_id);
          if (reg) {
            reg.stock_reservado += item.cantidad;
            reg.stock_libre = Math.max(0, reg.stock_disponible - reg.stock_reservado);
            store.put(reg);
          }
        }

        tx.oncomplete = () => resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // =========================================================================
  // BANDEJA DE OPERACIONES OFFLINE (VENTAS Y RESERVAS)
  // =========================================================================

  async guardarOperacion(op: OperacionOffline): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('operaciones', 'readwrite');
    const store = tx.objectStore('operaciones');

    return new Promise((resolve, reject) => {
      const request = store.put(op);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async actualizarOperacion(id: string, updates: Partial<OperacionOffline>): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('operaciones', 'readwrite');
    const store = tx.objectStore('operaciones');

    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existente = getReq.result;
        if (!existente) {
          resolve();
          return;
        }
        const actualizado = { ...existente, ...updates };
        const putReq = store.put(actualizado);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async obtenerOperaciones(filtroEstado?: EstadoOperacionOffline): Promise<OperacionOffline[]> {
    const db = await this.getDB();
    const tx = db.transaction('operaciones', 'readonly');
    const store = tx.objectStore('operaciones');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        let ops: OperacionOffline[] = request.result || [];
        if (filtroEstado) {
          ops = ops.filter(o => o.estado === filtroEstado);
        }
        // Orden descendente por fecha
        ops.sort((a, b) => new Date(b.timestamp_local).getTime() - new Date(a.timestamp_local).getTime());
        resolve(ops);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async obtenerOperacionesPendientes(): Promise<OperacionOffline[]> {
    const db = await this.getDB();
    const tx = db.transaction('operaciones', 'readonly');
    const store = tx.objectStore('operaciones');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const ops: OperacionOffline[] = request.result || [];
        // Pendientes son aquellas no confirmadas ('registrada_local', 'enviada', 'rechazada')
        const pendientes = ops.filter(o => o.estado !== 'confirmada');
        resolve(pendientes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async contarOperacionesPendientes(): Promise<number> {
    const pendientes = await this.obtenerOperacionesPendientes();
    return pendientes.length;
  }

  // =========================================================================
  // METADATOS Y CONTROL DE DESACTUALIZACIÓN (> 12 HORAS)
  // =========================================================================

  async obtenerMetaPaquete(): Promise<PaqueteOfflineMeta | null> {
    const db = await this.getDB();
    const tx = db.transaction('meta', 'readonly');
    const store = tx.objectStore('meta');

    return new Promise((resolve, reject) => {
      const request = store.get('paquete_meta');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async esPaqueteDesactualizado(): Promise<{ desactualizado: boolean; horas: number; descargado_en: string | null }> {
    const meta = await this.obtenerMetaPaquete();
    if (!meta || !meta.descargado_en) {
      return { desactualizado: true, horas: 999, descargado_en: null };
    }
    const msDiferencia = Date.now() - new Date(meta.descargado_en).getTime();
    const horas = msDiferencia / (1000 * 60 * 60);
    return {
      desactualizado: horas >= 12.0,
      horas: Math.round(horas * 10) / 10,
      descargado_en: meta.descargado_en
    };
  }
}
