import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container py-16 flex justify-center">
      
      <div class="card p-8" style="max-width: 440px; width: 100%;">
        
        <div class="text-center mb-6">
          <span style="font-size: 2rem; color: var(--accent);"><i class="fa-solid fa-lock"></i></span>
          <h2 class="font-serif text-2xl font-bold mt-2" style="color: var(--text-main);">Iniciar Sesión</h2>
          <p class="text-sm mt-1" style="color: var(--text-muted);">Ingresa tus credenciales para acceder a FashionStore</p>
        </div>

        <!-- Alerta de Error -->
        <div *ngIf="errorMessage" class="p-3 mb-4 rounded-lg text-sm flex items-center gap-2" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
          <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
        </div>

        <form (ngSubmit)="onSubmit()">
          
          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input 
              type="email" 
              name="email"
              [(ngModel)]="email" 
              required
              placeholder="admin@fashionstore.com"
              class="form-input" 
            />
          </div>

          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input 
              type="password" 
              name="password"
              [(ngModel)]="password" 
              required
              placeholder="••••••••"
              class="form-input" 
            />
          </div>

          <button type="submit" [disabled]="loading" class="btn btn-primary" style="width: 100%; padding: 0.75rem; margin-top: 0.5rem;">
            <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...</span>
            <span *ngIf="!loading"><i class="fa-solid fa-arrow-right-to-bracket"></i> Ingresar</span>
          </button>

        </form>

        <!-- Botón de Acceso Rápido Demo -->
        <div class="mt-6 pt-4 text-center" style="border-top: 1px solid var(--border-color);">
          <p class="text-xs mb-2" style="color: var(--text-muted);">Acceso Rápido Demo:</p>
          <button (click)="fillAdminCredentials()" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.4rem 0.8rem; width: 100%;">
            <i class="fa-solid fa-user-shield"></i> Llenar Credenciales de Administrador
          </button>
        </div>

        <div class="mt-4 text-center text-sm" style="color: var(--text-muted);">
          ¿No tienes cuenta? 
          <a routerLink="/registro" class="font-bold hover:underline" style="color: var(--accent);">Regístrate como cliente</a>
        </div>

      </div>

    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email: string = '';
  password: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  fillAdminCredentials(): void {
    this.email = 'admin@fashionstore.com';
    this.password = 'Admin123!';
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor ingresa correo y contraseña.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigate(['/catalogo']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Error al iniciar sesión. Revisa tus datos.';
      }
    });
  }
}
