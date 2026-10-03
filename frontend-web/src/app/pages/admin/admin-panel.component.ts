import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { ProductoService } from '../../services/producto.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { AlertaService, AlertaReabastecimiento } from '../../services/alerta.service';
import { Producto, Categoria, Talla, Color } from '../../models/producto.models';
import { Sucursal } from '../../models/sucursal.models';
import { ReportesComponent } from '../../components/reportes/reportes.component';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportesComponent],
  template: `
    <div class="container py-10">
      
      <!-- Encabezado del Panel -->
      <div class="flex items-center justify-between mb-8 pb-6 border-b border-gray-200" style="flex-wrap: wrap; gap: 1rem; border-color: var(--border-color);">
        <div>
          <span class="badge badge-admin mb-2">
            <i class="fa-solid fa-shield-halved"></i> Administración FashionStore
          </span>
          <h1 class="font-serif text-3xl font-bold" style="color: var(--text-main);">Panel de Control Comercial</h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">Gestión centralizada del catálogo, fotos por color, cantidades que entran, sucursales, personal y roles</p>
        </div>

        <div class="flex items-center gap-3">
          <button (click)="cargarDatosGenerales()" class="btn btn-outline" style="padding: 0.6rem 1.2rem;">
            <i class="fa-solid fa-rotate"></i> Actualizar Datos
          </button>
        </div>
      </div>

      <!-- Navegación por Pestañas -->
      <div class="flex items-center gap-4 mb-10 overflow-x-auto pb-4" style="flex-wrap: nowrap; overflow-x: auto;">
        <button 
          (click)="activeTab = 'prendas'" 
          [class.tab-btn-active]="activeTab === 'prendas'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
        >
          <i class="fa-solid fa-shirt"></i> Prendas de Ropa
        </button>

        <button 
          (click)="activeTab = 'atributos'" 
          [class.tab-btn-active]="activeTab === 'atributos'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
        >
          <i class="fa-solid fa-boxes-packing"></i> Mercadería por Categoría
        </button>

        <button 
          (click)="activeTab = 'sucursales'" 
          [class.tab-btn-active]="activeTab === 'sucursales'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
        >
          <i class="fa-solid fa-shop"></i> Sucursales &amp; Ciudades
        </button>

        <button 
          (click)="activeTab = 'proveedores'" 
          [class.tab-btn-active]="activeTab === 'proveedores'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
        >
          <i class="fa-solid fa-truck-ramp-box"></i> Proveedores &amp; Temporadas
        </button>

        <button 
          (click)="activeTab = 'usuarios'" 
          [class.tab-btn-active]="activeTab === 'usuarios'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
        >
          <i class="fa-solid fa-users-gear"></i> Personal &amp; Roles
        </button>

        <button 
          (click)="activeTab = 'alertas'" 
          [class.tab-btn-active]="activeTab === 'alertas'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
          style="position: relative;"
        >
          <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Alertas Stock
          <span *ngIf="alertas.length > 0" class="badge" style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white;">{{ alertas.length }}</span>
        </button>

        <button 
          (click)="activeTab = 'reportes'" 
          [class.tab-btn-active]="activeTab === 'reportes'" 
          class="admin-tab-btn shrink-0" style="flex-shrink: 0; min-width: max-content;"
        >
          <i class="fa-solid fa-chart-pie" style="color: #60a5fa;"></i> Reportes & BI
        </button>
      </div>



      <!-- =================================================================== -->
      <!-- PESTAÑA 1: PRENDAS DE ROPA                                          -->
      <!-- =================================================================== -->
      
      <!-- PESTAÑA: REPORTES -->
      <div *ngIf="activeTab === 'reportes'" class="animate-fade-in" style="width: 100%;">
         <app-reportes [esAdmin]="true"></app-reportes>
      </div>

      <div *ngIf="activeTab === 'prendas'" class="flex flex-col gap-6">
        
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-serif text-2xl font-bold" style="color: var(--text-main);">Catálogo Maestro de Prendas</h2>
            <p class="text-xs" style="color: var(--text-muted);">Configura fotos por color, registra cantidades de stock que entran y administra modelos 3D</p>
          </div>
          <button (click)="abrirModalPrenda()" class="btn btn-accent">
            <i class="fa-solid fa-plus"></i> Nueva Prenda
          </button>
        </div>

        <!-- Barra de Clasificación por Etiquetas de Categorías -->
        <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-wider mr-1" style="color: var(--text-muted);">
              <i class="fa-solid fa-tags mr-1"></i> Categorías:
            </span>
            <button 
              type="button"
              (click)="categoriaFiltroId = null" 
              class="category-filter-chip"
              [class.active]="categoriaFiltroId === null"
            >
              <span>Todas</span>
              <span class="chip-count">{{ productos.length }}</span>
            </button>
            <button 
              type="button"
              *ngFor="let c of categorias"
              (click)="categoriaFiltroId = c.id" 
              class="category-filter-chip"
              [class.active]="categoriaFiltroId === c.id"
            >
              <span>{{ c.nombre }}</span>
              <span class="chip-count">{{ getPrendasPorCategoriaCount(c.id) }}</span>
            </button>
          </div>

          <button 
            *ngIf="categoriaFiltroId !== null" 
            type="button"
            (click)="abrirModalPrenda(categoriaFiltroId)" 
            class="btn btn-primary" 
            style="font-size: 0.8rem; padding: 0.45rem 0.9rem;"
          >
            <i class="fa-solid fa-plus mr-1"></i> Añadir a {{ getCategoriaNombre(categoriaFiltroId) }}
          </button>
        </div>

        <div class="card overflow-x-auto w-full">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre de la Prenda</th>
                <th>Categoría</th>
                <th>Precio Base</th>
                <th>Modelo 3D / AR</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of productosFiltrados">
                <td>
                  <img [src]="p.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100'" [alt]="p.nombre" referrerpolicy="no-referrer" (error)="onImgError($event)" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" />
                </td>
                <td style="font-weight: 700; color: var(--text-main);">{{ p.nombre }}</td>
                <td><span class="badge" style="background: var(--table-th-bg); color: var(--text-muted); border: 1px solid var(--border-color);">{{ p.categoria?.nombre || 'General' }}</span></td>
                <td style="font-weight: 800; color: var(--accent);">Bs. {{ p.precio_base | number:'1.2-2' }}</td>
                <td>
                  <span *ngIf="p.modelo_ar_url" class="badge badge-ar"><i class="fa-solid fa-cube"></i> AR Activo</span>
                  <span *ngIf="!p.modelo_ar_url" class="text-xs" style="color: var(--text-muted);">Sin modelo 3D</span>
                </td>
                <td>
                  <span *ngIf="p.activo" class="badge badge-stock"><i class="fa-solid fa-check"></i> Activo</span>
                  <span *ngIf="!p.activo" class="badge" style="background:#fee2e2; color:#991b1b;">Inactivo</span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <div class="flex items-center justify-end gap-2">
                    <button 
                      (click)="abrirModalGestionPrenda(p)" 
                      class="btn btn-primary" 
                      style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" 
                      title="Gestionar fotos de cada color y registrar entrada de stock"
                    >
                      <i class="fa-solid fa-palette mr-1"></i> Fotos &amp; Stock
                    </button>
                    <button 
                      (click)="desactivarPrenda(p.id)" 
                      class="btn btn-outline" 
                      style="padding: 0.35rem 0.65rem; font-size: 0.8rem; color:#ef4444; border-color: rgba(239, 68, 68, 0.3);" 
                      title="Desactivar prenda"
                    >
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 2: ENTRADA DE MERCADERÍA & MATRIZ TALLA × COLOR             -->
      <!-- =================================================================== -->
      <div *ngIf="activeTab === 'atributos'" class="flex flex-col gap-6">
        
        <!-- Cabecera de la Sección -->
        <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b" style="border-color: var(--border-color);">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--accent); border: 1px solid rgba(245, 158, 11, 0.35);">
                <i class="fa-solid fa-boxes-stacked mr-1"></i> Operaciones Comerciales
              </span>
              <span class="text-xs" style="color: var(--text-muted);">Gestión Directa por Categoría</span>
            </div>
            <h2 class="font-serif text-2xl font-bold" style="color: var(--text-main);">Entrada de Mercadería por Categoría</h2>
            <p class="text-xs" style="color: var(--text-muted);">
              Crea una nueva categoría o presiona una existente para ingresar de inmediato cuántas prendas entran por talla y color al stock.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button 
              type="button" 
              (click)="mostrarGestionAtributosBase = !mostrarGestionAtributosBase" 
              class="btn btn-outline" 
              style="font-size: 0.8rem; padding: 0.5rem 1rem;"
            >
              <i class="fa-solid fa-sliders mr-1.5" style="color: var(--accent);"></i>
              {{ mostrarGestionAtributosBase ? 'Ocultar Atributos Base' : 'Configurar Tallas & Colores Base' }}
            </button>
          </div>
        </div>

        <!-- 1. BARRA DE CATEGORÍAS (BOTÓN + NUEVA Y CHIPS EXISTENTES) -->
        <div class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span class="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style="color: var(--accent);">
              <i class="fa-solid fa-tags"></i> 1. Selecciona la Categoría o Crea una Nueva:
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <!-- BOTÓN DESTACADO: + NUEVA CATEGORÍA -->
            <button 
              type="button"
              (click)="iniciarCrearNuevaCategoria()"
              class="btn"
              [ngClass]="modoNuevaCategoria ? 'btn-primary' : 'btn-outline'"
              style="padding: 0.6rem 1.25rem; font-size: 0.88rem; font-weight: 800; border-radius: 10px; border-width: 2px;"
            >
              <i class="fa-solid fa-plus-circle mr-1.5" [style.color]="modoNuevaCategoria ? '#18181b' : 'var(--accent)'"></i>
              + Nueva Categoría
            </button>

            <!-- CHIPS DE CATEGORÍAS EXISTENTES -->
            <button 
              type="button"
              *ngFor="let c of categorias"
              (click)="seleccionarCategoriaMatriz(c.id)"
              class="category-tag-chip"
              [class.selected]="!modoNuevaCategoria && categoriaMatrizId === c.id"
              style="padding: 0.6rem 1.1rem; font-size: 0.88rem;"
            >
              <i class="fa-solid mr-2 text-sm" [ngClass]="getCategoriaIcon(c.nombre)"></i>
              <span style="font-weight: 700;">{{ c.nombre }}</span>
              <span class="chip-count" style="margin-left: 0.5rem;">{{ getPrendasPorCategoriaCount(c.id) }}</span>
            </button>
          </div>
        </div>

        <!-- 2. CASO MODO NUEVA CATEGORÍA: FORMULARIO UNIFICADO -->
        <div *ngIf="modoNuevaCategoria" class="card p-5 animate-fade-in" style="border: 2px solid var(--accent); background: rgba(245, 158, 11, 0.03);">
          <div class="flex items-center justify-between mb-3 pb-2 border-b" style="border-color: var(--border-color);">
            <div class="flex items-center gap-2">
              <span class="badge" style="background: var(--accent); color: #18181b; font-weight: 800;">
                NUEVA CATEGORÍA
              </span>
              <h3 class="font-serif text-lg font-bold" style="color: var(--text-main);">
                Crear Categoría e Ingresar sus Prendas
              </h3>
            </div>
            <button type="button" (click)="cancelarModoNuevaCategoria()" class="btn btn-outline" style="padding: 0.3rem 0.7rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
              <i class="fa-solid fa-xmark mr-1"></i> Cancelar
            </button>
          </div>

          <div>
            <label class="form-label text-xs font-bold uppercase mb-1 block" style="color: var(--accent);">
              Nombre de la Nueva Categoría: *
            </label>
            <input 
              type="text" 
              [(ngModel)]="nuevaCategoriaInputNombre" 
              placeholder="Ej: Poleras Oversize, Blusas de Seda, Casacas de Invierno, Trajes Formales..." 
              class="form-input text-base font-bold" 
              style="width: 100%; padding: 0.65rem 0.9rem;"
            />
            <p class="text-xs mt-1" style="color: var(--text-muted);">
              Define abajo directamente cuántas prendas ingresarán de cada talla y color.
            </p>
          </div>
        </div>

        <!-- 3. PANEL OPERATIVO DE ENTRADA (SI ESTÁ EN MODO NUEVA O CATEGORÍA SELECCIONADA) -->
        <!-- 3. PANEL OPERATIVO GUIADO EN ORDEN (CANTIDAD -> TALLAS -> COLORES -> GUARDAR LOTE) -->
        <div *ngIf="modoNuevaCategoria || categoriaMatrizId !== null" class="flex flex-col gap-6 animate-fade-in">
          
          <!-- TARJETA CABECERA: DESTINO Y SUCURSAL -->
          <div class="card p-5" style="background: var(--card-bg); border: 1.5px solid var(--border-color);">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              
              <!-- Destino de Mercadería -->
              <div>
                <label class="form-label text-xs font-bold uppercase mb-1 block" style="color: var(--accent);">
                  <i class="fa-solid fa-tag mr-1"></i> Destino de Mercadería:
                </label>
                <div class="p-3 rounded-xl flex items-center justify-between" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
                  <div>
                    <span class="text-xs font-bold text-muted uppercase block">Categoría:</span>
                    <span class="font-serif text-lg font-bold" style="color: var(--text-main);">
                      {{ modoNuevaCategoria ? (nuevaCategoriaInputNombre || 'Nueva Categoría') : getCategoriaNombre(categoriaMatrizId) }}
                    </span>
                  </div>
                  
                  <div *ngIf="!modoNuevaCategoria && getPrendasDeCategoriaMatriz().length > 1" style="min-width: 170px;">
                    <select 
                      [(ngModel)]="productoMatrizId" 
                      (ngModelChange)="onProductoMatrizChange($event)"
                      class="form-select text-xs font-semibold"
                      style="width: 100%; padding: 0.35rem 0.6rem;"
                    >
                      <option *ngFor="let p of getPrendasDeCategoriaMatriz()" [value]="p.id">
                        {{ p.nombre }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Selector de Sucursal Destino -->
              <div>
                <label class="form-label text-xs font-bold uppercase mb-1 block" style="color: var(--accent);">
                  <i class="fa-solid fa-warehouse mr-1"></i> Sucursal Destino:
                </label>
                <select 
                  [(ngModel)]="sucursalMatrizId" 
                  class="form-select text-sm font-semibold"
                  style="width: 100%; padding: 0.6rem 0.75rem;"
                >
                  <option *ngFor="let s of sucursales" [ngValue]="s.id">
                    {{ s.nombre }} ({{ s.ciudad?.nombre || 'Bolivia' }})
                  </option>
                </select>
              </div>

            </div>
          </div>

          <!-- BARRA STEPPER DEL PROCESO EN ORDEN -->
          <div class="p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4" style="background: var(--table-th-bg); border: 1.5px solid var(--border-color);">
            <div class="flex flex-wrap items-center gap-2 sm:gap-4">
              
              <!-- Paso 1 -->
              <button 
                type="button" 
                (click)="irAPaso(1)" 
                class="stepper-nav-btn"
                [style.opacity]="pasoLote === 1 ? '1' : '0.7'"
              >
                <span class="step-badge" 
                      [style.background]="pasoLote === 1 ? 'var(--accent)' : (loteFijado ? '#22c55e' : 'var(--card-bg)')"
                      [style.color]="pasoLote === 1 || loteFijado ? '#ffffff' : 'var(--text-muted)'">
                  <i *ngIf="loteFijado && pasoLote > 1" class="fa-solid fa-check"></i>
                  <span *ngIf="!loteFijado || pasoLote === 1">1</span>
                </span>
                <div>
                  <span class="text-xs font-bold uppercase block" style="color: var(--text-muted);">Paso 1</span>
                  <span class="text-xs font-extrabold" [style.color]="pasoLote === 1 ? 'var(--accent)' : 'var(--text-main)'">
                    Cantidad Total
                  </span>
                </div>
              </button>

              <i class="fa-solid fa-chevron-right text-xs" style="color: var(--border-color);"></i>

              <!-- Paso 2 -->
              <button 
                type="button" 
                (click)="irAPaso(2)" 
                [disabled]="!loteFijado"
                class="stepper-nav-btn"
                [style.opacity]="pasoLote === 2 ? '1' : (loteFijado ? '0.7' : '0.4')"
              >
                <span class="step-badge"
                      [style.background]="pasoLote === 2 ? 'var(--accent)' : (pasoLote > 2 ? '#22c55e' : 'var(--card-bg)')"
                      [style.color]="pasoLote >= 2 ? '#ffffff' : 'var(--text-muted)'">
                  <i *ngIf="pasoLote > 2" class="fa-solid fa-check"></i>
                  <span *ngIf="pasoLote <= 2">2</span>
                </span>
                <div>
                  <span class="text-xs font-bold uppercase block" style="color: var(--text-muted);">Paso 2</span>
                  <span class="text-xs font-extrabold" [style.color]="pasoLote === 2 ? 'var(--accent)' : 'var(--text-main)'">
                    Repartir en Tallas
                  </span>
                </div>
              </button>

              <i class="fa-solid fa-chevron-right text-xs" style="color: var(--border-color);"></i>

              <!-- Paso 3 -->
              <button 
                type="button" 
                (click)="irAPaso(3)" 
                [disabled]="!loteFijado || getTotalAsignadoTallas() !== cantidadTotalLote"
                class="stepper-nav-btn"
                [style.opacity]="pasoLote === 3 ? '1' : (todosLosColoresCompletos() ? '0.7' : '0.4')"
              >
                <span class="step-badge"
                      [style.background]="pasoLote === 3 ? 'var(--accent)' : (todosLosColoresCompletos() ? '#22c55e' : 'var(--card-bg)')"
                      [style.color]="pasoLote === 3 || todosLosColoresCompletos() ? '#ffffff' : 'var(--text-muted)'">
                  <i *ngIf="todosLosColoresCompletos()" class="fa-solid fa-check"></i>
                  <span *ngIf="!todosLosColoresCompletos()">3</span>
                </span>
                <div>
                  <span class="text-xs font-bold uppercase block" style="color: var(--text-muted);">Paso 3</span>
                  <span class="text-xs font-extrabold" [style.color]="pasoLote === 3 ? 'var(--accent)' : 'var(--text-main)'">
                    Colores por Talla
                  </span>
                </div>
              </button>

            </div>

            <!-- Resumen flotante de lote -->
            <div *ngIf="loteFijado" class="px-3.5 py-1.5 rounded-xl text-right" style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid var(--accent);">
              <span class="text-xs font-bold uppercase block" style="color: var(--text-muted);">LOTE FIJADO:</span>
              <span class="font-serif text-xl font-black" style="color: var(--accent);">
                {{ cantidadTotalLote }} <span class="text-xs font-sans font-bold">Prendas</span>
              </span>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- VISTA PASO 1: FIJAR CANTIDAD TOTAL DEL LOTE -->
          <!-- ========================================== -->
          <div *ngIf="pasoLote === 1" class="card p-8 animate-fade-in text-center" style="border: 1.5px solid var(--accent); box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);">
            <div class="max-w-md mx-auto">
              <div class="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4" style="background: rgba(245, 158, 11, 0.15); color: var(--accent); font-size: 1.8rem;">
                <i class="fa-solid fa-boxes-stacked"></i>
              </div>
              
              <h3 class="font-serif text-2xl font-bold mb-2" style="color: var(--text-main);">
                Paso 1: Cantidad Total que Ingresará
              </h3>
              <p class="text-xs mb-6" style="color: var(--text-muted);">
                Escribe cuántas prendas en total han llegado de esta categoría. Luego le das <strong>OK</strong> y el sistema te guiará en vivo para distribuirlas en tallas y colores sin pasarte de ese número.
              </p>

              <div class="flex items-center gap-3 justify-center mb-6">
                <input 
                  type="number" 
                  min="1" 
                  [(ngModel)]="cantidadTotalLoteInput" 
                  placeholder="Ej: 50" 
                  class="form-input text-center text-2xl font-black"
                  style="width: 170px; padding: 0.75rem 1rem; border: 2px solid var(--accent); border-radius: 12px;"
                  (keyup.enter)="fijarCantidadLote()"
                  autofocus
                />
                <button 
                  type="button" 
                  (click)="fijarCantidadLote()" 
                  class="btn btn-primary"
                  style="padding: 0.85rem 1.6rem; font-size: 1rem; font-weight: 800; border-radius: 12px;"
                >
                  <i class="fa-solid fa-check mr-2"></i> OK / Siguiente
                </button>
              </div>

              <!-- Si ya había fijado previamente un lote y vuelve al paso 1 -->
              <div *ngIf="loteFijado" class="mt-4 p-3 rounded-xl inline-block" style="background: var(--table-th-bg); border: 1px dashed var(--accent);">
                <span class="text-xs" style="color: var(--text-muted);">
                  Actualmente fijado en <strong>{{ cantidadTotalLote }} prendas</strong>. Si cambias el número y das OK, reajustarás el lote.
                </span>
                <button 
                  type="button" 
                  (click)="pasoLote = 2" 
                  class="btn btn-outline ml-3" 
                  style="font-size: 0.75rem; padding: 0.3rem 0.6rem;"
                >
                  Mantener y seguir a Tallas <i class="fa-solid fa-arrow-right ml-1"></i>
                </button>
              </div>

            </div>
          </div>

          <!-- ============================================== -->
          <!-- VISTA PASO 2: ASIGNAR PRENDAS A CADA TALLA (EN VIVO) -->
          <!-- ============================================== -->
          <div *ngIf="pasoLote === 2" class="card p-6 animate-fade-in" style="border: 1.5px solid var(--accent); box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);">
            
            <!-- Banner de Control de Distribución en Tallas -->
            <div class="mb-6 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in"
                 [style.background]="getTotalAsignadoTallas() === cantidadTotalLote ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'"
                 [style.border]="'1.5px solid ' + (getTotalAsignadoTallas() === cantidadTotalLote ? '#22c55e' : 'var(--accent)')">
              
              <div class="flex items-center gap-3">
                <i class="fa-solid text-2xl" 
                   [ngClass]="getTotalAsignadoTallas() === cantidadTotalLote ? 'fa-circle-check text-green-500' : 'fa-hourglass-half text-amber-500'"></i>
                <div>
                  <div class="font-bold text-base" style="color: var(--text-main);">
                    <span *ngIf="getTotalAsignadoTallas() === cantidadTotalLote" style="color: #22c55e;">
                      ¡Tallas Completadas! Has distribuido exactamente las {{ cantidadTotalLote }} prendas.
                    </span>
                    <span *ngIf="getTotalAsignadoTallas() < cantidadTotalLote" style="color: var(--accent);">
                      Paso 2: Asigna cuántas prendas van a cada talla ({{ getTotalAsignadoTallas() }} de {{ cantidadTotalLote }} Uds asignadas).
                    </span>
                  </div>
                  <div class="text-xs mt-0.5" style="color: var(--text-muted);">
                    <span *ngIf="getTotalAsignadoTallas() < cantidadTotalLote">
                      El sistema no te deja pasarte. Faltan <strong>{{ getPendienteTallas() }} prendas</strong> por asignar a las tallas.
                    </span>
                    <span *ngIf="getTotalAsignadoTallas() === cantidadTotalLote">
                      Distribución exacta alcanzada. Ya puedes presionar <strong>"Siguiente: Asignar Colores"</strong>.
                    </span>
                  </div>
                </div>
              </div>

              <!-- Indicadores Numéricos -->
              <div class="flex items-center gap-3">
                <div class="text-center px-4 py-2 rounded-xl" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                  <span class="text-xs font-bold block" style="color: var(--text-muted);">TOTAL LOTE:</span>
                  <span class="font-serif text-xl font-bold" style="color: var(--text-main);">
                    {{ cantidadTotalLote }} Uds
                  </span>
                </div>
                <div class="text-center px-4 py-2 rounded-xl" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                  <span class="text-xs font-bold block" style="color: var(--text-muted);">FALTAN EN TALLAS:</span>
                  <span class="font-serif text-2xl font-black" [style.color]="getPendienteTallas() === 0 ? '#22c55e' : 'var(--accent)'">
                    {{ getPendienteTallas() }} <span class="text-xs font-sans font-bold">Uds</span>
                  </span>
                </div>
              </div>

            </div>

            <!-- Título y Cuadrícula de Tallas -->
            <div class="mb-4">
              <h3 class="font-serif text-lg font-bold" style="color: var(--text-main);">
                <i class="fa-solid fa-ruler mr-2" style="color: var(--accent);"></i>
                Tallas Predeterminadas Disponibles
              </h3>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                Escribe manualmente cuántas prendas irán a cada talla (control en vivo):
              </p>
            </div>

            <!-- Tarjetas de Tallas con Ingreso Manual -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <div 
                *ngFor="let t of tallasMatrizActivas" 
                class="talla-card flex flex-col items-center justify-between text-center gap-2"
                [class.has-quantity]="getCantidadTalla(t.id) > 0"
                [class.opacity-40]="getPendienteTallas() === 0 && getCantidadTalla(t.id) === 0"
              >
                <!-- Nombre de Talla -->
                <div>
                  <span class="text-xs font-bold uppercase block" style="color: var(--text-muted);">Talla</span>
                  <span class="font-serif text-2xl font-black" style="color: var(--accent);">
                    {{ t.nombre }}
                  </span>
                </div>

                <!-- Ingreso Manual de Cantidad de la Talla -->
                <div class="w-full flex items-center justify-center my-1">
                  <input 
                    type="number" 
                    min="0" 
                    [max]="cantidadTotalLote"
                    [disabled]="getPendienteTallas() === 0 && getCantidadTalla(t.id) === 0"
                    [value]="getCantidadTalla(t.id) === 0 ? '' : getCantidadTalla(t.id)" 
                    (input)="onTallaInput($event, t.id)"
                    placeholder="0"
                    class="matrix-cell-input font-black text-center"
                    [class.cursor-not-allowed]="getPendienteTallas() === 0 && getCantidadTalla(t.id) === 0"
                    style="width: 76px; font-size: 1.15rem; padding: 0.45rem 0.5rem; border-radius: 10px;"
                  />
                </div>

                <!-- Badge Informativo de esa Talla -->
                <span class="text-xs font-bold" [style.color]="getCantidadTalla(t.id) > 0 ? 'var(--accent)' : 'var(--text-muted)'">
                  {{ getCantidadTalla(t.id) }} Uds asignadas
                </span>
              </div>
            </div>

            <!-- Botones de Navegación del Paso 2 -->
            <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" style="border-color: var(--border-color);">
              <button 
                type="button" 
                (click)="irAPaso(1)" 
                class="btn btn-outline"
                style="padding: 0.65rem 1.2rem; font-size: 0.85rem;"
              >
                <i class="fa-solid fa-arrow-left mr-1.5"></i> Cambiar Cantidad Total
              </button>

              <div class="flex items-center gap-3">
                <span *ngIf="getTotalAsignadoTallas() < cantidadTotalLote" class="text-xs font-bold" style="color: var(--accent);">
                  <i class="fa-solid fa-info-circle mr-1"></i> Faltan {{ getPendienteTallas() }} prendas por asignar para avanzar
                </span>

                <button 
                  type="button" 
                  (click)="avanzarAColores()" 
                  [disabled]="getTotalAsignadoTallas() !== cantidadTotalLote"
                  class="btn"
                  [style.background]="getTotalAsignadoTallas() === cantidadTotalLote ? 'var(--accent)' : 'var(--border-color)'"
                  [style.color]="getTotalAsignadoTallas() === cantidadTotalLote ? '#18181b' : 'var(--text-muted)'"
                  style="padding: 0.8rem 1.8rem; font-size: 0.95rem; font-weight: 800; border-radius: 10px; cursor: pointer;"
                >
                  <span>Siguiente: Asignar Colores</span>
                  <i class="fa-solid fa-arrow-right ml-2"></i>
                </button>
              </div>
            </div>

          </div>

          <!-- ============================================== -->
          <!-- VISTA PASO 3: ASIGNAR COLORES A CADA TALLA (EN VIVO) -->
          <!-- ============================================== -->
          <div *ngIf="pasoLote === 3" class="card p-6 animate-fade-in" style="border: 1.5px solid var(--accent); box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);">
            
            <!-- Barra Superior: Estado General de Colores + Botón + Otro Color -->
            <div class="flex flex-wrap items-center justify-between gap-4 mb-5 pb-3 border-b" style="border-color: var(--border-color);">
              <div>
                <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">
                  <i class="fa-solid fa-palette mr-2" style="color: var(--accent);"></i>
                  Paso 3: Asignar Colores para Cada Talla
                </h3>
                <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                  Reparte las prendas de cada talla entre los colores. El sistema controla en vivo que no te pases de la cuota de cada talla:
                </p>
              </div>

              <!-- Botón + Otro Color con Paleta -->
              <div class="flex items-center gap-3">
                <button 
                  type="button" 
                  (click)="mostrarModalOtroColor = !mostrarModalOtroColor" 
                  class="btn btn-outline flex items-center gap-2"
                  style="border-color: var(--accent); color: var(--accent); font-size: 0.82rem; padding: 0.5rem 1rem;"
                >
                  <i class="fa-solid fa-palette"></i>
                  <span>{{ mostrarModalOtroColor ? 'Cerrar Paleta' : '+ Otro Color' }}</span>
                </button>

                <div class="px-4 py-2 rounded-xl text-center" style="background: rgba(245, 158, 11, 0.15); border: 1.5px solid var(--accent);">
                  <span class="text-xs font-bold block" style="color: var(--text-muted);">TOTAL COLORES:</span>
                  <span class="font-serif text-xl font-extrabold" style="color: var(--accent);">
                    {{ getGranTotalMatriz() }} / {{ cantidadTotalLote }} <span class="text-xs font-sans font-bold">Uds</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- PANEL INTERACTIVO: AGREGAR OTRO COLOR CON PALETA -->
            <div *ngIf="mostrarModalOtroColor" class="p-5 mb-5 rounded-2xl animate-fade-in" style="background: var(--table-th-bg); border: 1.5px dashed var(--accent);">
              <div class="flex items-center justify-between mb-3 pb-2 border-b" style="border-color: var(--border-color);">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-eye-dropper" style="color: var(--accent);"></i>
                  <h4 class="text-sm font-bold" style="color: var(--text-main);">Agregar Color Personalizado con Paleta</h4>
                </div>
                <button type="button" (click)="mostrarModalOtroColor = false" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"><i class="fa-solid fa-xmark"></i></button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                <div>
                  <label class="form-label text-xs font-bold uppercase mb-1 block">Nombre del Color:</label>
                  <div class="flex items-center gap-2">
                    <input 
                      type="color" 
                      [(ngModel)]="nuevoOtroColorHex" 
                      style="width: 44px; height: 38px; border: 1.5px solid var(--border-color); border-radius: 8px; cursor: pointer; background: transparent; padding: 2px;"
                      title="Haz clic para abrir el selector de color"
                    />
                    <input 
                      type="text" 
                      [(ngModel)]="nuevoOtroColorNombre" 
                      placeholder="Ej: Verde Militar, Mostaza, Lila..." 
                      class="form-input text-xs font-semibold"
                      style="flex: 1; padding: 0.55rem 0.8rem;"
                      (keyup.enter)="agregarOtroColorMatriz()"
                    />
                    <button 
                      type="button" 
                      (click)="agregarOtroColorMatriz()" 
                      class="btn btn-primary"
                      style="padding: 0.55rem 1rem; font-size: 0.8rem; font-weight: 700;"
                    >
                      <i class="fa-solid fa-plus mr-1"></i> Agregar a la Lista
                    </button>
                  </div>
                </div>

                <div>
                  <label class="form-label text-xs font-bold uppercase mb-1 block" style="color: var(--accent);">
                    Paleta de Sugerencias Rápidas:
                  </label>
                  <div class="flex flex-wrap items-center gap-2">
                    <button 
                      type="button" 
                      *ngFor="let p of coloresPaletaRapida" 
                      (click)="seleccionarColorPaleta(p)"
                      class="color-swatch-btn" 
                      [style.background-color]="p.hex" 
                      [title]="p.nombre + ' (' + p.hex + ')'"
                    ></button>
                  </div>
                  <p class="text-xs mt-1" style="color: var(--text-muted);">Haz clic en un tono para autocompletar.</p>
                </div>
              </div>
            </div>

            <!-- SECCIONES DE ASIGNACIÓN: UNA POR CADA TALLA CON PRENDAS ASIGNADAS -->
            <div class="flex flex-col gap-5 mb-6">
              <div 
                *ngFor="let t of tallasConCantidad" 
                class="p-4 rounded-xl"
                [style.background]="getPendienteColorTalla(t.id) === 0 ? 'rgba(34, 197, 94, 0.05)' : 'var(--table-th-bg)'"
                [style.border]="'1.5px solid ' + (getPendienteColorTalla(t.id) === 0 ? '#22c55e' : 'var(--border-color)')"
              >
                <!-- Cabecera de la Talla -->
                <div class="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b" style="border-color: var(--border-color);">
                  <div class="flex items-center gap-3">
                    <span class="w-9 h-9 rounded-lg flex items-center justify-center font-serif text-lg font-black" style="background: var(--card-bg); border: 1.5px solid var(--accent); color: var(--accent);">
                      {{ t.nombre }}
                    </span>
                    <div>
                      <span class="font-serif text-base font-bold" style="color: var(--text-main);">
                        Talla {{ t.nombre }}
                      </span>
                      <span class="text-xs ml-2 font-bold px-2 py-0.5 rounded-md" style="background: rgba(245, 158, 11, 0.15); color: var(--accent);">
                        Cuota: {{ getCantidadTalla(t.id) }} Uds
                      </span>
                    </div>
                  </div>

                  <!-- Estado de Asignación de esa Talla -->
                  <div class="flex items-center gap-2">
                    <span *ngIf="getPendienteColorTalla(t.id) > 0" class="text-xs font-bold" style="color: var(--accent);">
                      <i class="fa-solid fa-hourglass-half mr-1"></i> Faltan {{ getPendienteColorTalla(t.id) }} Uds por asignar en colores
                    </span>
                    <span *ngIf="getPendienteColorTalla(t.id) === 0" class="text-xs font-bold" style="color: #22c55e;">
                      <i class="fa-solid fa-circle-check mr-1"></i> ¡Colores completos para Talla {{ t.nombre }}!
                    </span>

                    <div class="px-2.5 py-1 rounded-lg text-xs font-black" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                      {{ getTotalColorDeTalla(t.id) }} / {{ getCantidadTalla(t.id) }} Uds
                    </div>
                  </div>
                </div>

                <!-- Lista de Colores de esta Talla -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  <div 
                    *ngFor="let col of coloresMatrizActivos" 
                    class="p-2.5 rounded-lg flex items-center justify-between gap-2"
                    [style.background]="getCantidadMatriz(col.id, t.id) > 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--card-bg)'"
                    [style.border]="'1px solid ' + (getCantidadMatriz(col.id, t.id) > 0 ? 'var(--accent)' : 'var(--border-color)')"
                    [class.opacity-40]="getPendienteColorTalla(t.id) === 0 && getCantidadMatriz(col.id, t.id) === 0"
                  >
                    <!-- Muestra de Color y Nombre -->
                    <div class="flex items-center gap-2 min-w-0">
                      <span 
                        class="color-dot-indicator" 
                        [style.background-color]="col.codigo_hex || '#000'" 
                        style="width: 16px; height: 16px; min-width: 16px; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"
                      ></span>
                      <span class="text-xs font-bold truncate" style="color: var(--text-main);" [title]="col.nombre">
                        {{ col.nombre }}
                      </span>
                    </div>

                    <!-- Ingreso Manual de Cantidad del Color -->
                    <div class="flex items-center gap-1.5">
                      <input 
                        type="number" 
                        min="0" 
                        [max]="getCantidadTalla(t.id)"
                        [disabled]="getPendienteColorTalla(t.id) === 0 && getCantidadMatriz(col.id, t.id) === 0"
                        [value]="getCantidadMatriz(col.id, t.id) === 0 ? '' : getCantidadMatriz(col.id, t.id)" 
                        (input)="onColorInput($event, col.id, t.id)"
                        placeholder="0"
                        class="matrix-cell-input font-bold text-center"
                        [class.cursor-not-allowed]="getPendienteColorTalla(t.id) === 0 && getCantidadMatriz(col.id, t.id) === 0"
                        style="width: 58px; padding: 0.35rem 0.3rem; font-size: 0.95rem; border-radius: 8px;"
                      />
                      <span class="text-xs font-semibold" style="color: var(--text-muted);">Uds</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <!-- Fila de Observaciones y Botón Final [ Guardar Lote ] -->
            <div class="flex flex-wrap items-center justify-between gap-4 pt-5 border-t" style="border-color: var(--border-color);">
              <div class="flex-1" style="min-width: 260px;">
                <label class="form-label text-xs block mb-1">Observaciones / Guía de Remisión (Opcional):</label>
                <input 
                  type="text" 
                  [(ngModel)]="observacionesMatriz" 
                  placeholder="Ej: Lote Temporada Primavera-Verano #104 / Factura Proveedor..." 
                  class="form-input text-xs" 
                  style="padding: 0.5rem 0.75rem;" 
                />
              </div>

              <!-- Acciones Finales -->
              <div class="flex items-center gap-3">
                <button 
                  type="button" 
                  (click)="irAPaso(2)" 
                  class="btn btn-outline"
                  style="padding: 0.75rem 1.2rem; font-size: 0.85rem;"
                >
                  <i class="fa-solid fa-arrow-left mr-1.5"></i> Volver a Tallas
                </button>

                <!-- Estado: Faltan colores -->
                <div *ngIf="!todosLosColoresCompletos()" 
                     class="px-4 py-3 rounded-xl flex items-center gap-2" 
                     style="background: rgba(245, 158, 11, 0.12); border: 1.5px dashed var(--accent); color: var(--accent); font-weight: 700; font-size: 0.85rem;">
                  <i class="fa-solid fa-hourglass-half"></i>
                  <span>Faltan {{ cantidadTotalLote - getGranTotalMatriz() }} prendas por asignar en colores para habilitar "Guardar Lote"</span>
                </div>

                <!-- BOTÓN PRINCIPAL: GUARDAR LOTE (UNA VEZ LLEGUES AL FINAL) -->
                <button 
                  *ngIf="todosLosColoresCompletos()" 
                  type="button" 
                  (click)="guardarIngresoDirecto()" 
                  [disabled]="guardandoMatriz" 
                  class="btn animate-fade-in"
                  style="background: #22c55e; border: 2px solid #16a34a; color: #ffffff; padding: 0.85rem 2.2rem; font-size: 1.05rem; font-weight: 900; letter-spacing: 0.04em; border-radius: 12px; box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4); cursor: pointer;"
                >
                  <span *ngIf="guardandoMatriz"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Registrando en Kardex...</span>
                  <span *ngIf="!guardandoMatriz">
                    <i class="fa-solid fa-boxes-packing mr-2"></i> Guardar Lote ({{ cantidadTotalLote }} Uds)
                  </span>
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- 4. SECCIÓN DISCRETA: CONFIGURACIÓN DE ATRIBUTOS BASE (COLAPSABLE) -->
        <div *ngIf="mostrarGestionAtributosBase" class="card p-6 animate-fade-in" style="background: var(--table-th-bg); border: 1px dashed var(--border-color);">
          <div class="flex items-center justify-between mb-4 pb-2 border-b" style="border-color: var(--border-color);">
            <div>
              <h3 class="font-serif text-lg font-bold" style="color: var(--text-main);">
                <i class="fa-solid fa-sliders text-amber-600 mr-2"></i> Catálogo Maestro de Tallas y Colores
              </h3>
              <p class="text-xs" style="color: var(--text-muted);">Administra la lista maestra de tallas y la paleta de colores global</p>
            </div>
            <button (click)="mostrarGestionAtributosBase = false" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Tallas Maestras -->
            <div class="p-4 rounded-xl" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold uppercase" style="color: var(--accent);">Tallas Maestras Registradas ({{ tallas.length }})</span>
              </div>
              <div class="flex flex-wrap gap-2 mb-3">
                <span *ngFor="let t of tallas" class="badge" style="background: var(--table-th-bg); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.3rem 0.6rem;">
                  {{ t.nombre }}
                </span>
              </div>
              <div class="flex gap-2">
                <input type="text" [(ngModel)]="nuevaTallaNombre" placeholder="Nueva talla (ej: 4XL)" class="form-input text-xs" style="padding: 0.4rem 0.6rem;" />
                <button (click)="crearTalla()" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>

            <!-- Colores Maestros -->
            <div class="p-4 rounded-xl" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold uppercase" style="color: var(--accent);">Paleta Maestra de Colores ({{ colores.length }})</span>
              </div>
              <div class="flex flex-wrap gap-2 mb-3">
                <span *ngFor="let col of colores" class="badge flex items-center gap-1.5" style="background: var(--table-th-bg); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.3rem 0.6rem;">
                  <span class="color-dot-indicator" [style.background-color]="col.codigo_hex || '#000'" style="width: 10px; height: 10px; min-width: 10px; border-radius: 50%;"></span>
                  {{ col.nombre }}
                </span>
              </div>
              <div class="flex gap-2 items-center">
                <input type="text" [(ngModel)]="nuevoColorNombre" placeholder="Nuevo color (ej: Celeste Cielo)" class="form-input text-xs" style="flex:1; padding: 0.4rem 0.6rem;" />
                <input type="color" [(ngModel)]="nuevoColorHex" style="width: 36px; height: 32px; border:none; border-radius: 6px; cursor:pointer; background: transparent;" />
                <button (click)="crearColor()" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 3: SUCURSALES Y CIUDADES                                    -->
      <!-- =================================================================== -->
      <div *ngIf="activeTab === 'sucursales'" class="flex flex-col gap-6">
        
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-serif text-2xl font-bold" style="color: var(--text-main);">Sucursales Físicas Habilitadas</h2>
            <p class="text-xs" style="color: var(--text-muted);">Puntos físicos para vestidores con prueba de ropa, reservas y cobro presencial</p>
          </div>
          <button (click)="mostrarModalSucursal = true" class="btn btn-accent">
            <i class="fa-solid fa-plus"></i> Registrar Nueva Sucursal
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div *ngFor="let s of sucursales" class="card p-6 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">{{ s.nombre }}</h3>
                <span class="badge" style="background:#dbeafe; color:#1e40af;">{{ s.ciudad?.nombre || 'Bolivia' }}</span>
              </div>
              <p class="text-sm mb-2" style="color: var(--text-muted);"><i class="fa-solid fa-map-pin text-amber-600 mr-2"></i> {{ s.direccion }}</p>
              <p *ngIf="s.telefono" class="text-sm" style="color: var(--text-muted);"><i class="fa-solid fa-phone text-amber-600 mr-2"></i> {{ s.telefono }}</p>
            </div>
            
            <div class="mt-5 pt-3 border-t flex items-center justify-between" style="border-color: var(--border-color);">
              <span class="text-xs text-green-600 font-bold">
                <i class="fa-solid fa-door-open mr-1"></i> Vestidores Activos
              </span>
              <button 
                type="button" 
                (click)="eliminarSucursal(s)" 
                class="btn btn-outline" 
                style="padding: 0.35rem 0.7rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.35);"
                title="Desactivar sucursal '{{ s.nombre }}'"
              >
                <i class="fa-solid fa-trash-can mr-1"></i> Eliminar
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 4: PROVEEDORES Y TEMPORADAS                                 -->
      <!-- =================================================================== -->
      <div *ngIf="activeTab === 'proveedores'" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <!-- Proveedores -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
              <i class="fa-solid fa-truck-fast text-amber-600"></i> Empresas Proveedoras
            </h3>
            <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ proveedores.length }}</span>
          </div>

          <div class="mb-5 flex flex-col gap-3 p-5 rounded-xl" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase" style="color: var(--text-muted);">Registrar Proveedor</h4>
            <input type="text" [(ngModel)]="nuevoProvNombre" placeholder="Razón Social / Empresa *" class="form-input" style="padding: 0.5rem;" />
            <div class="grid grid-cols-2 gap-2">
              <input type="text" [(ngModel)]="nuevoProvContacto" placeholder="Nombre Contacto" class="form-input" style="padding: 0.5rem;" />
              <input type="text" [(ngModel)]="nuevoProvTelefono" placeholder="Teléfono" class="form-input" style="padding: 0.5rem;" />
            </div>
            <button (click)="crearProveedor()" class="btn btn-primary" style="padding: 0.5rem;"><i class="fa-solid fa-plus"></i> Guardar Proveedor</button>
          </div>

          <div class="flex flex-col gap-3" style="max-height: 380px; overflow-y: auto;">
            <div *ngFor="let pr of proveedores" class="p-3.5 rounded-xl flex items-center justify-between" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <div>
                <h4 class="font-bold text-sm" style="color: var(--text-main);">{{ pr.nombre }}</h4>
                <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                  <i class="fa-solid fa-user mr-1"></i> {{ pr.contacto_nombre || 'Sin contacto' }} • 
                  <i class="fa-solid fa-phone mr-1 ml-1"></i> {{ pr.telefono || 'Sin tel.' }}
                </p>
                <p *ngIf="pr.direccion" class="text-xs mt-0.5" style="color: var(--text-muted);">
                  <i class="fa-solid fa-location-dot mr-1"></i> {{ pr.direccion }}
                </p>
              </div>
              <button 
                type="button" 
                (click)="eliminarProveedor(pr)" 
                class="btn btn-outline" 
                style="padding: 0.3rem 0.55rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"
                title="Eliminar proveedor"
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Temporadas y Colecciones -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
              <i class="fa-solid fa-calendar-week text-amber-600"></i> Campañas &amp; Colecciones
            </h3>
            <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ temporadas.length }}</span>
          </div>

          <div class="mb-5 flex flex-col gap-3 p-5 rounded-xl" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase" style="color: var(--text-muted);">Crear Temporada de Moda</h4>
            <input type="text" [(ngModel)]="nuevaTempNombre" placeholder="Ej: Invierno Festivo 2026 *" class="form-input" style="padding: 0.5rem;" />
            <input type="text" [(ngModel)]="nuevaTempTipo" placeholder="Tipo (Casual, Gala, Deporte)" class="form-input" style="padding: 0.5rem;" />
            <button (click)="crearTemporada()" class="btn btn-primary" style="padding: 0.5rem;"><i class="fa-solid fa-plus"></i> Crear Temporada</button>
          </div>

          <div class="flex flex-col gap-3" style="max-height: 380px; overflow-y: auto;">
            <div *ngFor="let t of temporadas" class="p-3.5 rounded-xl flex items-center justify-between" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <div>
                <h4 class="font-bold text-sm" style="color: var(--text-main);">{{ t.nombre }}</h4>
                <p class="text-xs mt-0.5" style="color: var(--text-muted);">Tipo: {{ t.tipo || 'General' }}</p>
                <span *ngIf="t.fecha_inicio" class="text-xs" style="color: var(--accent);">
                  {{ t.fecha_inicio }} al {{ t.fecha_fin || 'Presente' }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge badge-stock">Vigente</span>
                <button 
                  type="button" 
                  (click)="eliminarTemporada(t)" 
                  class="btn btn-outline" 
                  style="padding: 0.3rem 0.55rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"
                  title="Eliminar temporada"
                >
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 5: PERSONAL Y USUARIOS INTERNOS (ROLES EDITABLES)           -->
      <!-- =================================================================== -->
      
        <!-- PESTAÑA: ALERTAS -->
        <div *ngIf="activeTab === 'alertas'" class="animate-fade-in" style="width: 100%;">
          <div class="card p-6" style="border-left: 4px solid #ef4444; background: linear-gradient(145deg, #18181b, #27272a);">
            <div class="flex items-center gap-3 mb-6">
              <div class="rounded-full flex items-center justify-center" style="background-color: rgba(239, 68, 68, 0.2); width: 40px; height: 40px;">
                <i class="fa-solid fa-triangle-exclamation text-red-500"></i>
              </div>
              <div>
                <h2 class="text-xl font-bold text-white m-0">Supervisión Global de Inventario Crítico</h2>
                <p class="text-xs text-zinc-400 m-0 mt-1">Monitorea variantes con stock crítico en TODAS las sucursales.</p>
              </div>
              <button (click)="cargarAlertas()" class="ml-auto btn btn-outline flex items-center gap-2">
                <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="alertasLoading"></i> Actualizar
              </button>
            </div>

            <div *ngIf="alertasLoading" class="text-center py-10">
              <i class="fa-solid fa-circle-notch fa-spin text-3xl text-accent mb-3"></i>
              <p class="text-zinc-400">Evaluando stock crítico...</p>
            </div>

            <div *ngIf="!alertasLoading && alertas.length === 0" class="text-center py-12 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <i class="fa-solid fa-check text-2xl text-green-500"></i>
              </div>
              <h3 class="text-lg font-bold text-white mb-2">Todo en Orden</h3>
              <p class="text-zinc-400 text-sm max-w-md mx-auto">No hay alertas activas en ninguna sucursal.</p>
            </div>

            <div *ngIf="!alertasLoading && alertas.length > 0" class="overflow-x-auto">
              <table class="table w-full text-left">
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Sucursal</th>
                    <th class="text-center">Stock Actual</th>
                    <th class="text-center">Mínimo</th>
                    <th class="text-center">Sugerido (IA)</th>
                    <th class="text-right">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of alertas">
                    <td>
                      <div class="font-bold text-white">{{a.variante.producto_nombre}}</div>
                      <div class="text-xs text-zinc-400">Talla: {{a.variante.talla}} | Color: {{a.variante.color}}</div>
                    </td>
                    <td class="text-sm text-zinc-300 font-bold">{{a.sucursal.nombre}}</td>
                    <td class="text-center">
                      <span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;">{{a.cantidad_actual}}</span>
                    </td>
                    <td class="text-center text-sm text-zinc-400">{{a.stock_minimo_usado}}</td>
                    <td class="text-center">
                      <span class="badge" style="background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent);">+{{a.cantidad_sugerida}} uds.</span>
                    </td>
                    <td class="text-right text-xs text-zinc-400">
                      {{a.proveedor_sugerido}}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div *ngIf="activeTab === 'usuarios'" class="flex flex-col gap-6">
        
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-serif text-2xl font-bold" style="color: var(--text-main);">Personal Interno de Tienda</h2>
            <p class="text-xs" style="color: var(--text-muted);">Puedes cambiar el rol directamente desde el selector de la tabla o dar de baja cuentas de empleados</p>
          </div>
          <button (click)="mostrarModalUsuario = true" class="btn btn-accent">
            <i class="fa-solid fa-user-plus"></i> Registrar Empleado
          </button>
        </div>

        <div class="card overflow-x-auto w-full">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>Correo Electrónico</th>
                <th>Rol de Acceso (Editable)</th>
                <th>Sucursal Asignada</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of usuarios">
                <td style="font-weight: 700; color: var(--text-main);">{{ u.nombres }} {{ u.apellidos }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <!-- Selector para Cambiar Rol Inmediatamente -->
                  <select 
                    [ngModel]="u.rol_id" 
                    (ngModelChange)="cambiarRolUsuario(u, $event)"
                    class="form-select text-xs font-bold"
                    style="padding: 0.35rem 0.65rem; min-width: 155px; border-radius: 8px;"
                    [style.color]="u.rol_id === 1 ? '#d97706' : (u.rol_id === 2 ? '#6366f1' : '#10b981')"
                  >
                    <option *ngFor="let r of roles" [value]="r.id">{{ r.nombre }}</option>
                  </select>
                </td>
                <td>
                  <!-- Selector de Sucursal si aplica -->
                  <select 
                    *ngIf="u.rol_id !== 1"
                    [ngModel]="u.sucursal_id" 
                    (ngModelChange)="cambiarSucursalUsuario(u, $event)"
                    class="form-select text-xs"
                    style="padding: 0.35rem 0.65rem;"
                  >
                    <option [ngValue]="null">-- Central / Global --</option>
                    <option *ngFor="let s of sucursales" [value]="s.id">{{ s.nombre }}</option>
                  </select>
                  <span *ngIf="u.rol_id === 1" class="badge" style="background: rgba(217, 119, 6, 0.15); color: #d97706;">
                    <i class="fa-solid fa-crown mr-1"></i> Acceso Global
                  </span>
                </td>
                <td>{{ u.telefono || 'N/A' }}</td>
                <td><span class="badge badge-stock"><i class="fa-solid fa-check"></i> Activo</span></td>
                <td style="text-align: right;">
                  <button 
                    type="button" 
                    (click)="eliminarUsuario(u)" 
                    class="btn btn-outline" 
                    style="padding: 0.35rem 0.7rem; font-size: 0.8rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.35);"
                    title="Desactivar usuario '{{ u.nombres }}'"
                  >
                    <i class="fa-solid fa-trash-can mr-1"></i> Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- =================================================================== -->
    <!-- MODAL NUEVA PRENDA: REGISTRAR CON FOTOS POR COLOR Y CANTIDAD INICIAL-->
    <!-- =================================================================== -->
    <div *ngIf="mostrarModalPrenda" class="modal-overlay">
      <div class="modal-content" style="max-width: 780px; max-height: 90vh; overflow-y: auto;">
        
        <div class="flex items-center justify-between mb-4 pb-3 border-b" style="border-color: var(--border-color);">
          <div>
            <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);">
              <i class="fa-solid fa-shirt text-amber-600 mr-2"></i> Registrar Nueva Prenda
            </h3>
            <p class="text-xs" style="color: var(--text-muted);">Información general, fotos por cada color y cantidades de entrada</p>
          </div>
          <button (click)="mostrarModalPrenda = false" class="btn btn-outline" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form (ngSubmit)="guardarPrenda()">
          
          <!-- SECCIÓN 1: SELECCIÓN DE CATEGORÍA POR ETIQUETAS (TAGS/CHIPS) -->
          <div class="p-4 rounded-xl mb-4" style="background: var(--table-th-bg); border: 1.5px solid" [style.border-color]="!prendaForm.categoria_id ? '#ef4444' : 'var(--border-color)'">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold uppercase" [style.color]="!prendaForm.categoria_id ? '#ef4444' : 'var(--accent)'">
                <i class="fa-solid fa-tags mr-1"></i> 1. Categoría de la Prenda *
              </h4>
              <button 
                type="button" 
                (click)="mostrarCrearCategoriaRapida = !mostrarCrearCategoriaRapida"
                class="text-xs font-bold hover:underline flex items-center gap-1"
                style="color: var(--accent); background: none; border: none; cursor: pointer;"
              >
                <i class="fa-solid" [ngClass]="mostrarCrearCategoriaRapida ? 'fa-xmark' : 'fa-plus'"></i>
                {{ mostrarCrearCategoriaRapida ? 'Cerrar' : '+ Nueva Categoría' }}
              </button>
            </div>

            <!-- Mini formulario en línea para crear categoría al vuelo -->
            <div *ngIf="mostrarCrearCategoriaRapida" class="flex gap-2 mb-3 p-3 rounded-xl animate-fade-in" style="background: rgba(245,158,11,0.08); border: 1px dashed var(--accent);">
              <input 
                type="text" 
                [(ngModel)]="nuevaCategoriaRapidaNombre" 
                [ngModelOptions]="{standalone: true}"
                placeholder="Nombre de la nueva categoría (ej: Abrigos de Invierno)..." 
                class="form-input text-xs" 
                style="flex: 1; padding: 0.45rem 0.8rem;"
                (keyup.enter)="crearCategoriaRapida()"
              />
              <button 
                type="button" 
                (click)="crearCategoriaRapida()" 
                class="btn btn-accent" 
                style="font-size: 0.75rem; padding: 0.45rem 0.9rem;"
              >
                <i class="fa-solid fa-plus mr-1"></i> Crear y Usar
              </button>
            </div>

            <p class="text-xs mb-3" style="color: var(--text-muted);">
              Toca una etiqueta para clasificar la prenda y activar sugerencias inteligentes de tallas, colores y cortes:
            </p>

            <!-- Etiquetas / Chips de Categorías -->
            <div class="flex flex-wrap gap-2 mb-1">
              <button 
                type="button"
                *ngFor="let c of categorias"
                (click)="onCategoriaSeleccionada(c.id)"
                class="category-tag-chip"
                [class.selected]="prendaForm.categoria_id === c.id"
              >
                <i *ngIf="prendaForm.categoria_id === c.id" class="fa-solid fa-circle-check text-xs mr-1"></i>
                <i *ngIf="prendaForm.categoria_id !== c.id" class="fa-solid fa-tag text-xs mr-1 opacity-50"></i>
                <span>{{ c.nombre }}</span>
              </button>
            </div>

            <!-- Asistente de Estilo según categoría -->
            <div *ngIf="sugerenciaEstiloPrenda" class="mt-3 p-2.5 rounded-lg flex items-center gap-2 text-xs animate-fade-in" style="background: rgba(245,158,11,0.08); border-left: 3px solid var(--accent); color: var(--text-main);">
              <i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
              <span><strong>Guía de Estilo:</strong> {{ sugerenciaEstiloPrenda }}</span>
            </div>
          </div>

          <!-- SECCIÓN 2: INFORMACIÓN GENERAL -->
          <div class="p-4 rounded-xl mb-4" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase mb-3" style="color: var(--accent);">
              <i class="fa-solid fa-circle-info mr-1"></i> 2. Detalles de la Prenda
            </h4>

            <div class="form-group mb-3">
              <label class="form-label text-xs">Nombre de la Prenda *</label>
              <input 
                type="text" 
                [(ngModel)]="prendaForm.nombre" 
                name="nombre" 
                required 
                [placeholder]="nombrePlaceholderPrenda" 
                class="form-input" 
              />
            </div>

            <div class="grid grid-cols-2 gap-4 mb-3">
              <div class="form-group mb-0">
                <label class="form-label text-xs">Precio Base (Bs.) *</label>
                <input type="number" step="0.5" [(ngModel)]="prendaForm.precio_base" name="precio_base" required placeholder="180.00" class="form-input" />
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">Empresa Proveedora</label>
                <select [(ngModel)]="prendaForm.proveedor_id" name="proveedor_id" class="form-select">
                  <option *ngFor="let pr of proveedores" [value]="pr.id">{{ pr.nombre }}</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-3">
              <div class="form-group mb-0">
                <div class="flex items-center justify-between mb-1">
                  <label class="form-label text-xs mb-0">Foto Oficial de Portada (URL)</label>
                  <span *ngIf="prendaForm.imagen_url" class="text-xs" style="color: var(--accent);"><i class="fa-solid fa-eye"></i> Vista previa</span>
                </div>
                <div class="flex gap-2 items-center">
                  <input type="url" [(ngModel)]="prendaForm.imagen_url" (input)="onPrendaUrlChange()" (blur)="onPrendaUrlChange()" name="imagen_url" placeholder="https://images.unsplash.com/... o enlace de imagen" class="form-input" style="flex: 1;" />
                  <div *ngIf="prendaForm.imagen_url" style="width: 42px; height: 42px; min-width: 42px; border-radius: 6px; overflow: hidden; border: 1.5px solid var(--accent); background: var(--table-th-bg); display: flex; align-items: center; justify-content: center;">
                    <img [src]="prendaForm.imagen_url" referrerpolicy="no-referrer" (error)="onImgError($event)" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>
                </div>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">Género de la Prenda</label>
                <select [(ngModel)]="prendaForm.genero" name="genero" class="form-input">
                  <option value="Unisex">Unisex / Ambos</option>
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Niños">Niños</option>
                </select>
              </div>
            </div>

            <div class="form-group mb-3">
              <label class="form-label text-xs">URL Modelo 3D / Realidad Aumentada (.glb)</label>
              <input type="url" [(ngModel)]="prendaForm.modelo_ar_url" name="modelo_ar_url" placeholder="https://modelviewer.dev/shared-assets/models/Astronaut.glb" class="form-input" />
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">Descripción de la Prenda (Opcional)</label>
              <textarea [(ngModel)]="prendaForm.descripcion" name="descripcion" rows="2" placeholder="Detalles de confección, tela o estilo..." class="form-input" style="resize: vertical;"></textarea>
            </div>
          </div>

          <!-- Botones de Acción -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t" style="border-color: var(--border-color);">
            <button type="button" (click)="mostrarModalPrenda = false" class="btn btn-outline">Cancelar</button>
            <button type="submit" [disabled]="guardando || !esPrendaValida()" class="btn btn-primary" style="padding: 0.6rem 1.5rem;">
              <span *ngIf="guardando"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Guardando prenda...</span>
              <span *ngIf="!guardando"><i class="fa-solid fa-check mr-1"></i> Guardar Prenda</span>
            </button>
          </div>

        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: GESTIÓN DE FOTOS POR COLOR Y CANTIDADES DE STOCK (PRENDA)    -->
    <!-- =================================================================== -->
    <div *ngIf="mostrarModalGestionPrenda && prendaGestion" class="modal-overlay">
      <div class="modal-content" style="max-width: 860px; max-height: 90vh; overflow-y: auto;">
        
        <!-- Header -->
        <div class="flex items-center justify-between mb-5 pb-4 border-b" style="border-color: var(--border-color);">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge" style="background: var(--table-th-bg); color: var(--accent); border: 1px solid var(--border-color);">ID: #{{ prendaGestion.id }}</span>
              <span class="badge badge-stock">Prenda Activa</span>
            </div>
            <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);">
              <i class="fa-solid fa-shirt text-amber-600 mr-2"></i> {{ prendaGestion.nombre }}
            </h3>
            <p class="text-xs" style="color: var(--text-muted);">Administra la foto principal, la foto por cada color y registra cantidades de stock que entran</p>
          </div>
          <button (click)="cerrarModalGestionPrenda()" class="btn btn-outline" style="padding: 0.4rem 0.7rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- SECCIÓN 1: FOTO GENERAL DE LA PRENDA -->
        <div class="p-5 rounded-xl mb-6" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
          <h4 class="text-xs font-bold uppercase mb-3" style="color: var(--accent);">
            <i class="fa-solid fa-image mr-1.5"></i> 1. Fotografía de Portada General
          </h4>
          <div class="flex gap-4 items-center">
            <img [src]="prendaGestion.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200'" [alt]="prendaGestion.nombre" referrerpolicy="no-referrer" (error)="onImgError($event)" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1.5px solid var(--border-color);" />
            <div class="flex-1">
              <label class="form-label text-xs">URL de la Imagen General (Catálogo / Portada)</label>
              <div class="flex gap-2">
                <input type="url" [(ngModel)]="prendaGestion.imagen_url" (blur)="prendaGestion.imagen_url = limpiarUrlImagen(prendaGestion.imagen_url)" placeholder="https://images.unsplash.com/... o enlace de imagen" class="form-input" style="padding: 0.45rem 0.75rem;" />
                <button type="button" (click)="guardarFotoGeneral()" class="btn btn-primary" style="padding: 0.45rem 0.9rem; font-size: 0.8rem; white-space: nowrap;">
                  <i class="fa-solid fa-floppy-disk mr-1"></i> Guardar Foto
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 2: FOTOGRAFÍAS DEDICADAS POR CADA COLOR -->
        <div class="p-5 rounded-xl mb-6" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="text-xs font-bold uppercase" style="color: var(--accent);">
                <i class="fa-solid fa-palette mr-1.5"></i> 2. Fotografías por Variante de Color
              </h4>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                Pega la URL de la prenda en cada color para que el usuario la vea cambiar de inmediato en la tienda al pulsar ese color.
              </p>
            </div>
            <button type="button" (click)="guardarFotosColores()" class="btn btn-primary" style="padding: 0.4rem 0.9rem; font-size: 0.8rem;">
              <i class="fa-solid fa-check mr-1"></i> Guardar Fotos de Colores
            </button>
          </div>

          <div *ngIf="cargandoVariantes" class="text-center py-6">
            <i class="fa-solid fa-circle-notch fa-spin text-xl" style="color: var(--accent);"></i>
            <p class="text-xs mt-2" style="color: var(--text-muted);">Cargando colores y fotos asociadas...</p>
          </div>

          <div *ngIf="!cargandoVariantes" class="flex flex-col gap-3">
            <div *ngFor="let col of coloresPrendaGestion" class="p-3.5 rounded-xl flex items-center gap-4" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <div class="flex items-center gap-3" style="min-width: 170px;">
                <span class="color-dot-indicator" [style.background-color]="col.color_hex" style="width: 22px; height: 22px; min-width: 22px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.25);"></span>
                <div>
                  <h5 class="font-bold text-sm" style="color: var(--text-main); margin: 0;">{{ col.color_nombre }}</h5>
                  <span class="text-xs" style="color: var(--text-muted);">Tallas: {{ col.tallas_disponibles.join(', ') }}</span>
                </div>
              </div>

              <img [src]="col.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100'" [alt]="col.color_nombre" referrerpolicy="no-referrer" (error)="onImgError($event)" style="width: 48px; height: 48px; min-width: 48px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" />

              <div class="flex-1">
                <input 
                  type="url" 
                  [(ngModel)]="col.imagen_url" 
                  (blur)="col.imagen_url = limpiarUrlImagen(col.imagen_url)"
                  placeholder="URL imagen de la prenda en color {{ col.color_nombre }} (https://...)" 
                  class="form-input" 
                  style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" 
                />
              </div>
            </div>
          </div>
        </div>

        <!-- SECCIÓN 3: REGISTRAR ENTRADA DE STOCK ("LAS CANTIDADES QUE ENTRAN") -->
        <div class="p-5 rounded-xl mb-6" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
          <h4 class="text-xs font-bold uppercase mb-2" style="color: var(--accent);">
            <i class="fa-solid fa-boxes-stacked mr-1.5"></i> 3. Registrar Entrada de Stock ("Cantidades que Entran")
          </h4>
          <p class="text-xs mb-4" style="color: var(--text-muted);">
            Registra el ingreso de nuevas unidades de esta prenda recibidas de fábrica o proveedor a una tienda física.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label class="form-label text-xs">Tienda que Recibe *</label>
              <select [(ngModel)]="stockIngresoForm.sucursal_id" class="form-select text-xs" style="padding: 0.5rem;">
                <option *ngFor="let s of sucursales" [value]="s.id">{{ s.nombre }}</option>
              </select>
            </div>

            <div>
              <label class="form-label text-xs">Aplica a Variante *</label>
              <select [(ngModel)]="stockIngresoForm.variante_id" class="form-select text-xs" style="padding: 0.5rem;">
                <option [ngValue]="null">-- Todas las Variantes (Lote General) --</option>
                <option *ngFor="let v of variantesPrendaGestion" [value]="v.id">
                  Talla {{ v.talla_nombre }} - Color {{ v.color_nombre }} ({{ v.sku }})
                </option>
              </select>
            </div>

            <div>
              <label class="form-label text-xs">Cantidad que Entra (+ Uds) *</label>
              <input type="number" [(ngModel)]="stockIngresoForm.cantidad" min="1" placeholder="Ej: 20" class="form-input text-xs font-bold" style="padding: 0.5rem; color: #10b981;" />
            </div>
          </div>

          <div class="mb-4">
            <label class="form-label text-xs">Observación / Nota de Entrada (Opcional)</label>
            <input type="text" [(ngModel)]="stockIngresoForm.observaciones" placeholder="Ej: Recepción de lote #402 - Telas y Confecciones Andinas" class="form-input text-xs" style="padding: 0.45rem 0.75rem;" />
          </div>

          <div class="flex items-center justify-between pt-3 border-t" style="border-color: var(--border-color);">
            <span class="text-xs font-bold" style="color: #10b981;">
              <i class="fa-solid fa-plus-circle mr-1"></i> Se incrementará el stock disponible en la tienda seleccionada
            </span>
            <button 
              type="button" 
              (click)="ejecutarIngresoStock()" 
              [disabled]="guardandoStock || stockIngresoForm.cantidad <= 0" 
              class="btn btn-primary"
              style="padding: 0.5rem 1.2rem; font-size: 0.85rem;"
            >
              <i *ngIf="!guardandoStock" class="fa-solid fa-box-open mr-1.5"></i>
              <i *ngIf="guardandoStock" class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>
              <span>{{ guardandoStock ? 'Registrando ingreso...' : 'Ingresar ' + (stockIngresoForm.cantidad || 0) + ' Unidades' }}</span>
            </button>
          </div>
        </div>

        <!-- SECCIÓN 4: RESUMEN DEL INVENTARIO ACTUAL DE LA PRENDA EN TODAS LAS TIENDAS -->
        <div class="p-5 rounded-xl" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
          <h4 class="text-xs font-bold uppercase mb-3" style="color: var(--text-main);">
            <i class="fa-solid fa-warehouse mr-1.5"></i> 4. Existencias Actuales en Tiendas Físicas
          </h4>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div *ngFor="let s of sucursales" class="p-3 rounded-lg" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <span class="text-xs text-muted block mb-1">{{ s.nombre }}</span>
              <div class="flex items-center justify-between">
                <span class="text-base font-bold" style="color: var(--accent);">
                  {{ getStockPrendaPorSucursal(s.id) }} uds. disponibles
                </span>
                <span class="badge badge-stock text-xs">En Tienda</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- MODAL: REGISTRAR EMPLEADO -->
    <div *ngIf="mostrarModalUsuario" class="modal-overlay">
      <div class="modal-content">
        <div class="flex items-center justify-between mb-6 pb-4 border-b" style="border-color: var(--border-color);">
          <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);"><i class="fa-solid fa-user-plus text-amber-600 mr-2"></i> Crear Empleado Interno</h3>
          <button (click)="mostrarModalUsuario = false" class="btn btn-outline" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form (ngSubmit)="guardarUsuario()">
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Nombres *</label>
              <input type="text" [(ngModel)]="usuarioForm.nombres" name="nombres" required placeholder="Mario" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Apellidos *</label>
              <input type="text" [(ngModel)]="usuarioForm.apellidos" name="apellidos" required placeholder="Vargas" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Correo Electrónico *</label>
            <input type="email" [(ngModel)]="usuarioForm.email" name="email" required placeholder="mario@fashionstore.com" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Contraseña de Acceso *</label>
            <input type="password" [(ngModel)]="usuarioForm.password" name="password" required placeholder="••••••••" class="form-input" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Rol Asignado *</label>
              <select [(ngModel)]="usuarioForm.rol_id" name="rol_id" required class="form-select">
                <option *ngFor="let r of roles" [value]="r.id">{{ r.nombre }}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Sucursal de Trabajo</label>
              <select [(ngModel)]="usuarioForm.sucursal_id" name="sucursal_id" class="form-select">
                <option [ngValue]="null">-- Central / Todas --</option>
                <option *ngFor="let s of sucursales" [value]="s.id">{{ s.nombre }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Teléfono Móvil</label>
            <input type="text" [(ngModel)]="usuarioForm.telefono" name="telefono" placeholder="77889900" class="form-input" />
          </div>

          <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t" style="border-color: var(--border-color);">
            <button type="button" (click)="mostrarModalUsuario = false" class="btn btn-outline">Cancelar</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Registrar Empleado</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: REGISTRAR SUCURSAL -->
    <div *ngIf="mostrarModalSucursal" class="modal-overlay">
      <div class="modal-content">
        <div class="flex items-center justify-between mb-6 pb-4 border-b" style="border-color: var(--border-color);">
          <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);"><i class="fa-solid fa-shop text-amber-600 mr-2"></i> Nueva Sucursal Física</h3>
          <button (click)="mostrarModalSucursal = false" class="btn btn-outline" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form (ngSubmit)="guardarSucursal()">
          <div class="form-group">
            <label class="form-label">Nombre de Sucursal *</label>
            <input type="text" [(ngModel)]="sucursalForm.nombre" name="nombre" required placeholder="Ej: Sucursal Cine Center Cochabamba" class="form-input" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Ciudad *</label>
              <select [(ngModel)]="sucursalForm.ciudad_id" name="ciudad_id" required class="form-select">
                <option [value]="1">La Paz</option>
                <option [value]="2">Santa Cruz</option>
                <option [value]="3">Cochabamba</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" [(ngModel)]="sucursalForm.telefono" name="telefono" placeholder="44556677" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Dirección Física *</label>
            <input type="text" [(ngModel)]="sucursalForm.direccion" name="direccion" required placeholder="Av. América #789" class="form-input" />
          </div>

          <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t" style="border-color: var(--border-color);">
            <button type="button" (click)="mostrarModalSucursal = false" class="btn btn-outline">Cancelar</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Guardar Sucursal</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .admin-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.75rem 1.45rem;
      border-radius: 0.75rem;
      font-size: 0.925rem;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .admin-tab-btn:hover {
      background-color: var(--table-hover-bg);
      color: var(--text-main);
    }
    .tab-btn-active {
      background-color: var(--primary) !important;
      color: var(--primary-text) !important;
      border-color: var(--primary) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    /* Chips de Filtro por Categoría en Tabla Principal */
    .category-filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-muted);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .category-filter-chip:hover {
      border-color: var(--accent);
      color: var(--text-main);
    }
    .category-filter-chip.active {
      background: rgba(245, 158, 11, 0.15);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 700;
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.2);
    }
    .chip-count {
      font-size: 0.7rem;
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
    }
    .category-filter-chip.active .chip-count {
      background: var(--accent);
      color: #18181b;
      font-weight: 800;
    }

    /* Chips de Selección de Categoría en Modal */
    .category-tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1.1rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      border: 1.5px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-main);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .category-tag-chip:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    .category-tag-chip.selected {
      background: rgba(245, 158, 11, 0.18);
      border-color: #f59e0b;
      color: #f59e0b;
      font-weight: 700;
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.25);
    }

    /* Botones de Lote Rápido de Stock */
    .batch-preset-btn {
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .batch-preset-btn:hover {
      border-color: var(--accent);
      color: var(--text-main);
    }
    .batch-preset-btn.selected {
      background: #f59e0b;
      border-color: #f59e0b;
      color: #18181b;
      font-weight: 800;
    }

    /* Estilos de la Matriz de Mercadería */
    .matrix-table {
      border-collapse: separate;
      border-spacing: 6px;
    }
    .matrix-cell-input {
      width: 52px;
      text-align: center;
      padding: 0.35rem 0.2rem;
      border-radius: 6px;
      border: 1.5px solid var(--border-color);
      background: var(--table-th-bg);
      color: var(--text-main);
      font-weight: 800;
      font-size: 0.88rem;
      transition: all 0.15s ease;
    }
    .matrix-cell-input:focus {
      border-color: var(--accent);
      outline: none;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
    }
    .matrix-btn-minus, .matrix-btn-plus {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 5px;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 800;
      transition: all 0.15s ease;
    }
    .matrix-btn-minus:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border-color: #ef4444;
    }
    .matrix-btn-plus:hover {
      background: rgba(245, 158, 11, 0.2);
      color: var(--accent);
      border-color: var(--accent);
    }
    .color-swatch-btn {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .color-swatch-btn:hover {
      transform: scale(1.25);
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }

    /* Estilos del Asistente Guiado de Lotes */
    .step-badge {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.85rem;
      transition: all 0.2s ease;
    }
    .talla-card {
      padding: 1rem;
      border-radius: 14px;
      background: var(--table-th-bg);
      border: 1.5px solid var(--border-color);
      transition: all 0.2s ease;
    }
    .talla-card.has-quantity {
      border-color: var(--accent);
      background: rgba(245, 158, 11, 0.08);
      box-shadow: 0 4px 14px rgba(245, 158, 11, 0.15);
    }
    .stepper-nav-btn {
      cursor: pointer;
      background: transparent;
      border: none;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.35rem 0.65rem;
      border-radius: 10px;
      transition: all 0.15s ease;
    }
    .stepper-nav-btn:hover:not(:disabled) {
      background: var(--card-bg);
    }

    /* Quitar flechas arriba y abajo de los inputs de número (solo ingreso manual) */
    input[type=number]::-webkit-inner-spin-button, 
    input[type=number]::-webkit-outer-spin-button { 
      -webkit-appearance: none !important; 
      margin: 0 !important; 
    }
    input[type=number] {
      -moz-appearance: textfield !important;
      appearance: textfield !important;
    }
  `]
})
export class AdminPanelComponent implements OnInit {
  private adminService = inject(AdminService);
  private productoService = inject(ProductoService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private router = inject(Router);

  activeTab: 'prendas' | 'atributos' | 'sucursales' | 'proveedores' | 'usuarios' | 'alertas' | 'reportes' = 'prendas';
  private alertaService = inject(AlertaService);
  alertas: AlertaReabastecimiento[] = [];
  alertasLoading = false;
  categoriaFiltroId: number | null = null;
  mostrarCrearCategoriaRapida: boolean = false;
  nuevaCategoriaRapidaNombre: string = '';
  nombrePlaceholderPrenda: string = 'Ej: Polera Heavy Cotton Oversize';
  sugerenciaEstiloPrenda: string = '';

  // --- Matriz de Mercadería por Categoría & Flujo Unificado ---
  modoNuevaCategoria: boolean = false;
  nuevaCategoriaInputNombre: string = '';
  mostrarModalOtroColor: boolean = false;
  nuevoOtroColorNombre: string = '';
  nuevoOtroColorHex: string = '#10B981';
  coloresPaletaRapida = [
    { nombre: 'Verde Esmeralda', hex: '#10B981' },
    { nombre: 'Azul Celeste', hex: '#38BDF8' },
    { nombre: 'Amarillo Mostaza', hex: '#F59E0B' },
    { nombre: 'Rosado Pastel', hex: '#F472B6' },
    { nombre: 'Morado Lavanda', hex: '#A855F7' },
    { nombre: 'Naranja Cobre', hex: '#F97316' },
    { nombre: 'Marrón Café', hex: '#78350F' },
    { nombre: 'Verde Olivo', hex: '#4D7C0F' },
    { nombre: 'Vino Tinto', hex: '#881337' },
    { nombre: 'Turquesa', hex: '#14B8A6' }
  ];

  // Fijar Cantidad Total de Prendas del Lote (Distribución Controlada en Pasos)
  pasoLote: 1 | 2 | 3 = 1;
  cantidadTotalLoteInput: number | null = null;
  cantidadTotalLote: number = 0;
  loteFijado: boolean = false;
  cantidadesPorTalla: { [tallaId: number]: number } = {};

  categoriaMatrizId: number | null = null;
  productoMatrizId: number | null = null;
  sucursalMatrizId: number = 1;
  observacionesMatriz: string = '';
  matrizCantidades: { [colorId: number]: { [tallaId: number]: number } } = {};
  tallasMatrizActivas: Talla[] = [];
  coloresMatrizActivos: Color[] = [];
  guardandoMatriz: boolean = false;
  mostrarGestionAtributosBase: boolean = false;

  get productosFiltrados(): Producto[] {
    if (this.categoriaFiltroId === null) return this.productos;
    return this.productos.filter(p => p.categoria_id === this.categoriaFiltroId || (p.categoria && p.categoria.id === this.categoriaFiltroId));
  }

  productos: Producto[] = [];
  categorias: Categoria[] = [];
  tallas: Talla[] = [];
  colores: Color[] = [];
  sucursales: any[] = [
    { id: 1, nombre: 'Sucursal Central La Paz', direccion: 'Av. 16 de Julio #1234, El Prado', ciudad: { id: 1, nombre: 'La Paz', pais: 'Bolivia' } },
    { id: 2, nombre: 'Sucursal Equipetrol Santa Cruz', direccion: 'Av. San Martín #456, Equipetrol', ciudad: { id: 2, nombre: 'Santa Cruz', pais: 'Bolivia' } },
    { id: 3, nombre: 'Sucursal Cine Center Cochabamba', direccion: 'Av. Ramón Rivero #250', ciudad: { id: 3, nombre: 'Cochabamba', pais: 'Bolivia' } }
  ];
  proveedores: any[] = [];
  temporadas: any[] = [];
  roles: any[] = [];
  usuarios: any[] = [];

  // Tallas y Colores predeterminados para selección rápida
  presetTallas: string[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '28', '30', '32', '34', '36', '38', 'Única'];
  presetColores = [
    { nombre: 'Negro', hex: '#000000' },
    { nombre: 'Blanco', hex: '#FFFFFF' },
    { nombre: 'Azul Marino', hex: '#0F172A' },
    { nombre: 'Rojo Borgoña', hex: '#881337' },
    { nombre: 'Café Chocolate', hex: '#451A03' },
    { nombre: 'Beige Arena', hex: '#D4B996' },
    { nombre: 'Verde Oliva', hex: '#365314' },
    { nombre: 'Gris Plomo', hex: '#4B5563' },
    { nombre: 'Rosa Pastel', hex: '#F472B6' },
    { nombre: 'Mostaza Ocre', hex: '#D97706' },
    { nombre: 'Azul Celeste', hex: '#38BDF8' },
    { nombre: 'Verde Esmeralda', hex: '#059669' }
  ];

  // Selección en modal de Prenda
  tallasSeleccionadasIds: number[] = [];
  coloresSeleccionadosIds: number[] = [];
  fotosColoresNuevoProducto: { [colorId: number]: string } = {};
  stockInicialNuevoProducto: number = 15;

  // Estados de Modales
  mostrarModalPrenda: boolean = false;
  mostrarModalUsuario: boolean = false;
  mostrarModalSucursal: boolean = false;
  mostrarModalGestionPrenda: boolean = false;
  guardando: boolean = false;
  guardandoStock: boolean = false;
  cargandoVariantes: boolean = false;

  private _successMessage: string = '';
  get successMessage(): string {
    return this._successMessage;
  }
  set successMessage(val: string) {
    this._successMessage = val;
    if (val) {
      this.toastService.success('Operación Exitosa', val);
    }
  }

  private _errorMessage: string = '';
  get errorMessage(): string {
    return this._errorMessage;
  }
  set errorMessage(val: string) {
    this._errorMessage = val;
    if (val) {
      this.toastService.error('Aviso del Sistema', val);
    }
  }

  // Formulario de Prenda
  prendaForm = {
    nombre: '',
    descripcion: '',
    precio_base: 180,
    categoria_id: null as number | null,
    proveedor_id: 1,
    imagen_url: '',
    modelo_ar_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    genero: 'Unisex'
  };

  // Prenda actualmente en Gestión de Fotos y Stock
  prendaGestion: any = null;
  variantesPrendaGestion: any[] = [];
  coloresPrendaGestion: {
    color_id: number;
    color_nombre: string;
    color_hex: string;
    imagen_url: string;
    tallas_disponibles: string[];
    variante_ids: number[];
  }[] = [];

  stockIngresoForm = {
    sucursal_id: 1,
    variante_id: null as number | null,
    cantidad: 20,
    observaciones: ''
  };

  usuarioForm = {
    nombres: '',
    apellidos: '',
    email: '',
    password: '',
    rol_id: 2,
    sucursal_id: null as number | null,
    telefono: ''
  };

  sucursalForm = {
    nombre: '',
    ciudad_id: 1,
    direccion: '',
    telefono: ''
  };

  nuevaCategoriaNombre: string = '';
  nuevaTallaNombre: string = '';
  nuevoColorNombre: string = '';
  nuevoColorHex: string = '#000000';

  nuevoProvNombre: string = '';
  nuevoProvContacto: string = '';
  nuevoProvTelefono: string = '';

  nuevaTempNombre: string = '';
  nuevaTempTipo: string = '';

  
  cargarAlertas(): void {
    this.alertasLoading = true;
    this.alertaService.getAlertas().subscribe({
      next: (data) => {
        this.alertas = data;
        this.alertasLoading = false;
      },
      error: (err) => {
        console.error("Error alertas", err);
        this.alertasLoading = false;
      }
    });
  }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn || !this.authService.isAdmin) {
      alert('Acceso denegado. Se requiere cuenta de Administrador.');
      this.router.navigate(['/login']);
      return;
    }
    this.cargarDatosGenerales();
  }

  cargarDatosGenerales(): void {
    this.productoService.getProductos().subscribe({ 
      next: data => {
        this.productos = data || [];
        if (this.categoriaMatrizId !== null && !this.productoMatrizId) {
          const prods = this.getPrendasDeCategoriaMatriz();
          if (prods.length > 0) this.productoMatrizId = prods[0].id;
        }
      } 
    });
    this.productoService.getCategorias().subscribe({ 
      next: data => {
        this.categorias = data || [];
        if (this.categorias.length > 0 && !this.prendaForm.categoria_id) {
          this.prendaForm.categoria_id = this.categorias[0].id;
        }
        if (this.categorias.length > 0 && this.categoriaMatrizId === null) {
          this.seleccionarCategoriaMatriz(this.categorias[0].id);
        }
      }
    });
    this.productoService.getTallas().subscribe({ 
      next: data => {
        this.tallas = data || [];
        if (this.categoriaMatrizId !== null) {
          this.actualizarTallasYColoresMatriz(this.categoriaMatrizId);
        }
      } 
    });
    this.productoService.getColores().subscribe({ 
      next: data => {
        this.colores = data || [];
        if (this.categoriaMatrizId !== null) {
          this.actualizarTallasYColoresMatriz(this.categoriaMatrizId);
        }
      } 
    });
    this.productoService.getSucursales().subscribe({ 
      next: data => {
        if (data && data.length > 0) {
          this.sucursales = data;
        }
        if (this.sucursales.length > 0 && !this.sucursalMatrizId) {
          this.sucursalMatrizId = this.sucursales[0].id;
        }
      },
      error: (err) => {
        console.warn('No se pudo conectar con el endpoint de sucursales, usando sucursales locales:', err);
      }
    });
    this.adminService.getProveedores().subscribe({ 
      next: data => {
        this.proveedores = data || [];
        if (this.proveedores.length > 0) {
          this.prendaForm.proveedor_id = this.proveedores[0].id;
        }
      }
    });
    this.adminService.getTemporadas().subscribe({ next: data => this.temporadas = data || [] });
    this.adminService.getRoles().subscribe({ next: data => this.roles = data || [] });
    this.adminService.getUsuarios().subscribe({ next: data => this.usuarios = data || [] });
  }

  // --- Verificaciones de Atributos ---
  tallaRegistrada(nombre: string): boolean {
    return this.tallas.some(t => t.nombre.trim().toUpperCase() === nombre.trim().toUpperCase());
  }

  colorRegistrado(nombre: string): boolean {
    return this.colores.some(c => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  }

  get tallasPersonalizadas(): Talla[] {
    const set = new Set(this.presetTallas.map(x => x.toUpperCase()));
    return this.tallas.filter(t => !set.has(t.nombre.trim().toUpperCase()));
  }

  get coloresPersonalizados(): Color[] {
    const set = new Set(this.presetColores.map(x => x.nombre.toLowerCase()));
    return this.colores.filter(c => !set.has(c.nombre.trim().toLowerCase()));
  }

  toggleTallaPreset(nombre: string): void {
    const exist = this.tallas.find(t => t.nombre.trim().toUpperCase() === nombre.trim().toUpperCase());
    if (exist) {
      this.eliminarTallaDB(exist.id);
    } else {
      this.adminService.crearTalla({ nombre, orden: this.tallas.length + 1 }).subscribe({
        next: () => this.productoService.getTallas().subscribe(data => this.tallas = data || [])
      });
    }
  }

  eliminarTallaDB(id: number): void {
    this.adminService.eliminarTalla(id).subscribe({
      next: () => this.productoService.getTallas().subscribe(data => this.tallas = data || [])
    });
  }

  toggleColorPreset(pc: { nombre: string; hex: string }): void {
    const exist = this.colores.find(c => c.nombre.trim().toLowerCase() === pc.nombre.trim().toLowerCase());
    if (exist) {
      this.eliminarColorDB(exist.id);
    } else {
      this.adminService.crearColor({ nombre: pc.nombre, codigo_hex: pc.hex }).subscribe({
        next: () => this.productoService.getColores().subscribe(data => this.colores = data || [])
      });
    }
  }

  eliminarColorDB(id: number): void {
    this.adminService.eliminarColor(id).subscribe({
      next: () => this.productoService.getColores().subscribe(data => this.colores = data || [])
    });
  }

  // --- Métodos de la Matriz de Mercadería por Categoría ---
  getCategoriaIcon(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    if (n.includes('polera') || n.includes('camiset') || n.includes('remera') || n.includes('t-shirt')) return 'fa-shirt';
    if (n.includes('camisa') || n.includes('blusa')) return 'fa-shirt';
    if (n.includes('vestid')) return 'fa-person-dress';
    if (n.includes('pantal') || n.includes('jean') || n.includes('short') || n.includes('bermuda')) return 'fa-scissors';
    if (n.includes('abrigo') || n.includes('chaquet') || n.includes('chompa') || n.includes('blazer') || n.includes('saco')) return 'fa-mitten';
    if (n.includes('calzad') || n.includes('zapato') || n.includes('zapatill') || n.includes('bota')) return 'fa-shoe-prints';
    if (n.includes('deport') || n.includes('fitness')) return 'fa-dumbbell';
    return 'fa-tag';
  }

  getPrendasDeCategoriaMatriz(): Producto[] {
    if (this.categoriaMatrizId === null) return [];
    return this.productos.filter(p => p.categoria_id === this.categoriaMatrizId || (p.categoria && p.categoria.id === this.categoriaMatrizId));
  }

  getProductoMatrizNombre(): string {
    if (!this.productoMatrizId) return 'Prenda Seleccionada';
    const p = this.productos.find(x => x.id === this.productoMatrizId);
    return p ? p.nombre : 'Prenda Seleccionada';
  }

  iniciarCrearNuevaCategoria(): void {
    this.modoNuevaCategoria = true;
    this.categoriaMatrizId = null;
    this.productoMatrizId = null;
    this.nuevaCategoriaInputNombre = '';
    this.pasoLote = 1;
    this.loteFijado = false;
    this.cantidadTotalLote = 0;
    this.cantidadTotalLoteInput = null;
    this.cantidadesPorTalla = {};
    this.actualizarTallasYColoresMatriz();
    this.llenarLoteParejo(0);
  }

  cancelarModoNuevaCategoria(): void {
    this.modoNuevaCategoria = false;
    this.nuevaCategoriaInputNombre = '';
    this.pasoLote = 1;
    this.loteFijado = false;
    this.cantidadTotalLote = 0;
    this.cantidadTotalLoteInput = null;
    this.cantidadesPorTalla = {};
    if (this.categorias.length > 0) {
      this.seleccionarCategoriaMatriz(this.categorias[0].id);
    }
  }

  seleccionarCategoriaMatriz(catId: number): void {
    this.modoNuevaCategoria = false;
    this.categoriaMatrizId = catId;
    const prods = this.getPrendasDeCategoriaMatriz();
    if (prods.length > 0) {
      this.productoMatrizId = prods[0].id;
    } else {
      this.productoMatrizId = null;
    }
    this.pasoLote = 1;
    this.loteFijado = false;
    this.cantidadTotalLote = 0;
    this.cantidadTotalLoteInput = null;
    this.cantidadesPorTalla = {};
    this.actualizarTallasYColoresMatriz(catId);
    this.llenarLoteParejo(0);
  }

  onProductoMatrizChange(prodId: number): void {
    this.productoMatrizId = Number(prodId);
  }

  // --- PASO 1: FIJAR CANTIDAD TOTAL DEL LOTE ---
  fijarCantidadLote(): void {
    const cant = Number(this.cantidadTotalLoteInput);
    if (!cant || cant <= 0) {
      this.toastService.warning('Cantidad Inválida', 'Escribe una cantidad total mayor a 0 para el lote de prendas.');
      return;
    }
    this.cantidadTotalLote = cant;
    this.loteFijado = true;
    this.pasoLote = 2;

    if (!this.cantidadesPorTalla) this.cantidadesPorTalla = {};
    for (const t of this.tallasMatrizActivas) {
      if (this.cantidadesPorTalla[t.id] === undefined) {
        this.cantidadesPorTalla[t.id] = 0;
      }
    }
    this.toastService.success('Cantidad Fijada', `Lote fijado en ${cant} prendas. Asigna cuántas van a cada talla sin pasarte de este número.`);
  }

  editarCantidadLote(): void {
    this.pasoLote = 1;
  }

  irAPaso(paso: 1 | 2 | 3): void {
    if (paso === 1) {
      this.pasoLote = 1;
    } else if (paso === 2) {
      if (!this.loteFijado) {
        this.toastService.warning('Paso 1 pendiente', 'Fija la cantidad total del lote primero.');
        return;
      }
      this.pasoLote = 2;
    } else if (paso === 3) {
      if (this.getTotalAsignadoTallas() !== this.cantidadTotalLote) {
        this.toastService.warning('Tallas incompletas', `Debes distribuir exactamente las ${this.cantidadTotalLote} prendas en las tallas antes de pasar a colores.`);
        return;
      }
      this.pasoLote = 3;
    }
  }

  // --- PASO 2: ASIGNACIÓN DE PRENDAS A TALLAS CON TOPE EN VIVO ---
  getTotalAsignadoTallas(): number {
    let sum = 0;
    for (const t of this.tallasMatrizActivas) {
      sum += Number(this.cantidadesPorTalla[t.id]) || 0;
    }
    return sum;
  }

  getPendienteTallas(): number {
    return Math.max(0, this.cantidadTotalLote - this.getTotalAsignadoTallas());
  }

  getCantidadTalla(tallaId: number): number {
    return Number(this.cantidadesPorTalla[tallaId]) || 0;
  }

  setCantidadTalla(tallaId: number, val: any): void {
    if (val === '' || val === null || val === undefined) {
      this.cantidadesPorTalla[tallaId] = 0;
      return;
    }
    const parsed = Math.max(0, parseInt(val, 10) || 0);
    const sumaOtras = this.getTotalAsignadoTallas() - this.getCantidadTalla(tallaId);
    const maxPermitido = Math.max(0, this.cantidadTotalLote - sumaOtras);
    const finalVal = parsed > maxPermitido ? maxPermitido : parsed;
    this.cantidadesPorTalla[tallaId] = finalVal;

    // Si la cuota de la talla disminuyó por debajo de lo asignado en colores, recortar colores
    const sumColores = this.getTotalColorDeTalla(tallaId);
    if (sumColores > finalVal) {
      this.reajustarColoresDeTallaAlMaximo(tallaId, finalVal);
    }
  }

  onTallaInput(event: any, tallaId: number): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      this.cantidadesPorTalla[tallaId] = 0;
      return;
    }
    const parsed = Math.max(0, parseInt(rawVal, 10) || 0);
    const sumaOtras = this.getTotalAsignadoTallas() - this.getCantidadTalla(tallaId);
    const maxPermitido = Math.max(0, this.cantidadTotalLote - sumaOtras);
    const finalVal = parsed > maxPermitido ? maxPermitido : parsed;
    
    this.cantidadesPorTalla[tallaId] = finalVal;
    input.value = finalVal === 0 ? '' : finalVal.toString();

    const sumColores = this.getTotalColorDeTalla(tallaId);
    if (sumColores > finalVal) {
      this.reajustarColoresDeTallaAlMaximo(tallaId, finalVal);
    }
  }

  incrementarTalla(tallaId: number, delta: number): void {
    const actual = this.getCantidadTalla(tallaId);
    this.setCantidadTalla(tallaId, actual + delta);
  }

  avanzarAColores(): void {
    if (this.getTotalAsignadoTallas() !== this.cantidadTotalLote) {
      this.toastService.warning('Tallas Incompletas', `Debes asignar exactamente las ${this.cantidadTotalLote} prendas en las tallas para continuar.`);
      return;
    }
    this.pasoLote = 3;
    this.toastService.success('Tallas Completadas', 'Ahora asigna los colores correspondientes para cada talla.');
  }

  // --- PASO 3: ASIGNACIÓN DE COLORES POR CADA TALLA CON TOPE EN VIVO ---
  get tallasConCantidad(): Talla[] {
    return this.tallasMatrizActivas.filter(t => (this.cantidadesPorTalla[t.id] || 0) > 0);
  }

  getTotalColorDeTalla(tallaId: number): number {
    let sum = 0;
    for (const col of this.coloresMatrizActivos) {
      sum += this.getCantidadMatriz(col.id, tallaId);
    }
    return sum;
  }

  getPendienteColorTalla(tallaId: number): number {
    const cuota = this.getCantidadTalla(tallaId);
    return Math.max(0, cuota - this.getTotalColorDeTalla(tallaId));
  }

  setCantidadColorTalla(colorId: number, tallaId: number, val: any): void {
    if (val === '' || val === null || val === undefined) {
      this.setCantidadMatriz(colorId, tallaId, 0);
      return;
    }
    const parsed = Math.max(0, parseInt(val, 10) || 0);
    const cuotaTalla = this.getCantidadTalla(tallaId);
    const sumaOtrosColores = this.getTotalColorDeTalla(tallaId) - this.getCantidadMatriz(colorId, tallaId);
    const maxPermitido = Math.max(0, cuotaTalla - sumaOtrosColores);
    const finalVal = parsed > maxPermitido ? maxPermitido : parsed;
    this.setCantidadMatriz(colorId, tallaId, finalVal);
  }

  onColorInput(event: any, colorId: number, tallaId: number): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value;
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      this.setCantidadMatriz(colorId, tallaId, 0);
      return;
    }
    const parsed = Math.max(0, parseInt(rawVal, 10) || 0);
    const cuotaTalla = this.getCantidadTalla(tallaId);
    const sumaOtrosColores = this.getTotalColorDeTalla(tallaId) - this.getCantidadMatriz(colorId, tallaId);
    const maxPermitido = Math.max(0, cuotaTalla - sumaOtrosColores);
    const finalVal = parsed > maxPermitido ? maxPermitido : parsed;
    
    this.setCantidadMatriz(colorId, tallaId, finalVal);
    input.value = finalVal === 0 ? '' : finalVal.toString();
  }

  incrementarColorTalla(colorId: number, tallaId: number, delta: number): void {
    const actual = this.getCantidadMatriz(colorId, tallaId);
    this.setCantidadColorTalla(colorId, tallaId, actual + delta);
  }

  private reajustarColoresDeTallaAlMaximo(tallaId: number, maxPermitido: number): void {
    let acumulado = 0;
    for (const col of this.coloresMatrizActivos) {
      const cant = this.getCantidadMatriz(col.id, tallaId);
      if (acumulado + cant <= maxPermitido) {
        acumulado += cant;
      } else {
        const resto = Math.max(0, maxPermitido - acumulado);
        this.setCantidadMatriz(col.id, tallaId, resto);
        acumulado += resto;
      }
    }
  }

  todosLosColoresCompletos(): boolean {
    if (!this.loteFijado || this.cantidadTotalLote <= 0) return false;
    if (this.tallasConCantidad.length === 0) return false;
    for (const t of this.tallasConCantidad) {
      if (this.getTotalColorDeTalla(t.id) !== this.getCantidadTalla(t.id)) {
        return false;
      }
    }
    return this.getGranTotalMatriz() === this.cantidadTotalLote;
  }

  actualizarTallasYColoresMatriz(catId?: number): void {
    // Si la lista de tallas de la BD aún no ha cargado, usamos las base
    if (!this.tallas || this.tallas.length === 0) {
      this.tallas = [
        { id: 2, nombre: 'S', orden: 1 },
        { id: 3, nombre: 'M', orden: 2 },
        { id: 4, nombre: 'L', orden: 3 },
        { id: 17, nombre: 'XL', orden: 4 },
        { id: 18, nombre: '3XL', orden: 5 },
      ];
    }

    // 1. TALLAS PREDETERMINADAS MÁS NORMALES (XS, S, M, L, XL, 2XL, 3XL)
    const std = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL'];
    let matchedTallas = this.tallas.filter(t => std.includes(t.nombre.trim().toUpperCase()));
    if (matchedTallas.length === 0) {
      matchedTallas = this.tallas.slice(0, 6);
    }
    matchedTallas.sort((a, b) => {
      const idxA = std.indexOf(a.nombre.trim().toUpperCase());
      const idxB = std.indexOf(b.nombre.trim().toUpperCase());
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
    this.tallasMatrizActivas = matchedTallas;

    // Si la lista de colores de la BD aún no ha cargado, usamos los base
    if (!this.colores || this.colores.length === 0) {
      this.colores = [
        { id: 1, nombre: 'Negro', codigo_hex: '#000000' },
        { id: 2, nombre: 'Blanco', codigo_hex: '#FFFFFF' },
        { id: 3, nombre: 'Azul Marino', codigo_hex: '#0F172A' },
        { id: 16, nombre: 'Gris Plomo', codigo_hex: '#4B5563' },
        { id: 15, nombre: 'Beige Arena', codigo_hex: '#D4B996' },
        { id: 12, nombre: 'Rojo', codigo_hex: '#EF4444' },
      ];
    }

    // 2. COLORES PREDETERMINADOS MÁS NORMALES
    const normalesNombres = ['negro', 'blanco', 'azul marino', 'gris', 'beige', 'rojo'];
    const normales = this.colores.filter(c => {
      const n = (c.nombre || '').trim().toLowerCase();
      return normalesNombres.some(norm => n.includes(norm));
    });

    const listaBase = normales.length > 0 ? normales : this.colores.slice(0, 6);

    // Mantener también los colores agregados manualmente con "+ Otro Color"
    const idsExistentes = new Set(listaBase.map(c => c.id));
    for (const c of this.coloresMatrizActivos) {
      if (!idsExistentes.has(c.id)) {
        listaBase.push(c);
        idsExistentes.add(c.id);
      }
    }

    this.coloresMatrizActivos = listaBase;

    // 3. Inicializar matriz de cantidades y mapa de tallas
    if (!this.cantidadesPorTalla) this.cantidadesPorTalla = {};
    for (const t of this.tallasMatrizActivas) {
      if (this.cantidadesPorTalla[t.id] === undefined) {
        this.cantidadesPorTalla[t.id] = 0;
      }
    }

    if (!this.matrizCantidades) this.matrizCantidades = {};
    for (const col of this.coloresMatrizActivos) {
      if (!this.matrizCantidades[col.id]) {
        this.matrizCantidades[col.id] = {};
      }
      for (const t of this.tallasMatrizActivas) {
        if (this.matrizCantidades[col.id][t.id] === undefined) {
          this.matrizCantidades[col.id][t.id] = 0;
        }
      }
    }
  }

  // --- Selección de Color desde Paleta y Botón Otro Color ---
  seleccionarColorPaleta(color: { nombre: string; hex: string }): void {
    this.nuevoOtroColorNombre = color.nombre;
    this.nuevoOtroColorHex = color.hex;
  }

  agregarOtroColorMatriz(): void {
    if (!this.nuevoOtroColorNombre.trim()) {
      this.toastService.warning('Nombre requerido', 'Escribe el nombre del nuevo color.');
      return;
    }
    const nombre = this.nuevoOtroColorNombre.trim();
    const hex = this.nuevoOtroColorHex || '#10B981';

    // Si ya existe en la lista general de colores
    const existente = this.colores.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) {
      if (!this.coloresMatrizActivos.some(c => c.id === existente.id)) {
        this.coloresMatrizActivos.push(existente);
        if (!this.matrizCantidades[existente.id]) this.matrizCantidades[existente.id] = {};
        for (const t of this.tallasMatrizActivas) {
          this.matrizCantidades[existente.id][t.id] = 0;
        }
      }
      this.mostrarModalOtroColor = false;
      this.nuevoOtroColorNombre = '';
      this.toastService.success('Color Activado', `Color "${nombre}" añadido a la tabla.`);
      return;
    }

    // Si no existe, crearlo en la BD mediante adminService
    this.adminService.crearColor({ nombre, codigo_hex: hex }).subscribe({
      next: (colorCreado) => {
        this.colores.push(colorCreado);
        this.coloresMatrizActivos.push(colorCreado);
        if (!this.matrizCantidades[colorCreado.id]) this.matrizCantidades[colorCreado.id] = {};
        for (const t of this.tallasMatrizActivas) {
          this.matrizCantidades[colorCreado.id][t.id] = 0;
        }
        this.mostrarModalOtroColor = false;
        this.nuevoOtroColorNombre = '';
        this.toastService.success('¡Color Creado!', `Color "${nombre}" agregado a la tabla con su tono.`);
      },
      error: (err) => {
        this.toastService.error('Error al Crear Color', err.error?.detail || 'No se pudo registrar el color.');
      }
    });
  }

  getCantidadMatriz(colorId: number, tallaId: number): number {
    return this.matrizCantidades[colorId]?.[tallaId] || 0;
  }

  setCantidadMatriz(colorId: number, tallaId: number, val: any): void {
    if (!this.matrizCantidades[colorId]) {
      this.matrizCantidades[colorId] = {};
    }
    const num = Math.max(0, parseInt(val, 10) || 0);
    this.matrizCantidades[colorId][tallaId] = num;
  }

  incrementarCantidad(colorId: number, tallaId: number, delta: number): void {
    const cur = this.getCantidadMatriz(colorId, tallaId);
    this.setCantidadMatriz(colorId, tallaId, cur + delta);
  }

  llenarLoteParejo(cantidad: number): void {
    for (const col of this.coloresMatrizActivos) {
      if (!this.matrizCantidades[col.id]) {
        this.matrizCantidades[col.id] = {};
      }
      for (const t of this.tallasMatrizActivas) {
        this.matrizCantidades[col.id][t.id] = cantidad;
      }
    }
  }

  getTotalPorColor(colorId: number): number {
    let sum = 0;
    for (const t of this.tallasMatrizActivas) {
      sum += this.getCantidadMatriz(colorId, t.id);
    }
    return sum;
  }

  getTotalPorTalla(tallaId: number): number {
    let sum = 0;
    for (const col of this.coloresMatrizActivos) {
      sum += this.getCantidadMatriz(col.id, tallaId);
    }
    return sum;
  }

  getGranTotalMatriz(): number {
    let total = 0;
    for (const col of this.coloresMatrizActivos) {
      for (const t of this.tallasMatrizActivas) {
        total += this.getCantidadMatriz(col.id, t.id);
      }
    }
    return total;
  }

  // --- Guardado Unificado (Para Nueva Categoría o Categoría Existente) ---
  guardarIngresoDirecto(): void {
    const total = this.getGranTotalMatriz();
    if (total <= 0) {
      this.toastService.warning('Cantidades Vacías', 'Ingresa al menos una cantidad mayor a 0 en la tabla.');
      return;
    }

    if (this.loteFijado && !this.todosLosColoresCompletos()) {
      this.toastService.warning('Distribución Incompleta', `Debes completar la asignación exacta de las ${this.cantidadTotalLote} prendas en los colores.`);
      return;
    }

    const items: { talla_id: number; color_id: number; cantidad: number }[] = [];
    for (const col of this.coloresMatrizActivos) {
      for (const t of this.tallasMatrizActivas) {
        const cant = this.getCantidadMatriz(col.id, t.id);
        if (cant > 0) {
          items.push({ talla_id: t.id, color_id: col.id, cantidad: cant });
        }
      }
    }

    this.guardandoMatriz = true;

    // CASO 1: Modo Nueva Categoría
    if (this.modoNuevaCategoria) {
      if (!this.nuevaCategoriaInputNombre.trim()) {
        this.guardandoMatriz = false;
        this.toastService.warning('Nombre requerido', 'Escribe el nombre de la nueva categoría.');
        return;
      }

      const nombreCat = this.nuevaCategoriaInputNombre.trim();
      this.adminService.crearCategoria({ nombre: nombreCat }).subscribe({
        next: (catCreada) => {
          this.categorias.push(catCreada);
          this.categoriaMatrizId = catCreada.id;

          const provId = this.proveedores.length > 0 ? this.proveedores[0].id : 1;
          this.adminService.crearProducto({
            nombre: nombreCat,
            categoria_id: catCreada.id,
            proveedor_id: provId,
            precio_base: 120.0,
            descripcion: `Prendas de la categoría ${nombreCat}`,
            genero: 'Unisex',
            imagen_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
            variantes: []
          }).subscribe({
            next: (prodCreado) => {
              this.productos.push(prodCreado);
              this.productoMatrizId = prodCreado.id;
              this.ejecutarRegistroMatriz(
                prodCreado.id,
                items,
                total,
                `¡Categoría "${nombreCat}" creada y +${total} prendas ingresadas con éxito!`
              );
              this.modoNuevaCategoria = false;
              this.nuevaCategoriaInputNombre = '';
            },
            error: (errProd) => {
              this.guardandoMatriz = false;
              this.toastService.error('Error al registrar prenda base', errProd.error?.detail || 'No se pudo crear la prenda.');
            }
          });
        },
        error: (errCat) => {
          this.guardandoMatriz = false;
          this.toastService.error('Error al crear categoría', errCat.error?.detail || 'No se pudo crear la categoría.');
        }
      });
      return;
    }

    // CASO 2: Categoría Existente
    if (this.categoriaMatrizId === null) {
      this.guardandoMatriz = false;
      this.toastService.warning('Categoría no seleccionada', 'Selecciona una categoría primero.');
      return;
    }

    // Si la categoría existente no tiene prenda aún, la creamos automáticamente
    if (!this.productoMatrizId) {
      const cat = this.categorias.find(c => c.id === this.categoriaMatrizId);
      const catNom = cat ? cat.nombre : 'Prenda General';
      const provId = this.proveedores.length > 0 ? this.proveedores[0].id : 1;

      this.adminService.crearProducto({
        nombre: catNom,
        categoria_id: this.categoriaMatrizId,
        proveedor_id: provId,
        precio_base: 120.0,
        descripcion: `Prendas de la categoría ${catNom}`,
        genero: 'Unisex',
        imagen_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
        variantes: []
      }).subscribe({
        next: (prodCreado) => {
          this.productos.push(prodCreado);
          this.productoMatrizId = prodCreado.id;
          this.ejecutarRegistroMatriz(
            prodCreado.id,
            items,
            total,
            `¡+${total} prendas ingresadas a "${catNom}" con éxito!`
          );
        },
        error: (err) => {
          this.guardandoMatriz = false;
          this.toastService.error('Error al registrar', err.error?.detail || 'No se pudo crear la prenda base.');
        }
      });
    } else {
      const prodNom = this.getProductoMatrizNombre();
      this.ejecutarRegistroMatriz(
        this.productoMatrizId,
        items,
        total,
        `¡+${total} prendas ingresadas para "${prodNom}" con éxito!`
      );
    }
  }

  private ejecutarRegistroMatriz(productoId: number, items: any[], total: number, mensajeExito: string): void {
    this.adminService.registrarIngresoMatriz(productoId, {
      sucursal_id: Number(this.sucursalMatrizId),
      items: items,
      observaciones: this.observacionesMatriz ? this.observacionesMatriz.trim() : undefined
    }).subscribe({
      next: (res) => {
        this.guardandoMatriz = false;
        this.toastService.success('¡Lote Registrado con Éxito!', mensajeExito);
        this.llenarLoteParejo(0);
        this.observacionesMatriz = '';
        this.loteFijado = false;
        this.cantidadTotalLote = 0;
        this.cantidadTotalLoteInput = null;
        this.cantidadesPorTalla = {};
        this.pasoLote = 1;
        this.cargarDatosGenerales();
      },
      error: (err) => {
        this.guardandoMatriz = false;
        this.toastService.error('Error al Registrar Mercadería', err.error?.detail || 'No se pudo guardar la entrada en el inventario.');
      }
    });
  }

  // --- Helpers de Clasificación por Categorías ---
  getPrendasPorCategoriaCount(catId: number): number {
    return this.productos.filter(p => p.categoria_id === catId || (p.categoria && p.categoria.id === catId)).length;
  }

  getCategoriaNombre(catId: number | null): string {
    if (catId === null) return 'Todas las Categorías';
    const c = this.categorias.find(x => x.id === catId);
    return c ? c.nombre : 'Categoría';
  }

  onCategoriaSeleccionada(categoriaId: number): void {
    this.prendaForm.categoria_id = categoriaId;
    const cat = this.categorias.find(c => c.id === categoriaId);
    if (!cat) return;
    const catLower = cat.nombre.toLowerCase();

    if (catLower.includes('polera') || catLower.includes('camiset') || catLower.includes('remera') || catLower.includes('t-shirt')) {
      this.nombrePlaceholderPrenda = 'Ej: Polera Heavy Cotton Oversize de Temporada';
      this.sugerenciaEstiloPrenda = 'Cortes oversize, cuello redondo y gramaje 240g/m²';
      this.autoSeleccionarTallas(['S', 'M', 'L', 'XL']);
      this.autoSeleccionarColores(['Negro', 'Blanco', 'Azul Marino', 'Gris Plomo']);
    } else if (catLower.includes('camisa') || catLower.includes('blusa')) {
      this.nombrePlaceholderPrenda = 'Ej: Camisa Oxford Slim Fit Cuello Italiano';
      this.sugerenciaEstiloPrenda = 'Telas 100% algodón, corte slim fit o lino fino';
      this.autoSeleccionarTallas(['S', 'M', 'L', 'XL']);
      this.autoSeleccionarColores(['Blanco', 'Azul Celeste', 'Azul Marino', 'Rosa Pastel']);
    } else if (catLower.includes('vestid')) {
      this.nombrePlaceholderPrenda = 'Ej: Vestido Midi Satinado Escote Halter';
      this.sugerenciaEstiloPrenda = 'Acabado satinado, corte midi o fiesta de noche';
      this.autoSeleccionarTallas(['XS', 'S', 'M', 'L']);
      this.autoSeleccionarColores(['Negro', 'Rojo Borgoña', 'Verde Esmeralda', 'Rosa Pastel']);
    } else if (catLower.includes('pantal') || catLower.includes('jean') || catLower.includes('short') || catLower.includes('bermuda')) {
      this.nombrePlaceholderPrenda = 'Ej: Pantalón Chino Stretch Slim Fit';
      this.sugerenciaEstiloPrenda = 'Tallas de cintura numérica (28-36) y tela stretch';
      this.autoSeleccionarTallas(['28', '30', '32', '34', '36']);
      this.autoSeleccionarColores(['Negro', 'Azul Marino', 'Beige Arena', 'Verde Oliva']);
    } else if (catLower.includes('abrigo') || catLower.includes('chaquet') || catLower.includes('chompa') || catLower.includes('blazer') || catLower.includes('saco')) {
      this.nombrePlaceholderPrenda = 'Ej: Abrigo Trench Clásico de Paño y Lana';
      this.sugerenciaEstiloPrenda = 'Forro térmico, solapa ancha y botones carey';
      this.autoSeleccionarTallas(['S', 'M', 'L', 'XL', '2XL']);
      this.autoSeleccionarColores(['Negro', 'Café Chocolate', 'Beige Arena', 'Gris Plomo']);
    } else if (catLower.includes('calzad') || catLower.includes('zapato') || catLower.includes('zapatill') || catLower.includes('bota')) {
      this.nombrePlaceholderPrenda = 'Ej: Mocasines de Cuero Genuino Suela Track';
      this.sugerenciaEstiloPrenda = 'Tallas numéricas de calzado y cuero legítimo';
      this.autoSeleccionarTallas(['38', '39', '40', '41', '42']);
      this.autoSeleccionarColores(['Negro', 'Café Chocolate', 'Blanco']);
    } else {
      this.nombrePlaceholderPrenda = `Ej: ${cat.nombre} Edición Exclusiva`;
      this.sugerenciaEstiloPrenda = `Prenda clasificada en categoría ${cat.nombre}`;
      this.autoSeleccionarTallas(['S', 'M', 'L', 'XL']);
      this.autoSeleccionarColores(['Negro', 'Blanco']);
    }
  }

  autoSeleccionarTallas(nombresTallas: string[]): void {
    const ids: number[] = [];
    for (const nombre of nombresTallas) {
      const t = this.tallas.find(x => x.nombre.trim().toUpperCase() === nombre.toUpperCase());
      if (t) ids.push(t.id);
    }
    if (ids.length > 0) this.tallasSeleccionadasIds = ids;
  }

  autoSeleccionarColores(nombresColores: string[]): void {
    const ids: number[] = [];
    for (const nombre of nombresColores) {
      const c = this.colores.find(x => x.nombre.trim().toLowerCase() === nombre.toLowerCase());
      if (c) ids.push(c.id);
    }
    if (ids.length > 0) this.coloresSeleccionadosIds = ids;
  }

  seleccionarLoteStock(cant: number): void {
    this.stockInicialNuevoProducto = cant;
  }

  getTotalUnidadesEntrantes(): number {
    return this.tallasSeleccionadasIds.length * this.coloresSeleccionadosIds.length * (Number(this.stockInicialNuevoProducto) || 0);
  }

  crearCategoriaRapida(): void {
    if (!this.nuevaCategoriaRapidaNombre.trim()) return;
    const nombre = this.nuevaCategoriaRapidaNombre.trim();
    this.adminService.crearCategoria({ nombre }).subscribe({
      next: () => {
        this.nuevaCategoriaRapidaNombre = '';
        this.mostrarCrearCategoriaRapida = false;
        this.productoService.getCategorias().subscribe(data => {
          this.categorias = data || [];
          const encontrada = this.categorias.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
          if (encontrada) {
            this.onCategoriaSeleccionada(encontrada.id);
          }
        });
        this.toastService.success('Categoría Creada', `Categoría "${nombre}" creada y seleccionada.`);
      },
      error: (err) => {
        this.toastService.error('Error al Crear Categoría', err.error?.detail || 'No se pudo crear la categoría.');
      }
    });
  }

  // --- Modal Prenda ---
  abrirModalPrenda(categoriaIdTarget?: number): void {
    const targetCatId = categoriaIdTarget || (this.categoriaFiltroId !== null ? this.categoriaFiltroId : (this.categorias.length > 0 ? this.categorias[0].id : null));
    this.prendaForm = {
      nombre: '',
      descripcion: '',
      precio_base: 180,
      categoria_id: targetCatId,
      proveedor_id: this.proveedores.length > 0 ? this.proveedores[0].id : 1,
      imagen_url: '',
      modelo_ar_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    genero: 'Unisex'
    };
    this.tallasSeleccionadasIds = [];
    this.coloresSeleccionadosIds = [];
    this.fotosColoresNuevoProducto = {};
    this.stockInicialNuevoProducto = 15;
    this.mostrarCrearCategoriaRapida = false;
    this.nuevaCategoriaRapidaNombre = '';
    this.mostrarModalPrenda = true;

    if (targetCatId) {
      this.onCategoriaSeleccionada(targetCatId);
    }
  }

  toggleTalla(tallaId: number): void {
    const idx = this.tallasSeleccionadasIds.indexOf(tallaId);
    if (idx >= 0) {
      this.tallasSeleccionadasIds.splice(idx, 1);
    } else {
      this.tallasSeleccionadasIds.push(tallaId);
    }
  }

  isTallaSelected(tallaId: number): boolean {
    return this.tallasSeleccionadasIds.includes(tallaId);
  }

  toggleColor(colorId: number): void {
    const idx = this.coloresSeleccionadosIds.indexOf(colorId);
    if (idx >= 0) {
      this.coloresSeleccionadosIds.splice(idx, 1);
    } else {
      this.coloresSeleccionadosIds.push(colorId);
    }
  }

  isColorSelected(colorId: number): boolean {
    return this.coloresSeleccionadosIds.includes(colorId);
  }

  getColorById(id: number): Color | undefined {
    return this.colores.find(c => c.id === id);
  }

  esPrendaValida(): boolean {
    return (
      !!this.prendaForm.nombre &&
      !!this.prendaForm.nombre.trim() &&
      this.prendaForm.categoria_id !== null &&
      Number(this.prendaForm.precio_base) > 0
    );
  }

  getVariantesGeneradasCount(): number {
    return this.tallasSeleccionadasIds.length * this.coloresSeleccionadosIds.length;
  }

  limpiarUrlImagen(url: string | null | undefined): string {
    if (!url) return '';
    let clean = url.trim().replace(/^["']|["']$/g, '');
    if (clean.includes('imgurl=')) {
      try {
        const match = clean.match(/[?&]imgurl=([^&]+)/);
        if (match && match[1]) clean = decodeURIComponent(match[1]);
      } catch (e) {}
    }
    return clean;
  }

  onImgError(event: any): void {
    if (event?.target) {
      event.target.onerror = null;
      event.target.src = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';
    }
  }

  onPrendaUrlChange(): void {
    if (this.prendaForm.imagen_url) {
      this.prendaForm.imagen_url = this.limpiarUrlImagen(this.prendaForm.imagen_url);
    }
  }

  guardarPrenda(): void {
    if (!this.esPrendaValida()) {
      this.errorMessage = 'Revisa los campos obligatorios: Nombre de la prenda, Categoría y Precio base.';
      return;
    }

    this.guardando = true;
    this.errorMessage = '';

    this.prendaForm.imagen_url = this.limpiarUrlImagen(this.prendaForm.imagen_url);

    const payload = {
      ...this.prendaForm,
      variantes: []
    };

    this.adminService.crearProducto(payload).subscribe({
      next: (prod) => {
        this.guardando = false;
        this.mostrarModalPrenda = false;
        this.successMessage = `¡Prenda "${this.prendaForm.nombre}" guardada con éxito! Puedes configurar sus fotos y stock en "Fotos & Lotes".`;
        this.productoService.getProductos().subscribe({
          next: (data) => this.productos = data || []
        });
      },
      error: (err) => {
        this.guardando = false;
        this.errorMessage = err.error?.detail || 'Error al registrar la prenda en la base de datos.';
      }
    });
  }

  desactivarPrenda(id: number): void {
    if (confirm('¿Estás seguro de desactivar esta prenda del catálogo?')) {
      this.adminService.eliminarProducto(id).subscribe({
        next: () => {
          this.successMessage = 'Prenda desactivada del catálogo.';
          this.cargarDatosGenerales();
        }
      });
    }
  }

  // --- Modal Gestión de Fotos por Color y Entrada de Stock ---
  abrirModalGestionPrenda(p: Producto): void {
    this.prendaGestion = { ...p };
    this.mostrarModalGestionPrenda = true;
    this.cargandoVariantes = true;
    this.coloresPrendaGestion = [];
    this.variantesPrendaGestion = [];

    this.stockIngresoForm = {
      sucursal_id: this.sucursales.length > 0 ? this.sucursales[0].id : 1,
      variante_id: null,
      cantidad: 20,
      observaciones: ''
    };

    this.adminService.getVariantesDetalle(p.id).subscribe({
      next: (res) => {
        this.cargandoVariantes = false;
        this.variantesPrendaGestion = res.variantes || [];
        
        // Agrupar variantes por color único
        const colorMap = new Map<number, any>();
        for (const v of this.variantesPrendaGestion) {
          if (!colorMap.has(v.color_id)) {
            colorMap.set(v.color_id, {
              color_id: v.color_id,
              color_nombre: v.color_nombre,
              color_hex: v.color_hex,
              imagen_url: v.imagen_url || '',
              tallas_disponibles: [v.talla_nombre],
              variante_ids: [v.id]
            });
          } else {
            const entry = colorMap.get(v.color_id);
            if (!entry.tallas_disponibles.includes(v.talla_nombre)) {
              entry.tallas_disponibles.push(v.talla_nombre);
            }
            entry.variante_ids.push(v.id);
            if (!entry.imagen_url && v.imagen_url) {
              entry.imagen_url = v.imagen_url;
            }
          }
        }
        this.coloresPrendaGestion = Array.from(colorMap.values());
      },
      error: () => {
        this.cargandoVariantes = false;
      }
    });
  }

  cerrarModalGestionPrenda(): void {
    this.mostrarModalGestionPrenda = false;
    this.prendaGestion = null;
  }

  guardarFotoGeneral(): void {
    if (!this.prendaGestion) return;
    this.prendaGestion.imagen_url = this.limpiarUrlImagen(this.prendaGestion.imagen_url);
    this.adminService.actualizarProducto(this.prendaGestion.id, {
      imagen_url: this.prendaGestion.imagen_url
    }).subscribe({
      next: () => {
        this.successMessage = 'Foto de portada general guardada exitosamente.';
        this.cargarDatosGenerales();
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error al guardar foto general.'
    });
  }

  guardarFotosColores(): void {
    if (!this.prendaGestion) return;
    
    // Preparar lista de actualizaciones para cada variante según el color
    const updates: any[] = [];
    for (const col of this.coloresPrendaGestion) {
      const limpia = this.limpiarUrlImagen(col.imagen_url);
      col.imagen_url = limpia;
      for (const vid of col.variante_ids) {
        updates.push({
          id: vid,
          imagen_url: limpia || null
        });
      }
    }

    this.adminService.actualizarVariantes(this.prendaGestion.id, updates).subscribe({
      next: () => {
        this.successMessage = `¡Fotos por variante de color guardadas correctamente para "${this.prendaGestion.nombre}"!`;
        this.cargarDatosGenerales();
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error actualizando fotos de colores.'
    });
  }

  ejecutarIngresoStock(): void {
    if (!this.prendaGestion || this.stockIngresoForm.cantidad <= 0) return;

    this.guardandoStock = true;
    this.adminService.registrarIngresoStock(this.prendaGestion.id, {
      sucursal_id: Number(this.stockIngresoForm.sucursal_id),
      cantidad: Number(this.stockIngresoForm.cantidad),
      variante_id: this.stockIngresoForm.variante_id ? Number(this.stockIngresoForm.variante_id) : undefined,
      observaciones: this.stockIngresoForm.observaciones
    }).subscribe({
      next: (res) => {
        this.guardandoStock = false;
        this.successMessage = res.message || 'Ingreso de stock registrado exitosamente.';
        // Recargar detalle de inventario
        this.abrirModalGestionPrenda(this.prendaGestion);
        this.cargarDatosGenerales();
      },
      error: (err) => {
        this.guardandoStock = false;
        this.errorMessage = err.error?.detail || 'Error al registrar entrada de stock.';
      }
    });
  }

  getStockPrendaPorSucursal(sucursalId: number): number {
    let total = 0;
    for (const v of this.variantesPrendaGestion) {
      if (v.stock_por_sucursal) {
        const item = v.stock_por_sucursal.find((s: any) => s.sucursal_id === sucursalId);
        if (item) {
          total += item.stock_libre || 0;
        }
      }
    }
    return total;
  }

  // --- Gestión de Atributos Básicos ---
  crearCategoria(): void {
    if (!this.nuevaCategoriaNombre.trim()) return;
    this.adminService.crearCategoria({ nombre: this.nuevaCategoriaNombre.trim() }).subscribe({
      next: () => {
        this.nuevaCategoriaNombre = '';
        this.successMessage = 'Categoría creada con éxito.';
        this.productoService.getCategorias().subscribe(data => this.categorias = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando categoría.'
    });
  }

  eliminarCategoria(c: Categoria): void {
    if (confirm(`¿Estás seguro de eliminar la categoría "${c.nombre}"?`)) {
      this.adminService.eliminarCategoria(c.id).subscribe({
        next: (res) => {
          this.successMessage = res.message || 'Categoría eliminada.';
          this.productoService.getCategorias().subscribe(data => this.categorias = data || []);
        },
        error: (err) => this.errorMessage = err.error?.detail || 'Error al eliminar categoría.'
      });
    }
  }

  crearTalla(): void {
    if (!this.nuevaTallaNombre.trim()) return;
    this.adminService.crearTalla({ nombre: this.nuevaTallaNombre.trim(), orden: this.tallas.length + 1 }).subscribe({
      next: () => {
        this.nuevaTallaNombre = '';
        this.successMessage = 'Talla creada con éxito.';
        this.productoService.getTallas().subscribe(data => this.tallas = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando talla.'
    });
  }

  crearColor(): void {
    if (!this.nuevoColorNombre.trim()) return;
    this.adminService.crearColor({ nombre: this.nuevoColorNombre.trim(), codigo_hex: this.nuevoColorHex }).subscribe({
      next: () => {
        this.nuevoColorNombre = '';
        this.successMessage = 'Color creado con éxito.';
        this.productoService.getColores().subscribe(data => this.colores = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando color.'
    });
  }

  // --- Sucursales ---
  guardarSucursal(): void {
    this.adminService.crearSucursal(this.sucursalForm).subscribe({
      next: () => {
        this.mostrarModalSucursal = false;
        this.successMessage = 'Sucursal física registrada exitosamente.';
        this.sucursalForm = { nombre: '', ciudad_id: 1, direccion: '', telefono: '' };
        this.productoService.getSucursales().subscribe(data => this.sucursales = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando sucursal.'
    });
  }

  eliminarSucursal(s: Sucursal): void {
    if (confirm(`¿Estás seguro de desactivar la sucursal "${s.nombre}"?`)) {
      this.adminService.eliminarSucursal(s.id).subscribe({
        next: () => {
          this.successMessage = `Sucursal "${s.nombre}" desactivada exitosamente.`;
          this.productoService.getSucursales().subscribe(data => this.sucursales = data || []);
        },
        error: (err) => this.errorMessage = err.error?.detail || 'Error al desactivar sucursal.'
      });
    }
  }

  // --- Proveedores & Temporadas ---
  crearProveedor(): void {
    if (!this.nuevoProvNombre.trim()) return;
    this.adminService.crearProveedor({
      nombre: this.nuevoProvNombre.trim(),
      contacto_nombre: this.nuevoProvContacto,
      telefono: this.nuevoProvTelefono
    }).subscribe({
      next: () => {
        this.nuevoProvNombre = '';
        this.nuevoProvContacto = '';
        this.nuevoProvTelefono = '';
        this.successMessage = 'Proveedor registrado exitosamente.';
        this.adminService.getProveedores().subscribe(data => this.proveedores = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error registrando proveedor.'
    });
  }

  eliminarProveedor(pr: any): void {
    if (confirm(`¿Estás seguro de desactivar al proveedor "${pr.nombre}"?`)) {
      this.adminService.eliminarProveedor(pr.id).subscribe({
        next: () => {
          this.successMessage = `Proveedor "${pr.nombre}" desactivado exitosamente.`;
          this.adminService.getProveedores().subscribe(data => this.proveedores = data || []);
        },
        error: (err) => this.errorMessage = err.error?.detail || 'Error desactivando proveedor.'
      });
    }
  }

  crearTemporada(): void {
    if (!this.nuevaTempNombre.trim()) return;
    this.adminService.crearTemporada({
      nombre: this.nuevaTempNombre.trim(),
      tipo: this.nuevaTempTipo
    }).subscribe({
      next: () => {
        this.nuevaTempNombre = '';
        this.nuevaTempTipo = '';
        this.successMessage = 'Temporada creada exitosamente.';
        this.adminService.getTemporadas().subscribe(data => this.temporadas = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando temporada.'
    });
  }

  eliminarTemporada(t: any): void {
    if (confirm(`¿Estás seguro de desactivar la temporada "${t.nombre}"?`)) {
      this.adminService.eliminarTemporada(t.id).subscribe({
        next: () => {
          this.successMessage = `Temporada "${t.nombre}" desactivada exitosamente.`;
          this.adminService.getTemporadas().subscribe(data => this.temporadas = data || []);
        },
        error: (err) => this.errorMessage = err.error?.detail || 'Error desactivando temporada.'
      });
    }
  }

  // --- Personal & Roles ---
  guardarUsuario(): void {
    this.adminService.crearUsuario(this.usuarioForm).subscribe({
      next: () => {
        this.mostrarModalUsuario = false;
        this.successMessage = 'Empleado interno registrado exitosamente.';
        this.usuarioForm = { nombres: '', apellidos: '', email: '', password: '', rol_id: 2, sucursal_id: null, telefono: '' };
        this.adminService.getUsuarios().subscribe(data => this.usuarios = data || []);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando usuario.'
    });
  }

  cambiarRolUsuario(u: any, nuevoRolId: number): void {
    if (!nuevoRolId || nuevoRolId === u.rol_id) return;
    this.adminService.cambiarRolUsuario(u.id, {
      rol_id: Number(nuevoRolId),
      sucursal_id: u.sucursal_id
    }).subscribe({
      next: (res) => {
        u.rol_id = Number(nuevoRolId);
        const rObj = this.roles.find(r => r.id === Number(nuevoRolId));
        if (rObj) u.rol = rObj.nombre;
        this.successMessage = res.message || `Rol de ${u.nombres} modificado exitosamente.`;
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error al cambiar rol del usuario.'
    });
  }

  cambiarSucursalUsuario(u: any, nuevaSucursalId: any): void {
    const sId = nuevaSucursalId ? Number(nuevaSucursalId) : undefined;
    this.adminService.cambiarRolUsuario(u.id, {
      rol_id: Number(u.rol_id),
      sucursal_id: sId
    }).subscribe({
      next: () => {
        u.sucursal_id = sId;
        this.successMessage = `Sucursal asignada a ${u.nombres} actualizada.`;
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error al asignar sucursal.'
    });
  }

  eliminarUsuario(u: any): void {
    if (u.email === 'admin@fashionstore.com') {
      alert('No es posible eliminar la cuenta principal del administrador.');
      return;
    }
    if (confirm(`¿Estás seguro de desactivar a ${u.nombres} ${u.apellidos}? Ya no podrá iniciar sesión en la tienda.`)) {
      this.adminService.eliminarUsuario(u.id).subscribe({
        next: () => {
          this.successMessage = `Usuario "${u.nombres} ${u.apellidos}" desactivado exitosamente.`;
          this.adminService.getUsuarios().subscribe(data => this.usuarios = data || []);
        },
        error: (err) => this.errorMessage = err.error?.detail || 'Error desactivando usuario.'
      });
    }
  }
}
