import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OfflineSyncService } from '../../services/offline-sync.service';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { PosCambioPrendaComponent } from '../../components/pos-cambio-prenda/pos-cambio-prenda.component';
import { CajaTurnoComponent } from '../../components/caja-turno/caja-turno.component';
import {
  ProductoOffline,
  VarianteOffline,
  OperacionOffline,
  PaqueteOfflineMeta,
  ItemOperacionOffline
} from '../../models/offline.models';

@Component({
  selector: 'app-offline-centro',
  standalone: true,
  imports: [CommonModule, FormsModule, PosCambioPrendaComponent, CajaTurnoComponent],
  template: `
    <div class="offline-center-container">

      <!-- =================================================================== -->
      <!-- 1. ENCABEZADO Y ESTADO DE CONECTIVIDAD & SINCRONIZACIÓN             -->
      <!-- =================================================================== -->
      <header class="page-header">
        <div class="header-left">
          <div class="badge-pwa" [class.badge-pwa-client]="esCliente">
            <i class="fa-solid fa-cloud-bolt mr-1"></i>
            {{ esCliente ? 'MODO CLIENTE OFFLINE' : 'DESAFÍO II — PWA OFFLINE' }}
          </div>
          <h1 class="font-serif text-3xl font-bold text-white mt-1">
            {{ esCliente ? 'Catálogo & Reservas Offline' : 'Centro de Operaciones Offline & Sincronización' }}
          </h1>
          <p class="text-zinc-400 text-sm mt-1">
            <span *ngIf="esCliente">
              Explora las prendas en almacenamiento local y reserva tu probador sin conexión. Se sincronizará automáticamente al reconectar.
            </span>
            <span *ngIf="esPersonalTienda">
              Gestión de persistencia local IndexedDB, ventas de contado (Regla 7.2), reservas y consistencia de inventario omnicanal.
            </span>
          </p>
        </div>

        <div class="header-actions">
          <!-- Botón Descargar Paquete Offline -->
          <button
            (click)="descargarPaquete()"
            [disabled]="descargando() || !syncService.isOnline()"
            class="btn-secondary"
            title="Descargar catálogo y existencias para operar offline"
          >
            <i class="fa-solid fa-download mr-1.5" [class.fa-spin]="descargando()"></i>
            {{ descargando() ? 'Descargando...' : 'Actualizar Catálogo Local' }}
          </button>

          <!-- Botón Sincronizar Lote -->
          <button
            (click)="sincronizarLote()"
            [disabled]="syncService.sincronizando() || !syncService.isOnline() || syncService.pendientesCount() === 0"
            class="btn-primary"
            [title]="esCliente ? 'Enviar mis reservas pendientes al servidor central' : 'Enviar operaciones pendientes al backend central'"
          >
            <i class="fa-solid fa-rotate mr-1.5" [class.fa-spin]="syncService.sincronizando()"></i>
            {{ syncService.sincronizando() ? 'Sincronizando...' : (esCliente ? 'Sincronizar Mis Reservas (' + syncService.pendientesCount() + ')' : 'Sincronizar Lote (' + syncService.pendientesCount() + ')') }}
          </button>
        </div>
      </header>

      <!-- =================================================================== -->
      <!-- 2. TARJETAS DE ESTADO DEL NODO WEB LOCAL                           -->
      <!-- =================================================================== -->
      <section class="metrics-grid">
        
        <!-- Tarjeta 1: Conectividad en tiempo real -->
        <div class="metric-card" [class.border-red]="!syncService.isOnline()" [class.border-green]="syncService.isOnline()">
          <div class="metric-icon" [style.background-color]="syncService.isOnline() ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'">
            <i [class]="syncService.isOnline() ? 'fa-solid fa-wifi text-green-500' : 'fa-solid fa-wifi-slash text-red-500'"></i>
          </div>
          <div class="metric-content">
            <span class="metric-label">ESTADO DE CONECTIVIDAD</span>
            <strong class="metric-value" [style.color]="syncService.isOnline() ? '#22c55e' : '#ef4444'">
              {{ syncService.isOnline() ? 'En Línea (Conectado)' : 'Sin Conexión (Offline)' }}
            </strong>
            <span class="metric-hint">
              {{ syncService.isOnline() ? 'Comunicación directa con PostgreSQL Supabase' : 'Operaciones almacenadas localmente en IndexedDB' }}
            </span>
          </div>
        </div>

        <!-- Tarjeta 2: Catálogo y Metadatos Locales -->
        <div class="metric-card" [class.border-amber]="meta()?.descargado_en && syncService.estadoDesactualizado().desactualizado">
          <div class="metric-icon bg-amber-500/15">
            <i class="fa-solid fa-boxes-stacked text-amber-500"></i>
          </div>
          <div class="metric-content">
            <span class="metric-label">CATÁLOGO LOCAL INDEXEDDB</span>
            <strong class="metric-value text-white">
              {{ productos().length }} Productos / {{ variantes().length }} Variantes
            </strong>
            <span class="metric-hint" *ngIf="meta()?.descargado_en">
              Descargado: {{ formatearFecha(meta()!.descargado_en) }}
              <span *ngIf="syncService.estadoDesactualizado().desactualizado" class="text-red-400 font-semibold ml-1">
                (>12h Desactualizado)
              </span>
            </span>
            <span class="metric-hint text-zinc-500" *ngIf="!meta()?.descargado_en">
              Sin datos locales. Presiona "Actualizar Catálogo Local".
            </span>
          </div>
        </div>

        <!-- Tarjeta 3: Operaciones Pendientes -->
        <div class="metric-card" [class.border-blue]="syncService.pendientesCount() > 0">
          <div class="metric-icon bg-blue-500/15">
            <i class="fa-solid fa-cloud-arrow-up text-blue-500"></i>
          </div>
          <div class="metric-content">
            <span class="metric-label">{{ esCliente ? 'MIS RESERVAS PENDIENTES' : 'OPERACIONES PENDIENTES' }}</span>
            <strong class="metric-value text-white">
              {{ syncService.pendientesCount() }} en cola local
            </strong>
            <span class="metric-hint">
              {{ esCliente ? 'Reservas guardadas en este dispositivo listas para sincronizar' : 'Ventas y reservas registradas localmente en este navegador' }}
            </span>
          </div>
        </div>

      </section>

      <!-- =================================================================== -->
      <!-- 3. ALERTA OBLIGATORIA DE INFORMACIÓN DESACTUALIZADA (SEC. 5.3)      -->
      <!-- =================================================================== -->
      <div *ngIf="syncService.estadoDesactualizado().desactualizado" class="alert-box alert-warning">
        <i class="fa-solid fa-triangle-exclamation text-xl mr-3 text-amber-400"></i>
        <div>
          <h4 class="font-bold text-amber-200">Aviso Oficial — Información Potencialmente Desactualizada (Sec. 5.3)</h4>
          <p class="text-xs text-amber-300/90 mt-0.5">
            El paquete de datos local tiene {{ syncService.estadoDesactualizado().horas }} horas de antigüedad (supera el umbral de 12 horas).
            Las existencias o precios pueden haber cambiado en el servidor central. Si dispones de conexión a Internet, actualiza el catálogo.
          </p>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- 4. PESTAÑAS DE NAVEGACIÓN FUNCIONAL (ADAPTADAS POR ROL)             -->
      <!-- =================================================================== -->
      <nav class="tabs-nav">
        <!-- 1. POS Offline (Solo Personal de Tienda: Cajero, Encargado, Admin) -->
        <button
          *ngIf="esPersonalTienda"
          (click)="tabActiva.set('pos')"
          class="tab-btn"
          [class.active]="tabActiva() === 'pos'"
        >
          <i class="fa-solid fa-cash-register mr-1.5"></i>
          1. POS Offline (Venta Contado)
        </button>

        <!-- 2. Catálogo Local (Visible para Todos; Pestaña #1 para Clientes) -->
        <button
          (click)="tabActiva.set('catalogo')"
          class="tab-btn"
          [class.active]="tabActiva() === 'catalogo'"
        >
          <i class="fa-solid fa-shirt mr-1.5"></i>
          {{ esCliente ? '1. Catálogo Offline' : '3. Catálogo Local' }} ({{ productos().length }})
        </button>

        <!-- 3. Reserva Offline (Visible para Todos) -->
        <button
          (click)="tabActiva.set('reserva')"
          class="tab-btn"
          [class.active]="tabActiva() === 'reserva'"
        >
          <i class="fa-solid fa-calendar-check mr-1.5"></i>
          {{ esCliente ? '2. Mis Reservas & Probador' : '2. Reserva Offline' }}
        </button>

        <!-- 4. Historial & Auditoría Sincronización (Solo Personal de Tienda) -->
        <button
          *ngIf="esPersonalTienda"
          (click)="tabActiva.set('operaciones')"
          class="tab-btn"
          [class.active]="tabActiva() === 'operaciones'"
        >
          <i class="fa-solid fa-list-check mr-1.5"></i>
          4. Historial & Auditoría Sincronización ({{ operaciones().length }})
        </button>

        <!-- 5. Cambio de Prenda (CU13) (Solo Personal de Tienda) -->
        <button
          *ngIf="esPersonalTienda"
          (click)="tabActiva.set('cambio')"
          class="tab-btn"
          [class.active]="tabActiva() === 'cambio'"
        >
          <i class="fa-solid fa-arrows-rotate mr-1.5"></i>
          5. Cambio de Prenda (CU13)
        </button>

        <!-- 6. Control de Caja (CU30) (Solo Personal de Tienda) -->
        <button
          *ngIf="esPersonalTienda"
          (click)="tabActiva.set('caja')"
          class="tab-btn"
          [class.active]="tabActiva() === 'caja'"
        >
          <i class="fa-solid fa-vault mr-1.5"></i>
          6. Control de Caja (CU30)
        </button>
      </nav>

      <!-- =================================================================== -->
      <!-- 5. TAB 1: POS OFFLINE (VENTA DE CONTADO - REGLA 7.2)                -->
      <!-- =================================================================== -->
      <section *ngIf="esPersonalTienda && tabActiva() === 'pos'" class="tab-content animate-fade-in">
        <div class="pos-layout">
          
          <!-- Lado Izquierdo: Selector de Prendas del Catálogo Local -->
          <div class="pos-products-panel">
            <div class="panel-header">
              <h3 class="font-bold text-white text-base">Seleccionar Prenda para Venta Rápida</h3>
              <input
                type="text"
                [(ngModel)]="busquedaPos"
                placeholder="Buscar prenda local por nombre..."
                class="input-search"
              />
            </div>

            <div class="pos-grid" *ngIf="productosFiltradosPos().length > 0">
              <div
                *ngFor="let prod of productosFiltradosPos()"
                class="pos-card"
                (click)="seleccionarProductoParaVenta(prod)"
              >
                <div class="pos-card-thumb">
                  <img [src]="prod.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300'" [alt]="prod.nombre" />
                </div>
                <div class="pos-card-info">
                  <h4 class="font-bold text-white text-sm truncate">{{ prod.nombre }}</h4>
                  <span class="text-xs text-zinc-400">{{ prod.categoria_nombre || 'Moda' }}</span>
                  <div class="pos-card-bottom">
                    <span class="text-amber-400 font-bold text-sm">Bs. {{ prod.precio_base }}</span>
                    <button class="btn-pos-add" title="Agregar prenda al ticket">
                      <i class="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="productosFiltradosPos().length === 0" class="empty-state">
              <i class="fa-solid fa-shirt text-4xl text-zinc-600 mb-2"></i>
              <p class="text-zinc-400 text-sm">No se encontraron productos en el catálogo local.</p>
              <button (click)="descargarPaquete()" [disabled]="descargando() || !syncService.isOnline()" class="btn-secondary mt-3">
                <i class="fa-solid fa-download mr-1" [class.fa-spin]="descargando()"></i> {{ descargando() ? 'Descargando...' : 'Descargar Catálogo Ahora' }}
              </button>
              <div *ngIf="!syncService.isOnline()" class="text-xs text-amber-400 mt-2 font-medium">
                <i class="fa-solid fa-triangle-exclamation mr-1"></i> Para descargar, cambia en DevTools (Network) de "Offline" a "No throttling".
              </div>
            </div>
          </div>

          <!-- Lado Derecho: Ticket de Venta POS Offline -->
          <div class="pos-ticket-panel">
            <div class="ticket-header">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-white text-base">Ticket de Venta Offline</h3>
                <span class="badge-tag">Regla 7.2: Contado</span>
              </div>
              <p class="text-xs text-zinc-400 mt-1">
                Aprobación inmediata en local. Descuenta stock libre en IndexedDB.
              </p>
            </div>

            <!-- Tabla de Ítems en Ticket -->
            <div class="ticket-items-list">
              <div *ngFor="let it of itemsTicketVenta(); let idx = index" class="ticket-item-row">
                <div class="ticket-item-desc">
                  <strong class="text-sm text-white block">{{ it.producto_nombre }}</strong>
                  <span class="text-xs text-zinc-400">Talla: {{ it.talla }} | Color: {{ it.color }}</span>
                </div>
                
                <div class="ticket-item-qty">
                  <button (click)="modificarCantidadTicket(idx, -1)" class="btn-qty">-</button>
                  <span class="qty-text">{{ it.cantidad }}</span>
                  <button (click)="modificarCantidadTicket(idx, 1)" class="btn-qty">+</button>
                </div>

                <div class="ticket-item-price">
                  <span class="text-sm font-bold text-white">Bs. {{ it.subtotal }}</span>
                </div>

                <button (click)="removerItemTicket(idx)" class="btn-remove-item" title="Quitar ítem">
                  <i class="fa-solid fa-trash-can text-red-400 text-xs"></i>
                </button>
              </div>

              <div *ngIf="itemsTicketVenta().length === 0" class="empty-ticket">
                <i class="fa-solid fa-cart-arrow-down text-3xl text-zinc-600 mb-1"></i>
                <p class="text-xs text-zinc-500">Selecciona prendas del catálogo para iniciar la venta.</p>
              </div>
            </div>

            <!-- Resumen y Pago en Efectivo -->
            <div class="ticket-footer">
              <div class="ticket-total-row">
                <span class="text-sm text-zinc-400">Total a Pagar:</span>
                <strong class="text-xl font-bold text-amber-400">Bs. {{ totalTicketVenta() }}</strong>
              </div>

              <!-- Cálculo de Cambio / Vuelto -->
              <div class="cash-calc-row">
                <label class="text-xs text-zinc-400">Monto Efectivo Recibido (Bs):</label>
                <div class="cash-input-box">
                  <input
                    type="number"
                    [(ngModel)]="efectivoRecibido"
                    (input)="calcularVuelto()"
                    placeholder="0.00"
                    min="0"
                    class="input-cash"
                  />
                </div>
              </div>

              <div class="cambio-row" *ngIf="efectivoRecibido > 0">
                <span class="text-xs text-zinc-400">Cambio / Vuelto:</span>
                <strong class="text-sm font-bold" [class.text-green-400]="vueltoCalculado >= 0" [class.text-red-400]="vueltoCalculado < 0">
                  Bs. {{ vueltoCalculado }}
                </strong>
              </div>

              <!-- Sucursal Responsable -->
              <div class="sucursal-select-box">
                <label class="text-xs text-zinc-400 block mb-1">Sucursal de Venta:</label>
                <select [(ngModel)]="sucursalSeleccionadaId" class="select-sucursal">
                  <option *ngFor="let s of sucursales()" [value]="s.id">{{ s.nombre }} ({{ s.ciudad }})</option>
                </select>
              </div>

              <!-- Botón Emitir Venta -->
              <button
                (click)="confirmarVentaOffline()"
                [disabled]="itemsTicketVenta().length === 0 || procesandoVenta() || (efectivoRecibido > 0 && vueltoCalculado < 0)"
                class="btn-emitir-venta"
              >
                <i class="fa-solid fa-receipt mr-1.5" [class.fa-spin]="procesandoVenta()"></i>
                {{ procesandoVenta() ? 'Registrando en Local...' : 'Emitir Venta de Contado Offline' }}
              </button>
            </div>

          </div>

        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 6. TAB 2: RESERVA OFFLINE                                           -->
      <!-- =================================================================== -->
      <section *ngIf="tabActiva() === 'reserva'" class="tab-content animate-fade-in">
        <div class="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
          <div class="border-b border-zinc-800 pb-4 mb-5">
            <span class="badge-tag">{{ esCliente ? 'Reserva de Probador / Prenda' : 'CU04 — Reserva Offline' }}</span>
            <h3 class="text-lg font-bold text-white mt-1">{{ esCliente ? 'Apartar Prenda para Prueba en Tienda' : 'Registrar Reserva Local de Prendas' }}</h3>
            <p class="text-xs text-zinc-400">
              {{ esCliente ? 'Aparta prendas en la sucursal seleccionada sin conexión. Se registrará localmente y se enviará al reconectar.' : 'Aparta stock en el inventario local de la sucursal para prueba en vestidor físico (Vigencia 48h).' }}
            </p>
          </div>

          <form (ngSubmit)="confirmarReservaOffline()" class="space-y-4">
            
            <div>
              <label class="block text-xs font-semibold text-zinc-300 mb-1">Cliente Solicitante:</label>
              <input
                type="text"
                [(ngModel)]="nombreClienteReserva"
                name="cliente"
                placeholder="Nombre completo o celular del cliente..."
                required
                class="input-text"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Sucursal de Retiro:</label>
                <select [(ngModel)]="sucursalReservaId" name="sucursal" class="select-sucursal">
                  <option *ngFor="let s of sucursales()" [value]="s.id">{{ s.nombre }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Prenda a Reservar:</label>
                <select [(ngModel)]="varianteReservaId" name="variante" class="select-sucursal">
                  <option *ngFor="let v of variantes()" [value]="v.id">
                    SKU: {{ v.sku }} | Talla: {{ v.talla }} ({{ v.color }}) — Bs. {{ v.precio }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Cantidad de Prendas:</label>
                <input
                  type="number"
                  [(ngModel)]="cantidadReserva"
                  name="cantidad"
                  min="1"
                  max="5"
                  class="input-text"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-zinc-300 mb-1">Fecha de Visita Estimada:</label>
                <input
                  type="date"
                  [(ngModel)]="fechaVisitaReserva"
                  name="fecha"
                  class="input-text"
                />
              </div>
            </div>

            <button
              type="submit"
              [disabled]="!varianteReservaId || procesandoReserva()"
              class="btn-primary w-full py-3 mt-4"
            >
              <i class="fa-solid fa-bookmark mr-1.5" [class.fa-spin]="procesandoReserva()"></i>
              {{ procesandoReserva() ? 'Registrando en Local...' : 'Confirmar Reserva Offline (IndexedDB)' }}
            </button>
          </form>

          <!-- Historial de Mis Reservas Offline (Para clientes y personal) -->
          <div *ngIf="obtenerReservasCliente().length > 0" class="mt-8 border-t border-zinc-800 pt-6">
            <h4 class="font-bold text-white text-base mb-3 flex items-center gap-2">
              <i class="fa-solid fa-clock-rotate-left text-amber-400"></i>
              {{ esCliente ? 'Mis Reservas Guardadas en este Dispositivo' : 'Reservas Registradas Localmente' }}
              <span class="text-xs text-zinc-400 font-normal">({{ obtenerReservasCliente().length }})</span>
            </h4>
            <div class="space-y-3">
              <div *ngFor="let res of obtenerReservasCliente()" class="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-white">ID: {{ res.id.substring(0, 8) }}...</span>
                    <span class="badge-estado" [class.estado-registrada]="res.estado === 'registrada_local'" [class.estado-confirmada]="res.estado === 'confirmada'">
                      {{ res.estado === 'registrada_local' ? 'Pendiente Sincronizar' : 'Confirmada' }}
                    </span>
                  </div>
                  <div class="text-xs text-zinc-300 mt-1">
                    <span *ngIf="res.items && res.items.length > 0">
                      {{ res.items[0].producto_nombre }} (Talla: {{ res.items[0].talla }}, Cant: {{ res.items[0].cantidad }})
                    </span>
                    <span class="text-zinc-500 ml-2">• Fecha: {{ formatearFecha(res.timestamp_local) }}</span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-bold text-amber-400 text-sm">Bs. {{ res.monto_total }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 7. TAB 3: CATÁLOGO LOCAL INDEXEDDB                                  -->
      <!-- =================================================================== -->
      <section *ngIf="tabActiva() === 'catalogo'" class="tab-content animate-fade-in">
        <div class="catalog-header">
          <div>
            <h3 class="font-bold text-white text-lg">Prendas y Existencias en Almacenamiento Local</h3>
            <p class="text-xs text-zinc-400">Total: {{ productos().length }} productos disponibles sin Internet.</p>
          </div>
          <input
            type="text"
            [(ngModel)]="busquedaCatalogo"
            placeholder="Filtrar por nombre o descripción..."
            class="input-search max-w-xs"
          />
        </div>

        <div class="catalog-grid" *ngIf="productosFiltradosCatalogo().length > 0">
          <div *ngFor="let prod of productosFiltradosCatalogo()" class="catalog-card">
            <div class="catalog-thumb">
              <img [src]="prod.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'" [alt]="prod.nombre" />
              <span class="badge-cat">{{ prod.categoria_nombre || 'Colección' }}</span>
            </div>
            <div class="catalog-body">
              <h4 class="font-bold text-white text-base">{{ prod.nombre }}</h4>
              <p class="text-xs text-zinc-400 line-clamp-2 mt-1">{{ prod.descripcion || 'Sin descripción disponible.' }}</p>
              
              <div class="catalog-variantes-box">
                <span class="text-xs text-zinc-400 font-semibold block mb-1">Variantes Locales:</span>
                <div class="variantes-chips">
                  <span *ngFor="let v of obtenerVariantesDeProducto(prod.id)" class="chip-variante">
                    {{ v.talla }} / {{ v.color }} (Bs. {{ v.precio }})
                  </span>
                </div>
              </div>

              <div class="catalog-footer">
                <div>
                  <span class="font-bold text-amber-400 text-lg">Bs. {{ prod.precio_base }}</span>
                  <span class="badge-offline-ok block text-xs"><i class="fa-solid fa-check mr-1"></i> Disponible Offline</span>
                </div>
                <!-- Botón de acción rápida según rol -->
                <button
                  *ngIf="esCliente"
                  (click)="iniciarReservaDesdeProducto(prod)"
                  class="btn-primary"
                  style="padding: 0.45rem 0.9rem; font-size: 0.78rem;"
                  title="Reservar esta prenda para prueba física"
                >
                  <i class="fa-solid fa-calendar-check mr-1"></i> Reservar
                </button>
                <button
                  *ngIf="esPersonalTienda"
                  (click)="seleccionarProductoParaVenta(prod); tabActiva.set('pos')"
                  class="btn-secondary"
                  style="padding: 0.45rem 0.9rem; font-size: 0.78rem;"
                  title="Cargar prenda al ticket del POS"
                >
                  <i class="fa-solid fa-cash-register mr-1"></i> Al POS
                </button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="productosFiltradosCatalogo().length === 0" class="empty-state">
          <p class="text-zinc-400">No hay productos locales para el filtro aplicado.</p>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 8. TAB 4: BANDEJA DE OPERACIONES & AUDITORÍA DE SINCRONIZACIÓN      -->
      <!-- =================================================================== -->
      <section *ngIf="esPersonalTienda && tabActiva() === 'operaciones'" class="tab-content animate-fade-in">
        <div class="ops-header">
          <div>
            <h3 class="font-bold text-white text-lg">Registro de Transacciones Locales y Sincronización</h3>
            <p class="text-xs text-zinc-400">Las operaciones conservan su identificador único (UUIDv4) y estado auditado.</p>
          </div>

          <!-- Filtros de Estado -->
          <div class="ops-filter-pills">
            <button
              (click)="filtroOps.set('todas')"
              class="pill-btn"
              [class.active]="filtroOps() === 'todas'"
            >
              Todas ({{ operaciones().length }})
            </button>
            <button
              (click)="filtroOps.set('registrada_local')"
              class="pill-btn"
              [class.active]="filtroOps() === 'registrada_local'"
            >
              Pendientes ({{ contarOpsPorEstado('registrada_local') }})
            </button>
            <button
              (click)="filtroOps.set('confirmada')"
              class="pill-btn text-green-400"
              [class.active]="filtroOps() === 'confirmada'"
            >
              Confirmadas ({{ contarOpsPorEstado('confirmada') }})
            </button>
            <button
              (click)="filtroOps.set('rechazada')"
              class="pill-btn text-red-400"
              [class.active]="filtroOps() === 'rechazada'"
            >
              Rechazadas ({{ contarOpsPorEstado('rechazada') }})
            </button>
          </div>
        </div>

        <!-- Tabla de Operaciones -->
        <div class="ops-table-container" *ngIf="operacionesFiltradas().length > 0">
          <table class="ops-table">
            <thead>
              <tr>
                <th>ID Operación (UUIDv4)</th>
                <th>Tipo</th>
                <th>Fecha Local</th>
                <th>Detalle Prendas</th>
                <th>Total Bs</th>
                <th>Estado</th>
                <th>Auditoría / Servidor</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let op of operacionesFiltradas()">
                <td class="font-mono text-xs text-zinc-300">
                  <span class="truncate block max-w-[140px]" [title]="op.id">{{ op.id }}</span>
                </td>
                <td>
                  <span class="badge-op-tipo" [class.tipo-venta]="op.tipo === 'venta'" [class.tipo-reserva]="op.tipo === 'reserva'">
                    <i [class]="op.tipo === 'venta' ? 'fa-solid fa-receipt mr-1' : 'fa-solid fa-bookmark mr-1'"></i>
                    {{ op.tipo | uppercase }}
                  </span>
                </td>
                <td class="text-xs text-zinc-300">
                  {{ formatearFecha(op.timestamp_local) }}
                </td>
                <td class="text-xs text-zinc-300">
                  <span *ngFor="let it of op.items" class="block">
                    {{ it.cantidad }}x {{ it.producto_nombre || ('Variante #' + it.variante_id) }} (Bs. {{ it.subtotal }})
                  </span>
                  <span *ngIf="op.cliente_nombre" class="text-zinc-500 text-[11px] block">
                    Cliente: {{ op.cliente_nombre }}
                  </span>
                </td>
                <td class="font-bold text-amber-400 text-sm">
                  Bs. {{ op.monto_total }}
                </td>
                <td>
                  <span
                    class="badge-estado"
                    [class.estado-registrada]="op.estado === 'registrada_local'"
                    [class.estado-confirmada]="op.estado === 'confirmada'"
                    [class.estado-rechazada]="op.estado === 'rechazada' || op.estado === 'en_conflicto'"
                  >
                    <i *ngIf="op.estado === 'registrada_local'" class="fa-solid fa-clock mr-1"></i>
                    <i *ngIf="op.estado === 'confirmada'" class="fa-solid fa-circle-check mr-1"></i>
                    <i *ngIf="op.estado === 'rechazada' || op.estado === 'en_conflicto'" class="fa-solid fa-triangle-exclamation mr-1"></i>
                    {{ op.estado }}
                  </span>
                </td>
                <td class="text-xs">
                  <span *ngIf="op.estado === 'confirmada'" class="text-green-400">
                    <i class="fa-solid fa-check-double mr-1"></i> Sincronizado OK
                  </span>
                  <span *ngIf="op.estado === 'rechazada'" class="text-red-400 font-medium" [title]="op.error_mensaje || ''">
                    <i class="fa-solid fa-circle-xmark mr-1"></i> {{ op.error_mensaje || 'Conflicto de stock central' }}
                  </span>
                  <span *ngIf="op.estado === 'registrada_local'" class="text-zinc-400">
                    Pendiente de envío por lote
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="operacionesFiltradas().length === 0" class="empty-state">
          <i class="fa-solid fa-inbox text-4xl text-zinc-600 mb-2"></i>
          <p class="text-zinc-400">No hay operaciones registradas para este filtro.</p>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 9. TAB 5: CAMBIO DE PRENDA (CU13 - RN20 & RN21)                     -->
      <!-- =================================================================== -->
      <section *ngIf="esPersonalTienda && tabActiva() === 'cambio'" class="tab-content animate-fade-in">
        <app-pos-cambio-prenda></app-pos-cambio-prenda>
      </section>

      <!-- =================================================================== -->
      <!-- 10. TAB 6: CONTROL DE CAJA, ARQUEO Y CIERRE POR TURNO (CU30)       -->
      <!-- =================================================================== -->
      <section *ngIf="esPersonalTienda && tabActiva() === 'caja'" class="tab-content animate-fade-in">
        <app-caja-turno [sucursalIdInput]="sucursalSeleccionadaId"></app-caja-turno>
      </section>

    </div>
  `,
  styles: [`
    .offline-center-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      border-bottom: 1px solid #27272a;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }
    .badge-pwa {
      display: inline-block;
      background: #78350f;
      color: #fef3c7;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      letter-spacing: 0.05em;
    }
    .badge-pwa-client {
      background: #0369a1 !important;
      color: #e0f2fe !important;
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .btn-primary {
      background-color: #d97706;
      color: #ffffff;
      border: none;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      transition: background 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      background-color: #b45309;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-secondary {
      background-color: #27272a;
      color: #ffffff;
      border: 1px solid #3f3f46;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
    }
    .btn-secondary:hover:not(:disabled) {
      background-color: #3f3f46;
    }
    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .metric-card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    }
    .metric-card.border-green { border-color: #22c55e40; }
    .metric-card.border-red { border-color: #ef444450; }
    .metric-card.border-amber { border-color: #f59e0b50; }
    .metric-card.border-blue { border-color: #3b82f650; }
    .metric-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    .metric-content {
      display: flex;
      flex-direction: column;
    }
    .metric-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #a1a1aa;
      letter-spacing: 0.05em;
    }
    .metric-value {
      font-size: 1.15rem;
      line-height: 1.3;
      margin: 0.2rem 0;
    }
    .metric-hint {
      font-size: 0.75rem;
      color: #71717a;
    }
    .alert-box {
      border-radius: 10px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .alert-warning {
      background-color: #451a03;
      border: 1px solid #92400e;
    }
    .tabs-nav {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid #27272a;
      margin-bottom: 1.5rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }
    .tab-btn {
      background: none;
      border: none;
      color: #a1a1aa;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn:hover {
      color: #ffffff;
      background-color: #27272a;
    }
    .tab-btn.active {
      background-color: #d97706;
      color: #ffffff;
    }
    .tab-content {
      margin-top: 1rem;
    }
    .pos-layout {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 1.5rem;
    }
    @media (max-width: 900px) {
      .pos-layout { grid-template-columns: 1fr; }
    }
    .pos-products-panel, .pos-ticket-panel {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 1.25rem;
    }
    .panel-header, .ticket-header {
      border-bottom: 1px solid #27272a;
      padding-bottom: 0.85rem;
      margin-bottom: 1rem;
    }
    .input-search {
      width: 100%;
      background-color: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 0.45rem 0.75rem;
      color: #ffffff;
      font-size: 0.825rem;
      margin-top: 0.5rem;
    }
    .input-text, .select-sucursal {
      width: 100%;
      background-color: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 0.55rem 0.75rem;
      color: #ffffff;
      font-size: 0.85rem;
    }
    .pos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.85rem;
      max-height: 520px;
      overflow-y: auto;
    }
    .pos-card {
      background-color: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
    }
    .pos-card:hover {
      transform: translateY(-2px);
      border-color: #d97706;
    }
    .pos-card-thumb img {
      width: 100%;
      height: 110px;
      object-fit: cover;
    }
    .pos-card-info {
      padding: 0.65rem;
    }
    .pos-card-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.5rem;
    }
    .btn-pos-add {
      background-color: #d97706;
      color: #ffffff;
      border: none;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .badge-tag {
      background-color: #3b82f620;
      color: #93c5fd;
      border: 1px solid #3b82f640;
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .ticket-items-list {
      max-height: 280px;
      overflow-y: auto;
      margin-bottom: 1rem;
    }
    .ticket-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0;
      border-bottom: 1px solid #27272a;
      gap: 0.5rem;
    }
    .btn-qty {
      background-color: #3f3f46;
      border: none;
      color: #ffffff;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      cursor: pointer;
    }
    .qty-text {
      padding: 0 0.4rem;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .btn-remove-item {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.2rem;
    }
    .ticket-footer {
      border-top: 2px solid #27272a;
      padding-top: 1rem;
    }
    .ticket-total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.85rem;
    }
    .cash-calc-row {
      margin-bottom: 0.65rem;
    }
    .input-cash {
      width: 100%;
      background-color: #27272a;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      padding: 0.45rem 0.75rem;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 700;
    }
    .cambio-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.85rem;
    }
    .sucursal-select-box {
      margin-bottom: 1rem;
    }
    .btn-emitir-venta {
      width: 100%;
      background-color: #16a34a;
      color: #ffffff;
      border: none;
      padding: 0.75rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .btn-emitir-venta:hover:not(:disabled) {
      background-color: #15803d;
    }
    .btn-emitir-venta:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .catalog-header, .ops-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.25rem;
    }
    .catalog-card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
      overflow: hidden;
    }
    .catalog-thumb {
      position: relative;
    }
    .catalog-thumb img {
      width: 100%;
      height: 160px;
      object-fit: cover;
    }
    .badge-cat {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background-color: rgba(0, 0, 0, 0.7);
      color: #ffffff;
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .catalog-body {
      padding: 1rem;
    }
    .catalog-variantes-box {
      margin: 0.75rem 0;
    }
    .chip-variante {
      display: inline-block;
      background-color: #27272a;
      color: #d4d4d8;
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      margin-right: 0.35rem;
      margin-bottom: 0.35rem;
    }
    .catalog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #27272a;
      padding-top: 0.75rem;
      margin-top: 0.5rem;
    }
    .badge-offline-ok {
      color: #22c55e;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .ops-filter-pills {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .pill-btn {
      background-color: #18181b;
      border: 1px solid #27272a;
      color: #a1a1aa;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      cursor: pointer;
    }
    .pill-btn.active {
      background-color: #27272a;
      color: #ffffff;
      border-color: #d97706;
    }
    .ops-table-container {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
      overflow-x: auto;
    }
    .ops-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.825rem;
      text-align: left;
    }
    .ops-table th {
      background-color: #27272a;
      color: #a1a1aa;
      padding: 0.75rem 1rem;
      font-weight: 600;
      border-bottom: 1px solid #3f3f46;
    }
    .ops-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid #27272a;
      color: #e4e4e7;
    }
    .badge-op-tipo {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    .tipo-venta {
      background-color: #065f4625;
      color: #34d399;
      border: 1px solid #065f4650;
    }
    .tipo-reserva {
      background-color: #1e3a8a25;
      color: #93c5fd;
      border: 1px solid #1e3a8a50;
    }
    .badge-estado {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }
    .estado-registrada {
      background-color: #854d0e25;
      color: #fde047;
      border: 1px solid #854d0e50;
    }
    .estado-confirmada {
      background-color: #14532d25;
      color: #4ade80;
      border: 1px solid #14532d50;
    }
    .estado-rechazada {
      background-color: #7f1d1d25;
      color: #f87171;
      border: 1px solid #7f1d1d50;
    }
    .empty-state, .empty-ticket {
      text-align: center;
      padding: 2.5rem 1rem;
    }
  `]
})
export class OfflineCentroComponent implements OnInit {
  public syncService = inject(OfflineSyncService);
  private storage = inject(OfflineStorageService);
  private toast = inject(ToastService);
  public authService = inject(AuthService);

