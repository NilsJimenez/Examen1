import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfflineSyncService, CatalogoOfflineItem, OperacionLocalOffline } from '../../services/offline-sync.service';

@Component({
  selector: 'app-offline-sync-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- CABECERA PWA & ESTADO DE CONECTIVIDAD (RF24 - RF32) -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/30">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <span class="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider"
                    [ngClass]="syncService.enLinea() ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'">
                <i class="fas mr-1.5" [ngClass]="syncService.enLinea() ? 'fa-wifi' : 'fa-plane'"></i>
                {{ syncService.enLinea() ? 'CONECTADO AL SERVIDOR CENTRAL' : 'MODO SIN CONEXIÓN ACTIVO (OFFLINE)' }}
              </span>
              <span class="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold text-indigo-200">
                PWA IndexedDB + SQLite Sync
              </span>
            </div>
            <h2 class="text-2xl font-extrabold mt-2">Centro de Operación Offline y Sincronización (CU15 – CU22)</h2>
            <p class="text-sm text-slate-300 mt-1">
              Descarga el catálogo local en <code class="text-indigo-300">IndexedDB</code>, registra ventas en efectivo (<code class="text-emerald-300">RN11</code>) o reservas con <code class="text-indigo-300">UUID</code> único (<code class="text-indigo-300">RN13</code>) y sincroniza por lotes con <code class="text-amber-300">SAVEPOINT</code> (<code class="text-amber-300">RN14</code>).
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- Interruptor para simular corte de internet durante la defensa -->
            <button (click)="syncService.toggleModoOfflineSimulado()"
                    class="px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-md flex items-center gap-2"
                    [ngClass]="syncService.modoOfflineSimulado() ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'">
              <i class="fas" [ngClass]="syncService.modoOfflineSimulado() ? 'fa-plug' : 'fa-wifi-slash'"></i>
              {{ syncService.modoOfflineSimulado() ? 'Restaurar Conexión Online' : 'Simular Corte de Red (Modo Offline)' }}
            </button>

            <!-- CU15: Descargar Catálogo Offline -->
            <button (click)="descargarCatalogo()"
                    [disabled]="!syncService.enLinea() || cargandoDescarga()"
                    class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-md flex items-center gap-2">
              <i class="fas" [ngClass]="cargandoDescarga() ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'"></i>
              Descargar Catálogo Local (CU15)
            </button>

            <!-- CU20: Sincronizar Lote Pendiente -->
            <button (click)="sincronizarAhora()"
                    [disabled]="!syncService.enLinea() || syncService.pendientesCount() === 0 || sincronizando()"
                    class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-md flex items-center gap-2">
              <i class="fas" [ngClass]="sincronizando() ? 'fa-sync fa-spin' : 'fa-cloud-upload-alt'"></i>
              Sincronizar Pendientes ({{ syncService.pendientesCount() }})
            </button>
          </div>
        </div>

        <!-- KPIs de Sincronización -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div class="bg-white/5 rounded-xl p-3">
            <div class="text-xs text-slate-400">Catálogo en IndexedDB (CU16)</div>
            <div class="text-xl font-extrabold text-white mt-0.5">{{ syncService.catalogoLocal().length }} variantes</div>
            <div class="text-[11px] text-indigo-300 truncate">
              Últ. descarga: {{ syncService.fechaUltimaDescarga() ? (syncService.fechaUltimaDescarga() | date:'dd/MM/yyyy HH:mm') : 'Sin descargar' }}
            </div>
          </div>
          <div class="bg-white/5 rounded-xl p-3">
            <div class="text-xs text-slate-400">Pendientes en Cola Local (CU19)</div>
            <div class="text-xl font-extrabold text-amber-400 mt-0.5">{{ syncService.pendientesCount() }} operaciones</div>
            <div class="text-[11px] text-slate-300">Estado: REGISTRADA_LOCAL</div>
          </div>
          <div class="bg-white/5 rounded-xl p-3">
            <div class="text-xs text-slate-400">Conflictos / Rechazos (CU21)</div>
            <div class="text-xl font-extrabold text-rose-400 mt-0.5">{{ conflictosServidor().length }} casos</div>
            <div class="text-[11px] text-slate-300">Stock insuficiente o regla RN08</div>
          </div>
          <div class="bg-white/5 rounded-xl p-3">
            <div class="text-xs text-slate-400">Confirmadas en Servidor (CU22)</div>
            <div class="text-xl font-extrabold text-emerald-400 mt-0.5">{{ bitacoraServidor().length }} registros</div>
            <div class="text-[11px] text-slate-300">Idempotencia UUID activa (RN13)</div>
          </div>
        </div>
      </div>

      <!-- MENSAJE DE FEEDBACK -->
      <div *ngIf="mensajeAlerta()" class="p-4 rounded-xl border flex items-center justify-between"
           [ngClass]="tipoAlerta() === 'exito' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-amber-50 border-amber-300 text-amber-900'">
        <div class="flex items-center gap-3 text-sm font-semibold">
          <i class="fas" [ngClass]="tipoAlerta() === 'exito' ? 'fa-check-circle text-emerald-600' : 'fa-exclamation-triangle text-amber-600'"></i>
          <span>{{ mensajeAlerta() }}</span>
        </div>
        <button (click)="mensajeAlerta.set('')" class="text-xs font-bold underline">Cerrar</button>
      </div>

      <!-- NAVEGACION INTERNA DEL PANEL OFFLINE -->
      <div class="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button (click)="subTab.set('catalogo')"
                class="px-4 py-2 rounded-xl text-xs font-bold transition"
                [ngClass]="subTab() === 'catalogo' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border'">
          <i class="fas fa-boxes mr-1.5"></i> 1. Catálogo Local & Registro Offline (CU16-CU18)
        </button>
        <button (click)="subTab.set('cola')"
                class="px-4 py-2 rounded-xl text-xs font-bold transition"
                [ngClass]="subTab() === 'cola' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border'">
          <i class="fas fa-tasks mr-1.5"></i> 2. Cola de Operaciones Pendientes ({{ syncService.operacionesLocales().length }}) (CU19-CU20)
        </button>
        <button (click)="subTab.set('conflictos'); cargarBitacoraServidor()"
                class="px-4 py-2 rounded-xl text-xs font-bold transition"
                [ngClass]="subTab() === 'conflictos' ? 'bg-rose-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border'">
          <i class="fas fa-exclamation-circle mr-1.5"></i> 3. Resolución de Conflictos ({{ conflictosServidor().length }}) (CU21)
        </button>
        <button (click)="subTab.set('bitacora'); cargarBitacoraServidor()"
                class="px-4 py-2 rounded-xl text-xs font-bold transition"
                [ngClass]="subTab() === 'bitacora' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border'">
          <i class="fas fa-clipboard-list mr-1.5"></i> 4. Bitácora de Sincronización (CU22)
        </button>
      </div>

      <!-- SUBTAB 1: CATALOGO LOCAL Y REGISTRO DE VENTA / RESERVA OFFLINE (CU16, CU17, CU18) -->
      <div *ngIf="subTab() === 'catalogo'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Listado del catálogo local en IndexedDB -->
        <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 class="text-base font-extrabold text-gray-900">Catálogo Almacenado en el Dispositivo (CU16)</h3>
              <p class="text-xs text-gray-500">
                Existencias locales conocidas al momento de la última descarga. Se descuentan preventivamente al registrar operaciones offline (RF31).
              </p>
            </div>
            <input type="text" [(ngModel)]="filtroTexto" placeholder="Buscar por prenda, SKU o talla..."
                   class="px-3 py-2 rounded-xl border border-gray-300 text-xs w-full sm:w-64 focus:ring-2 focus:ring-indigo-500 outline-none">
          </div>

          <div *ngIf="syncService.catalogoLocal().length === 0" class="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <i class="fas fa-cloud-download-alt text-3xl text-indigo-400 mb-2"></i>
            <p class="text-sm font-bold text-gray-700">Aún no se ha descargado el catálogo para uso offline</p>
            <p class="text-xs text-gray-500 mt-1 mb-4">Haz clic en "Descargar Catálogo Local (CU15)" para guardar las prendas en IndexedDB.</p>
            <button (click)="descargarCatalogo()" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
              Descargar Ahora
            </button>
          </div>

          <div *ngIf="syncService.catalogoLocal().length > 0" class="overflow-x-auto max-h-[420px]">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-100 text-slate-700 uppercase text-[11px]">
                  <th class="p-2.5 rounded-tl-lg">SKU / Prenda</th>
                  <th class="p-2.5">Talla / Color</th>
                  <th class="p-2.5">Sucursal</th>
                  <th class="p-2.5 text-right">Precio (Bs)</th>
                  <th class="p-2.5 text-center">Stock Local</th>
                  <th class="p-2.5 text-right rounded-tr-lg">Acción Offline</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr *ngFor="let item of catalogoFiltrado()" class="hover:bg-indigo-50/40 transition">
                  <td class="p-2.5">
                    <div class="font-bold text-gray-900">{{ item.nombre }}</div>
                    <div class="text-[11px] text-gray-500 font-mono">{{ item.sku }}</div>
                  </td>
                  <td class="p-2.5">
                    <span class="px-2 py-0.5 bg-gray-100 rounded font-bold text-gray-800 mr-1">{{ item.talla }}</span>
                    <span class="text-gray-600">{{ item.color }}</span>
                  </td>
                  <td class="p-2.5 text-gray-600">{{ item.sucursal_nombre }}</td>
                  <td class="p-2.5 text-right font-bold text-gray-900">Bs. {{ item.precio_unitario | number:'1.2-2' }}</td>
                  <td class="p-2.5 text-center">
                    <span class="px-2.5 py-1 rounded-full font-extrabold"
                          [ngClass]="item.existencia_local_conocida > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
                      {{ item.existencia_local_conocida }} uds.
                    </span>
                  </td>
                  <td class="p-2.5 text-right space-x-1">
                    <button (click)="agregarAlCarritoOffline(item, 1)"
                            [disabled]="item.existencia_local_conocida <= 0"
                            class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg font-bold">
                      + Agregar
                    </button>
                    <button (click)="simularConflictoStock(item)"
                            title="Agrega cantidad mayor al stock real para demostrar CU21 (Conflicto de Stock)"
                            class="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[10px]">
                      Forzar Conflicto
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Formulario de Registro Offline (CU17 Reserva / CU18 Venta Contado Efectivo) -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-base font-extrabold text-gray-900">Nueva Operación Offline</h3>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                RN11: Solo Efectivo
              </span>
            </div>

            <!-- Selector Tipo Operación: VENTA (CU18) o RESERVA (CU17) -->
            <div class="grid grid-cols-2 gap-2 mb-4">
              <button (click)="tipoOperacionForm = 'VENTA'"
                      class="py-2 rounded-xl text-xs font-extrabold border transition"
                      [ngClass]="tipoOperacionForm === 'VENTA' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-700 border-gray-200'">
                <i class="fas fa-cash-register mr-1"></i> Venta Efectivo (CU18)
              </button>
              <button (click)="tipoOperacionForm = 'RESERVA'"
                      class="py-2 rounded-xl text-xs font-extrabold border transition"
                      [ngClass]="tipoOperacionForm === 'RESERVA' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'">
                <i class="fas fa-calendar-check mr-1"></i> Reserva Local (CU17)
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-gray-700 mb-1">Cliente / Referencia Local</label>
                <input type="text" [(ngModel)]="clienteNombreForm" placeholder="Nombre del cliente"
                       class="w-full px-3 py-2 rounded-xl border border-gray-300">
              </div>

              <div *ngIf="tipoOperacionForm === 'RESERVA'" class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-bold text-gray-700 mb-1">Fecha Reserva</label>
                  <input type="date" [(ngModel)]="fechaReservaForm" class="w-full px-2.5 py-1.5 rounded-xl border border-gray-300">
                </div>
                <div>
                  <label class="block font-bold text-gray-700 mb-1">Hora</label>
                  <input type="time" [(ngModel)]="horaReservaForm" class="w-full px-2.5 py-1.5 rounded-xl border border-gray-300">
                </div>
              </div>

              <!-- Ítems seleccionados -->
              <div class="border-t border-gray-200 pt-3">
                <div class="font-bold text-gray-700 mb-2">Prendas en la Operación ({{ carritoOffline().length }})</div>
                <div *ngIf="carritoOffline().length === 0" class="text-center py-6 bg-gray-50 rounded-xl text-gray-400">
                  Selecciona prendas del catálogo local a la izquierda.
                </div>
                <div class="space-y-2 max-h-48 overflow-y-auto">
                  <div *ngFor="let c of carritoOffline(); let i = index" class="flex items-center justify-between bg-gray-50 p-2 rounded-xl border">
                    <div>
                      <div class="font-bold text-gray-900">{{ c.nombre }} ({{ c.talla }})</div>
                      <div class="text-[11px] text-gray-500">{{ c.sku }} · Bs. {{ c.precio_unitario }} x {{ c.cantidad }}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-extrabold text-gray-900">Bs. {{ (c.precio_unitario * c.cantidad) | number:'1.2-2' }}</span>
                      <button (click)="quitarDelCarritoOffline(i)" class="text-rose-500 hover:text-rose-700">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-gray-200">
            <div class="flex items-center justify-between text-sm font-extrabold text-gray-900 mb-3">
              <span>Total Operación Local:</span>
              <span class="text-lg text-emerald-700">Bs. {{ totalCarritoOffline() | number:'1.2-2' }}</span>
            </div>
            <button (click)="guardarOperacionEnColaLocal()"
                    [disabled]="carritoOffline().length === 0"
                    class="w-full py-3 rounded-xl bg-slate-900 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-xs transition shadow-lg">
              <i class="fas fa-save mr-1.5"></i>
              Guardar en Cola Local IndexedDB ({{ tipoOperacionForm }})
            </button>
          </div>
        </div>
      </div>

      <!-- SUBTAB 2: COLA DE OPERACIONES PENDIENTES EN EL DISPOSITIVO (CU19, CU20) -->
      <div *ngIf="subTab() === 'cola'" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-extrabold text-gray-900">Cola de Operaciones Almacenadas en el Dispositivo (CU19)</h3>
            <p class="text-xs text-gray-500">
              Cada operación posee un <code class="text-indigo-600 font-bold">operation_id (UUID v4)</code> único para garantizar idempotencia (<code class="text-indigo-600">RN13</code>) aunque se envíe múltiples veces.
            </p>
          </div>
          <button (click)="sincronizarAhora()"
                  [disabled]="!syncService.enLinea() || syncService.pendientesCount() === 0"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold">
            <i class="fas fa-sync mr-1.5"></i> Sincronizar Pendientes Ahora (CU20)
          </button>
        </div>

        <div *ngIf="syncService.operacionesLocales().length === 0" class="text-center py-10 text-gray-400 text-sm">
          No hay operaciones registradas en la cola local de este dispositivo.
        </div>

        <div *ngIf="syncService.operacionesLocales().length > 0" class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100 text-slate-700 uppercase text-[11px]">
                <th class="p-3">UUID (operation_id)</th>
                <th class="p-3">Tipo</th>
                <th class="p-3">Cliente / Fecha Local</th>
                <th class="p-3">Detalle Prendas</th>
                <th class="p-3 text-right">Total (Bs)</th>
                <th class="p-3 text-center">Estado Sincronización</th>
                <th class="p-3">Respuesta del Servidor</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr *ngFor="let op of syncService.operacionesLocales()" class="hover:bg-gray-50">
                <td class="p-3 font-mono text-[11px] text-indigo-700 font-bold">{{ op.operation_id | slice:0:13 }}...</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded font-bold text-[10px]"
                        [ngClass]="op.tipo === 'VENTA' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'">
                    {{ op.tipo }}
                  </span>
                </td>
                <td class="p-3">
                  <div class="font-bold text-gray-900">{{ op.cliente_nombre }}</div>
                  <div class="text-[11px] text-gray-500">{{ op.fecha_local | date:'dd/MM/yyyy HH:mm:ss' }}</div>
                </td>
                <td class="p-3">
                  <div *ngFor="let it of op.items" class="text-[11px] text-gray-700">
                    {{ it.cantidad }}x {{ it.nombre }} ({{ it.sku }})
                  </div>
                </td>
                <td class="p-3 text-right font-extrabold text-gray-900">Bs. {{ op.total_bs | number:'1.2-2' }}</td>
                <td class="p-3 text-center">
                  <span class="px-2.5 py-1 rounded-full font-extrabold text-[10px]"
                        [ngClass]="{
                          'bg-amber-100 text-amber-800': op.estado_local === 'REGISTRADA_LOCAL',
                          'bg-emerald-100 text-emerald-800': op.estado_local === 'CONFIRMADA',
                          'bg-rose-100 text-rose-800': op.estado_local === 'EN_CONFLICTO' || op.estado_local === 'RECHAZADA',
                          'bg-gray-200 text-gray-700': op.estado_local === 'ANULADA'
                        }">
                    {{ op.estado_local }}
                  </span>
                </td>
                <td class="p-3 text-[11px] text-gray-600">
                  {{ op.motivo_servidor || 'En espera de conexión para sincronizar' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SUBTAB 3: RESOLUCION DE CONFLICTOS Y RECHAZOS (CU21, RN19, RF47) -->
      <div *ngIf="subTab() === 'conflictos'" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div class="mb-4">
          <h3 class="text-base font-extrabold text-gray-900">Gestión de Conflictos de Stock y Rechazos de Sincronización (CU21)</h3>
          <p class="text-xs text-gray-500">
            Cuando una operación offline falla por falta de stock real en el servidor (<code class="text-rose-600 font-bold">EN_CONFLICTO</code>), puedes <strong>ajustar la cantidad al stock disponible y reenviarla con nuevo UUID vinculado (RF47)</strong> o <strong>anularla con justificación (RN19)</strong>.
          </p>
        </div>

        <div *ngIf="conflictosServidor().length === 0" class="text-center py-10 bg-emerald-50/50 rounded-xl border border-emerald-200 text-emerald-800 text-sm font-semibold">
          <i class="fas fa-check-circle mr-1.5"></i> No existen operaciones en conflicto pendientes de resolución.
        </div>

        <div class="space-y-4">
          <div *ngFor="let conf of conflictosServidor()" class="p-4 rounded-2xl border-2 border-rose-200 bg-rose-50/30">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[10px]">
                    {{ conf.estado }}
                  </span>
                  <span class="font-mono text-xs font-bold text-gray-800">UUID: {{ conf.operation_id }}</span>
                  <span class="text-xs text-gray-500">· Tipo: {{ conf.tipo }}</span>
                </div>
                <p class="text-xs font-bold text-rose-800 mt-1.5">{{ conf.motivo }}</p>
                <div *ngIf="conf.resultado?.conflictos_stock?.length" class="mt-2 space-y-1">
                  <div *ngFor="let cs of conf.resultado.conflictos_stock" class="text-xs bg-white px-3 py-1.5 rounded-lg border border-rose-200 inline-block mr-2">
                    <strong>{{ cs.nombre || cs.sku }}</strong>: Solicitado <span class="text-rose-600 font-bold">{{ cs.solicitado }}</span> |
                    Disponible en Servidor: <span class="text-emerald-700 font-bold">{{ cs.disponible_servidor }}</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input type="text" [(ngModel)]="justificacionMap[conf.operation_id]"
                       placeholder="Justificación de ajuste o anulación (RN19)..."
                       class="px-3 py-2 rounded-xl border border-gray-300 text-xs w-full sm:w-64 bg-white">
                <button (click)="resolverConflicto(conf.operation_id, 'ajustar_reenviar')"
                        class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs whitespace-nowrap">
                  <i class="fas fa-redo mr-1"></i> Ajustar al Stock y Reenviar (RF47)
                </button>
                <button (click)="resolverConflicto(conf.operation_id, 'anular')"
                        class="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs whitespace-nowrap">
                  <i class="fas fa-ban mr-1"></i> Anular Operación (RN19)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SUBTAB 4: BITACORA DE SINCRONIZACION DEL SERVIDOR (CU22, RN26) -->
      <div *ngIf="subTab() === 'bitacora'" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-base font-extrabold text-gray-900">Bitácora Auditable de Sincronización en Servidor (CU22)</h3>
            <p class="text-xs text-gray-500">
              Historial consolidado en la tabla <code class="text-indigo-600 font-bold">operaciones_sync</code> libre de credenciales o secretos (<code class="text-indigo-600">RN26</code>).
            </p>
          </div>
          <button (click)="cargarBitacoraServidor()" class="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700">
            <i class="fas fa-sync-alt mr-1"></i> Actualizar Bitácora
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100 text-slate-700 uppercase text-[11px]">
                <th class="p-3">Operation ID (UUID)</th>
                <th class="p-3">Tipo</th>
                <th class="p-3">Entidad Creada</th>
                <th class="p-3 text-center">Estado Final</th>
                <th class="p-3">Detalle / Motivo</th>
                <th class="p-3">Recibida en Servidor</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr *ngFor="let b of bitacoraServidor()" class="hover:bg-gray-50">
                <td class="p-3 font-mono text-[11px] font-bold text-slate-700">{{ b.operation_id }}</td>
                <td class="p-3 font-bold">{{ b.tipo }}</td>
                <td class="p-3">
                  <span *ngIf="b.resultado?.numero_comprobante" class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-mono font-bold">
                    {{ b.resultado.numero_comprobante }}
                  </span>
                  <span *ngIf="b.resultado?.codigo_reserva" class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-mono font-bold">
                    {{ b.resultado.codigo_reserva }}
                  </span>
                  <span *ngIf="!b.resultado?.numero_comprobante && !b.resultado?.codigo_reserva" class="text-gray-400">-</span>
                </td>
                <td class="p-3 text-center">
                  <span class="px-2.5 py-1 rounded-full font-extrabold text-[10px]"
                        [ngClass]="{
                          'bg-emerald-100 text-emerald-800': b.estado === 'CONFIRMADA',
                          'bg-rose-100 text-rose-800': b.estado === 'EN_CONFLICTO' || b.estado === 'RECHAZADA',
                          'bg-gray-200 text-gray-700': b.estado === 'ANULADA'
                        }">
                    {{ b.estado }}
                  </span>
                </td>
                <td class="p-3 text-gray-700">{{ b.motivo }}</td>
                <td class="p-3 text-gray-500">{{ b.recibida_en | date:'dd/MM/yyyy HH:mm:ss' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class OfflineSyncPanelComponent implements OnInit {
  subTab = signal<'catalogo' | 'cola' | 'conflictos' | 'bitacora'>('catalogo');
  cargandoDescarga = signal<boolean>(false);
  sincronizando = signal<boolean>(false);
  mensajeAlerta = signal<string>('');
  tipoAlerta = signal<'exito' | 'alerta'>('exito');

  filtroTexto = '';
  tipoOperacionForm: 'VENTA' | 'RESERVA' = 'VENTA';
  clienteNombreForm = 'Cliente Mostrador Offline';
  fechaReservaForm = new Date().toISOString().slice(0, 10);
  horaReservaForm = '16:00';

  carritoOffline = signal<{
    variante_id: number;
    sku: string;
    nombre: string;
    talla: string;
    color: string;
    cantidad: number;
    precio_unitario: number;
    sucursal_id: number;
  }[]>([]);

  bitacoraServidor = signal<any[]>([]);
  conflictosServidor = computed(() =>
    this.bitacoraServidor().filter(b => b.estado === 'EN_CONFLICTO' || b.estado === 'RECHAZADA')
  );
  justificacionMap: { [opId: string]: string } = {};

  totalCarritoOffline = computed(() =>
    this.carritoOffline().reduce((acc, it) => acc + it.precio_unitario * it.cantidad, 0)
  );

  constructor(public syncService: OfflineSyncService) {}

  ngOnInit(): void {
    if (this.syncService.catalogoLocal().length === 0 && this.syncService.enLinea()) {
      this.descargarCatalogo();
    }
    if (this.syncService.enLinea()) {
      this.cargarBitacoraServidor();
    }
  }

  catalogoFiltrado(): CatalogoOfflineItem[] {
    const q = (this.filtroTexto || '').toLowerCase().trim();
    const lista = this.syncService.catalogoLocal();
    if (!q) return lista;
    return lista.filter(i =>
      i.nombre.toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      i.talla.toLowerCase().includes(q) ||
      i.color.toLowerCase().includes(q)
    );
  }

  descargarCatalogo(): void {
    this.cargandoDescarga.set(true);
    this.syncService.descargarCatalogoServidor().subscribe({
      next: res => {
        this.cargandoDescarga.set(false);
        this.mostrarMensaje(`Catálogo offline actualizado en IndexedDB (${res.total_variantes} variantes disponibles).`, 'exito');
      },
      error: err => {
        this.cargandoDescarga.set(false);
        this.mostrarMensaje(err?.error?.detail || 'No se pudo descargar el catálogo offline.', 'alerta');
      }
    });
  }

  agregarAlCarritoOffline(item: CatalogoOfflineItem, cantidad: number): void {
    const actual = [...this.carritoOffline()];
    const idx = actual.findIndex(x => x.variante_id === item.variante_id);
    if (idx >= 0) {
      actual[idx].cantidad += cantidad;
    } else {
      actual.push({
        variante_id: item.variante_id,
        sku: item.sku,
        nombre: item.nombre,
        talla: item.talla,
        color: item.color,
        cantidad,
        precio_unitario: item.precio_unitario,
        sucursal_id: item.sucursal_id
      });
    }
    this.carritoOffline.set(actual);
  }

  simularConflictoStock(item: CatalogoOfflineItem): void {
    // Agrega una cantidad superior al stock disponible en servidor para demostrar fácilmente CU21
    const cantExcesiva = Math.max(50, (item.cantidad_disponible || 5) + 15);
    this.carritoOffline.set([{
      variante_id: item.variante_id,
      sku: item.sku,
      nombre: item.nombre,
      talla: item.talla,
      color: item.color,
      cantidad: cantExcesiva,
      precio_unitario: item.precio_unitario,
      sucursal_id: item.sucursal_id
    }]);
    this.mostrarMensaje(
      `Se cargaron ${cantExcesiva} uds. de "${item.nombre}" (stock real: ${item.existencia_local_conocida}). Guárdala en la cola y sincroniza para demostrar la detección y resolución de conflictos (CU21).`,
      'alerta'
    );
  }

  quitarDelCarritoOffline(index: number): void {
    const actual = [...this.carritoOffline()];
    actual.splice(index, 1);
    this.carritoOffline.set(actual);
  }

  guardarOperacionEnColaLocal(): void {
    const items = this.carritoOffline();
    if (items.length === 0) return;

    const sucursalId = items[0].sucursal_id;
    const op = this.syncService.registrarOperacionLocal({
      tipo: this.tipoOperacionForm,
      sucursal_id: sucursalId,
      cliente_nombre: this.clienteNombreForm || 'Cliente Local Offline',
      metodo_pago: 'efectivo',
      fecha_reserva: this.tipoOperacionForm === 'RESERVA' ? this.fechaReservaForm : undefined,
      horario_atencion: this.tipoOperacionForm === 'RESERVA' ? this.horaReservaForm : undefined,
      total_bs: this.totalCarritoOffline(),
      items: items.map(i => ({
        variante_id: i.variante_id,
        sku: i.sku,
        nombre: i.nombre,
        talla: i.talla,
        color: i.color,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario
      }))
    });

    this.carritoOffline.set([]);
    this.mostrarMensaje(
      `Operación ${op.tipo} guardada en IndexedDB con estado REGISTRADA_LOCAL (UUID: ${op.operation_id.slice(0, 8)}...).`,
      'exito'
    );
  }

  sincronizarAhora(): void {
    if (!this.syncService.enLinea()) {
      this.mostrarMensaje('El dispositivo está en Modo Sin Conexión. Restaura la conexión antes de sincronizar.', 'alerta');
      return;
    }
    this.sincronizando.set(true);
    this.syncService.sincronizarPendientes().subscribe({
      next: res => {
        this.sincronizando.set(false);
        const r = res.resumen || {};
        this.cargarBitacoraServidor();
        if (r.en_conflicto > 0 || r.rechazadas > 0) {
          this.mostrarMensaje(
            `Sincronización completada: ${r.confirmadas} confirmadas, ${r.en_conflicto} en conflicto de stock y ${r.rechazadas} rechazadas. Revisa la pestaña "Resolución de Conflictos (CU21)".`,
            'alerta'
          );
          this.subTab.set('conflictos');
        } else {
          this.mostrarMensaje(
            `¡Sincronización exitosa! ${r.confirmadas} operaciones consolidadas en PostgreSQL.`,
            'exito'
          );
        }
      },
      error: err => {
        this.sincronizando.set(false);
        this.mostrarMensaje(err?.error?.detail || 'Error al sincronizar el lote de operaciones.', 'alerta');
      }
    });
  }

  cargarBitacoraServidor(): void {
    if (!this.syncService.enLinea()) return;
    this.syncService.obtenerBitacoraServidor().subscribe({
      next: res => {
        this.bitacoraServidor.set(res.bitacora || []);
      }
    });
  }

  resolverConflicto(operationId: string, accion: 'ajustar_reenviar' | 'anular'): void {
    const justificacion = (this.justificacionMap[operationId] || '').trim() ||
      (accion === 'ajustar_reenviar' ? 'Ajuste autorizado al stock disponible en servidor (CU21)' : 'Anulada por falta de stock en sucursal (RN19)');

    this.syncService.resolverConflictoServidor(operationId, { accion, justificacion }).subscribe({
      next: res => {
        this.mostrarMensaje(res.mensaje || 'Conflicto resuelto correctamente.', 'exito');
        this.cargarBitacoraServidor();
        this.syncService.descargarCatalogoServidor().subscribe();
      },
      error: err => {
        this.mostrarMensaje(err?.error?.detail || 'No se pudo resolver el conflicto.', 'alerta');
      }
    });
  }

  private mostrarMensaje(msg: string, tipo: 'exito' | 'alerta'): void {
    this.mensajeAlerta.set(msg);
    this.tipoAlerta.set(tipo);
  }
}
