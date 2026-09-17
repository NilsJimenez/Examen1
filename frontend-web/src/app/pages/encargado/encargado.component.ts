import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservaService } from '../../services/reserva.service';
import { InventarioService } from '../../services/inventario.service';
import { ProductoService } from '../../services/producto.service';
import { AuthService } from '../../services/auth.service';
import { Sucursal } from '../../models/sucursal.models';

declare const Html5Qrcode: any;

@Component({
  selector: 'app-encargado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="encargado-container">
      
      <!-- =================================================================== -->
      <!-- ENCABEZADO PRINCIPAL CON SELECTOR DE SUCURSAL ELEGANTE              -->
      <!-- =================================================================== -->
      <div class="encargado-header">
        <div>
          <div class="header-badges">
            <span class="badge" style="background: rgba(245,158,11,0.12); color: var(--accent); border: 1px solid rgba(245,158,11,0.3); font-size: 0.72rem; padding: 0.2rem 0.65rem;">
              <i class="fa-solid fa-store mr-1"></i> Operaciones en Tienda Física
            </span>
            <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted); font-size: 0.72rem; padding: 0.2rem 0.65rem;">
              <i class="fa-solid fa-clock mr-1"></i> En Tiempo Real
            </span>
          </div>
          <h1 class="font-serif text-3xl font-bold flex items-center gap-3" style="color: var(--text-main); margin-top: 0.35rem;">
            <i class="fa-solid fa-warehouse" style="color: var(--accent);"></i> Panel de Gestión de Sucursal
          </h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">
            Atención de reservas para vestidores, validación rápida de pases QR y control del inventario local
          </p>
        </div>

        <!-- Selector de Sucursales Estilizado (Etiqueta Dropdown) -->
        <div class="header-actions">
          <div class="sucursal-selector-wrapper" (click)="$event.stopPropagation()">
            <button 
              (click)="toggleMenuSucursales($event)"
              class="sucursal-dropdown-btn"
              type="button"
              title="Haz clic para cambiar la sucursal de atención"
            >
              <div class="flex items-center gap-2.5">
                <span class="branch-icon-dot">
                  <i class="fa-solid fa-location-dot" style="color: var(--accent);"></i>
                </span>
                <div class="text-left leading-tight">
                  <span class="block uppercase tracking-wider font-bold" style="color: var(--text-muted); font-size: 0.65rem;">
                    Sucursal Seleccionada:
                  </span>
                  <strong style="color: var(--text-main); font-size: 0.88rem;">
                    {{ sucursalNombreActual }}
                  </strong>
                </div>
              </div>
              <i 
                class="fa-solid fa-chevron-down text-xs ml-2" 
                [style.transform]="menuSucursalesAbierto ? 'rotate(180deg)' : 'rotate(0deg)'" 
                style="color: var(--accent); transition: transform 0.2s ease;"
              ></i>
            </button>

            <!-- Menú Desplegable Flotante de Sucursales -->
            <div 
              *ngIf="menuSucursalesAbierto" 
              class="sucursal-dropdown-menu animate-fade-in"
            >
              <div class="text-xs font-bold uppercase tracking-wider px-3 py-1.5" style="color: var(--text-muted); font-size: 0.68rem; border-bottom: 1px solid var(--border-color); margin-bottom: 0.35rem;">
                <i class="fa-solid fa-shop mr-1"></i> Seleccionar Tienda Activa:
              </div>

              <button 
                *ngFor="let s of sucursales"
                (click)="seleccionarSucursal(s)"
                class="sucursal-menu-item"
                [class.sucursal-menu-item-active]="sucursalId === s.id"
              >
                <div class="flex items-center gap-2.5">
                  <i class="fa-solid fa-store" [style.color]="sucursalId === s.id ? 'var(--accent)' : 'var(--text-muted)'"></i>
                  <div>
                    <span class="block font-bold">{{ s.nombre }}</span>
                    <span class="text-xs block" style="color: var(--text-muted);">{{ s.direccion }}</span>
                  </div>
                </div>
                <span class="badge" style="font-size: 0.68rem; background: var(--table-th-bg); color: var(--text-muted);">
                  {{ s.ciudad.nombre }}
                </span>
              </button>
            </div>
          </div>

          <!-- Botón de Actualizar / Refrescar -->
          <button 
            (click)="recargarTodo()" 
            class="btn btn-outline" 
            style="padding: 0.6rem 0.95rem; font-size: 0.85rem;"
            title="Refrescar datos de la sucursal"
          >
            <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="loadingReservas"></i>
          </button>
        </div>
      </div>

      <!-- Banner Informativo para Sesión con botón 1-clic a Encargado -->
      <div *ngIf="esCliente" class="p-4 mb-6 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-fade-in" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); width: 100%;">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background: rgba(245, 158, 11, 0.15); color: var(--accent);">
            <i class="fa-solid fa-user-tag text-base"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs uppercase font-bold tracking-wider" style="color: var(--accent);">Modo de Prueba Activo:</span>
              <span class="badge" style="background: var(--table-th-bg); color: var(--text-main); font-size: 0.72rem; padding: 0.15rem 0.5rem;">
                Cuenta Cliente ({{ currentUserEmail }})
              </span>
            </div>
            <p class="text-xs mt-0.5" style="color: var(--text-muted);">
              Puedes escanear o simular pases QR libremente, o alternar a la cuenta oficial de personal con un solo clic:
            </p>
          </div>
        </div>
        <button 
          (click)="cambiarAEncargado()" 
          class="btn btn-primary text-xs" 
          style="padding: 0.5rem 1rem;"
          title="Iniciar sesión automáticamente con la cuenta oficial de Encargado de Tienda"
        >
          <i class="fa-solid fa-id-badge mr-1.5"></i> Cambiar a Cuenta Encargado (1 Clic)
        </button>
      </div>

      <!-- Mensajes de Notificación -->
      <div *ngIf="successMessage" class="p-3.5 mb-6 rounded-xl flex items-center justify-between text-sm animate-fade-in" style="background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); width: 100%;">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-circle-check text-base"></i>
          <span>{{ successMessage }}</span>
        </div>
        <button (click)="successMessage = ''" class="opacity-70 hover:opacity-100"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div *ngIf="errorMessage" class="p-3.5 mb-6 rounded-xl flex items-center justify-between text-sm animate-fade-in" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); width: 100%;">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-triangle-exclamation text-base"></i>
          <span>{{ errorMessage }}</span>
        </div>
        <button (click)="errorMessage = ''" class="opacity-70 hover:opacity-100"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- =================================================================== -->
      <!-- TARJETAS MÉTRICAS KPI (EN UNA SOLA FILA CENTRADA)                   -->
      <!-- =================================================================== -->
      <div class="kpi-row-grid">
        <!-- KPI 1: Reservas Pendientes -->
        <div class="kpi-card">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs uppercase font-bold tracking-wider" style="color: var(--text-muted);">Por Atender</span>
              <h3 class="text-2xl font-bold font-serif mt-1" style="color: #f59e0b;">{{ countPendientes }}</h3>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">En espera de preparación</p>
            </div>
            <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25);">
              <i class="fa-solid fa-clock text-xl"></i>
            </div>
          </div>
        </div>

        <!-- KPI 2: Listas en Probador -->
        <div class="kpi-card">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs uppercase font-bold tracking-wider" style="color: var(--text-muted);">Listas en Probador</span>
              <h3 class="text-2xl font-bold font-serif mt-1" style="color: #818cf8;">{{ countPreparadas }}</h3>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">Vestidor listo para cliente</p>
            </div>
            <div class="kpi-icon-wrap" style="background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.25);">
              <i class="fa-solid fa-door-open text-xl"></i>
            </div>
          </div>
        </div>

        <!-- KPI 3: Total Existencias Físicas -->
        <div class="kpi-card">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs uppercase font-bold tracking-wider" style="color: var(--text-muted);">Existencias Físicas</span>
              <h3 class="text-2xl font-bold font-serif mt-1" style="color: var(--accent);">{{ totalStockFisico }}</h3>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">{{ inventarioItems.length }} variantes registradas</p>
            </div>
            <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.12); color: var(--accent); border: 1px solid rgba(245, 158, 11, 0.25);">
              <i class="fa-solid fa-shirt text-xl"></i>
            </div>
          </div>
        </div>

        <!-- KPI 4: Alertas de Stock Bajo -->
        <div class="kpi-card">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs uppercase font-bold tracking-wider" style="color: var(--text-muted);">Alertas de Stock</span>
              <h3 class="text-2xl font-bold font-serif mt-1" [style.color]="countBajoStock > 0 ? '#ef4444' : '#22c55e'">
                {{ countBajoStock }}
              </h3>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                {{ countBajoStock > 0 ? 'Artículos bajo mínimo' : 'Nivel de inventario óptimo' }}
              </p>
            </div>
            <div class="kpi-icon-wrap" [style.background]="countBajoStock > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)'" [style.color]="countBajoStock > 0 ? '#ef4444' : '#22c55e'" [style.border]="countBajoStock > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(34, 197, 94, 0.25)'">
              <i class="fa-solid" [class.fa-triangle-exclamation]="countBajoStock > 0" [class.fa-circle-check]="countBajoStock === 0" style="font-size: 1.25rem;"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑAS MODERNAS SEGMENTADAS (CENTRADAS)                           -->
      <!-- =================================================================== -->
      <div class="tabs-bar-wrapper">
        <div class="tabs-bar">
          <button 
            (click)="tabActiva = 'reservas'" 
            [class.tab-btn-active]="tabActiva === 'reservas'"
            class="tab-btn"
          >
            <i class="fa-solid fa-calendar-days mr-2"></i>
            <span>Reservas en Probadores</span>
            <span class="tab-badge" [class.tab-badge-active]="tabActiva === 'reservas'">{{ reservas.length }}</span>
          </button>

          <button 
            (click)="tabActiva = 'qr'" 
            [class.tab-btn-active]="tabActiva === 'qr'"
            class="tab-btn"
          >
            <i class="fa-solid fa-qrcode mr-2"></i>
            <span>Check-in Instantáneo QR</span>
          </button>

          <button 
            (click)="tabActiva = 'inventario'" 
            [class.tab-btn-active]="tabActiva === 'inventario'"
            class="tab-btn"
          >
            <i class="fa-solid fa-boxes-stacked mr-2"></i>
            <span>Inventario & Kárdex Local</span>
            <span class="tab-badge" [class.tab-badge-active]="tabActiva === 'inventario'">{{ inventarioItems.length }}</span>
          </button>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 1: RESERVAS DE SUCURSAL (CON TARJETAS TIPO TICKET VIP)      -->
      <!-- =================================================================== -->
      <div *ngIf="tabActiva === 'reservas'" class="animate-fade-in" style="width: 100%;">
        <div class="card p-6" style="width: 100%;">
          <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4" style="border-bottom: 1px solid var(--border-color);">
            <div>
              <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-calendar-check" style="color: var(--accent);"></i>
                Agenda de Probadores: {{ sucursalNombreActual }}
              </h3>
              <p class="text-xs mt-1" style="color: var(--text-muted);">
                Prendas apartadas que los clientes probarán antes de pagar en caja
              </p>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs font-bold mr-2" style="color: var(--text-muted);">
                {{ reservas.length }} reserva{{ reservas.length !== 1 ? 's' : '' }} programada{{ reservas.length !== 1 ? 's' : '' }}
              </span>
              <button (click)="cargarReservas()" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">
                <i class="fa-solid fa-arrows-rotate mr-1" [class.fa-spin]="loadingReservas"></i> Actualizar
              </button>
            </div>
          </div>

          <!-- Spinner Loading -->
          <div *ngIf="loadingReservas" class="text-center py-16">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3" style="color: var(--accent);"></i>
            <p class="text-xs" style="color: var(--text-muted);">Cargando citas de probador...</p>
          </div>

          <!-- Estado Vacío -->
          <div *ngIf="!loadingReservas && reservas.length === 0" class="text-center py-16" style="color: var(--text-muted);">
            <div class="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
              <i class="fa-solid fa-calendar-check text-2xl opacity-40"></i>
            </div>
            <h4 class="font-serif font-bold text-base" style="color: var(--text-main);">No hay reservas pendientes</h4>
            <p class="text-xs max-w-sm mx-auto mt-1" style="color: var(--text-muted);">
              Actualmente no existen citas de probado agendadas para esta sucursal. Los clientes pueden reservar desde el catálogo web.
            </p>
          </div>

          <!-- Listado de Reservas con Diseño de Tarjetas VIP -->
          <div *ngIf="!loadingReservas && reservas.length > 0" class="flex flex-col gap-4">
            <div *ngFor="let r of reservas" class="reserva-ticket-card">
              
              <!-- Cabecera del Ticket -->
              <div class="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3" style="border-bottom: 1px dashed var(--border-color);">
                <div class="flex items-center gap-3">
                  <span class="font-mono text-sm font-bold tracking-wider px-2.5 py-1 rounded" style="background: rgba(245, 158, 11, 0.12); color: var(--accent); border: 1px solid rgba(245, 158, 11, 0.3);">
                    {{ r.codigo_reserva }}
                  </span>
                  <span 
                    class="badge" 
                    [style.background]="r.estado === 'preparada' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)'" 
                    [style.color]="r.estado === 'preparada' ? '#818cf8' : '#f59e0b'"
                    [style.border]="r.estado === 'preparada' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(245,158,11,0.3)'"
                    style="font-size: 0.72rem; padding: 0.25rem 0.7rem;"
                  >
                    <i class="fa-solid" [class.fa-clock]="r.estado === 'pendiente'" [class.fa-check-double]="r.estado === 'preparada'"></i>
                    {{ r.estado === 'preparada' ? 'Lista en Vestidor' : 'Pendiente de Preparar' }}
                  </span>
                </div>

                <div class="flex items-center gap-2 text-xs font-bold" style="color: var(--text-muted);">
                  <i class="fa-regular fa-clock" style="color: var(--accent);"></i>
                  <span>Cita: <strong>{{ r.fecha }}</strong> a las <strong>{{ r.hora }}</strong></span>
                </div>
              </div>

              <!-- Cuerpo del Ticket: Datos del Cliente y Prendas -->
              <div class="ticket-body">
                <div class="ticket-info">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style="background: var(--table-th-bg); color: var(--accent); border: 1px solid var(--border-color);">
                      <i class="fa-solid fa-user"></i>
                    </div>
                    <div>
                      <span class="text-xs block" style="color: var(--text-muted);">Cliente:</span>
                      <strong class="text-sm" style="color: var(--text-main);">{{ r.cliente }}</strong>
                    </div>
                  </div>

                  <div class="mt-3">
                    <span class="text-xs uppercase font-bold tracking-wider block mb-1.5" style="color: var(--text-muted); font-size: 0.65rem;">
                      <i class="fa-solid fa-shirt mr-1"></i> Prendas Apartadas para Probar:
                    </span>
                    <div class="flex flex-wrap gap-2">
                      <div *ngFor="let it of r.items" class="item-pill">
                        <span class="item-pill-name">{{ it.producto }}</span>
                        <span class="item-pill-attr">Talla {{ it.talla }}</span>
                        <span class="item-pill-attr flex items-center gap-1">
                          <span [style.background-color]="it.color_hex || '#fff'" class="color-dot-inline"></span>
                          {{ it.color }}
                        </span>
                        <span class="item-pill-qty">x{{ it.cantidad }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Botones de Acción del Encargado -->
                <div class="ticket-actions">
                  <button 
                    *ngIf="r.estado === 'pendiente'" 
                    (click)="marcarPreparada(r.id)" 
                    class="btn btn-primary" 
                    style="font-size: 0.82rem; padding: 0.55rem 1rem; width: 100%;"
                  >
                    <i class="fa-solid fa-box-open mr-1.5"></i> Marcar Preparada
                  </button>

                  <button 
                    *ngIf="r.estado === 'preparada'" 
                    (click)="marcarAtendida(r.id)" 
                    class="btn" 
                    style="font-size: 0.82rem; padding: 0.55rem 1rem; width: 100%; background: rgba(34,197,94,0.15); color: #22c55e; border: 1.5px solid #22c55e;"
                  >
                    <i class="fa-solid fa-door-open mr-1.5"></i> Asignar Vestidor
                  </button>

                  <span class="text-xs text-right w-full block mt-1" style="color: var(--text-muted); font-size: 0.7rem;">
                    Vestidor sugerido: <strong>Vestidor VIP #{{ (r.id % 3) + 1 }}</strong>
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 2: CHECK-IN INSTANTÁNEO CON PASE QR (CÁMARA & SIMULADOR)    -->
      <!-- =================================================================== -->
      <div *ngIf="tabActiva === 'qr'" class="animate-fade-in" style="width: 100%;">
        <div class="card p-8 qr-tab-card">
          <div class="text-center mb-6">
            <div class="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(245, 158, 11, 0.3);">
              <i class="fa-solid fa-qrcode text-2xl" style="color: var(--accent);"></i>
            </div>
            <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);">
              Lector de Pase QR para Probadores
            </h3>
            <p class="text-xs max-w-md mx-auto mt-1" style="color: var(--text-muted);">
              Escanea el código QR del cliente con la cámara de tu dispositivo o ingresa el código alfanumérico
            </p>
          </div>

          <!-- Botones de Acción: Escanear con Cámara & Simulación Instantánea -->
          <div class="flex flex-wrap items-center justify-center gap-3 mb-6 pb-5" style="border-bottom: 1px dashed var(--border-color);">
            <button 
              (click)="toggleCamara()" 
              class="btn"
              [style.background]="camaraActiva ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'"
              [style.color]="camaraActiva ? '#ef4444' : 'var(--accent)'"
              [style.border]="camaraActiva ? '1.5px solid #ef4444' : '1.5px solid var(--accent)'"
              style="padding: 0.6rem 1.1rem; font-size: 0.85rem;"
            >
              <i class="fa-solid" [class.fa-camera]="!camaraActiva" [class.fa-stop]="camaraActiva"></i>
              <span class="ml-1.5">{{ camaraActiva ? 'Detener Cámara' : 'Activar Cámara para Escanear' }}</span>
            </button>

            <button 
              (click)="simularEscaneoInstantaneo()" 
              class="btn btn-outline"
              style="font-size: 0.85rem; padding: 0.6rem 1.1rem;"
              title="Valida automáticamente una reserva activa de prueba con sonido de confirmación"
            >
              <i class="fa-solid fa-bolt mr-1.5" style="color: #f59e0b;"></i>
              Simular Escaneo Rápido
            </button>
          </div>

          <!-- Visor de Cámara en Vivo (HTML5-QRCode) -->
          <div *ngIf="camaraActiva" class="mb-6 p-4 rounded-2xl animate-fade-in text-center" style="background: #09090b; border: 2px solid var(--accent);">
            <div class="flex items-center justify-between mb-3 text-xs">
              <span class="font-bold flex items-center gap-2" style="color: var(--accent);">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
                Cámara en Vivo: Enfoca el código QR del cliente
              </span>
              <button (click)="detenerCamara()" class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">
                <i class="fa-solid fa-xmark"></i> Cerrar
              </button>
            </div>
            
            <div id="qr-camera-stream" style="width: 100%; max-width: 360px; margin: 0 auto; border-radius: 12px; overflow: hidden;"></div>
            
            <p *ngIf="errorCamara" class="text-xs text-red-500 mt-3 font-semibold">{{ errorCamara }}</p>
          </div>

          <!-- Formulario de Búsqueda de Código Manual -->
          <div class="mb-6">
            <span class="text-xs uppercase font-bold tracking-wider block mb-2" style="color: var(--text-muted); font-size: 0.68rem;">
              O ingresa el código alfanumérico manualmente:
            </span>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <i class="fa-solid fa-barcode absolute left-4 top-1/2 -translate-y-1/2 text-base" style="color: var(--accent);"></i>
                <input 
                  type="text" 
                  [(ngModel)]="codigoQREscaneado" 
                  placeholder="Ej: RES-LPZ-8912..." 
                  class="form-input font-mono font-bold uppercase pl-11" 
                  style="letter-spacing: 0.08em; font-size: 1rem; padding: 0.75rem 1rem 0.75rem 2.75rem;" 
                  (keyup.enter)="verificarQR()"
                />
              </div>
              <button 
                (click)="verificarQR()" 
                [disabled]="loadingQR || !codigoQREscaneado.trim()" 
                class="btn btn-primary" 
                style="padding: 0.75rem 1.4rem; font-size: 0.9rem;"
              >
                <span *ngIf="loadingQR"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Validando...</span>
                <span *ngIf="!loadingQR"><i class="fa-solid fa-magnifying-glass mr-1"></i> Validar</span>
              </button>
            </div>
          </div>

          <!-- Resultado del Pase VIP Verificado -->
          <div *ngIf="resultadoQR" class="p-6 rounded-2xl animate-fade-in" style="background: var(--table-th-bg); border: 2px solid var(--accent); box-shadow: 0 12px 30px rgba(0,0,0,0.3);">
            
            <div class="flex items-center justify-between pb-4 mb-4" style="border-bottom: 1px dashed var(--border-color);">
              <div>
                <span class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid #22c55e; font-size: 0.75rem; padding: 0.25rem 0.7rem;">
                  <i class="fa-solid fa-shield-check mr-1"></i> PASE AUTORIZADO
                </span>
                <h4 class="font-bold text-lg mt-2 font-serif" style="color: var(--text-main);">
                  <i class="fa-solid fa-user mr-1.5" style="color: var(--accent);"></i> {{ resultadoQR.cliente }}
                </h4>
              </div>
              <div class="text-right p-3 rounded-xl" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                <span class="text-xs block font-bold uppercase tracking-wider" style="color: var(--text-muted); font-size: 0.65rem;">Cabina Asignada:</span>
                <span class="font-serif font-bold text-lg" style="color: var(--accent);">Vestidor VIP #1</span>
              </div>
            </div>

            <div class="text-xs mb-4 flex flex-wrap gap-4" style="color: var(--text-muted);">
              <div><i class="fa-regular fa-calendar mr-1"></i> Fecha: <strong style="color: var(--text-main);">{{ resultadoQR.fecha }}</strong></div>
              <div><i class="fa-regular fa-clock mr-1"></i> Horario: <strong style="color: var(--text-main);">{{ resultadoQR.hora }}</strong></div>
              <div><i class="fa-solid fa-circle-info mr-1"></i> Estado: <strong style="text-transform: uppercase; color: var(--accent);">{{ resultadoQR.estado }}</strong></div>
            </div>

            <h5 class="text-xs font-bold mb-2.5 uppercase tracking-wider" style="color: var(--text-main); font-size: 0.7rem;">
              <i class="fa-solid fa-box-open mr-1" style="color: var(--accent);"></i> Prendas a entregar para prueba:
            </h5>
            
            <div class="flex flex-col gap-2 mb-6">
              <div *ngFor="let it of resultadoQR.items" class="p-3 rounded-xl flex items-center justify-between text-xs" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                <div>
                  <span class="font-bold block text-sm" style="color: var(--text-main);">{{ it.producto }}</span>
                  <span style="color: var(--text-muted);">Talla: <strong style="color: var(--text-main);">{{ it.talla }}</strong></span>
                </div>
                <span class="badge" style="background: rgba(245,158,11,0.15); color: var(--accent); font-weight: bold; font-size: 0.75rem;">
                  {{ it.cantidad }} unidad{{ it.cantidad > 1 ? 'es' : '' }}
                </span>
              </div>
            </div>

            <button (click)="marcarAtendida(resultadoQR.reserva_id)" class="btn btn-primary w-full" style="padding: 0.8rem; font-size: 0.95rem;">
              <i class="fa-solid fa-door-open mr-2"></i> Confirmar Ingreso del Cliente a Vestidor
            </button>
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 3: INVENTARIO & KÁRDEX LOCAL                                -->
      <!-- =================================================================== -->
      <div *ngIf="tabActiva === 'inventario'" class="inventario-layout-grid animate-fade-in">
        
        <!-- Columna Izquierda: Tabla de Existencias Locales -->
        <div class="card p-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4" style="border-bottom: 1px solid var(--border-color);">
            <div>
              <h3 class="font-serif text-lg font-bold flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-boxes-stacked" style="color: var(--accent);"></i>
                Stock Físico en {{ sucursalNombreActual }}
              </h3>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                Existencias disponibles, unidades reservadas para probado y stock libre para venta
              </p>
            </div>
            <span class="badge" style="background: var(--table-th-bg); color: var(--accent); font-weight: bold;">
              {{ inventarioItems.length }} registros
            </span>
          </div>

          <div class="table-responsive" style="max-height: 520px; overflow-y: auto;">
            <table class="table" style="width: 100%;">
              <thead>
                <tr>
                  <th>Prenda & SKU</th>
                  <th>Talla & Color</th>
                  <th style="text-align: center;">Disponible</th>
                  <th style="text-align: center;">En Probador</th>
                  <th style="text-align: center;">Libre Venta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let it of inventarioItems">
                  <td>
                    <strong style="color: var(--text-main); font-size: 0.85rem;">{{ it.producto }}</strong>
                    <code class="block text-xs font-mono mt-0.5" style="color: var(--text-muted);">{{ it.sku }}</code>
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <span class="badge" style="background: var(--table-th-bg); color: var(--text-main); font-size: 0.7rem;">
                        {{ it.talla }}
                      </span>
                      <span class="inline-flex items-center gap-1 text-xs" style="color: var(--text-muted);">
                        <span [style.background-color]="it.color_hex" class="color-dot-inline"></span>
                        {{ it.color }}
                      </span>
                    </div>
                  </td>
                  <td style="text-align: center; font-weight: bold; color: var(--text-main);">
                    {{ it.cantidad_disponible }}
                  </td>
                  <td style="text-align: center; color: #f59e0b; font-weight: bold;">
                    {{ it.cantidad_reservada }}
                  </td>
                  <td style="text-align: center; font-weight: bold; color: var(--accent); font-size: 0.95rem;">
                    {{ it.stock_libre }}
                  </td>
                  <td>
                    <span *ngIf="it.bajo_stock" class="badge" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-size: 0.68rem;">
                      <i class="fa-solid fa-triangle-exclamation mr-1"></i> Bajo Stock
                    </span>
                    <span *ngIf="!it.bajo_stock" class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); font-size: 0.68rem;">
                      <i class="fa-solid fa-check mr-1"></i> Óptimo
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Columna Derecha: Formulario de Registro de Movimiento -->
        <div class="card p-6 flex flex-col gap-4">
          <div class="pb-3" style="border-bottom: 1px solid var(--border-color);">
            <h3 class="font-serif text-lg font-bold flex items-center gap-2" style="color: var(--text-main);">
              <i class="fa-solid fa-truck-ramp-box" style="color: var(--accent);"></i> Registrar Entrada / Ajuste
            </h3>
            <p class="text-xs mt-1" style="color: var(--text-muted);">
              Actualización física del inventario de esta sucursal
            </p>
          </div>

          <div class="form-group">
            <label class="form-label text-xs font-bold uppercase tracking-wider">Tipo de Movimiento</label>
            <select [(ngModel)]="movTipo" class="form-select">
              <option value="ingreso">📦 Ingreso de Mercadería (+)</option>
              <option value="devolucion">↩️ Devolución de Prenda (+)</option>
              <option value="ajuste">⚙️ Ajuste Físico de Inventario (+)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label text-xs font-bold uppercase tracking-wider">Prenda y Variante</label>
            <select [(ngModel)]="movVarianteId" class="form-select">
              <option *ngFor="let it of inventarioItems" [value]="it.variante_id">
                {{ it.producto }} ({{ it.talla }} / {{ it.color }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label text-xs font-bold uppercase tracking-wider">Cantidad de Unidades</label>
            <input type="number" [(ngModel)]="movCantidad" min="1" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label text-xs font-bold uppercase tracking-wider">Observaciones (Opcional)</label>
            <textarea [(ngModel)]="movObservaciones" placeholder="Ej: Lote recibido de fábrica..." class="form-input" rows="3"></textarea>
          </div>

          <button 
            (click)="guardarMovimiento()" 
            [disabled]="guardandoMovimiento" 
            class="btn btn-primary w-full" 
            style="padding: 0.75rem; font-size: 0.9rem;"
          >
            <span *ngIf="guardandoMovimiento"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Guardando...</span>
            <span *ngIf="!guardandoMovimiento"><i class="fa-solid fa-floppy-disk mr-1"></i> Registrar en Kárdex</span>
          </button>
        </div>

      </div>

    </div>
  `,
  styles: [`
    .encargado-container {
      max-width: 1320px;
      margin: 0 auto;
      padding: 2.75rem 2rem 5rem 2rem;
      width: 100%;
      box-sizing: border-box;
    }
    .encargado-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.75rem;
      margin-bottom: 2.75rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      width: 100%;
    }
    .header-badges {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .sucursal-selector-wrapper {
      position: relative;
    }
    .sucursal-dropdown-btn {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 9999px;
      padding: 0.45rem 1.1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 250px;
    }
    .sucursal-dropdown-btn:hover {
      border-color: var(--accent);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    .branch-icon-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
    }
    .sucursal-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 100;
      min-width: 320px;
      background: var(--card-bg, #18181b);
      border: 1.5px solid var(--border-color, #27272a);
      border-radius: 14px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      padding: 0.5rem;
      backdrop-filter: blur(12px);
    }
    .sucursal-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      background: none;
      border: none;
      color: var(--text-main);
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }
    .sucursal-menu-item:hover {
      background: var(--table-hover-bg, rgba(255, 255, 255, 0.06));
      color: var(--accent);
    }
    .sucursal-menu-item-active {
      background: rgba(245, 158, 11, 0.15) !important;
      color: var(--accent) !important;
    }
    
    /* Cuadrícula de tarjetas métricas KPI en una sola fila centrada */
    .kpi-row-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.85rem;
      width: 100%;
      margin: 0 0 2.85rem 0;
    }
    @media (max-width: 1050px) {
      .kpi-row-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 600px) {
      .kpi-row-grid {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 18px;
      padding: 1.65rem 1.5rem;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.1);
    }
    .kpi-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }
    .kpi-icon-wrap {
      width: 50px;
      height: 50px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* Pestañas centradas */
    .tabs-bar-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin-bottom: 2.85rem;
    }
    .tabs-bar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.85rem;
      padding: 0.55rem 0.75rem;
      background: var(--table-th-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 18px;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2);
      overflow-x: auto;
      max-width: 100%;
    }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 1.4rem;
      border-radius: 14px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.04);
    }
    .tab-btn-active {
      background: var(--card-bg) !important;
      color: var(--accent) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
    }
    .tab-badge {
      font-size: 0.72rem;
      padding: 0.15rem 0.55rem;
      border-radius: 9999px;
      background: var(--card-bg);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }
    .tab-badge-active {
      background: rgba(245, 158, 11, 0.2);
      color: var(--accent);
      border-color: rgba(245, 158, 11, 0.4);
    }

    /* Tickets de Reserva */
    .reserva-ticket-card {
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-left: 5px solid var(--accent);
      border-radius: 16px;
      padding: 1.6rem 1.85rem;
      transition: all 0.2s ease;
      width: 100%;
      margin-bottom: 1.25rem;
    }
    .reserva-ticket-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      border-color: var(--accent);
    }
    .ticket-body {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }
    @media (max-width: 768px) {
      .ticket-body {
        flex-direction: column;
        align-items: stretch;
      }
      .ticket-actions {
        align-items: stretch !important;
        width: 100% !important;
      }
    }
    .ticket-info {
      flex: 1;
    }
    .ticket-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
      min-width: 200px;
    }
    .item-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.35rem 0.75rem;
      font-size: 0.78rem;
    }
    .item-pill-name {
      font-weight: 600;
      color: var(--text-main);
    }
    .item-pill-attr {
      color: var(--text-muted);
      border-left: 1px solid var(--border-color);
      padding-left: 0.5rem;
    }
    .item-pill-qty {
      font-weight: 700;
      color: var(--accent);
      border-left: 1px solid var(--border-color);
      padding-left: 0.5rem;
    }
    .color-dot-inline {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Pestaña QR */
    .qr-tab-card {
      max-width: 720px;
      margin: 0 auto;
      width: 100%;
    }

    /* Pestaña Inventario */
    .inventario-layout-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 2.25rem;
      width: 100%;
    }
    @media (max-width: 1024px) {
      .inventario-layout-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class EncargadoComponent implements OnInit, OnDestroy {
  private reservaService = inject(ReservaService);
  private inventarioService = inject(InventarioService);
  private productoService = inject(ProductoService);
  public authService = inject(AuthService);

  get currentUser() {
    return this.authService.currentUserValue;
  }

  get esCliente(): boolean {
    return this.currentUser?.role === 'cliente';
  }

  get currentUserEmail(): string {
    return this.currentUser?.email || '';
  }

  cambiarAEncargado(): void {
    this.authService.login({ email: 'encargado@fashionstore.com', password: 'Admin123!' }).subscribe({
      next: () => {
        this.successMessage = 'Sesión iniciada como Encargado de Sucursal exitosamente.';
        this.recargarTodo();
      },
      error: () => {
        this.errorMessage = 'No se pudo iniciar sesión automáticamente como encargado.';
      }
    });
  }

  sucursalId: number = 1;
  sucursalNombreActual: string = 'Sucursal Central La Paz';
  sucursales: Sucursal[] = [];
  menuSucursalesAbierto: boolean = false;

  tabActiva: string = 'reservas';

  reservas: any[] = [];
  loadingReservas: boolean = false;

  codigoQREscaneado: string = '';
  resultadoQR: any = null;
  loadingQR: boolean = false;

  // Lector de Cámara Web
  camaraActiva: boolean = false;
  html5QrScanner: any = null;
  errorCamara: string = '';

  inventarioItems: any[] = [];
  movTipo: string = 'ingreso';
  movVarianteId: number = 1;
  movCantidad: number = 10;
  movObservaciones: string = '';
  guardandoMovimiento: boolean = false;

  successMessage: string = '';
  errorMessage: string = '';

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuSucursalesAbierto = false;
  }

  ngOnInit(): void {
    this.cargarSucursales();
    this.recargarTodo();
  }

  ngOnDestroy(): void {
    this.detenerCamara();
  }

  cargarSucursales(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => {
        this.sucursales = data || [];
        const actual = this.sucursales.find(s => s.id === this.sucursalId);
        if (actual) {
          this.sucursalNombreActual = actual.nombre;
        } else if (this.sucursales.length > 0) {
          this.sucursalId = this.sucursales[0].id;
          this.sucursalNombreActual = this.sucursales[0].nombre;
        }
      }
    });
  }

  toggleMenuSucursales(event: Event): void {
    event.stopPropagation();
    this.menuSucursalesAbierto = !this.menuSucursalesAbierto;
  }

  seleccionarSucursal(s: Sucursal): void {
    this.sucursalId = s.id;
    this.sucursalNombreActual = s.nombre;
    this.menuSucursalesAbierto = false;
    this.recargarTodo();
  }

  // Métricas calculadas para los KPI cards
  get countPendientes(): number {
    return this.reservas.filter(r => r.estado === 'pendiente').length;
  }

  get countPreparadas(): number {
    return this.reservas.filter(r => r.estado === 'preparada').length;
  }

  get totalStockFisico(): number {
    return this.inventarioItems.reduce((acc, it) => acc + (Number(it.cantidad_disponible) || 0), 0);
  }

  get countBajoStock(): number {
    return this.inventarioItems.filter(it => it.bajo_stock).length;
  }

  recargarTodo(): void {
    this.cargarReservas();
    this.cargarInventario();
  }

  cargarReservas(): void {
    this.loadingReservas = true;
    this.reservaService.getReservasSucursal(this.sucursalId).subscribe({
      next: (data) => {
        this.reservas = data || [];
        this.loadingReservas = false;
      },
      error: () => {
        this.loadingReservas = false;
      }
    });
  }

  marcarPreparada(id: number): void {
    this.reservaService.prepararReserva(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Reserva marcada como preparada para vestidor.';
        this.cargarReservas();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'No se pudo actualizar el estado de la reserva.';
      }
    });
  }

  marcarAtendida(id: number): void {
    this.reservaService.atenderReserva(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Reserva atendida. Vestidor habilitado.';
        this.resultadoQR = null;
        this.cargarReservas();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Error al confirmar atención.';
      }
    });
  }

  verificarQR(): void {
    if (!this.codigoQREscaneado.trim()) return;
    this.loadingQR = true;
    this.errorMessage = '';
    this.resultadoQR = null;

    this.reservaService.checkinQR(this.codigoQREscaneado.trim().toUpperCase()).subscribe({
      next: (res) => {
        this.resultadoQR = res;
        this.loadingQR = false;
        this.playBeep();
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Código QR no válido o expirado.';
        this.loadingQR = false;
      }
    });
  }

  // --- Funcionalidades Avanzadas de Cámara Web & QR ---
  toggleCamara(): void {
    if (this.camaraActiva) {
      this.detenerCamara();
    } else {
      this.iniciarCamara();
    }
  }

  iniciarCamara(): void {
    this.camaraActiva = true;
    this.errorCamara = '';
    setTimeout(() => {
      if (typeof Html5Qrcode === 'undefined') {
        this.errorCamara = 'El módulo de cámara no está disponible en este momento.';
        return;
      }
      try {
        this.html5QrScanner = new Html5Qrcode("qr-camera-stream");
        this.html5QrScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            let codigo = decodedText.trim();
            if (codigo.includes('RES-')) {
              const match = codigo.match(/RES-[A-Za-z0-9-]+/);
              if (match) codigo = match[0];
            }
            this.codigoQREscaneado = codigo;
            this.detenerCamara();
            this.verificarQR();
          },
          () => {} // frame sin detección
        ).catch((err: any) => {
          console.warn("No se pudo iniciar la cámara:", err);
          this.errorCamara = 'No se pudo abrir la cámara. Asegúrate de otorgar permisos de video en el navegador.';
        });
      } catch (e) {
        this.errorCamara = 'Error inicializando el visor de cámara.';
      }
    }, 250);
  }

  detenerCamara(): void {
    if (this.html5QrScanner) {
      this.html5QrScanner.stop().then(() => {
        this.html5QrScanner.clear();
        this.html5QrScanner = null;
        this.camaraActiva = false;
      }).catch(() => {
        this.camaraActiva = false;
        this.html5QrScanner = null;
      });
    } else {
      this.camaraActiva = false;
    }
  }

  simularEscaneoInstantaneo(): void {
    if (this.reservas && this.reservas.length > 0) {
      const primera = this.reservas[0];
      this.codigoQREscaneado = primera.codigo_reserva;
      this.verificarQR();
      this.successMessage = `¡Pase ${primera.codigo_reserva} validado con éxito!`;
    } else {
      this.reservaService.getMisReservas().subscribe({
        next: (misReservas) => {
          if (misReservas && misReservas.length > 0) {
            const primera = misReservas[0];
            this.codigoQREscaneado = primera.codigo_reserva;
            this.verificarQR();
            this.successMessage = `¡Pase ${primera.codigo_reserva} validado con éxito!`;
          } else {
            this.errorMessage = 'No hay reservas registradas para simular el escaneo.';
          }
        },
        error: () => {
          this.errorMessage = 'No hay reservas agendadas en esta sucursal para simular el escaneo.';
        }
      });
    }
  }

  playBeep(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // Audio fallback silencioso
    }
  }

  cargarInventario(): void {
    this.inventarioService.getInventarioSucursal(this.sucursalId).subscribe({
      next: (res) => {
        this.inventarioItems = res.items || [];
        if (this.inventarioItems.length > 0) {
          this.movVarianteId = this.inventarioItems[0].variante_id;
        }
      }
    });
  }

  guardarMovimiento(): void {
    this.guardandoMovimiento = true;
    this.inventarioService.registrarMovimiento({
      variante_id: Number(this.movVarianteId),
      sucursal_id: Number(this.sucursalId),
      tipo_movimiento: this.movTipo,
      cantidad: Number(this.movCantidad),
      observaciones: this.movObservaciones
    }).subscribe({
      next: (res) => {
        this.guardandoMovimiento = false;
        this.successMessage = res.message || 'Movimiento de inventario asentado en kárdex.';
        this.movObservaciones = '';
        this.cargarInventario();
      },
      error: (err) => {
        this.guardandoMovimiento = false;
        this.errorMessage = err.error?.detail || 'Error al registrar movimiento.';
      }
    });
  }
}