  get esPersonalTienda(): boolean {
    const r = (this.authService.currentUserValue?.role || '').toLowerCase();
    return r === 'cajero' || r === 'encargado_sucursal' || r === 'administrador' || r === 'admin' || r === 'superadmin';
  }

  get esCliente(): boolean {
    return !this.esPersonalTienda;
  }

  // Estados Reactivos Locales
  public tabActiva = signal<'pos' | 'reserva' | 'catalogo' | 'operaciones' | 'cambio' | 'caja'>('catalogo');
  public meta = signal<PaqueteOfflineMeta | null>(null);
  public productos = signal<ProductoOffline[]>([]);
  public variantes = signal<VarianteOffline[]>([]);
  public sucursales = signal<any[]>([]);
  public operaciones = signal<OperacionOffline[]>([]);

  public descargando = signal<boolean>(false);
  public procesandoVenta = signal<boolean>(false);
  public procesandoReserva = signal<boolean>(false);

  // Filtros
  public busquedaPos = '';
  public busquedaCatalogo = '';
  public filtroOps = signal<string>('todas');

  // Ticket POS Offline
  public itemsTicketVenta = signal<ItemOperacionOffline[]>([]);
  public totalTicketVenta = signal<number>(0);
  public efectivoRecibido: number = 0;
  public vueltoCalculado: number = 0;
  public sucursalSeleccionadaId: number = 1;

