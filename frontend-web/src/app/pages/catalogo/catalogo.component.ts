import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { Producto, Categoria } from '../../models/producto.models';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="pb-16">
      
      <!-- Banner Hero -->
      <section class="hero-banner">
        <div class="container text-center">
          <span class="badge badge-ar mb-4">
            <i class="fa-solid fa-cube"></i> Innovación Omnicanal
          </span>
          <h1 style="font-size: 2.8rem; font-weight: 700; color: #ffffff; margin: 0.5rem 0 1rem;">
            Viste el futuro con Vestidores Virtuales AR
          </h1>
          <p style="color: #d4d4d8; max-width: 600px; margin: 0 auto 1.5rem; font-size: 1.05rem;">
            Explora nuestra nueva colección, prueba las prendas en Realidad Aumentada con tu cámara y reserva tus favoritas para probártelas en tienda física.
          </p>
        </div>
      </section>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="container" style="margin-top: -28px; position: relative; z-index: 10;">
        <div class="filter-card card p-4 flex flex-col gap-4">
          
          <div class="flex items-center justify-between gap-4" style="flex-wrap: wrap;">
            <!-- Buscador -->
            <div class="search-box">
              <i class="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                [(ngModel)]="searchTerm" 
                (input)="onSearch()" 
                placeholder="Buscar prenda, camisa, vestido, jeans..."
                class="form-input" 
                style="padding-left: 2.5rem;"
              />
            </div>

            <!-- Selector Único Desplegable de Tienda ("Una Sola Etiqueta") -->
            <div class="sucursal-selector-wrapper">
              <button 
                (click)="toggleMenuSucursales($event)"
                class="sucursal-dropdown-btn"
                type="button"
                title="Selecciona la tienda para ver prendas disponibles"
              >
                <div class="flex items-center gap-2">
                  <span class="branch-icon-dot">
                    <i class="fa-solid fa-location-dot" style="color: var(--accent);"></i>
                  </span>
                  <div class="text-left leading-tight">
                    <span class="block uppercase tracking-wider font-bold" style="color: var(--text-muted); font-size: 0.65rem;">
                      Disponibilidad en Tienda:
                    </span>
                    <strong style="color: var(--text-main); font-size: 0.82rem;">
                      {{ selectedSucursalNombre }}
                    </strong>
                  </div>
                </div>
                <i 
                  class="fa-solid fa-chevron-down text-xs ml-2" 
                  [style.transform]="menuSucursalesAbierto ? 'rotate(180deg)' : 'rotate(0deg)'" 
                  style="color: var(--accent); transition: transform 0.2s ease;"
                ></i>
              </button>

              <!-- Menú Desplegable Flotante -->
              <div 
                *ngIf="menuSucursalesAbierto" 
                (click)="$event.stopPropagation()"
                class="sucursal-dropdown-menu animate-fade-in"
              >
                <div class="text-xs font-bold uppercase tracking-wider px-3 py-1.5" style="color: var(--text-muted); font-size: 0.68rem; border-bottom: 1px solid var(--border-color); margin-bottom: 0.35rem;">
                  <i class="fa-solid fa-shop mr-1"></i> Ver prendas disponibles en:
                </div>

                <!-- Opción: Todas las Tiendas -->
                <button 
                  (click)="selectSucursal(null)"
                  class="sucursal-menu-item"
                  [class.sucursal-menu-item-active]="selectedSucursalId === null"
                  type="button"
                >
                  <div class="flex items-center gap-2.5">
                    <i class="fa-solid fa-store" style="color: var(--accent); width: 16px; text-align: center;"></i>
                    <span>Todas las Tiendas</span>
                  </div>
                  <i *ngIf="selectedSucursalId === null" class="fa-solid fa-check" style="color: var(--accent); font-size: 0.8rem;"></i>
                </button>

                <!-- Opciones por Sucursal -->
                <button 
                  *ngFor="let suc of sucursales"
                  (click)="selectSucursal(suc.id)"
                  class="sucursal-menu-item"
                  [class.sucursal-menu-item-active]="selectedSucursalId === suc.id"
                  type="button"
                >
                  <div class="flex items-center gap-2.5">
                    <i class="fa-solid fa-location-dot" style="color: var(--accent); width: 16px; text-align: center;"></i>
                    <span>{{ suc.nombre }}</span>
                  </div>
                  <i *ngIf="selectedSucursalId === suc.id" class="fa-solid fa-check" style="color: var(--accent); font-size: 0.8rem;"></i>
                </button>
              </div>
            </div>

            <!-- Contador de Resultados -->
            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
              <span *ngIf="selectedSucursalId; else todasMsg">
                Mostrando <strong style="color: var(--text-main);">{{ productos.length }}</strong> prendas en <strong style="color: var(--accent);">{{ selectedSucursalNombre }}</strong>
              </span>
              <ng-template #todasMsg>
                Mostrando <strong style="color: var(--text-main);">{{ productos.length }}</strong> prendas disponibles
              </ng-template>
            </div>
          </div>

          <!-- Píldoras de Categorías -->
          <div class="flex items-center gap-2" style="overflow-x: auto; padding-bottom: 4px;">
            <button 
              (click)="selectCategoria(null)" 
              [class.category-pill-active]="selectedCategoriaId === null" 
              class="category-pill"
            >
              Todas
            </button>
            <button 
              *ngFor="let cat of categorias" 
              (click)="selectCategoria(cat.id)" 
              [class.category-pill-active]="selectedCategoriaId === cat.id" 
              class="category-pill"
            >
              {{ cat.nombre }}
            </button>
          </div>

        </div>
      </div>

      <!-- Cuadrícula de Productos -->
      <section class="container" style="margin-top: 2.5rem;">
        
        <!-- Indicador de Carga -->
        <div *ngIf="loading" class="text-center py-12">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--accent);"></i>
          <p class="mt-3 text-muted">Consultando disponibilidad en tiempo real...</p>
        </div>

        <!-- Sin Resultados -->
        <div *ngIf="!loading && productos.length === 0" class="text-center py-16 card">
          <i class="fa-solid fa-shop-slash" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
          <h3 class="font-serif text-xl" style="color: var(--text-main);">No hay prendas disponibles en esta sucursal</h3>
          <p class="text-muted">No se encontraron prendas con stock disponible en {{ selectedSucursalNombre }}.</p>
          <div class="mt-4">
            <button (click)="selectSucursal(null)" class="btn btn-outline" style="display: inline-flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-store"></i> Ver Todas las Tiendas
            </button>
          </div>
        </div>

        <!-- Grid de Tarjetas -->
        <div *ngIf="!loading && productos.length > 0" class="grid grid-cols-1 grid-cols-sm-2 grid-cols-lg-4 gap-6">
          
          <div *ngFor="let p of productos" class="card product-card">
            
            <!-- Imagen y Badges -->
            <div class="product-image-container">
              <img [src]="p.imagen_url || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600'" [alt]="p.nombre" class="product-image" />
              
              <!-- Badge Flotante de Stock en Sucursal sobre la Imagen -->
              <div class="product-badge-stock">
                <span *ngIf="selectedSucursalId" class="stock-chip">
                  <span class="stock-dot" style="background-color: #22c55e;"></span>
                  <span>{{ getNombreCorto(selectedSucursalNombre) }}: <strong style="color: #22c55e;">{{ p.stock_sucursal_seleccionada }}</strong> uds.</span>
                </span>
                <span *ngIf="!selectedSucursalId" class="stock-chip">
                  <i class="fa-solid fa-boxes-stacked" style="color: var(--accent);"></i>
                  <span>Stock: <strong>{{ p.stock_total || 0 }}</strong> uds.</span>
                </span>
              </div>

              <span *ngIf="p.modelo_ar_url" class="badge badge-ar product-badge-ar">
                <i class="fa-solid fa-vr-cardboard"></i> AR
              </span>

              <span class="badge badge-category">
                {{ p.categoria?.nombre || 'Moda' }}
              </span>
            </div>

            <!-- Contenido de la Tarjeta -->
            <div class="p-4 flex flex-col justify-between" style="flex: 1;">
              <div>
                <h3 class="product-title font-serif">{{ p.nombre }}</h3>
                <p class="product-desc">{{ p.descripcion }}</p>
              </div>

              <div class="mt-4 pt-3 border-t flex items-center justify-between" style="border-color: var(--border-color);">
                <div>
                  <span style="font-size: 0.75rem; color: var(--text-muted); display: block; font-weight: 600;">PRECIO</span>
                  <span class="product-price">Bs. {{ p.precio_base | number:'1.2-2' }}</span>
                </div>

                <a [routerLink]="['/producto', p.id]" [queryParams]="selectedSucursalId ? { sucursal: selectedSucursalId } : {}" class="btn btn-primary" style="padding: 0.5rem 0.9rem; font-size: 0.85rem;">
                  Ver Prenda <i class="fa-solid fa-arrow-right"></i>
                </a>
              </div>

            </div>

          </div>

        </div>

      </section>

    </main>
  `,
  styles: [`
    .hero-banner {
      background: linear-gradient(rgba(24, 24, 27, 0.85), rgba(24, 24, 27, 0.95)), 
                  url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&auto=format&fit=crop') center/cover;
      padding: 4.5rem 0 5rem;
    }
    .filter-card {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
    }
    .search-box {
      position: relative;
      flex: 1;
      min-width: 260px;
    }
    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #a1a1aa;
    }
    .sucursal-selector-wrapper {
      position: relative;
    }
    .sucursal-dropdown-btn {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 9999px;
      padding: 0.35rem 0.95rem;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 230px;
    }
    .sucursal-dropdown-btn:hover {
      border-color: var(--accent);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }
    .branch-icon-dot {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
    }
    .sucursal-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 100;
      min-width: 290px;
      background: var(--card-bg, #18181b);
      border: 1.5px solid var(--border-color, #27272a);
      border-radius: 12px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
      padding: 0.4rem;
      backdrop-filter: blur(12px);
    }
    .sucursal-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.85rem;
      border-radius: 8px;
      background: none;
      border: none;
      color: var(--text-main);
      font-size: 0.82rem;
      font-weight: 500;
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
      font-weight: 700;
    }
    .category-pill {
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      padding: 0.45rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .category-pill:hover {
      background: var(--table-hover-bg);
      color: var(--text-main);
      border-color: var(--accent);
    }
    .category-pill-active {
      background: var(--primary) !important;
      color: var(--primary-text) !important;
      border-color: var(--primary) !important;
    }
    .product-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .product-image-container {
      position: relative;
      width: 100%;
      height: 280px;
      overflow: hidden;
      background-color: var(--table-th-bg);
    }
    .product-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .product-card:hover .product-image {
      transform: scale(1.05);
    }
    .product-badge-stock {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 5;
    }
    .stock-chip {
      background: rgba(24, 24, 27, 0.88);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      padding: 0.25rem 0.65rem;
      font-size: 0.72rem;
      font-weight: 600;
      color: #f4f4f5;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .stock-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }
    .product-badge-ar {
      position: absolute;
      top: 10px;
      right: 10px;
    }
    .badge-category {
      position: absolute;
      bottom: 10px;
      left: 10px;
      background-color: var(--card-bg);
      color: var(--text-main);
      border: 1px solid var(--border-color);
      font-weight: 700;
    }
    .product-title {
      font-size: 1.15rem;
      color: var(--text-main);
      margin-bottom: 0.35rem;
    }
    .product-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .product-price {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--accent);
    }
  `]
})
export class CatalogoComponent implements OnInit {
  private productoService = inject(ProductoService);

  productos: Producto[] = [];
  categorias: Categoria[] = [];
  sucursales: Sucursal[] = [];
  selectedCategoriaId: number | null = null;
  selectedSucursalId: number | null = null;
  selectedSucursalNombre: string = 'Todas las Tiendas';
  menuSucursalesAbierto: boolean = false;
  searchTerm: string = '';
  loading: boolean = true;

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarSucursales();
    this.cargarProductos();
  }

  toggleMenuSucursales(event: Event): void {
    event.stopPropagation();
    this.menuSucursalesAbierto = !this.menuSucursalesAbierto;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuSucursalesAbierto = false;
  }

  cargarCategorias(): void {
    this.productoService.getCategorias().subscribe({
      next: (data) => this.categorias = data,
      error: (err) => console.error('Error cargando categorías:', err)
    });
  }

  cargarSucursales(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => this.sucursales = data,
      error: (err) => console.error('Error cargando sucursales:', err)
    });
  }

  cargarProductos(): void {
    this.loading = true;
    this.productoService.getProductos(
      this.selectedCategoriaId || undefined,
      this.searchTerm,
      this.selectedSucursalId || undefined
    ).subscribe({
      next: (data) => {
        this.productos = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.loading = false;
      }
    });
  }

  selectCategoria(catId: number | null): void {
    this.selectedCategoriaId = catId;
    this.cargarProductos();
  }

  selectSucursal(sucId: number | null): void {
    this.selectedSucursalId = sucId;
    this.menuSucursalesAbierto = false;
    if (sucId === null) {
      this.selectedSucursalNombre = 'Todas las Tiendas';
    } else {
      const s = this.sucursales.find(item => item.id === sucId);
      this.selectedSucursalNombre = s ? s.nombre : 'Tienda Seleccionada';
    }
    this.cargarProductos();
  }

  onSearch(): void {
    this.cargarProductos();
  }

  getNombreCorto(nombre: string): string {
    return (nombre || '').replace('Sucursal ', '');
  }
}
