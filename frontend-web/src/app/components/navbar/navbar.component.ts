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
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm" style="background-color: var(--card-bg); border-color: var(--border-color);">
      <div class="flex items-center justify-between w-full" style="height: 74px; padding: 0 2.5rem;">
        
        <!-- Logo de la Marca en la Esquina Izquierda -->
        <a routerLink="/" class="flex items-center gap-3.5 flex-shrink-0" style="text-decoration: none;">
          <span style="font-size: 1.8rem; color: var(--accent);"><i class="fa-solid fa-vest-patches"></i></span>
          <div>
            <span class="font-serif" style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text-main); display: block; line-height: 1.1;">FashionStore</span>
            <span style="display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent); font-weight: 700;">Vestidores Virtuales AR</span>
          </div>
        </a>

        <!-- Enlaces de Navegación según Rol (Separados con buen espaciado) -->
        <nav class="flex items-center gap-8">
          
          <!-- Enlaces comunes: Catálogo -->
          <a routerLink="/catalogo" routerLinkActive="active-link" class="nav-link">
            <i class="fa-solid fa-shirt"></i> Catálogo
          </a>

          <!-- Sucursales públicas: Visible para Clientes, Invitados y Administrador -->
          <a *ngIf="!esEncargado && !esCajero" routerLink="/sucursales" routerLinkActive="active-link" class="nav-link">
            <i class="fa-solid fa-shop"></i> Sucursales
          </a>

          <!-- ROL: CLIENTE AUTENTICADO -->
          <ng-container *ngIf="authService.isLoggedIn && esCliente">
            <!-- Carrito de Compras: Solo para clientes y únicamente si tienen prendas agregadas -->
            <a 
              *ngIf="carritoService.carritoCount() > 0" 
              routerLink="/carrito" 
              routerLinkActive="active-link" 
              class="nav-link relative"
            >
              <i class="fa-solid fa-cart-shopping"></i> Carrito
              <span 
                style="
                  background: #ef4444; 
                  color: #ffffff; 
                  font-size: 0.65rem; 
                  font-weight: 800; 
                  border-radius: 9999px; 
                  padding: 0.1rem 0.45rem; 
                  margin-left: 2px;
                "
              >
                {{ carritoService.carritoCount() }}
              </span>
            </a>

            <!-- Opciones exclusivas de Cliente Autenticado -->
            <a routerLink="/mis-reservas" routerLinkActive="active-link" class="nav-link">
              <i class="fa-solid fa-calendar-check"></i> Mis Reservas
            </a>
            <a routerLink="/mis-compras" routerLinkActive="active-link" class="nav-link">
              <i class="fa-solid fa-bag-shopping"></i> Mis Compras
            </a>
          </ng-container>

          <!-- ROL: ENCARGADO DE SUCURSAL -->
          <a *ngIf="esEncargado" routerLink="/encargado" routerLinkActive="active-link" class="nav-link font-bold" style="color: #6366f1;">
            <i class="fa-solid fa-warehouse"></i> Panel de Sucursal
          </a>

          <!-- ROL: CAJERO -->
          <a *ngIf="esCajero" routerLink="/encargado" routerLinkActive="active-link" class="nav-link font-bold" style="color: #10b981;">
            <i class="fa-solid fa-cash-register"></i> Caja & Ventas
          </a>

          <!-- ROL: ADMINISTRADOR -->
          <a *ngIf="esAdmin" routerLink="/admin" routerLinkActive="active-link" class="nav-link text-amber-600 font-bold" style="color: var(--accent);">
            <i class="fa-solid fa-sliders"></i> Panel de Administración
          </a>

        </nav>

        <!-- Acciones en la Esquina Derecha: Modo Oscuro + Estado de Autenticación -->
        <div class="flex items-center gap-5 flex-shrink-0">
          
          <!-- Botón de Modo Oscuro / Claro -->
          <button 
            (click)="themeService.toggleTheme()" 
            class="theme-toggle-btn"
            [title]="themeService.isDarkMode() ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'"
          >
            <i *ngIf="themeService.isDarkMode()" class="fa-solid fa-sun" style="color: #f59e0b;"></i>
            <i *ngIf="!themeService.isDarkMode()" class="fa-solid fa-moon" style="color: #64748b;"></i>
          </button>

          <!-- Usuario Conectado -->
          <ng-container *ngIf="authService.currentUser$ | async as user; else guestTpl">
            <div class="flex items-center gap-3">
              <div class="user-avatar">
                {{ user.nombre_completo.charAt(0).toUpperCase() }}
              </div>
              <div class="flex flex-col text-left">
                <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">{{ user.nombre_completo }}</span>
                <span class="badge" style="background-color: var(--table-th-bg); color: var(--text-muted); font-size: 0.65rem; padding: 2px 6px; text-transform: uppercase;">
                  {{ user.role }}
                </span>
              </div>
              <button (click)="logout()" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" title="Cerrar Sesión">
                <i class="fa-solid fa-right-from-bracket"></i> Salir
              </button>
            </div>
          </ng-container>

          <!-- Invitado / No logueado -->
          <ng-template #guestTpl>
            <div class="flex items-center gap-3">
              <a routerLink="/login" class="btn btn-outline" style="padding: 0.5rem 1rem;">
                <i class="fa-regular fa-user"></i> Iniciar Sesión
              </a>
              <a routerLink="/registro" class="btn btn-primary" style="padding: 0.5rem 1rem;">
                Registrarse
              </a>
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

  logout(): void {
    this.carritoService.carritoCount.set(0);
    this.authService.logout();
  }
}


