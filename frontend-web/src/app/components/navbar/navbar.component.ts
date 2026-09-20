import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="bg-white border-b sticky top-0 z-50 shadow-sm" style="background-color: var(--card-bg); border-color: var(--border-color);">
      <div class="flex items-center justify-between w-full px-4 lg:px-10" style="height: 74px;">
        
        <!-- Logo de la Marca en la Esquina Izquierda -->
        <a routerLink="/" class="flex items-center gap-3.5 flex-shrink-0" style="text-decoration: none;">
          <span style="font-size: 1.8rem; color: var(--accent);"><i class="fa-solid fa-vest-patches"></i></span>
          <div>
            <span class="font-serif" style="font-size: 1.2rem; lg:font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text-main); display: block; line-height: 1.1;">FashionStore</span>
            <span class="hidden sm:block" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); font-weight: 700;">Vestidores Virtuales AR</span>
          </div>
        </a>

        <!-- Enlaces de Navegación según Rol (Desktop) -->
        <nav class="hidden lg:flex items-center gap-6 xl:gap-8">
          
          <a routerLink="/catalogo" routerLinkActive="active-link" class="nav-link">
            <i class="fa-solid fa-shirt"></i> Catálogo
          </a>

          <a *ngIf="!esEncargado && !esCajero" routerLink="/sucursales" routerLinkActive="active-link" class="nav-link">
            <i class="fa-solid fa-shop"></i> Sucursales
          </a>

          <ng-container *ngIf="authService.isLoggedIn && esCliente">
            <a routerLink="/lookbook" routerLinkActive="active-link" class="nav-link" style="color: #a78bfa; font-weight: bold;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> Arma tu Outfit
            </a>
            <a *ngIf="carritoService.carritoCount() > 0" routerLink="/carrito" routerLinkActive="active-link" class="nav-link relative">
              <i class="fa-solid fa-cart-shopping"></i> Carrito
              <span class="cart-badge">{{ carritoService.carritoCount() }}</span>
            </a>
            <a routerLink="/mis-reservas" routerLinkActive="active-link" class="nav-link">
              <i class="fa-solid fa-calendar-check"></i> Reservas
            </a>
            <a routerLink="/mis-compras" routerLinkActive="active-link" class="nav-link">
              <i class="fa-solid fa-bag-shopping"></i> Compras
            </a>
          </ng-container>

          <a *ngIf="esEncargado" routerLink="/encargado" routerLinkActive="active-link" class="nav-link font-bold" style="color: #6366f1;">
            <i class="fa-solid fa-warehouse"></i> Panel Sucursal
          </a>
          <a *ngIf="esCajero" routerLink="/encargado" routerLinkActive="active-link" class="nav-link font-bold" style="color: #10b981;">
            <i class="fa-solid fa-cash-register"></i> Caja & Ventas
          </a>
          <a *ngIf="esAdmin" routerLink="/admin" routerLinkActive="active-link" class="nav-link text-amber-600 font-bold" style="color: var(--accent);">
            <i class="fa-solid fa-sliders"></i> Admin
          </a>

        </nav>

        <!-- Acciones Derecha (Desktop) y Hamburger (Mobile) -->
        <div class="flex items-center gap-3 lg:gap-5 flex-shrink-0">
          
          <button (click)="themeService.toggleTheme()" class="theme-toggle-btn" [title]="themeService.isDarkMode() ? 'Modo Claro' : 'Modo Oscuro'">
            <i *ngIf="themeService.isDarkMode()" class="fa-solid fa-sun" style="color: #f59e0b;"></i>
            <i *ngIf="!themeService.isDarkMode()" class="fa-solid fa-moon" style="color: #64748b;"></i>
          </button>

          <!-- Desktop Auth actions -->
          <div class="hidden lg:flex items-center">
            <ng-container *ngIf="authService.currentUser$ | async as user; else guestTpl">
              <div class="flex items-center gap-3">
                <div class="user-avatar">{{ user.nombre_completo.charAt(0).toUpperCase() }}</div>
                <div class="flex flex-col text-left">
                  <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">{{ user.nombre_completo }}</span>
                  <span class="badge" style="background-color: var(--table-th-bg); color: var(--text-muted); font-size: 0.65rem; padding: 2px 6px; text-transform: uppercase;">
                    {{ user.role }}
                  </span>
                </div>
                <button (click)="logout()" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" title="Cerrar Sesión">
                  <i class="fa-solid fa-right-from-bracket"></i>
                </button>
              </div>
            </ng-container>
            <ng-template #guestTpl>
              <div class="flex items-center gap-2">
                <a routerLink="/login" class="btn btn-outline" style="padding: 0.5rem 1rem;"><i class="fa-regular fa-user"></i> Ingresar</a>
                <a routerLink="/registro" class="btn btn-primary" style="padding: 0.5rem 1rem;">Registro</a>
              </div>
            </ng-template>
          </div>

          <!-- Mobile Hamburger Toggle -->
          <button class="lg:hidden p-2 text-gray-500 hover:text-gray-700 focus:outline-none" (click)="toggleMobileMenu()" style="color: var(--text-main);">
            <i class="fa-solid fa-bars text-2xl"></i>
          </button>

        </div>
      </div>

      <!-- Mobile Menu Dropdown -->
      <div *ngIf="isMobileMenuOpen" class="lg:hidden absolute top-full left-0 w-full border-b shadow-lg" style="background-color: var(--card-bg); border-color: var(--border-color);">
        <div class="flex flex-col p-4 gap-4">
          <a routerLink="/catalogo" (click)="closeMenu()" class="nav-link"><i class="fa-solid fa-shirt"></i> Catálogo</a>
          <a *ngIf="!esEncargado && !esCajero" routerLink="/sucursales" (click)="closeMenu()" class="nav-link"><i class="fa-solid fa-shop"></i> Sucursales</a>

          <ng-container *ngIf="authService.isLoggedIn && esCliente">
            <a routerLink="/lookbook" (click)="closeMenu()" class="nav-link" style="color: #a78bfa; font-weight: bold;"><i class="fa-solid fa-wand-magic-sparkles"></i> Arma tu Outfit</a>
            <a *ngIf="carritoService.carritoCount() > 0" routerLink="/carrito" (click)="closeMenu()" class="nav-link"><i class="fa-solid fa-cart-shopping"></i> Carrito ({{ carritoService.carritoCount() }})</a>
            <a routerLink="/mis-reservas" (click)="closeMenu()" class="nav-link"><i class="fa-solid fa-calendar-check"></i> Mis Reservas</a>
            <a routerLink="/mis-compras" (click)="closeMenu()" class="nav-link"><i class="fa-solid fa-bag-shopping"></i> Mis Compras</a>
          </ng-container>

          <a *ngIf="esEncargado" routerLink="/encargado" (click)="closeMenu()" class="nav-link font-bold" style="color: #6366f1;"><i class="fa-solid fa-warehouse"></i> Panel de Sucursal</a>
          <a *ngIf="esCajero" routerLink="/encargado" (click)="closeMenu()" class="nav-link font-bold" style="color: #10b981;"><i class="fa-solid fa-cash-register"></i> Caja & Ventas</a>
          <a *ngIf="esAdmin" routerLink="/admin" (click)="closeMenu()" class="nav-link font-bold" style="color: var(--accent);"><i class="fa-solid fa-sliders"></i> Panel de Administración</a>

          <hr style="border-color: var(--border-color);">
          
          <ng-container *ngIf="authService.currentUser$ | async as user; else guestMobileTpl">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="user-avatar">{{ user.nombre_completo.charAt(0).toUpperCase() }}</div>
                <div class="flex flex-col text-left">
                  <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">{{ user.nombre_completo }}</span>
                  <span style="color: var(--text-muted); font-size: 0.65rem; text-transform: uppercase;">{{ user.role }}</span>
                </div>
              </div>
              <button (click)="logout(); closeMenu()" class="btn btn-outline" style="padding: 0.4rem 0.8rem;"><i class="fa-solid fa-right-from-bracket"></i> Salir</button>
            </div>
          </ng-container>
          <ng-template #guestMobileTpl>
            <div class="flex flex-col gap-2">
              <a routerLink="/login" (click)="closeMenu()" class="btn btn-outline text-center py-2"><i class="fa-regular fa-user"></i> Iniciar Sesión</a>
              <a routerLink="/registro" (click)="closeMenu()" class="btn btn-primary text-center py-2">Registrarse</a>
            </div>
          </ng-template>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .nav-link {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-muted);
      text-decoration: none;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.2rem;
    }
    .nav-link:hover, .active-link {
      color: var(--text-main);
    }
    .active-link {
      border-bottom: 2px solid var(--accent);
      color: var(--accent) !important;
      padding-bottom: 2px;
    }
    .cart-badge {
      background: #ef4444; 
      color: #ffffff; 
      font-size: 0.65rem; 
      font-weight: 800; 
      border-radius: 9999px; 
      padding: 0.1rem 0.45rem; 
      margin-left: 2px;
      position: absolute;
      top: -8px;
      right: -12px;
    }
    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #18181b, #3f3f46);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.95rem;
      border: 1px solid var(--border-color);
    }
  `]
})
export class NavbarComponent implements OnInit {
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);
  public carritoService = inject(CarritoService);

  isMobileMenuOpen = false;

  get currentRole(): string | null {
    return this.authService.currentUserValue?.role || null;
  }

  get esAdmin(): boolean {
    return this.currentRole === 'administrador';
  }

  get esEncargado(): boolean {
    return this.currentRole === 'encargado_sucursal';
  }

  get esCajero(): boolean {
    return this.currentRole === 'cajero';
  }

  get esCliente(): boolean {
    return this.authService.isLoggedIn && (this.currentRole === 'cliente' || (!this.esAdmin && !this.esEncargado && !this.esCajero));
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user && (user.role === 'cliente' || user.user_type === 'cliente')) {
        this.carritoService.refreshCount();
      } else {
        this.carritoService.carritoCount.set(0);
      }
    });
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMenu(): void {
    this.isMobileMenuOpen = false;
  }

  logout(): void {
    this.carritoService.carritoCount.set(0);
    this.authService.logout();
    this.closeMenu();
  }
}
