import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { ProductoService } from '../../services/producto.service';
import { AuthService } from '../../services/auth.service';
import { Producto, Categoria, Talla, Color } from '../../models/producto.models';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
      <div class="flex items-center gap-4 mb-10 overflow-x-auto pb-3">
        <button 
          (click)="activeTab = 'prendas'" 
          [class.tab-btn-active]="activeTab === 'prendas'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-shirt"></i> Prendas de Ropa
        </button>

        <button 
          (click)="activeTab = 'atributos'" 
          [class.tab-btn-active]="activeTab === 'atributos'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-tags"></i> Categorías, Tallas &amp; Colores
        </button>

        <button 
          (click)="activeTab = 'sucursales'" 
          [class.tab-btn-active]="activeTab === 'sucursales'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-shop"></i> Sucursales &amp; Ciudades
        </button>

        <button 
          (click)="activeTab = 'proveedores'" 
          [class.tab-btn-active]="activeTab === 'proveedores'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-truck-ramp-box"></i> Proveedores &amp; Temporadas
        </button>

        <button 
          (click)="activeTab = 'usuarios'" 
          [class.tab-btn-active]="activeTab === 'usuarios'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-users-gear"></i> Personal &amp; Roles
        </button>
      </div>

      <!-- Alertas de Éxito / Error -->
      <div *ngIf="successMessage" class="p-4 mb-6 rounded-lg text-sm flex items-center justify-between" style="background-color: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35);">
        <span><i class="fa-solid fa-circle-check mr-2"></i> {{ successMessage }}</span>
        <button (click)="successMessage = ''" style="border:none; background:none; cursor:pointer; color: inherit;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div *ngIf="errorMessage" class="p-4 mb-6 rounded-lg text-sm flex items-center justify-between" style="background-color: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35);">
        <span><i class="fa-solid fa-triangle-exclamation mr-2"></i> {{ errorMessage }}</span>
        <button (click)="errorMessage = ''" style="border:none; background:none; cursor:pointer; color: inherit;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 1: PRENDAS DE ROPA                                          -->
      <!-- =================================================================== -->
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

        <div class="card table-container">
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
              <tr *ngFor="let p of productos">
                <td>
                  <img [src]="p.imagen_url || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=100'" [alt]="p.nombre" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" />
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
      <!-- PESTAÑA 2: ATRIBUTOS (CATEGORÍAS, TALLAS, COLORES EN SECUENCIA)    -->
      <!-- =================================================================== -->
      <div *ngIf="activeTab === 'atributos'" class="flex flex-col gap-6">
        
        <div class="flow-step-bar">
          <div class="flow-step-item active">
            <span class="flow-step-number">1</span>
            <span>1. Categoría de Prenda</span>
          </div>
          <i class="fa-solid fa-arrow-right" style="color: var(--text-muted);"></i>
          <div class="flow-step-item active">
            <span class="flow-step-number">2</span>
            <span>2. Tallas Disponibles</span>
          </div>
          <i class="fa-solid fa-arrow-right" style="color: var(--text-muted);"></i>
          <div class="flow-step-item active">
            <span class="flow-step-number">3</span>
            <span>3. Colores &amp; Paleta</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <!-- 1. Categorías -->
          <div class="card p-6 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
                  <i class="fa-solid fa-layer-group text-amber-600"></i> 1. Categorías
                </h3>
                <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ categorias.length }}</span>
              </div>
              <p class="text-xs mb-4" style="color: var(--text-muted);">Clasificación principal para catálogo y filtros</p>
              
              <div class="mb-4">
                <div class="flex gap-2">
                  <input type="text" [(ngModel)]="nuevaCategoriaNombre" placeholder="Nueva Categoría (ej: Abrigos)" class="form-input" style="padding: 0.5rem;" />
                  <button (click)="crearCategoria()" class="btn btn-primary" style="padding: 0.5rem 1rem;" title="Crear Categoría">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>

              <ul class="flex flex-col gap-2" style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                <li *ngFor="let c of categorias" style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  background: var(--table-th-bg);
                  border: 1px solid var(--border-color);
                  border-radius: 8px;
                  padding: 0.45rem 0.75rem;
                  font-size: 0.875rem;
                  color: var(--text-main);
                ">
                  <span>{{ c.nombre }}</span>
                  <button 
                    type="button"
                    (click)="eliminarCategoria(c)" 
                    class="btn btn-outline"
                    style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"
                    title="Eliminar categoría"
                  >
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- 2. Tallas -->
          <div class="card p-6 flex flex-col gap-5">
            <div class="flex items-center justify-between">
              <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-ruler-combined text-amber-600"></i> 2. Tallas de Ropa
              </h3>
              <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ tallas.length }}</span>
            </div>
            <p class="text-xs" style="color: var(--text-muted);">
              Clic en cualquier talla para <strong style="color:var(--accent);">marcarla</strong> o <strong style="color:var(--text-muted);">desmarcarla</strong>
            </p>

            <div class="flex flex-wrap gap-3">
              <button
                *ngFor="let pt of presetTallas"
                type="button"
                (click)="toggleTallaPreset(pt)"
                class="size-chip"
                [class.selected]="tallaRegistrada(pt)"
                style="padding: 0.45rem 0.85rem; font-size: 0.82rem; cursor: pointer;"
              >
                <i class="fa-solid" [class.fa-check]="tallaRegistrada(pt)" [class.fa-plus]="!tallaRegistrada(pt)" style="font-size: 0.7rem; margin-right: 2px;"></i>
                {{ pt }}
              </button>

              <button
                *ngFor="let t of tallasPersonalizadas"
                type="button"
                (click)="eliminarTallaDB(t.id)"
                class="size-chip selected"
                style="padding: 0.45rem 0.85rem; font-size: 0.82rem; cursor: pointer;"
              >
                <i class="fa-solid fa-check" style="font-size: 0.7rem; margin-right: 2px;"></i>
                {{ t.nombre }}
              </button>
            </div>

            <div style="padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
              <label class="text-xs font-semibold block mb-1" style="color: var(--text-muted);">Otra talla:</label>
              <div class="flex gap-2">
                <input type="text" [(ngModel)]="nuevaTallaNombre" placeholder="Ej: 4XL, Especial" class="form-input" style="padding: 0.5rem;" />
                <button (click)="crearTalla()" class="btn btn-primary" style="padding: 0.5rem 1rem;">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Colores -->
          <div class="card p-6 flex flex-col gap-5">
            <div class="flex items-center justify-between">
              <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-palette text-amber-600"></i> 3. Colores &amp; Paleta
              </h3>
              <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ colores.length }}</span>
            </div>
            <p class="text-xs" style="color: var(--text-muted);">
              Clic en cualquier color para <strong style="color:var(--accent);">marcarlo</strong> o <strong style="color:var(--text-muted);">desmarcarlo</strong>
            </p>

            <div class="flex flex-wrap gap-3">
              <button
                *ngFor="let pc of presetColores"
                type="button"
                (click)="toggleColorPreset(pc)"
                class="color-chip"
                [class.selected]="colorRegistrado(pc.nombre)"
                style="font-size: 0.82rem; padding: 0.4rem 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;"
              >
                <span class="color-dot-indicator" [style.background-color]="pc.hex" style="width:13px; height:13px; min-width:13px; border-radius: 50%; display: inline-block;"></span>
                <i class="fa-solid" [class.fa-check]="colorRegistrado(pc.nombre)" [class.fa-plus]="!colorRegistrado(pc.nombre)" style="font-size:0.65rem;"></i>
                {{ pc.nombre }}
              </button>

              <button
                *ngFor="let c of coloresPersonalizados"
                type="button"
                (click)="eliminarColorDB(c.id)"
                class="color-chip selected"
                style="font-size: 0.82rem; padding: 0.4rem 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;"
              >
                <span class="color-dot-indicator" [style.background-color]="c.codigo_hex || '#888'" style="width:13px; height:13px; min-width:13px; border-radius: 50%; display: inline-block;"></span>
                <i class="fa-solid fa-check" style="font-size:0.65rem;"></i>
                {{ c.nombre }}
              </button>
            </div>

            <div style="padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
              <label class="text-xs font-semibold block mb-1" style="color: var(--text-muted);">Color libre:</label>
              <div class="flex gap-2">
                <input type="text" [(ngModel)]="nuevoColorNombre" placeholder="Ej: Verde Militar" class="form-input" style="padding: 0.5rem;" />
                <input type="color" [(ngModel)]="nuevoColorHex" style="width: 44px; height: 42px; border:none; border-radius: 6px; cursor:pointer; background: transparent;" />
                <button (click)="crearColor()" class="btn btn-primary" style="padding: 0.5rem 1rem;">
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
                <span class="badge" style="background:#dbeafe; color:#1e40af;">{{ s.ciudad.nombre || 'Bolivia' }}</span>
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

        <div class="card table-container">
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
          
          <!-- SECCIÓN 1: DATOS BÁSICOS & CATEGORÍA -->
          <div class="p-4 rounded-xl mb-4" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase mb-3" style="color: var(--accent);">
              <i class="fa-solid fa-circle-info mr-1"></i> 1. Información General y Categoría
            </h4>

            <div class="form-group mb-3">
              <label class="form-label text-xs">Nombre de la Prenda *</label>
              <input type="text" [(ngModel)]="prendaForm.nombre" name="nombre" required placeholder="Ej: Vestido Midi Satinado de Gala" class="form-input" />
            </div>

            <div class="grid grid-cols-2 gap-4 mb-3">
              <div class="form-group mb-0">
                <label class="form-label text-xs">Categoría Obligatoria *</label>
                <select [(ngModel)]="prendaForm.categoria_id" name="categoria_id" required class="form-select">
                  <option [ngValue]="null" disabled>-- Selecciona una Categoría --</option>
                  <option *ngFor="let c of categorias" [ngValue]="c.id">{{ c.nombre }}</option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">Precio Base (Bs.) *</label>
                <input type="number" step="0.5" [(ngModel)]="prendaForm.precio_base" name="precio_base" required placeholder="180.00" class="form-input" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-3">
              <div class="form-group mb-0">
                <label class="form-label text-xs">Empresa Proveedora</label>
                <select [(ngModel)]="prendaForm.proveedor_id" name="proveedor_id" class="form-select">
                  <option *ngFor="let pr of proveedores" [value]="pr.id">{{ pr.nombre }}</option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">Foto Oficial de Portada (URL)</label>
                <input type="url" [(ngModel)]="prendaForm.imagen_url" name="imagen_url" placeholder="https://images.unsplash.com/..." class="form-input" />
              </div>
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">URL Modelo 3D / Realidad Aumentada (.glb)</label>
              <input type="url" [(ngModel)]="prendaForm.modelo_ar_url" name="modelo_ar_url" placeholder="https://modelviewer.dev/shared-assets/models/Astronaut.glb" class="form-input" />
            </div>
          </div>

          <!-- SECCIÓN 2: SELECCIÓN DE TALLAS -->
          <div class="p-4 rounded-xl mb-4" style="background: var(--table-th-bg); border: 1.5px solid" [style.border-color]="tallasSeleccionadasIds.length === 0 ? '#ef4444' : 'var(--border-color)'">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold uppercase" [style.color]="tallasSeleccionadasIds.length === 0 ? '#ef4444' : 'var(--accent)'">
                <i class="fa-solid fa-ruler-combined mr-1"></i> 2. Tallas disponibles para esta prenda *
              </h4>
              <span class="text-xs font-bold" [style.color]="tallasSeleccionadasIds.length > 0 ? '#10b981' : '#ef4444'">
                {{ tallasSeleccionadasIds.length }} seleccionadas
              </span>
            </div>

            <div class="flex flex-wrap gap-2 mb-2">
              <button 
                type="button"
                *ngFor="let t of tallas"
                (click)="toggleTalla(t.id)"
                class="size-chip"
                [class.selected]="isTallaSelected(t.id)"
              >
                <i *ngIf="isTallaSelected(t.id)" class="fa-solid fa-check text-xs mr-1"></i>
                {{ t.nombre }}
              </button>
            </div>
          </div>

          <!-- SECCIÓN 3: SELECCIÓN DE COLORES -->
          <div class="p-4 rounded-xl mb-4" style="background: var(--table-th-bg); border: 1.5px solid" [style.border-color]="coloresSeleccionadosIds.length === 0 ? '#ef4444' : 'var(--border-color)'">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold uppercase" [style.color]="coloresSeleccionadosIds.length === 0 ? '#ef4444' : 'var(--accent)'">
                <i class="fa-solid fa-palette mr-1"></i> 3. Colores disponibles para esta prenda *
              </h4>
              <span class="text-xs font-bold" [style.color]="coloresSeleccionadosIds.length > 0 ? '#10b981' : '#ef4444'">
                {{ coloresSeleccionadosIds.length }} seleccionados
              </span>
            </div>

            <div class="flex flex-wrap gap-2 mb-2">
              <button 
                type="button"
                *ngFor="let c of colores"
                (click)="toggleColor(c.id)"
                class="color-chip"
                [class.selected]="isColorSelected(c.id)"
              >
                <span class="color-dot-indicator" [style.background-color]="c.codigo_hex || '#000'"></span>
                <span>{{ c.nombre }}</span>
                <i *ngIf="isColorSelected(c.id)" class="fa-solid fa-check text-xs ml-1" style="color: var(--accent);"></i>
              </button>
            </div>
          </div>

          <!-- SECCIÓN 4: FOTOS POR COLOR Y CANTIDAD INICIAL QUE ENTRA -->
          <div *ngIf="coloresSeleccionadosIds.length > 0" class="p-4 rounded-xl mb-4" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold uppercase" style="color: var(--accent);">
                <i class="fa-solid fa-camera mr-1"></i> 4. Fotos Dedicadas por Color &amp; Cantidad que Entra
              </h4>
              <div class="flex items-center gap-2">
                <span class="text-xs" style="color: var(--text-muted);">Cantidad inicial que entra por tienda:</span>
                <input type="number" [(ngModel)]="stockInicialNuevoProducto" [ngModelOptions]="{standalone: true}" min="1" class="form-input text-xs font-bold" style="width: 80px; padding: 0.3rem 0.5rem; color: #10b981;" />
              </div>
            </div>

            <p class="text-xs mb-3" style="color: var(--text-muted);">
              Pega la URL de la foto de la prenda para cada color (el cliente verá cambiar la prenda de inmediato a ese color):
            </p>

            <div class="flex flex-col gap-2">
              <div *ngFor="let cId of coloresSeleccionadosIds" class="flex items-center gap-3 p-2 rounded-lg" style="background: var(--card-bg); border: 1px solid var(--border-color);">
                <span class="color-dot-indicator" [style.background-color]="getColorById(cId)?.codigo_hex || '#000'" style="width: 18px; height: 18px; min-width: 18px; border-radius: 50%;"></span>
                <span class="text-xs font-bold" style="min-width: 110px; color: var(--text-main);">{{ getColorById(cId)?.nombre }}:</span>
                <input 
                  type="url" 
                  [(ngModel)]="fotosColoresNuevoProducto[cId]" 
                  [ngModelOptions]="{standalone: true}" 
                  placeholder="URL foto para prenda en color {{ getColorById(cId)?.nombre }}..." 
                  class="form-input" 
                  style="padding: 0.35rem 0.6rem; font-size: 0.8rem;" 
                />
              </div>
            </div>
          </div>

          <!-- RESUMEN AUTOMÁTICO DE VARIANTES A GENERAR -->
          <div *ngIf="esPrendaValida()" class="p-4 rounded-xl mb-4" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3);">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-xs" style="color: #10b981;">
                <i class="fa-solid fa-circle-check mr-1"></i> {{ getVariantesGeneradasCount() }} variantes se crearán automáticamente
              </span>
              <span class="badge badge-stock">{{ tallasSeleccionadasIds.length }} tallas × {{ coloresSeleccionadosIds.length }} colores</span>
            </div>
            <p class="text-xs" style="color: var(--text-muted);">
              Cada variante entrará con {{ stockInicialNuevoProducto || 10 }} unidades iniciales en cada sucursal física.
            </p>
          </div>

          <!-- Botones de Acción -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t" style="border-color: var(--border-color);">
            <button type="button" (click)="mostrarModalPrenda = false" class="btn btn-outline">Cancelar</button>
            <button type="submit" [disabled]="guardando || !esPrendaValida()" class="btn btn-primary">
              <span *ngIf="guardando"><i class="fa-solid fa-circle-notch fa-spin"></i> Guardando y registrando stock...</span>
              <span *ngIf="!guardando"><i class="fa-solid fa-check"></i> Publicar Prenda y Generar Stock</span>
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
            <img [src]="prendaGestion.imagen_url || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200'" [alt]="prendaGestion.nombre" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1.5px solid var(--border-color);" />
            <div class="flex-1">
              <label class="form-label text-xs">URL de la Imagen General (Catálogo / Portada)</label>
              <div class="flex gap-2">
                <input type="url" [(ngModel)]="prendaGestion.imagen_url" placeholder="https://images.unsplash.com/..." class="form-input" style="padding: 0.45rem 0.75rem;" />
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

              <img [src]="col.imagen_url || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=100'" [alt]="col.color_nombre" style="width: 48px; height: 48px; min-width: 48px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" />

              <div class="flex-1">
                <input 
                  type="url" 
                  [(ngModel)]="col.imagen_url" 
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
  `]
})
export class AdminPanelComponent implements OnInit {
  private adminService = inject(AdminService);
  private productoService = inject(ProductoService);
  private authService = inject(AuthService);
  private router = inject(Router);

  activeTab: 'prendas' | 'atributos' | 'sucursales' | 'proveedores' | 'usuarios' = 'prendas';

  productos: Producto[] = [];
  categorias: Categoria[] = [];
  tallas: Talla[] = [];
  colores: Color[] = [];
  sucursales: Sucursal[] = [];
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

  successMessage: string = '';
  errorMessage: string = '';

  // Formulario de Prenda
  prendaForm = {
    nombre: '',
    descripcion: '',
    precio_base: 180,
    categoria_id: null as number | null,
    proveedor_id: 1,
    imagen_url: '',
    modelo_ar_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
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

  ngOnInit(): void {
    if (!this.authService.isLoggedIn || !this.authService.isAdmin) {
      alert('Acceso denegado. Se requiere cuenta de Administrador.');
      this.router.navigate(['/login']);
      return;
    }
    this.cargarDatosGenerales();
  }

  cargarDatosGenerales(): void {
    this.productoService.getProductos().subscribe({ next: data => this.productos = data || [] });
    this.productoService.getCategorias().subscribe({ 
      next: data => {
        this.categorias = data || [];
        if (this.categorias.length > 0 && !this.prendaForm.categoria_id) {
          this.prendaForm.categoria_id = this.categorias[0].id;
        }
      }
    });
    this.productoService.getTallas().subscribe({ next: data => this.tallas = data || [] });
    this.productoService.getColores().subscribe({ next: data => this.colores = data || [] });
    this.productoService.getSucursales().subscribe({ next: data => this.sucursales = data || [] });
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

  // --- Modal Prenda ---
  abrirModalPrenda(): void {
    this.prendaForm = {
      nombre: '',
      descripcion: '',
      precio_base: 180,
      categoria_id: this.categorias.length > 0 ? this.categorias[0].id : null,
      proveedor_id: this.proveedores.length > 0 ? this.proveedores[0].id : 1,
      imagen_url: '',
      modelo_ar_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
    };
    this.tallasSeleccionadasIds = [];
    this.coloresSeleccionadosIds = [];
    this.fotosColoresNuevoProducto = {};
    this.stockInicialNuevoProducto = 15;
    this.mostrarModalPrenda = true;
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
      !!this.prendaForm.nombre.trim() &&
      this.prendaForm.categoria_id !== null &&
      this.tallasSeleccionadasIds.length > 0 &&
      this.coloresSeleccionadosIds.length > 0
    );
  }

  getVariantesGeneradasCount(): number {
    return this.tallasSeleccionadasIds.length * this.coloresSeleccionadosIds.length;
  }

  guardarPrenda(): void {
    if (!this.esPrendaValida()) {
      this.errorMessage = 'Revisa los campos obligatorios: Categoría, al menos 1 Talla y al menos 1 Color.';
      return;
    }

    this.guardando = true;
    this.errorMessage = '';

    const variantesPayload: any[] = [];
    const baseCode = this.prendaForm.nombre
      .trim()
      .substring(0, 4)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, 'MODA');

    for (const tid of this.tallasSeleccionadasIds) {
      const t = this.tallas.find(x => x.id === tid);
      for (const cid of this.coloresSeleccionadosIds) {
        const c = this.colores.find(x => x.id === cid);
        const sku = `SKU-${baseCode}-${t?.nombre || tid}-${c?.nombre.substring(0, 3).toUpperCase() || cid}-${Math.floor(100 + Math.random() * 900)}`;
        const fotoColor = this.fotosColoresNuevoProducto[cid] || this.prendaForm.imagen_url || null;
        variantesPayload.push({
          talla_id: tid,
          color_id: cid,
          sku: sku,
          precio_adicional: 0,
          imagen_url: fotoColor,
          stock_inicial: Number(this.stockInicialNuevoProducto) || 15
        });
      }
    }

    const payload = {
      ...this.prendaForm,
      variantes: variantesPayload
    };

    this.adminService.crearProducto(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarModalPrenda = false;
        this.successMessage = `¡Prenda "${this.prendaForm.nombre}" publicada con éxito con sus ${variantesPayload.length} variantes e inventario inicial!`;
        this.cargarDatosGenerales();
      },
      error: (err) => {
        this.guardando = false;
        this.errorMessage = err.error?.detail || 'Error al registrar la prenda en Supabase.';
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
      for (const vid of col.variante_ids) {
        updates.push({
          id: vid,
          imagen_url: col.imagen_url ? col.imagen_url.trim() : null
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
