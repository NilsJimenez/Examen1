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
      <div class="flex items-center justify-between mb-8 pb-6 border-b border-gray-200" style="flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="badge badge-admin mb-2">
            <i class="fa-solid fa-shield-halved"></i> Administración FashionStore
          </span>
          <h1 class="font-serif text-3xl font-bold" style="color: var(--text-main);">Panel de Control Comercial</h1>
          <p class="text-sm mt-1" style="color: var(--text-muted);">Gestión centralizada del catálogo, sucursales, atributos, proveedores y personal de tienda</p>
        </div>

        <div class="flex items-center gap-3">
          <button (click)="cargarDatosGenerales()" class="btn btn-outline" style="padding: 0.6rem 1.2rem;">
            <i class="fa-solid fa-rotate"></i> Actualizar Datos
          </button>
        </div>
      </div>

      <!-- Navegación por Pestañas (Tabs Limpias sin códigos de materia) -->
      <div class="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
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
          <i class="fa-solid fa-tags"></i> Categorías, Tallas & Colores
        </button>

        <button 
          (click)="activeTab = 'sucursales'" 
          [class.tab-btn-active]="activeTab === 'sucursales'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-shop"></i> Sucursales & Ciudades
        </button>

        <button 
          (click)="activeTab = 'proveedores'" 
          [class.tab-btn-active]="activeTab === 'proveedores'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-truck-ramp-box"></i> Proveedores & Temporadas
        </button>

        <button 
          (click)="activeTab = 'usuarios'" 
          [class.tab-btn-active]="activeTab === 'usuarios'" 
          class="admin-tab-btn"
        >
          <i class="fa-solid fa-users-gear"></i> Personal & Roles
        </button>
      </div>

      <!-- Alertas de Éxito / Error -->
      <div *ngIf="successMessage" class="p-4 mb-6 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200 flex items-center justify-between" style="background-color: rgba(16, 185, 129, 0.12); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">
        <span><i class="fa-solid fa-circle-check mr-2"></i> {{ successMessage }}</span>
        <button (click)="successMessage = ''" style="border:none; background:none; cursor:pointer; color: inherit;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div *ngIf="errorMessage" class="p-4 mb-6 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200 flex items-center justify-between" style="background-color: rgba(239, 68, 68, 0.12); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
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
            <p class="text-xs" style="color: var(--text-muted);">Gestiona las prendas, sus variantes, fotos y modelos de realidad aumentada</p>
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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of productos">
                <td>
                  <img [src]="p.imagen_url || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=100'" [alt]="p.nombre" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;" />
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
                <td>
                  <button (click)="desactivarPrenda(p.id)" class="btn btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; color:#ef4444;" title="Desactivar prenda">
                    <i class="fa-solid fa-trash-can"></i> Desactivar
                  </button>
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
        
        <!-- Barra Guiada de Flujo Ordenado -->
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
            <span>3. Colores & Paleta</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          
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
                  <input type="text" [(ngModel)]="nuevaCategoriaNombre" placeholder="Ej: Ropa Deportiva" class="form-input" style="padding: 0.5rem;" />
                  <button (click)="crearCategoria()" class="btn btn-primary" style="padding: 0.5rem 1rem;" title="Crear Categoría">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>

              <ul class="flex flex-col gap-2" style="max-height: 280px; overflow-y: auto;">
                <li *ngFor="let c of categorias" style="
                  background: var(--table-th-bg);
                  border: 1px solid var(--border-color);
                  border-radius: 0.5rem;
                  padding: 0.6rem 0.85rem;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 0.75rem;
                  font-size: 0.875rem;
                  color: var(--text-main);
                  min-width: 0;
                ">
                  <span style="display:flex; align-items:center; gap:0.5rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <i class="fa-regular fa-folder" style="color: var(--accent); flex-shrink:0;"></i>
                    {{ c.nombre }}
                  </span>
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <span style="
                      background: var(--border-color);
                      color: var(--text-muted);
                      border-radius: 9999px;
                      padding: 0.15rem 0.55rem;
                      font-size: 0.72rem;
                      font-weight: 700;
                      white-space: nowrap;
                    ">#{{ c.id }}</span>
                    <button 
                      type="button"
                      (click)="eliminarCategoria(c)" 
                      style="
                        background: rgba(239, 68, 68, 0.12);
                        color: #ef4444;
                        border: 1px solid rgba(239, 68, 68, 0.25);
                        border-radius: 6px;
                        padding: 0.25rem 0.55rem;
                        font-size: 0.75rem;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.3rem;
                        transition: all 0.2s ease;
                      "
                      title="Eliminar categoría '{{ c.nombre }}'"
                    >
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- 2. Tallas -->
          <div class="card p-6 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-ruler-combined text-amber-600"></i> 2. Tallas de Ropa
              </h3>
              <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ tallas.length }}</span>
            </div>
            <p class="text-xs" style="color: var(--text-muted);">
              <i class="fa-solid fa-circle-info mr-1" style="color: var(--accent);"></i>
              Clic en cualquier talla para <strong style="color:var(--accent);">marcarla</strong> o <strong style="color:var(--text-muted);">desmarcarla</strong>
            </p>

            <!-- Chips de tallas con clic directo para marcar/desmarcar -->
            <div class="flex flex-wrap gap-2">
              <button
                *ngFor="let pt of presetTallas"
                type="button"
                (click)="toggleTallaPreset(pt)"
                class="size-chip"
                [class.selected]="tallaRegistrada(pt)"
                style="padding: 0.45rem 0.85rem; font-size: 0.82rem; cursor: pointer; transition: all 0.2s ease;"
                [title]="tallaRegistrada(pt) ? 'Clic para desmarcar ' + pt : 'Clic para marcar ' + pt"
              >
                <i class="fa-solid" [class.fa-check]="tallaRegistrada(pt)" [class.fa-plus]="!tallaRegistrada(pt)" style="font-size: 0.7rem; margin-right: 2px;"></i>
                {{ pt }}
              </button>

              <!-- Tallas personalizadas -->
              <button
                *ngFor="let t of tallasPersonalizadas"
                type="button"
                (click)="eliminarTallaDB(t.id)"
                class="size-chip selected"
                style="padding: 0.45rem 0.85rem; font-size: 0.82rem; cursor: pointer;"
                title="Clic para desmarcar {{ t.nombre }}"
              >
                <i class="fa-solid fa-check" style="font-size: 0.7rem; margin-right: 2px;"></i>
                {{ t.nombre }}
              </button>
            </div>

            <!-- Input para Talla personalizada no común -->
            <div style="padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
              <label class="text-xs font-semibold block mb-1" style="color: var(--text-muted);">
                <i class="fa-solid fa-pen mr-1"></i> Otra talla no común:
              </label>
              <div class="flex gap-2">
                <input type="text" [(ngModel)]="nuevaTallaNombre" placeholder="Ej: 4XL, Especial, 14-Años" class="form-input" style="padding: 0.5rem;" />
                <button (click)="crearTalla()" class="btn btn-primary" style="padding: 0.5rem 1rem;" title="Crear Talla">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Colores -->
          <div class="card p-6 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h3 class="font-serif text-xl font-bold flex items-center gap-2" style="color: var(--text-main);">
                <i class="fa-solid fa-palette text-amber-600"></i> 3. Colores &amp; Paleta
              </h3>
              <span class="badge" style="background: var(--table-th-bg); color: var(--text-muted);">{{ colores.length }}</span>
            </div>
            <p class="text-xs" style="color: var(--text-muted);">
              <i class="fa-solid fa-circle-info mr-1" style="color: var(--accent);"></i>
              Clic en cualquier color para <strong style="color:var(--accent);">marcarlo</strong> o <strong style="color:var(--text-muted);">desmarcarlo</strong>
            </p>

            <!-- Chips de colores con clic directo para marcar/desmarcar -->
            <div class="flex flex-wrap gap-2">
              <button
                *ngFor="let pc of presetColores"
                type="button"
                (click)="toggleColorPreset(pc)"
                class="color-chip"
                [class.selected]="colorRegistrado(pc.nombre)"
                style="font-size: 0.82rem; padding: 0.4rem 0.85rem; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.4rem;"
                [title]="colorRegistrado(pc.nombre) ? 'Clic para desmarcar ' + pc.nombre : 'Clic para marcar ' + pc.nombre"
              >
                <span class="color-dot-indicator" [style.background-color]="pc.hex" style="width:13px; height:13px; min-width:13px; border-radius: 50%; display: inline-block;"></span>
                <i class="fa-solid" [class.fa-check]="colorRegistrado(pc.nombre)" [class.fa-plus]="!colorRegistrado(pc.nombre)" style="font-size:0.65rem;"></i>
                {{ pc.nombre }}
              </button>

              <!-- Colores personalizados -->
              <button
                *ngFor="let c of coloresPersonalizados"
                type="button"
                (click)="eliminarColorDB(c.id)"
                class="color-chip selected"
                style="font-size: 0.82rem; padding: 0.4rem 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;"
                title="Clic para desmarcar {{ c.nombre }}"
              >
                <span class="color-dot-indicator" [style.background-color]="c.codigo_hex || '#888'" style="width:13px; height:13px; min-width:13px; border-radius: 50%; display: inline-block;"></span>
                <i class="fa-solid fa-check" style="font-size:0.65rem;"></i>
                {{ c.nombre }}
              </button>
            </div>

            <!-- Color personalizado libre -->
            <div style="padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
              <label class="text-xs font-semibold block mb-1" style="color: var(--text-muted);">
                <i class="fa-solid fa-pen mr-1"></i> Color libre o personalizado:
              </label>
              <div class="flex gap-2">
                <input type="text" [(ngModel)]="nuevoColorNombre" placeholder="Ej: Verde Militar" class="form-input" style="padding: 0.5rem;" />
                <input type="color" [(ngModel)]="nuevoColorHex" style="width: 44px; height: 42px; border:none; border-radius: 6px; cursor:pointer; background: transparent;" title="Elegir Tono Exacto" />
                <button (click)="crearColor()" class="btn btn-primary" style="padding: 0.5rem 1rem;" title="Guardar Color">
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
            <p class="text-xs" style="color: var(--text-muted);">Puntos físicos para vestidores con prueba de ropa y cobro presencial</p>
          </div>
          <button (click)="mostrarModalSucursal = true" class="btn btn-accent">
            <i class="fa-solid fa-plus"></i> Registrar Nueva Sucursal
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div *ngFor="let s of sucursales" class="card p-6 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">{{ s.nombre }}</h3>
                <span class="badge" style="background:#dbeafe; color:#1e40af;">{{ s.ciudad.nombre }}</span>
              </div>
              <p class="text-sm mb-2" style="color: var(--text-muted);"><i class="fa-solid fa-map-pin text-amber-600 mr-2"></i> {{ s.direccion }}</p>
              <p *ngIf="s.telefono" class="text-sm" style="color: var(--text-muted);"><i class="fa-solid fa-phone text-amber-600 mr-2"></i> {{ s.telefono }}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-gray-100 text-xs text-green-700 font-bold" style="border-color: var(--border-color);">
              <i class="fa-solid fa-door-open"></i> Vestidores Físicos Activos para Reservas
            </div>
          </div>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 4: PROVEEDORES Y TEMPORADAS                                 -->
      <!-- =================================================================== -->
      <div *ngIf="activeTab === 'proveedores'" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Proveedores -->
        <div class="card p-6">
          <h3 class="font-serif text-xl font-bold mb-4 flex items-center gap-2" style="color: var(--text-main);">
            <i class="fa-solid fa-truck-fast text-amber-600"></i> Empresas Proveedoras
          </h3>

          <div class="mb-4 flex flex-col gap-2 p-4 rounded-lg" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase" style="color: var(--text-muted);">Registrar Proveedor</h4>
            <input type="text" [(ngModel)]="nuevoProvNombre" placeholder="Razón Social / Empresa" class="form-input" style="padding: 0.5rem;" />
            <div class="flex gap-2">
              <input type="text" [(ngModel)]="nuevoProvContacto" placeholder="Nombre Contacto" class="form-input" style="padding: 0.5rem;" />
              <input type="text" [(ngModel)]="nuevoProvTelefono" placeholder="Teléfono" class="form-input" style="padding: 0.5rem;" />
            </div>
            <button (click)="crearProveedor()" class="btn btn-primary" style="padding: 0.5rem;"><i class="fa-solid fa-plus"></i> Guardar Proveedor</button>
          </div>

          <div class="flex flex-col gap-2">
            <div *ngFor="let pr of proveedores" class="p-3 rounded-lg" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <h4 class="font-bold" style="color: var(--text-main);">{{ pr.nombre }}</h4>
              <p class="text-xs" style="color: var(--text-muted);">Contacto: {{ pr.contacto_nombre || 'N/A' }} | Tel: {{ pr.telefono || 'N/A' }}</p>
            </div>
          </div>
        </div>

        <!-- Temporadas y Colecciones -->
        <div class="card p-6">
          <h3 class="font-serif text-xl font-bold mb-4 flex items-center gap-2" style="color: var(--text-main);">
            <i class="fa-solid fa-calendar-week text-amber-600"></i> Campañas & Colecciones
          </h3>

          <div class="mb-4 flex flex-col gap-2 p-4 rounded-lg" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <h4 class="text-xs font-bold uppercase" style="color: var(--text-muted);">Crear Temporada de Moda</h4>
            <input type="text" [(ngModel)]="nuevaTempNombre" placeholder="Ej: Primavera-Verano 2026" class="form-input" style="padding: 0.5rem;" />
            <input type="text" [(ngModel)]="nuevaTempTipo" placeholder="Tipo (Casual, Gala, Escolar)" class="form-input" style="padding: 0.5rem;" />
            <button (click)="crearTemporada()" class="btn btn-primary" style="padding: 0.5rem;"><i class="fa-solid fa-plus"></i> Crear Temporada</button>
          </div>

          <div class="flex flex-col gap-2">
            <div *ngFor="let t of temporadas" class="p-3 rounded-lg flex items-center justify-between" style="background: var(--card-bg); border: 1px solid var(--border-color);">
              <div>
                <h4 class="font-bold" style="color: var(--text-main);">{{ t.nombre }}</h4>
                <p class="text-xs" style="color: var(--text-muted);">Tipo: {{ t.tipo || 'General' }}</p>
              </div>
              <span class="badge badge-stock">Vigente</span>
            </div>
          </div>
        </div>

      </div>

      <!-- =================================================================== -->
      <!-- PESTAÑA 5: PERSONAL Y USUARIOS INTERNOS                             -->
      <!-- =================================================================== -->
      <div *ngIf="activeTab === 'usuarios'" class="flex flex-col gap-6">
        
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-serif text-2xl font-bold" style="color: var(--text-main);">Personal Interno de Tienda</h2>
            <p class="text-xs" style="color: var(--text-muted);">Cajeros y encargados de sucursal con accesos operativos</p>
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
                <th>Rol Asignado</th>
                <th>Sucursal Asignada</th>
                <th>Teléfono</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of usuarios">
                <td style="font-weight: 700; color: var(--text-main);">{{ u.nombres }} {{ u.apellidos }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <span class="badge" [style.background]="u.rol === 'administrador' ? '#fef3c7' : '#e0e7ff'" [style.color]="u.rol === 'administrador' ? '#92400e' : '#3730a3'">
                    {{ u.rol }}
                  </span>
                </td>
                <td>{{ u.sucursal }}</td>
                <td>{{ u.telefono || 'N/A' }}</td>
                <td><span class="badge badge-stock"><i class="fa-solid fa-check"></i> Activo</span></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- =================================================================== -->
    <!-- MODAL: REGISTRAR NUEVA PRENDA (FLUJO ORDENADO CATEGORÍA ➡️ TALLAS ➡️ COLORES) -->
    <!-- =================================================================== -->
    <div *ngIf="mostrarModalPrenda" class="modal-overlay">
      <div class="modal-content" style="max-width: 760px;">
        
        <!-- Header del Modal -->
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100" style="border-color: var(--border-color);">
          <div>
            <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);">
              <i class="fa-solid fa-shirt text-amber-600 mr-2"></i> Registrar Nueva Prenda
            </h3>
            <p class="text-xs" style="color: var(--text-muted);">Flujo guiado: Datos & Categoría ➡️ Tallas ➡️ Colores ➡️ Publicación</p>
          </div>
          <button (click)="mostrarModalPrenda = false" class="btn btn-outline" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- Checklist de Validación en Tiempo Real -->
        <div class="flow-step-bar mb-6">
          <div class="flow-step-item" [class.completed]="prendaForm.categoria_id" [class.active]="!prendaForm.categoria_id">
            <span class="flow-step-number">
              <i *ngIf="prendaForm.categoria_id" class="fa-solid fa-check"></i>
              <span *ngIf="!prendaForm.categoria_id">1</span>
            </span>
            <span>1. Categoría {{ prendaForm.categoria_id ? '✓' : '*' }}</span>
          </div>

          <i class="fa-solid fa-arrow-right" style="color: var(--text-muted);"></i>

          <div class="flow-step-item" [class.completed]="tallasSeleccionadasIds.length > 0" [class.active]="tallasSeleccionadasIds.length === 0">
            <span class="flow-step-number">
              <i *ngIf="tallasSeleccionadasIds.length > 0" class="fa-solid fa-check"></i>
              <span *ngIf="tallasSeleccionadasIds.length === 0">2</span>
            </span>
            <span>2. Tallas ({{ tallasSeleccionadasIds.length }}) {{ tallasSeleccionadasIds.length > 0 ? '✓' : '*' }}</span>
          </div>

          <i class="fa-solid fa-arrow-right" style="color: var(--text-muted);"></i>

          <div class="flow-step-item" [class.completed]="coloresSeleccionadosIds.length > 0" [class.active]="coloresSeleccionadosIds.length === 0">
            <span class="flow-step-number">
              <i *ngIf="coloresSeleccionadosIds.length > 0" class="fa-solid fa-check"></i>
              <span *ngIf="coloresSeleccionadosIds.length === 0">3</span>
            </span>
            <span>3. Colores ({{ coloresSeleccionadosIds.length }}) {{ coloresSeleccionadosIds.length > 0 ? '✓' : '*' }}</span>
          </div>
        </div>

        <form (ngSubmit)="guardarPrenda()">
          
          <!-- SECCIÓN 1: DATOS BÁSICOS & CATEGORÍA -->
          <div class="p-4 rounded-xl mb-5" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
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
                <select 
                  [(ngModel)]="prendaForm.categoria_id" 
                  name="categoria_id" 
                  required 
                  class="form-select"
                  [style.border-color]="!prendaForm.categoria_id ? '#ef4444' : 'var(--border-color)'"
                >
                  <option [ngValue]="null" disabled>-- Selecciona una Categoría --</option>
                  <option *ngFor="let c of categorias" [ngValue]="c.id">{{ c.nombre }}</option>
                </select>
                <span *ngIf="!prendaForm.categoria_id" class="text-xs text-red-500 mt-1 block">
                  <i class="fa-solid fa-triangle-exclamation"></i> Debes seleccionar una categoría
                </span>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">Precio Base (Bs.) *</label>
                <input type="number" step="0.5" [(ngModel)]="prendaForm.precio_base" name="precio_base" required placeholder="180.00" class="form-input" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-group mb-0">
                <label class="form-label text-xs">Proveedor</label>
                <select [(ngModel)]="prendaForm.proveedor_id" name="proveedor_id" class="form-select">
                  <option *ngFor="let pr of proveedores" [value]="pr.id">{{ pr.nombre }}</option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">URL Imagen Oficial</label>
                <input type="url" [(ngModel)]="prendaForm.imagen_url" name="imagen_url" placeholder="https://images.unsplash.com/..." class="form-input" />
              </div>
            </div>

            <div class="form-group mt-3 mb-0">
              <label class="form-label text-xs">URL Modelo 3D / Realidad Aumentada (.glb)</label>
              <input type="url" [(ngModel)]="prendaForm.modelo_ar_url" name="modelo_ar_url" placeholder="https://modelviewer.dev/shared-assets/models/Astronaut.glb" class="form-input" />
            </div>
          </div>

          <!-- SECCIÓN 2: SELECCIÓN DIRECTA DE TALLAS -->
          <div class="p-4 rounded-xl mb-5" style="background: var(--table-th-bg); border: 1.5px solid" [style.border-color]="tallasSeleccionadasIds.length === 0 ? '#ef4444' : 'var(--border-color)'">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold uppercase" [style.color]="tallasSeleccionadasIds.length === 0 ? '#ef4444' : 'var(--accent)'">
                <i class="fa-solid fa-ruler-combined mr-1"></i> 2. Tallas que aplican a esta prenda *
              </h4>
              <span class="text-xs font-bold" [style.color]="tallasSeleccionadasIds.length > 0 ? '#10b981' : '#ef4444'">
                {{ tallasSeleccionadasIds.length }} seleccionadas
              </span>
            </div>
            
            <p class="text-xs mb-3" style="color: var(--text-muted);">
              Haz clic directamente sobre las tallas que estarán disponibles para esta prenda:
            </p>

            <!-- Chips Interactivos de Tallas -->
            <div class="flex flex-wrap gap-2 mb-3">
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

            <!-- Alerta si no hay ninguna seleccionada -->
            <div *ngIf="tallasSeleccionadasIds.length === 0" class="p-2 rounded text-xs bg-red-50 text-red-700 flex items-center gap-2 mb-3" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444;">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Falta seleccionar al menos una talla para la prenda.</span>
            </div>

            <!-- Añadir Talla Rápida al Vuelo -->
            <div class="flex items-center gap-2 pt-2 border-t" style="border-color: var(--border-color);">
              <span class="text-xs" style="color: var(--text-muted);">¿No encuentras la talla?</span>
              <input type="text" [(ngModel)]="nuevaTallaModal" [ngModelOptions]="{standalone: true}" placeholder="Ej: 38, 4XL, Especial" class="form-input" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: 170px;" />
              <button type="button" (click)="crearTallaModal()" class="btn btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">
                <i class="fa-solid fa-plus"></i> Añadir Talla
              </button>
            </div>
          </div>

          <!-- SECCIÓN 3: SELECCIÓN DIRECTA DE COLORES -->
          <div class="p-4 rounded-xl mb-5" style="background: var(--table-th-bg); border: 1.5px solid" [style.border-color]="coloresSeleccionadosIds.length === 0 ? '#ef4444' : 'var(--border-color)'">
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-bold uppercase" [style.color]="coloresSeleccionadosIds.length === 0 ? '#ef4444' : 'var(--accent)'">
                <i class="fa-solid fa-palette mr-1"></i> 3. Colores que aplican a esta prenda *
              </h4>
              <span class="text-xs font-bold" [style.color]="coloresSeleccionadosIds.length > 0 ? '#10b981' : '#ef4444'">
                {{ coloresSeleccionadosIds.length }} seleccionados
              </span>
            </div>

            <p class="text-xs mb-3" style="color: var(--text-muted);">
              Haz clic directamente sobre los colores disponibles para esta prenda:
            </p>

            <!-- Chips Interactivos de Colores -->
            <div class="flex flex-wrap gap-2 mb-3">
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

            <!-- Alerta si no hay ningún color seleccionado -->
            <div *ngIf="coloresSeleccionadosIds.length === 0" class="p-2 rounded text-xs bg-red-50 text-red-700 flex items-center gap-2 mb-3" style="background-color: rgba(239, 68, 68, 0.1); color: #ef4444;">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Falta seleccionar al menos un color para la prenda.</span>
            </div>

            <!-- Añadir Color Rápido al Vuelo -->
            <div class="flex items-center gap-2 pt-2 border-t" style="border-color: var(--border-color);">
              <span class="text-xs" style="color: var(--text-muted);">¿Falta un color?</span>
              <input type="text" [(ngModel)]="nuevoColorModalNombre" [ngModelOptions]="{standalone: true}" placeholder="Nombre (ej: Borgoña)" class="form-input" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: 150px;" />
              <input type="color" [(ngModel)]="nuevoColorModalHex" [ngModelOptions]="{standalone: true}" style="width: 32px; height: 32px; border:none; border-radius: 4px; cursor:pointer;" />
              <button type="button" (click)="crearColorModal()" class="btn btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">
                <i class="fa-solid fa-plus"></i> Añadir Color
              </button>
            </div>
          </div>

          <!-- RESUMEN AUTOMÁTICO DE VARIANTES A GENERAR -->
          <div *ngIf="esPrendaValida()" class="p-4 rounded-xl mb-5" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--text-main);">
            <div class="flex items-center justify-between mb-2">
              <span class="font-bold text-xs" style="color: #10b981;">
                <i class="fa-solid fa-circle-check mr-1"></i> Todo listo: {{ getVariantesGeneradasCount() }} variantes se crearán automáticamente
              </span>
              <span class="badge badge-stock">{{ tallasSeleccionadasIds.length }} tallas × {{ coloresSeleccionadosIds.length }} colores</span>
            </div>
            <p class="text-xs mb-2" style="color: var(--text-muted);">
              Cada variante se registrará con su SKU correspondiente y recibirá un stock inicial de 10 unidades en cada sucursal:
            </p>
            <div class="flex flex-wrap gap-1.5" style="max-height: 80px; overflow-y: auto;">
              <span *ngFor="let combo of getCombinacionesPreview()" class="badge" style="background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main); font-size: 0.75rem;">
                {{ combo }}
              </span>
            </div>
          </div>

          <!-- ALERTA DE CAMPOS FALTANTES SI EL FORMULARIO NO ES VÁLIDO -->
          <div *ngIf="!esPrendaValida()" class="p-3 rounded-lg mb-4 text-xs flex flex-col gap-1" style="background: rgba(217, 119, 6, 0.12); color: #d97706; border: 1px solid rgba(217, 119, 6, 0.3);">
            <span class="font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i> Completa los requisitos para publicar la prenda:</span>
            <span *ngIf="!prendaForm.nombre">• Escribe el nombre de la prenda</span>
            <span *ngIf="!prendaForm.categoria_id">• Selecciona una Categoría</span>
            <span *ngIf="tallasSeleccionadasIds.length === 0">• Selecciona al menos una Talla</span>
            <span *ngIf="coloresSeleccionadosIds.length === 0">• Selecciona al menos un Color</span>
          </div>

          <!-- Botones de Acción -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100" style="border-color: var(--border-color);">
            <button type="button" (click)="mostrarModalPrenda = false" class="btn btn-outline">Cancelar</button>
            <button type="submit" [disabled]="guardando || !esPrendaValida()" class="btn btn-primary">
              <span *ngIf="guardando"><i class="fa-solid fa-circle-notch fa-spin"></i> Guardando y generando inventario...</span>
              <span *ngIf="!guardando"><i class="fa-solid fa-check"></i> Guardar y Publicar Prenda ({{ getVariantesGeneradasCount() }} variantes)</span>
            </button>
          </div>

        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: REGISTRAR EMPLEADO                                           -->
    <!-- =================================================================== -->
    <div *ngIf="mostrarModalUsuario" class="modal-overlay">
      <div class="modal-content">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100" style="border-color: var(--border-color);">
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
            <label class="form-label">Correo Institucional *</label>
            <input type="email" [(ngModel)]="usuarioForm.email" name="email" required placeholder="mario@fashionstore.com" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Contraseña Inicial *</label>
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
              <label class="form-label">Sucursal</label>
              <select [(ngModel)]="usuarioForm.sucursal_id" name="sucursal_id" class="form-select">
                <option [ngValue]="null">Central / Global</option>
                <option *ngFor="let s of sucursales" [value]="s.id">{{ s.nombre }}</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100" style="border-color: var(--border-color);">
            <button type="button" (click)="mostrarModalUsuario = false" class="btn btn-outline">Cancelar</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-check"></i> Registrar Empleado</button>
          </div>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: REGISTRAR SUCURSAL                                           -->
    <!-- =================================================================== -->
    <div *ngIf="mostrarModalSucursal" class="modal-overlay">
      <div class="modal-content">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-100" style="border-color: var(--border-color);">
          <h3 class="font-serif text-2xl font-bold" style="color: var(--text-main);"><i class="fa-solid fa-shop text-amber-600 mr-2"></i> Registrar Nueva Sucursal</h3>
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

          <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100" style="border-color: var(--border-color);">
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
      gap: 0.5rem;
      padding: 0.65rem 1.25rem;
      border-radius: 0.625rem;
      font-size: 0.9rem;
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

  // Tallas y Colores predeterminados para selección en 1 clic
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

  // Selección directa en modal de Prenda
  tallasSeleccionadasIds: number[] = [];
  coloresSeleccionadosIds: number[] = [];

  // Campos de creación rápida dentro del modal
  nuevaTallaModal: string = '';
  nuevoColorModalNombre: string = '';
  nuevoColorModalHex: string = '#18181b';

  // Estados de Modales
  mostrarModalPrenda: boolean = false;
  mostrarModalUsuario: boolean = false;
  mostrarModalSucursal: boolean = false;
  guardando: boolean = false;

  successMessage: string = '';
  errorMessage: string = '';

  // Formulario Prenda
  prendaForm = {
    nombre: '',
    descripcion: '',
    precio_base: 180,
    categoria_id: null as number | null,
    proveedor_id: 1,
    imagen_url: '',
    modelo_ar_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
  };

  usuarioForm = {
    nombres: '',
    apellidos: '',
    email: '',
    password: '',
    rol_id: 2,
    sucursal_id: null,
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
    this.productoService.getProductos().subscribe({ next: data => this.productos = data });
    this.productoService.getCategorias().subscribe({ 
      next: data => {
        this.categorias = data;
        if (this.categorias.length > 0 && !this.prendaForm.categoria_id) {
          this.prendaForm.categoria_id = this.categorias[0].id;
        }
      }
    });
    this.productoService.getTallas().subscribe({ next: data => this.tallas = data });
    this.productoService.getColores().subscribe({ next: data => this.colores = data });
    this.productoService.getSucursales().subscribe({ next: data => this.sucursales = data });
    this.adminService.getProveedores().subscribe({ 
      next: data => {
        this.proveedores = data;
        if (this.proveedores.length > 0) {
          this.prendaForm.proveedor_id = this.proveedores[0].id;
        }
      }
    });
    this.adminService.getTemporadas().subscribe({ next: data => this.temporadas = data });
    this.adminService.getRoles().subscribe({ next: data => this.roles = data });
    this.adminService.getUsuarios().subscribe({ next: data => this.usuarios = data });
  }

  // --- Verificaciones de Atributos ---
  tallaRegistrada(nombre: string): boolean {
    return this.tallas.some(t => t.nombre.trim().toUpperCase() === nombre.trim().toUpperCase());
  }

  colorRegistrado(nombre: string): boolean {
    return this.colores.some(c => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  }

  esTallaPreset(nombre: string): boolean {
    return this.presetTallas.some(pt => pt.trim().toUpperCase() === nombre.trim().toUpperCase());
  }

  esColorPreset(nombre: string): boolean {
    return this.presetColores.some(pc => pc.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  }

  get tallasPersonalizadas(): Talla[] {
    return this.tallas.filter(t => !this.esTallaPreset(t.nombre));
  }

  get coloresPersonalizados(): Color[] {
    return this.colores.filter(c => !this.esColorPreset(c.nombre));
  }

  toggleTallaPreset(nombre: string): void {
    if (this.tallaRegistrada(nombre)) {
      this.quitarTallaRegistrada(nombre);
    } else {
      this.agregarTallaRapida(nombre);
    }
  }

  toggleColorPreset(pc: { nombre: string, hex: string }): void {
    if (this.colorRegistrado(pc.nombre)) {
      this.quitarColorRegistrado(pc.nombre);
    } else {
      this.agregarColorPreset(pc);
    }
  }

  eliminarCategoria(cat: Categoria): void {
    if (confirm(`¿Estás seguro de eliminar la categoría "${cat.nombre}"?`)) {
      this.adminService.eliminarCategoria(cat.id).subscribe({
        next: (res: any) => {
          this.successMessage = res.message || `Categoría "${cat.nombre}" eliminada.`;
          this.productoService.getCategorias().subscribe(data => this.categorias = data);
        },
        error: (err) => {
          this.errorMessage = err.error?.detail || 'No se pudo eliminar la categoría.';
        }
      });
    }
  }

  // Quitar talla preset ya registrada (busca su ID y la desmarca o elimina en DB)
  quitarTallaRegistrada(nombre: string): void {
    const talla = this.tallas.find(t => t.nombre.trim().toUpperCase() === nombre.trim().toUpperCase());
    if (!talla) return;
    this.eliminarTallaDB(talla.id);
  }

  eliminarTallaDB(id: number): void {
    this.adminService.eliminarTalla(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Talla desmarcada.';
        this.productoService.getTallas().subscribe(data => this.tallas = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'No se pudo desmarcar la talla.'
    });
  }

  // Quitar color preset ya registrado
  quitarColorRegistrado(nombre: string): void {
    const color = this.colores.find(c => c.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (!color) return;
    this.eliminarColorDB(color.id);
  }

  eliminarColorDB(id: number): void {
    this.adminService.eliminarColor(id).subscribe({
      next: (res) => {
        this.successMessage = res.message || 'Color desmarcado.';
        this.productoService.getColores().subscribe(data => this.colores = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'No se pudo desmarcar el color.'
    });
  }

  agregarTallaRapida(nombre: string): void {
    if (this.tallaRegistrada(nombre)) {
      this.successMessage = `La talla "${nombre}" ya está registrada en el catálogo.`;
      return;
    }
    this.adminService.crearTalla({ nombre, orden: this.tallas.length + 1 }).subscribe({
      next: () => {
        this.successMessage = `Talla "${nombre}" creada y lista para asignarse.`;
        this.productoService.getTallas().subscribe(data => this.tallas = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando talla.'
    });
  }

  agregarColorPreset(pc: { nombre: string, hex: string }): void {
    if (this.colorRegistrado(pc.nombre)) {
      this.successMessage = `El color "${pc.nombre}" ya está registrado en el catálogo.`;
      return;
    }
    this.adminService.crearColor({ nombre: pc.nombre, codigo_hex: pc.hex }).subscribe({
      next: () => {
        this.successMessage = `Color "${pc.nombre}" agregado con éxito.`;
        this.productoService.getColores().subscribe(data => this.colores = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando color.'
    });
  }

  // --- Gestión de Selección en Modal Prenda ---
  abrirModalPrenda(): void {
    this.prendaForm = {
      nombre: '',
      descripcion: '',
      precio_base: 180,
      categoria_id: this.categorias.length > 0 ? this.categorias[0].id : null,
      proveedor_id: this.proveedores.length > 0 ? this.proveedores[0].id : 1,
      imagen_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600',
      modelo_ar_url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
    };

    // Preseleccionar por defecto las tallas iniciales (ej: S y M) si existen
    this.tallasSeleccionadasIds = this.tallas.slice(0, 2).map(t => t.id);
    // Preseleccionar los colores iniciales si existen
    this.coloresSeleccionadosIds = this.colores.slice(0, 2).map(c => c.id);

    this.mostrarModalPrenda = true;
  }

  toggleTalla(id: number): void {
    const idx = this.tallasSeleccionadasIds.indexOf(id);
    if (idx > -1) {
      this.tallasSeleccionadasIds.splice(idx, 1);
    } else {
      this.tallasSeleccionadasIds.push(id);
    }
  }

  isTallaSelected(id: number): boolean {
    return this.tallasSeleccionadasIds.includes(id);
  }

  toggleColor(id: number): void {
    const idx = this.coloresSeleccionadosIds.indexOf(id);
    if (idx > -1) {
      this.coloresSeleccionadosIds.splice(idx, 1);
    } else {
      this.coloresSeleccionadosIds.push(id);
    }
  }

  isColorSelected(id: number): boolean {
    return this.coloresSeleccionadosIds.includes(id);
  }

  crearTallaModal(): void {
    if (!this.nuevaTallaModal.trim()) return;
    const nombre = this.nuevaTallaModal.trim();
    this.adminService.crearTalla({ nombre, orden: this.tallas.length + 1 }).subscribe({
      next: (t) => {
        this.tallas.push(t);
        this.tallasSeleccionadasIds.push(t.id);
        this.nuevaTallaModal = '';
        this.successMessage = `Talla "${nombre}" agregada y seleccionada para esta prenda.`;
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando talla.'
    });
  }

  crearColorModal(): void {
    if (!this.nuevoColorModalNombre.trim()) return;
    const nombre = this.nuevoColorModalNombre.trim();
    this.adminService.crearColor({ nombre, codigo_hex: this.nuevoColorModalHex }).subscribe({
      next: (c) => {
        this.colores.push(c);
        this.coloresSeleccionadosIds.push(c.id);
        this.nuevoColorModalNombre = '';
        this.successMessage = `Color "${nombre}" agregado y seleccionado para esta prenda.`;
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando color.'
    });
  }

  esPrendaValida(): boolean {
    return Boolean(
      this.prendaForm.nombre &&
      this.prendaForm.nombre.trim().length >= 3 &&
      this.prendaForm.categoria_id &&
      this.prendaForm.precio_base > 0 &&
      this.tallasSeleccionadasIds.length > 0 &&
      this.coloresSeleccionadosIds.length > 0
    );
  }

  getVariantesGeneradasCount(): number {
    return this.tallasSeleccionadasIds.length * this.coloresSeleccionadosIds.length;
  }

  getCombinacionesPreview(): string[] {
    const previews: string[] = [];
    for (const tid of this.tallasSeleccionadasIds) {
      const t = this.tallas.find(x => x.id === tid);
      for (const cid of this.coloresSeleccionadosIds) {
        const c = this.colores.find(x => x.id === cid);
        previews.push(`${t?.nombre || 'T'} - ${c?.nombre || 'C'}`);
      }
    }
    return previews;
  }

  guardarPrenda(): void {
    if (!this.esPrendaValida()) {
      this.errorMessage = 'Revisa los campos obligatorios: Categoría, al menos 1 Talla y al menos 1 Color.';
      return;
    }

    this.guardando = true;
    this.errorMessage = '';

    // Generar variantes automáticamente para cada par (Talla x Color)
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
        variantesPayload.push({
          talla_id: tid,
          color_id: cid,
          sku: sku,
          precio_adicional: 0
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
        this.successMessage = `¡Prenda "${this.prendaForm.nombre}" publicada con éxito con sus ${variantesPayload.length} variantes!`;
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

  // --- Creación de Atributos Básicos ---
  crearCategoria(): void {
    if (!this.nuevaCategoriaNombre.trim()) return;
    this.adminService.crearCategoria({ nombre: this.nuevaCategoriaNombre.trim() }).subscribe({
      next: () => {
        this.nuevaCategoriaNombre = '';
        this.successMessage = 'Categoría creada con éxito.';
        this.productoService.getCategorias().subscribe(data => this.categorias = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando categoría.'
    });
  }

  crearTalla(): void {
    if (!this.nuevaTallaNombre.trim()) return;
    this.adminService.crearTalla({ nombre: this.nuevaTallaNombre.trim(), orden: this.tallas.length + 1 }).subscribe({
      next: () => {
        this.nuevaTallaNombre = '';
        this.successMessage = 'Talla creada con éxito.';
        this.productoService.getTallas().subscribe(data => this.tallas = data);
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
        this.productoService.getColores().subscribe(data => this.colores = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando color.'
    });
  }

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
        this.adminService.getProveedores().subscribe(data => this.proveedores = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error registrando proveedor.'
    });
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
        this.adminService.getTemporadas().subscribe(data => this.temporadas = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando temporada.'
    });
  }

  guardarUsuario(): void {
    this.adminService.crearUsuario(this.usuarioForm).subscribe({
      next: () => {
        this.mostrarModalUsuario = false;
        this.successMessage = 'Empleado interno registrado exitosamente.';
        this.usuarioForm = { nombres: '', apellidos: '', email: '', password: '', rol_id: 2, sucursal_id: null, telefono: '' };
        this.adminService.getUsuarios().subscribe(data => this.usuarios = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando usuario.'
    });
  }

  guardarSucursal(): void {
    this.adminService.crearSucursal(this.sucursalForm).subscribe({
      next: () => {
        this.mostrarModalSucursal = false;
        this.successMessage = 'Sucursal física registrada exitosamente.';
        this.sucursalForm = { nombre: '', ciudad_id: 1, direccion: '', telefono: '' };
        this.productoService.getSucursales().subscribe(data => this.sucursales = data);
      },
      error: (err) => this.errorMessage = err.error?.detail || 'Error creando sucursal.'
    });
  }
}

