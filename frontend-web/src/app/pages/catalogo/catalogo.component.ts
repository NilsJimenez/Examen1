import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { RecomendacionService, RecomendacionIA } from '../../services/recomendacion.service';
import { ProductoService } from '../../services/producto.service';
import { Producto, Categoria } from '../../models/producto.models';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="storefront-page">
      
      <!-- =================================================================== -->
      <!-- 1. HERO BANNER CINEMATOGRÁFICO DE MODA (ESTILO EDITORIAL)           -->
      <!-- =================================================================== -->
      <section class="editorial-hero-banner">
        <div class="hero-overlay"></div>
        
        <div class="hero-content-container">
          <div class="hero-text-block animate-fade-in">
            <span class="hero-badge">
              <i class="fa-solid fa-cube mr-1.5"></i> VESTIDORES VIRTUALES AR & BOUTIQUE
            </span>
            <h1 class="hero-main-title font-serif">
              VISTE LO ESENCIAL.<br>
              <span class="hero-accent-text">DEFINE TU ESTILO.</span>
            </h1>
            <p class="hero-subtitle">
              Descubre nuestra nueva colección de alta costura, pruébate las prendas en Realidad Aumentada desde casa y aparta tu vestidor VIP en tienda física.
            </p>
            <div class="hero-buttons-row">
              <button (click)="scrollToCatalogo()" class="hero-cta-btn">
                <span>DESCUBRIR COLECCIÓN</span>
                <i class="fa-solid fa-arrow-down ml-2"></i>
              </button>
              <a routerLink="/sucursales" class="hero-secondary-btn">
                <i class="fa-solid fa-location-dot mr-1.5" style="color: var(--accent);"></i>
                <span>NUESTRAS TIENDAS</span>
              </a>
            </div>
          </div>

          <!-- Indicador de Paginación Estilo Editorial -->
          <div class="hero-indicators">
            <span class="indicator-bar active"></span>
            <span class="indicator-dot"></span>
            <span class="indicator-dot"></span>
          </div>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 2. CARDS DE CATEGORÍAS VISUALES (4 DESTACADOS EN FILA)              -->
      <!-- =================================================================== -->
      <section class="container my-10">
        <div class="category-cards-grid">
          
          <div 
            (click)="filtrarYDesplazar(1)" 
            class="category-hero-card"
            style="background-image: url('https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop');"
          >
            <div class="cat-card-overlay"></div>
            <div class="cat-card-info">
              <span class="cat-tag">SASTRERÍA</span>
              <h3 class="cat-name">CAMISAS & BLUSAS</h3>
              <div class="cat-arrow">
                <span>Explorar</span>
                <i class="fa-solid fa-arrow-right ml-1"></i>
              </div>
            </div>
          </div>

          <div 
            (click)="filtrarYDesplazar(3)" 
            class="category-hero-card"
            style="background-image: url('https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop');"
          >
            <div class="cat-card-overlay"></div>
            <div class="cat-card-info">
              <span class="cat-tag">ALTA COSTURA</span>
              <h3 class="cat-name">VESTIDOS DE GALA</h3>
              <div class="cat-arrow">
                <span>Explorar</span>
                <i class="fa-solid fa-arrow-right ml-1"></i>
              </div>
            </div>
          </div>

          <div 
            (click)="filtrarYDesplazar(2)" 
            class="category-hero-card"
            style="background-image: url('https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop');"
          >
            <div class="cat-card-overlay"></div>
            <div class="cat-card-info">
              <span class="cat-tag">URBANO & CASUAL</span>
              <h3 class="cat-name">DENIM & JEANS</h3>
              <div class="cat-arrow">
                <span>Explorar</span>
                <i class="fa-solid fa-arrow-right ml-1"></i>
              </div>
            </div>
          </div>

          <div 
            (click)="filtrarYDesplazar(4)" 
            class="category-hero-card"
            style="background-image: url('https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop');"
          >
            <div class="cat-card-overlay"></div>
            <div class="cat-card-info">
              <span class="cat-tag">OUTERWEAR</span>
              <h3 class="cat-name">ABRIGOS & BIKER</h3>
              <div class="cat-arrow">
                <span>Explorar</span>
                <i class="fa-solid fa-arrow-right ml-1"></i>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 3. BARRA DE FILTROS FLOTANTE (BUSCADOR, SUCURSAL Y CATEGORÍAS)      -->
      <!-- =================================================================== -->
      <section id="catalogo-section" class="container mb-12">
        <div class="filter-card card p-6">
          
          <div class="flex flex-wrap items-center justify-between gap-4">
            
            <!-- Buscador con Icono -->
            <div class="search-box">
              <i class="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                [(ngModel)]="searchTerm" 
                (input)="onSearch()" 
                placeholder="Buscar camisa, vestido, jeans, blazer..."
                class="form-input" 
                style="padding-left: 2.75rem;"
              />
            </div>

            <!-- Selector Desplegable de Sucursal (Etiqueta Única) -->
            <div class="sucursal-selector-wrapper">
              <button 
                (click)="toggleMenuSucursales($event)"
                class="sucursal-dropdown-btn"
                type="button"
                title="Selecciona la tienda para ver prendas disponibles"
              >
                <div class="flex items-center gap-2.5">
                  <span class="branch-icon-dot">
                    <i class="fa-solid fa-location-dot" style="color: var(--accent);"></i>
                  </span>
                  <div class="text-left leading-tight">
                    <span class="block uppercase tracking-wider font-bold" style="color: var(--text-muted); font-size: 0.65rem;">
                      Disponibilidad en Tienda:
                    </span>
                    <strong style="color: var(--text-main); font-size: 0.84rem;">
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

          <!-- Píldoras de Categorías Horizontales -->
          <div class="category-pills-scroll mt-4 pt-3" style="border-top: 1px solid var(--border-color);">
            <button 
              (click)="selectCategoria(null)" 
              [class.category-pill-active]="selectedCategoriaId === null" 
              class="category-pill"
            >
              <i class="fa-solid fa-border-all mr-1.5"></i> Todas las Prendas
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
      </section>


      <!-- =================================================================== -->
      <!-- NUEVA SECCION: IA RECOMENDADO PARA TI (CU-22)                       -->
      <!-- =================================================================== -->
      <section class="container mb-12" *ngIf="recomendaciones.length > 0">
        <div style="background: linear-gradient(to right, #18181b, #27272a); border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #3f3f46; padding-bottom: 15px;">
            <div style="background: linear-gradient(135deg, #d4af37, #f3e5ab); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-right: 12px;">
              <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 1.5rem;"></i>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.25rem; font-family: serif; color: #f4f4f5; font-weight: bold; letter-spacing: 1px;">
                PERSONAL SHOPPER IA
              </h2>
              <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #a1a1aa;">
                Selección exclusiva basada en tu historial y preferencias.
              </p>
            </div>
          </div>

          <!-- Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;">
            
            <div *ngFor="let rec of recomendaciones" (click)="registrarClicRec(rec)" 
                 style="background: #121214; border: 1px solid #3f3f46; border-radius: 8px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column;">
              
              <div style="position: relative; height: 220px; width: 100%; flex-shrink: 0;">
                <img [src]="getProductoImagen(rec.producto_id)" alt="Prenda" 
                     referrerpolicy="no-referrer"
                     (error)="onImgError($event)"
                     style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.8); color: #d4af37; border: 1px solid #d4af37; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">
                  {{ (rec.score * 100).toFixed(0) }}% MATCH
                </div>
              </div>
              
              <div style="padding: 15px; display: flex; flex-direction: column; flex-grow: 1;">
                <h3 style="margin: 0 0 8px 0; font-size: 0.95rem; color: #fff; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  {{ getProductoNombre(rec.producto_id) }}
                </h3>
                <p style="margin: 0 0 15px 0; font-size: 0.75rem; color: #a1a1aa; font-style: italic; flex-grow: 1;">
                  "{{ rec.motivo }}"
                </p>
                <a [routerLink]="['/producto', rec.producto_id]" 
                   style="display: block; text-align: center; width: 100%; background: #d4af37; color: #000; font-weight: bold; padding: 8px 0; border-radius: 4px; text-decoration: none; font-size: 0.8rem;">
                  Ver Detalles
                </a>
              </div>
              
            </div>

          </div>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 4. ENCABEZADO DE SECCIÓN "PRENDAS DESTACADAS"                       -->
      <!-- =================================================================== -->
      <section class="container mb-8">
        <div class="flex items-center justify-between">
          <div>
            <span class="section-badge uppercase font-bold tracking-wider" style="color: var(--accent); font-size: 0.72rem;">
              CATÁLOGO OFICIAL 2026
            </span>
            <h2 class="font-serif text-2xl font-bold mt-0.5" style="color: var(--text-main);">
              Prendas Esenciales
            </h2>
          </div>
          <button (click)="selectCategoria(null); selectSucursal(null)" class="btn btn-outline text-xs" style="padding: 0.45rem 0.9rem;">
            <span>Ver Todo el Catálogo</span>
            <i class="fa-solid fa-arrow-right ml-1"></i>
          </button>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 5. CUADRÍCULA DE PRENDAS (DISEÑO MINIMALISTA DE ALTO IMPACTO)       -->
      <!-- =================================================================== -->
      <section class="container catalog-essentials-section mb-24">
        
        <!-- Indicador de Carga -->
        <div *ngIf="loading" class="text-center py-16">
          <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3" style="color: var(--accent);"></i>
          <p class="text-xs" style="color: var(--text-muted);">Consultando catálogo y disponibilidad en tiempo real...</p>
        </div>

        <!-- Sin Resultados -->
        <div *ngIf="!loading && productos.length === 0" class="text-center py-16 card p-8">
          <div class="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
            <i class="fa-solid fa-shop-slash text-2xl opacity-40"></i>
          </div>
          <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">No hay prendas disponibles en esta sucursal</h3>
          <p class="text-sm mt-1" style="color: var(--text-muted);">No se encontraron prendas con stock disponible en {{ selectedSucursalNombre }}.</p>
          <div class="mt-5">
            <button (click)="selectSucursal(null)" class="btn btn-outline">
              <i class="fa-solid fa-store mr-1.5"></i> Ver Todas las Tiendas
            </button>
          </div>
        </div>

        <!-- Cuadrícula de Productos Estilo Editorial -->
        <div *ngIf="!loading && productos.length > 0" class="products-grid">
          
          <div *ngFor="let p of productos" class="product-editorial-card">
            
            <!-- Contenedor de Imagen con Efecto Hover y Badges -->
            <div class="product-image-box">
              <img 
                [src]="p.imagen_url_preview || p.imagen_url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600'" 
                [alt]="p.nombre" 
                class="product-img" 
                referrerpolicy="no-referrer"
                (error)="onImgError($event)"
              />
              
              <!-- Badges Flotantes -->
              <div class="product-badges-top">
                <span *ngIf="p.modelo_ar_url" class="badge-ar-pill">
                  <i class="fa-solid fa-cube mr-1"></i> AR VESTIDOR
                </span>
                <span class="badge-category-pill">
                  {{ p.categoria?.nombre || 'Colección' }}
                </span>
              </div>

              <!-- Badge de Stock en Tienda Física -->
              <div class="product-stock-overlay">
                <span *ngIf="selectedSucursalId" class="stock-indicator-pill">
                  <span class="status-dot-green"></span>
                  <span>{{ getNombreCorto(selectedSucursalNombre) }}: <strong>{{ p.stock_sucursal_seleccionada }}</strong> uds.</span>
                </span>
                <span *ngIf="!selectedSucursalId" class="stock-indicator-pill">
                  <i class="fa-solid fa-boxes-stacked mr-1" style="color: var(--accent);"></i>
                  <span>Stock total: <strong>{{ p.stock_total || 0 }}</strong> uds.</span>
                </span>
              </div>

              <!-- Botón Rápido Overlay Hover -->
              <a 
                [routerLink]="['/producto', p.id]" 
                [queryParams]="selectedSucursalId ? { sucursal: selectedSucursalId } : {}" 
                class="quick-view-overlay-btn"
              >
                <i class="fa-solid fa-eye mr-1.5"></i> Ver Prenda & Probar
              </a>
            </div>

            <!-- Ficha de Información de la Prenda -->
            <div class="product-info-box">
              <span class="product-cat-label">{{ p.categoria?.nombre }}</span>
              <h3 class="product-name font-serif">
                <a [routerLink]="['/producto', p.id]" [queryParams]="selectedSucursalId ? { sucursal: selectedSucursalId } : {}">
                  {{ p.nombre }}
                </a>
              </h3>
              
              <!-- Swatches de Color Dinámicos con Cambio Instantáneo de Imagen -->
              <div class="color-swatches-row" *ngIf="getColoresProducto(p).length > 0; else fallbackSwatches">
                <button
                  *ngFor="let col of getColoresProducto(p)"
                  (click)="cambiarColorPreview(p, col.imagen_url, $event)"
                  (mouseenter)="cambiarColorPreview(p, col.imagen_url)"
                  class="color-swatch-mini"
                  [class.active]="(p.imagen_url_preview || p.imagen_url) === col.imagen_url"
                  [title]="col.nombre"
                  type="button"
                >
                  <span class="swatch-mini-dot" [style.background-color]="col.codigo_hex"></span>
                </button>
              </div>
              <ng-template #fallbackSwatches>
                <div class="color-swatches-row">
                  <span class="color-dot black-dot" title="Negro"></span>
                  <span class="color-dot white-dot" title="Blanco"></span>
                </div>
              </ng-template>

              <div class="product-price-row">
                <div>
                  <span class="price-currency">Bs.</span>
                  <span class="price-amount">{{ p.precio_base | number:'1.2-2' }}</span>
                </div>
                <a 
                  [routerLink]="['/producto', p.id]" 
                  [queryParams]="selectedSucursalId ? { sucursal: selectedSucursalId } : {}" 
                  class="view-product-btn"
                  title="Ver detalle de la prenda y disponibilidad de tallas"
                >
                  <i class="fa-solid fa-arrow-right"></i>
                </a>
              </div>
            </div>

          </div>

        </div>

      </section>

      <!-- =================================================================== -->
      <!-- 6. SECCIÓN "ARMA TU LOOK COMPLETO" (ESTILO LOOK COMPLET DEL EJEMPLO)-->
      <!-- =================================================================== -->
      <section class="container bundle-section-wrapper mb-24">
        <div class="bundle-outfit-card card">
          <div class="bundle-layout-grid">
            
            <!-- Bloque Izquierdo: Titular del Look y Desglose -->
            <div class="bundle-title-col">
              <div class="bundle-tag-pill">
                <i class="fa-solid fa-wand-magic-sparkles mr-1.5" style="color: var(--accent);"></i>
                <span>OUTFIT COMBINADO OFICIAL</span>
              </div>

              <h2 class="bundle-heading font-serif">
                ARMA TU LOOK.<br>
                <span class="bundle-heading-accent">PIEZAS HECHAS PARA LUCIR JUNTAS.</span>
              </h2>

              <p class="bundle-description">
                Conjunto coordinado por nuestros diseñadores para un balance perfecto entre elegancia urbana, comodidad y presencia de alta costura.
              </p>
              
              <!-- Caja de Precio y Descuento del Look -->
              <div class="bundle-pricing-card">
                <div class="bundle-price-header">
                  <span class="bundle-price-caption">PRECIO DEL CONJUNTO COMPLETO</span>
                  <span class="bundle-savings-pill">
                    <i class="fa-solid fa-tag mr-1"></i> AHORRAS Bs. 110.00
                  </span>
                </div>
                <div class="bundle-price-row">
                  <span class="bundle-old-price">Bs. 800.00</span>
                  <span class="bundle-final-price">Bs. 690.00</span>
                </div>
              </div>

              <!-- Botones de Acción Espaciados -->
              <div class="bundle-actions-group">
                <button (click)="selectCategoria(null)" routerLink="/catalogo" class="btn btn-primary bundle-btn-main">
                  <i class="fa-solid fa-bag-shopping mr-2"></i>
                  <span>EXPLORAR LOOK COMPLETO</span>
                </button>
                <a routerLink="/sucursales" class="btn btn-outline bundle-btn-sec">
                  <i class="fa-solid fa-store mr-1.5"></i>
                  <span>VER EN TIENDAS</span>
                </a>
              </div>
            </div>

            <!-- Bloque Derecho: Prendas Combinadas con signo '+' -->
            <div class="bundle-items-col">
              
              <!-- Pieza 1: Camisa -->
              <div class="bundle-piece">
                <div class="bundle-piece-img-box">
                  <img 
                    src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&auto=format&fit=crop&q=80" 
                    alt="Camisa Oxford Slim" 
                  />
                  <span class="bundle-step-indicator">1</span>
                </div>
                <span class="bundle-piece-name">Camisa Oxford Slim</span>
                <span class="bundle-piece-price">Bs. 180.00</span>
              </div>

              <!-- Signo + Estilizado -->
              <div class="bundle-plus-badge">
                <i class="fa-solid fa-plus"></i>
              </div>

              <!-- Pieza 2: Pantalón Denim (Con URL funcional 200 OK) -->
              <div class="bundle-piece">
                <div class="bundle-piece-img-box">
                  <img 
                    src="https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80" 
                    alt="Pantalón Denim Jeans" 
                  />
                  <span class="bundle-step-indicator">2</span>
                </div>
                <span class="bundle-piece-name">Pantalón Denim Clásico</span>
                <span class="bundle-piece-price">Bs. 240.00</span>
              </div>

              <!-- Signo + Estilizado -->
              <div class="bundle-plus-badge">
                <i class="fa-solid fa-plus"></i>
              </div>

              <!-- Pieza 3: Chaqueta Biker -->
              <div class="bundle-piece">
                <div class="bundle-piece-img-box">
                  <img 
                    src="https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80" 
                    alt="Chaqueta Cuero Biker" 
                  />
                  <span class="bundle-step-indicator">3</span>
                </div>
                <span class="bundle-piece-name">Chaqueta Cuero Biker</span>
                <span class="bundle-piece-price">Bs. 380.00</span>
              </div>

            </div>

          </div>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 7. SECCIÓN DE VALOR: PROBADORES AR & COMPROMISO DE MARCA            -->
      <!-- =================================================================== -->
      <section class="container value-section-wrapper mb-24">
        <div class="value-feature-card card">
          <div class="value-layout-grid">
            
            <!-- Foto de Modelos -->
            <div class="value-image-col">
              <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop" alt="Fashion Store Experiencia" />
            </div>

            <!-- Columna Central: Declaración de Marca -->
            <div class="value-brand-col">
              <div class="value-tag-pill">
                <i class="fa-solid fa-gem mr-1.5" style="color: var(--accent);"></i>
                <span>COMPROMISO FASHIONSTORE</span>
              </div>

              <h2 class="value-heading font-serif">
                LA CALIDAD ES<br>
                <span class="value-heading-accent">NUESTRA BASE.</span>
              </h2>

              <p class="value-description">
                Cada pieza es diseñada con fibras seleccionadas de máxima durabilidad, uniendo la sastrería clásica con la tecnología de vestidores virtuales interactivos en probadores inteligentes.
              </p>

              <a routerLink="/sucursales" class="editorial-link">
                <span>CONOCE NUESTRAS TIENDAS FÍSICAS</span>
                <i class="fa-solid fa-arrow-right ml-2"></i>
              </a>
            </div>

            <!-- Columna Derecha: Pilares de Servicio -->
            <div class="value-pillars-col">
              
              <div class="pillar-item">
                <div class="pillar-icon-box">
                  <i class="fa-solid fa-medal"></i>
                </div>
                <div>
                  <h4 class="pillar-title">CALIDAD DE ALTA GAMA</h4>
                  <p class="pillar-desc">
                    Algodones finos, lino y acabados satinados con garantía de manufactura impecable.
                  </p>
                </div>
              </div>

              <div class="pillar-item">
                <div class="pillar-icon-box">
                  <i class="fa-solid fa-vest-patches"></i>
                </div>
                <div>
                  <h4 class="pillar-title">PROBADORES INTELIGENTES</h4>
                  <p class="pillar-desc">
                    Reserva tu prenda en línea y pruébatela en probadores VIP con espejos de realidad aumentada.
                  </p>
                </div>
              </div>

              <div class="pillar-item">
                <div class="pillar-icon-box">
                  <i class="fa-solid fa-truck-fast"></i>
                </div>
                <div>
                  <h4 class="pillar-title">RETIRO GRATIS & DELIVERY</h4>
                  <p class="pillar-desc">
                    Recoge en nuestras tiendas de La Paz y Santa Cruz o recibe en la puerta de tu hogar.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 8. BANNER INFERIOR CLUB VIP ("EXPLORE D'AUTRES VIBES")              -->
      <!-- =================================================================== -->
      <section class="container mb-16">
        <div class="cta-club-footer card p-8 flex flex-wrap items-center justify-between gap-8">
          <div class="flex items-center gap-4">
            <div class="club-logo-circle">
              <i class="fa-solid fa-crown text-xl" style="color: var(--accent);"></i>
            </div>
            <div>
              <h4 class="font-serif text-xl font-bold" style="color: var(--text-main);">FASHIONSTORE PRIVÉ</h4>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                Accede a lanzamientos exclusivos de temporada y probadores VIP sin espera
              </p>
            </div>
          </div>

          <a routerLink="/registro" class="btn btn-primary" style="padding: 0.75rem 1.6rem; font-size: 0.88rem;">
            <span>UNIRME AL CLUB VIP</span>
            <i class="fa-solid fa-arrow-right ml-2"></i>
          </a>
        </div>
      </section>

    </main>
  `,
  styles: [`
    .storefront-page {
      padding-bottom: 4rem;
      background: var(--bg-main);
    }

    /* 1. Hero Banner Cinematográfico */
    .editorial-hero-banner {
      position: relative;
      min-height: 560px;
      background-image: url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&auto=format&fit=crop&q=80');
      background-size: cover;
      background-position: center 25%;
      display: flex;
      align-items: center;
      margin-bottom: 3.5rem;
    }

    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg, 
        rgba(9, 9, 11, 0.88) 0%, 
        rgba(9, 9, 11, 0.65) 45%, 
        rgba(9, 9, 11, 0.25) 100%
      );
      z-index: 1;
    }

    .hero-content-container {
      position: relative;
      z-index: 2;
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
      padding: 3.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .hero-text-block {
      max-width: 620px;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 0.3rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      margin-bottom: 1.25rem;
    }

    .hero-main-title {
      font-size: 3.2rem;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin: 0 0 1rem 0;
    }

    @media (max-width: 640px) {
      .hero-main-title {
        font-size: 2.3rem;
      }
    }

    .hero-accent-text {
      color: #f59e0b;
    }

    .hero-subtitle {
      color: #e4e4e7;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
      max-width: 520px;
    }

    .hero-buttons-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
    }

    .hero-cta-btn {
      display: inline-flex;
      align-items: center;
      background: #ffffff;
      color: #09090b;
      font-weight: 800;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      padding: 0.85rem 1.6rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .hero-cta-btn:hover {
      background: var(--accent);
      color: #ffffff;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4);
    }

    .hero-secondary-btn {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1.5px solid rgba(255, 255, 255, 0.3);
      padding: 0.85rem 1.4rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.06em;
      text-decoration: none;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
    }

    .hero-secondary-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: #ffffff;
      transform: translateY(-2px);
    }

    .hero-indicators {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 3.5rem;
    }

    .indicator-bar {
      width: 32px;
      height: 3px;
      background: #f59e0b;
      border-radius: 2px;
    }

    .indicator-dot {
      width: 8px;
      height: 3px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }

    /* 2. Grid de Categorías Visuales */
    .category-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.85rem;
      width: 100%;
    }

    @media (max-width: 1024px) {
      .category-cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .category-cards-grid {
        grid-template-columns: 1fr;
      }
    }

    .category-hero-card {
      position: relative;
      height: 200px;
      border-radius: 18px;
      background-size: cover;
      background-position: center;
      overflow: hidden;
      cursor: pointer;
      border: 1.5px solid var(--border-color);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    }

    .category-hero-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
    }

    .cat-card-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(9, 9, 11, 0.2) 0%, rgba(9, 9, 11, 0.85) 100%);
      transition: background 0.3s ease;
    }

    .category-hero-card:hover .cat-card-overlay {
      background: linear-gradient(180deg, rgba(9, 9, 11, 0.1) 0%, rgba(9, 9, 11, 0.75) 100%);
    }

    .cat-card-info {
      position: absolute;
      bottom: 1.25rem;
      left: 1.25rem;
      right: 1.25rem;
      z-index: 2;
    }

    .cat-tag {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #f59e0b;
      display: block;
      margin-bottom: 0.25rem;
    }

    .cat-name {
      font-family: var(--font-sans);
      font-size: 0.98rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #ffffff;
      margin: 0 0 0.5rem 0;
    }

    .cat-arrow {
      display: inline-flex;
      align-items: center;
      font-size: 0.72rem;
      font-weight: 700;
      color: #d4d4d8;
      transition: color 0.2s ease, transform 0.2s ease;
    }

    .category-hero-card:hover .cat-arrow {
      color: var(--accent);
      transform: translateX(4px);
    }

    /* 3. Barra de Filtros Flotante */
    .filter-card {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.12);
      background-color: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 18px;
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
      gap: 0.75rem;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 9999px;
      padding: 0.45rem 1.1rem;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 240px;
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
      min-width: 300px;
      background: var(--card-bg, #18181b);
      border: 1.5px solid var(--border-color, #27272a);
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
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

    .category-pills-scroll {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .category-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1.1rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 700;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }

    .category-pill:hover {
      color: var(--text-main);
      border-color: var(--accent);
    }

    .category-pill-active {
      background: var(--primary) !important;
      color: var(--primary-text) !important;
      border-color: var(--accent) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    /* 5. Cuadrícula de Productos Estilo Editorial */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.25rem;
      width: 100%;
    }

    @media (max-width: 1100px) {
      .products-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 580px) {
      .products-grid {
        grid-template-columns: 1fr;
      }
    }

    .product-editorial-card {
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .product-editorial-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.25);
    }

    .product-image-box {
      position: relative;
      width: 100%;
      height: 320px;
      background: #121214;
      overflow: hidden;
    }

    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .product-editorial-card:hover .product-img {
      transform: scale(1.05);
    }

    .product-badges-top {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      z-index: 2;
    }

    .badge-ar-pill {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.4);
    }

    .badge-category-pill {
      background: rgba(9, 9, 11, 0.75);
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(6px);
    }

    .product-stock-overlay {
      position: absolute;
      bottom: 12px;
      left: 12px;
      z-index: 2;
    }

    .stock-indicator-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(9, 9, 11, 0.85);
      color: #f4f4f5;
      font-size: 0.68rem;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(6px);
    }

    .status-dot-green {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      display: inline-block;
    }

    .quick-view-overlay-btn {
      position: absolute;
      inset: auto 12px 12px 12px;
      background: var(--primary);
      color: var(--primary-text);
      font-size: 0.78rem;
      font-weight: 700;
      text-align: center;
      padding: 0.65rem;
      border-radius: 8px;
      text-decoration: none;
      opacity: 0;
      transform: translateY(8px);
      transition: all 0.25s ease;
      z-index: 3;
    }

    .product-editorial-card:hover .quick-view-overlay-btn {
      opacity: 1;
      transform: translateY(0);
    }

    .product-info-box {
      padding: 1.5rem 1.4rem;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: space-between;
      gap: 0.85rem;
    }

    .product-cat-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .product-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 0.5rem 0;
      line-height: 1.35;
    }

    .product-name a {
      color: inherit;
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .product-name a:hover {
      color: var(--accent);
    }

    /* Swatches de Color */
    .color-swatches-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0.4rem 0 0.85rem 0;
      flex-wrap: wrap;
    }

    .color-swatch-mini {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      padding: 1.5px;
      background: transparent;
      border: 1.5px solid transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .color-swatch-mini:hover,
    .color-swatch-mini.active {
      border-color: var(--accent);
      transform: scale(1.18);
    }

    .swatch-mini-dot {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: block;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .black-dot { background-color: #18181b; }
    .white-dot { background-color: #ffffff; }
    .navy-dot { background-color: #1e3a8a; }
    .beige-dot { background-color: #d4b996; }

    .product-price-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }

    .price-currency {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-right: 0.2rem;
    }

    .price-amount {
      font-family: var(--font-sans);
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--accent);
    }

    .view-product-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: all 0.2s ease;
      font-size: 0.8rem;
    }

    .view-product-btn:hover {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      transform: translateX(2px);
    }

    /* 5. Separación Sección Prendas Esenciales */
    .catalog-essentials-section {
      margin-bottom: 6.5rem;
    }

    /* 6. Sección Look Complet */
    .bundle-section-wrapper {
      margin-bottom: 6.5rem;
    }

    .bundle-outfit-card {
      border: 1.5px solid var(--border-color);
      border-radius: 24px;
      background: var(--card-bg);
      padding: 3.5rem 3.25rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
    }

    .bundle-layout-grid {
      display: grid;
      grid-template-columns: 1fr 1.55fr;
      gap: 4.5rem;
      align-items: center;
    }

    @media (max-width: 1024px) {
      .bundle-outfit-card {
        padding: 2.75rem 2rem;
      }
      .bundle-layout-grid {
        grid-template-columns: 1fr;
        gap: 3rem;
      }
    }

    .bundle-tag-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.4rem 1rem;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--accent);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      margin-bottom: 1.35rem;
    }

    .bundle-heading {
      font-size: 2.25rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.25;
      margin: 0 0 1.25rem 0;
    }

    .bundle-heading-accent {
      color: var(--accent);
    }

    .bundle-description {
      font-size: 0.92rem;
      line-height: 1.7;
      color: var(--text-muted);
      margin: 0 0 2rem 0;
      max-width: 380px;
    }

    .bundle-pricing-card {
      background: var(--table-th-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 1.25rem 1.4rem;
      margin-bottom: 2rem;
    }

    .bundle-price-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .bundle-price-caption {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .bundle-savings-pill {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.35);
      border-radius: 9999px;
      padding: 0.2rem 0.65rem;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .bundle-price-values {
      display: flex;
      align-items: baseline;
      gap: 0.85rem;
    }

    .bundle-old-price {
      font-size: 1.05rem;
      color: var(--text-muted);
      text-decoration: line-through;
      font-weight: 600;
    }

    .bundle-final-price {
      font-family: var(--font-serif);
      font-size: 1.85rem;
      font-weight: 800;
      color: var(--accent);
    }

    .bundle-actions-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.15rem;
    }

    .bundle-btn-main {
      font-size: 0.86rem;
      padding: 0.75rem 1.4rem;
      border-radius: 10px;
    }

    .bundle-btn-sec {
      font-size: 0.86rem;
      padding: 0.75rem 1.3rem;
      border-radius: 10px;
    }

    /* Columna de Prendas Combinadas */
    .bundle-items-col {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      background: var(--table-th-bg);
      border: 1.5px solid var(--border-color);
      border-radius: 22px;
      padding: 2.75rem 2.25rem;
      box-shadow: inset 0 2px 12px rgba(0, 0, 0, 0.18);
    }

    .bundle-piece {
      text-align: center;
      width: 135px;
      transition: transform 0.25s ease;
      cursor: pointer;
    }

    .bundle-piece:hover {
      transform: translateY(-5px);
    }

    .bundle-piece-img-box {
      position: relative;
      width: 125px;
      height: 155px;
      border-radius: 16px;
      overflow: hidden;
      background: #09090b;
      margin: 0 auto 0.85rem auto;
      border: 1.5px solid var(--border-color);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }

    .bundle-piece-img-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.35s ease;
    }

    .bundle-piece:hover .bundle-piece-img-box img {
      transform: scale(1.06);
    }

    .bundle-step-indicator {
      position: absolute;
      top: 8px;
      left: 8px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(9, 9, 11, 0.85);
      border: 1.5px solid var(--accent);
      color: var(--accent);
      font-size: 0.72rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }

    .bundle-piece-name {
      display: block;
      font-size: 0.84rem;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.3rem;
    }

    .bundle-piece-price {
      display: block;
      font-size: 0.85rem;
      color: var(--accent);
      font-weight: 800;
    }

    .bundle-plus-badge {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      background: var(--card-bg);
      border: 1.5px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent);
      font-size: 0.95rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    /* 7. Sección de Propuesta de Valor */
    .value-section-wrapper {
      margin-bottom: 6.5rem;
    }

    .value-feature-card {
      border: 1.5px solid var(--border-color);
      border-radius: 24px;
      background: var(--card-bg);
      padding: 3.5rem 3.25rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
    }

    .value-layout-grid {
      display: grid;
      grid-template-columns: 1fr 1.25fr 1.25fr;
      gap: 3.5rem;
      align-items: center;
    }

    @media (max-width: 1024px) {
      .value-feature-card {
        padding: 2.75rem 2rem;
      }
      .value-layout-grid {
        grid-template-columns: 1fr;
        gap: 2.75rem;
      }
    }

    .value-image-col {
      height: 260px;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }

    .value-image-col img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .value-tag-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.4rem 1rem;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--accent);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      margin-bottom: 1.35rem;
    }

    .value-heading {
      font-size: 2.1rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.25;
      margin: 0 0 1.25rem 0;
    }

    .value-heading-accent {
      color: var(--accent);
    }

    .value-description {
      font-size: 0.92rem;
      line-height: 1.7;
      color: var(--text-muted);
      margin: 0 0 1.75rem 0;
    }

    .editorial-link {
      display: inline-flex;
      align-items: center;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--accent);
      text-decoration: none;
      transition: transform 0.2s ease;
    }

    .editorial-link:hover {
      transform: translateX(4px);
    }

    .value-pillars-col {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .pillar-item {
      display: flex;
      align-items: flex-start;
      gap: 1.35rem;
    }

    .pillar-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      flex-shrink: 0;
    }

    .pillar-title {
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--text-main);
      margin: 0;
    }

    .pillar-desc {
      font-size: 0.76rem;
      color: var(--text-muted);
      margin: 0.3rem 0 0 0;
      line-height: 1.5;
    }

    /* 8. Club Footer */
    .cta-club-footer {
      border: 1.5px solid var(--border-color);
      border-radius: 24px;
      padding: 3rem 3.25rem;
    }

    .club-logo-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.12);
      border: 1.5px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `]
})
export class CatalogoComponent implements OnInit {
  private productoService = inject(ProductoService);
  private recomendacionService = inject(RecomendacionService);
  recomendaciones: RecomendacionIA[] = [];

  cargarRecomendacionesIA(): void {
    const token = localStorage.getItem('token');
    if(token) {
      this.recomendacionService.getRecomendacionesParaMi().subscribe({
        next: (res) => {
          this.recomendaciones = res.recomendaciones;
        },
        error: (err) => console.error("Error al cargar IA:", err)
      });
    }
  }

  onImgError(event: any): void {
    if (event?.target) {
      event.target.onerror = null;
      event.target.src = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600';
    }
  }

  getProductoImagen(prodId: number): string {
    const p = this.productos.find(x => x.id === prodId);
    return (p && p.imagen_url) ? p.imagen_url : 'assets/placeholder.png';
  }

  getProductoNombre(prodId: number): string {
    const p = this.productos.find(x => x.id === prodId);
    return (p && p.nombre) ? p.nombre : 'Prenda Exclusiva';
  }

  registrarClicRec(rec: RecomendacionIA): void {
    this.recomendacionService.registrarClic(rec.id, rec.producto_id).subscribe();
  }

  private route = inject(ActivatedRoute);

  productos: Producto[] = [];
  categorias: Categoria[] = [];
  sucursales: Sucursal[] = [];

  searchTerm: string = '';
  selectedCategoriaId: number | null = null;
  selectedSucursalId: number | null = null;
  selectedSucursalNombre: string = 'Todas las Tiendas';

  menuSucursalesAbierto: boolean = false;
  loading: boolean = true;

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuSucursalesAbierto = false;
  }

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarSucursales();
    this.cargarRecomendacionesIA();

    this.route.queryParams.subscribe(params => {
      if (params['sucursal']) {
        this.selectedSucursalId = Number(params['sucursal']);
      }
      this.cargarProductos();
    });
  }

  scrollToCatalogo(): void {
    const el = document.getElementById('catalogo-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  filtrarYDesplazar(catId: number | null): void {
    this.selectCategoria(catId);
    this.scrollToCatalogo();
  }

  cargarCategorias(): void {
    this.productoService.getCategorias().subscribe({
      next: (data) => (this.categorias = data || [])
    });
  }

  cargarSucursales(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => {
        this.sucursales = data || [];
        if (this.selectedSucursalId) {
          const suc = this.sucursales.find(s => s.id === this.selectedSucursalId);
          if (suc) this.selectedSucursalNombre = suc.nombre;
        }
      }
    });
  }

  cargarProductos(): void {
    this.loading = true;
    this.productoService
      .getProductos(
        this.selectedCategoriaId || undefined,
        this.searchTerm || undefined,
        this.selectedSucursalId || undefined
      )
      .subscribe({
        next: (data) => {
          this.productos = data || [];
          this.loading = false;
          // Pre-cargar imágenes de variantes en caché para cambios instantáneos al hacer hover/click
          this.productos.forEach(p => {
            if (p.variantes) {
              p.variantes.forEach(v => {
                if (v.imagen_url) {
                  const img = new Image();
                  img.src = v.imagen_url;
                }
              });
            }
          });
        },
        error: () => {
          this.productos = [];
          this.loading = false;
        }
      });
  }

  getColoresProducto(p: Producto): { nombre: string; codigo_hex: string; imagen_url?: string }[] {
    if (!p.variantes || p.variantes.length === 0) return [];
    const map = new Map<string, { codigo_hex: string; imagen_url?: string }>();
    p.variantes.forEach(v => {
      if (v.color?.nombre && !map.has(v.color.nombre)) {
        map.set(v.color.nombre, {
          codigo_hex: v.color.codigo_hex || '#18181b',
          imagen_url: v.imagen_url
        });
      }
    });
    return Array.from(map.entries()).map(([nombre, info]) => ({
      nombre,
      codigo_hex: info.codigo_hex,
      imagen_url: info.imagen_url
    }));
  }

  cambiarColorPreview(p: Producto, imagenUrl?: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (imagenUrl) {
      p.imagen_url_preview = imagenUrl;
    }
  }

  onSearch(): void {
    this.cargarProductos();
  }

  selectCategoria(catId: number | null): void {
    this.selectedCategoriaId = catId;
    this.cargarProductos();
  }

  toggleMenuSucursales(event: Event): void {
    event.stopPropagation();
    this.menuSucursalesAbierto = !this.menuSucursalesAbierto;
  }

  selectSucursal(sucursalId: number | null): void {
    this.selectedSucursalId = sucursalId;
    if (sucursalId === null) {
      this.selectedSucursalNombre = 'Todas las Tiendas';
    } else {
      const suc = this.sucursales.find(s => s.id === sucursalId);
      this.selectedSucursalNombre = suc ? suc.nombre : 'Sucursal';
    }
    this.menuSucursalesAbierto = false;
    this.cargarProductos();
  }

  getNombreCorto(nombreCompleto: string): string {
    if (!nombreCompleto) return 'Tienda';
    return nombreCompleto.replace('Sucursal ', '');
  }
}