  // Formulario Reserva Offline
  public sucursalReservaId: number = 1;
  public varianteReservaId: number | null = null;
  public nombreClienteReserva: string = '';
  public cantidadReserva: number = 1;
  public fechaVisitaReserva: string = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    if (this.esCliente) {
      this.tabActiva.set('catalogo');
      if (this.authService.currentUserValue?.nombre_completo) {
        this.nombreClienteReserva = this.authService.currentUserValue.nombre_completo;
      }
    } else {
      this.tabActiva.set('pos');
    }
    this.cargarDatosLocales();
  }

  async cargarDatosLocales(): Promise<void> {
    const metaData = await this.storage.obtenerMetaPaquete();
    this.meta.set(metaData);

    const prods = await this.storage.obtenerProductosOffline();
    this.productos.set(prods);

    const ops = await this.storage.obtenerOperaciones();
    this.operaciones.set(ops);

    // Obtener variantes y sucursales de la BD local
    const db = await (this.storage as any).getDB();
    const tx = db.transaction(['variantes', 'sucursales'], 'readonly');
    const varReq = tx.objectStore('variantes').getAll();
    const sucReq = tx.objectStore('sucursales').getAll();

    varReq.onsuccess = () => {
      this.variantes.set(varReq.result || []);
      if (varReq.result?.length > 0 && !this.varianteReservaId) {
        this.varianteReservaId = varReq.result[0].id;
      }
    };
    sucReq.onsuccess = () => {
      this.sucursales.set(sucReq.result || [
        { id: 1, nombre: 'Sucursal Central Equipetrol', ciudad: 'Santa Cruz' },
        { id: 2, nombre: 'Sucursal Calacoto', ciudad: 'La Paz' }
      ]);
    };
  }

  descargarPaquete(): void {
    if (!this.syncService.isOnline() || !navigator.onLine) {
      this.toast.warning(
        'Modo Offline Activo',
        'No se puede descargar mientras estés sin conexión. Cambia el selector de DevTools (Network) de "Offline" a "No throttling".'
      );
      return;
    }
    this.descargando.set(true);
    this.syncService.descargarPaqueteOffline().subscribe({
      next: async () => {
        this.descargando.set(false);
        this.toast.success('Catálogo Actualizado', '12 productos, variantes y existencias guardadas en IndexedDB.');
        await this.cargarDatosLocales();
      },
      error: (err) => {
        this.descargando.set(false);
        const detalle = err.status === 0
          ? 'No hay conexión con el backend. Asegúrate de ejecutar start_backend.bat (puerto 8000).'
          : (err.error?.detail || 'No se pudo descargar el paquete offline desde el servidor.');
        this.toast.error('Error de Descarga', detalle);
      }
    });
  }

  sincronizarLote(): void {
    this.syncService.sincronizarLotePendiente().subscribe({
      next: async (res) => {
        if (res.confirmadas > 0) {
          this.toast.success('Sincronización Exitosa', `${res.confirmadas} operaciones confirmadas por el servidor.`);
        }
        if (res.rechazadas > 0) {
          this.toast.error('Conflicto en Servidor', `${res.rechazadas} operaciones rechazadas por conflicto central.`);
        }
        await this.cargarDatosLocales();
      },
      error: () => {
        this.toast.error('Error de Red', 'Error de red al sincronizar con el backend central.');
      }
    });
  }

  // =========================================================================
  // GESTIÓN POS OFFLINE
  // =========================================================================

  productosFiltradosPos(): ProductoOffline[] {
    if (!this.busquedaPos.trim()) return this.productos();
    const q = this.busquedaPos.toLowerCase().trim();
    return this.productos().filter(p => p.nombre.toLowerCase().includes(q));
  }

  async seleccionarProductoParaVenta(prod: ProductoOffline): Promise<void> {
    const vars = this.variantes().filter(v => v.producto_id === prod.id);
    const variante = vars.length > 0 ? vars[0] : null;
    if (!variante) {
      this.toast.warning('Sin Variantes', 'Esta prenda no tiene variantes disponibles.');
      return;
    }

    const actuales = [...this.itemsTicketVenta()];
    const existe = actuales.find(i => i.variante_id === variante.id);

    if (existe) {
      existe.cantidad++;
      existe.subtotal = existe.cantidad * existe.precio_unitario;
    } else {
      actuales.push({
        variante_id: variante.id,
        producto_nombre: prod.nombre,
        talla: variante.talla,
        color: variante.color,
        cantidad: 1,
        precio_unitario: variante.precio || prod.precio_base,
        subtotal: variante.precio || prod.precio_base
      });
    }

    this.itemsTicketVenta.set(actuales);
    this.actualizarTotalTicket();
  }

  modificarCantidadTicket(index: number, delta: number): void {
    const actuales = [...this.itemsTicketVenta()];
    actuales[index].cantidad += delta;
    if (actuales[index].cantidad <= 0) {
      actuales.splice(index, 1);
    } else {
      actuales[index].subtotal = actuales[index].cantidad * actuales[index].precio_unitario;
    }
    this.itemsTicketVenta.set(actuales);
    this.actualizarTotalTicket();
  }

  removerItemTicket(index: number): void {
    const actuales = [...this.itemsTicketVenta()];
    actuales.splice(index, 1);
    this.itemsTicketVenta.set(actuales);
    this.actualizarTotalTicket();
  }

  actualizarTotalTicket(): void {
    const total = this.itemsTicketVenta().reduce((acc, it) => acc + it.subtotal, 0);
    this.totalTicketVenta.set(total);
    this.calcularVuelto();
  }

  calcularVuelto(): void {
    if (this.efectivoRecibido > 0) {
      this.vueltoCalculado = Math.round((this.efectivoRecibido - this.totalTicketVenta()) * 100) / 100;
    } else {
      this.vueltoCalculado = 0;
    }
  }

  async confirmarVentaOffline(): Promise<void> {
    if (this.itemsTicketVenta().length === 0) return;

    this.procesandoVenta.set(true);
    try {
      const op = await this.syncService.registrarVentaOffline({
        sucursal_id: Number(this.sucursalSeleccionadaId),
        items: this.itemsTicketVenta(),
        cliente_nombre: 'Cliente en Tienda (POS Contado)'
      });

      this.toast.success('Venta Offline Registrada', `Venta de contado registrada localmente con ID: ${op.id.substring(0, 8)}...`);
      this.itemsTicketVenta.set([]);
      this.totalTicketVenta.set(0);
      this.efectivoRecibido = 0;
      this.vueltoCalculado = 0;
      await this.cargarDatosLocales();
    } catch (err: any) {
      this.toast.error('Error en Venta', err.message || 'Error registrando venta offline.');
    } finally {
      this.procesandoVenta.set(false);
    }
  }

  // =========================================================================
  // GESTIÓN RESERVA OFFLINE
  // =========================================================================

  async confirmarReservaOffline(): Promise<void> {
    if (!this.varianteReservaId) return;

    this.procesandoReserva.set(true);
    try {
      const v = this.variantes().find(item => item.id === Number(this.varianteReservaId));
      const p = v ? this.productos().find(prod => prod.id === v.producto_id) : null;

      const op = await this.syncService.registrarReservaOffline({
        sucursal_id: Number(this.sucursalReservaId),
        cliente_nombre: this.nombreClienteReserva || 'Cliente Mostrador',
        fecha_reserva: this.fechaVisitaReserva,
        items: [{
          variante_id: Number(this.varianteReservaId),
          producto_nombre: p?.nombre || `Variante #${this.varianteReservaId}`,
          talla: v?.talla,
          color: v?.color,
          cantidad: Number(this.cantidadReserva),
          precio_unitario: v?.precio || 0,
          subtotal: (v?.precio || 0) * Number(this.cantidadReserva)
        }]
      });

      this.toast.success('Reserva Offline Registrada', `Reserva local guardada con éxito (ID: ${op.id.substring(0, 8)}...).`);
      this.nombreClienteReserva = '';
      this.cantidadReserva = 1;
      await this.cargarDatosLocales();
    } catch (err: any) {
      this.toast.error('Error en Reserva', err.message || 'Error registrando reserva offline.');
    } finally {
      this.procesandoReserva.set(false);
    }
  }

  // =========================================================================
  // AUDITORÍA Y FILTROS
  // =========================================================================

  productosFiltradosCatalogo(): ProductoOffline[] {
    if (!this.busquedaCatalogo.trim()) return this.productos();
    const q = this.busquedaCatalogo.toLowerCase().trim();
    return this.productos().filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(q))
    );
  }

  iniciarReservaDesdeProducto(prod: ProductoOffline): void {
    const vars = this.obtenerVariantesDeProducto(prod.id);
    if (vars.length > 0) {
      this.varianteReservaId = vars[0].id;
    }
    this.tabActiva.set('reserva');
  }

  obtenerReservasCliente(): OperacionOffline[] {
    return this.operaciones().filter(o => o.tipo === 'reserva');
  }

  obtenerVariantesDeProducto(productoId: number): VarianteOffline[] {
    return this.variantes().filter(v => v.producto_id === productoId);
  }

  operacionesFiltradas(): OperacionOffline[] {
    const f = this.filtroOps();
    if (f === 'todas') return this.operaciones();
    return this.operaciones().filter(o => o.estado === f);
  }

  contarOpsPorEstado(estado: string): number {
    return this.operaciones().filter(o => o.estado === estado).length;
  }

  formatearFecha(iso: string): string {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-BO', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });
    } catch {
      return iso;
    }
  }
}
