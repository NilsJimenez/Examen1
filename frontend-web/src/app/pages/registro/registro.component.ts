import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="container py-16 flex justify-center">
      
      <div class="card p-8" style="max-width: 480px; width: 100%;">
        
        <div class="text-center mb-6">
          <span style="font-size: 2rem; color: var(--accent);"><i class="fa-solid fa-user-plus"></i></span>
          <h2 class="font-serif text-2xl font-bold mt-2" style="color: var(--text-main);">Crea tu Cuenta</h2>
          <p class="text-sm mt-1" style="color: var(--text-muted);">Únete a FashionStore para reservar y comprar ropa</p>
        </div>

        <!-- Alerta de Error -->
        <div *ngIf="errorMessage" class="p-3 mb-4 rounded-lg text-sm flex items-center gap-2" style="background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">
          <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
        </div>

        <form (ngSubmit)="onSubmit()">
          
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
              <label class="form-label">Nombres</label>
              <input type="text" [(ngModel)]="nombres" name="nombres" required placeholder="Juan" class="form-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Apellidos</label>
              <input type="text" [(ngModel)]="apellidos" name="apellidos" required placeholder="Pérez" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" [(ngModel)]="email" name="email" required placeholder="juan.perez@ejemplo.com" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" [(ngModel)]="password" name="password" required placeholder="Mínimo 6 caracteres" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Teléfono / Celular (Opcional)</label>
            <input type="tel" [(ngModel)]="telefono" name="telefono" placeholder="77665544" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Ciudad / Dirección (Opcional)</label>
            <input type="text" [(ngModel)]="direccion" name="direccion" placeholder="Av. Principal #123, Santa Cruz" class="form-input" />
          </div>

          <button type="submit" [disabled]="loading" class="btn btn-primary" style="width: 100%; padding: 0.75rem; margin-top: 0.5rem;">
            <span *ngIf="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Registrando...</span>
            <span *ngIf="!loading"><i class="fa-solid fa-check"></i> Crear Cuenta de Cliente</span>
          </button>

        </form>

        <div class="mt-6 text-center text-sm" style="color: var(--text-muted);">
          ¿Ya tienes cuenta? 
          <a routerLink="/login" class="font-bold hover:underline" style="color: var(--accent);">Inicia sesión aquí</a>
        </div>

      </div>

    </div>
  `
})
export class RegistroComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  nombres: string = '';
  apellidos: string = '';
  email: string = '';
  password: string = '';
  telefono: string = '';
  direccion: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  onSubmit(): void {
    if (!this.nombres || !this.apellidos || !this.email || !this.password) {
      this.errorMessage = 'Por favor completa los campos obligatorios.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.registerCliente({
      nombres: this.nombres,
      apellidos: this.apellidos,
      email: this.email,
      password: this.password,
      telefono: this.telefono || undefined,
      direccion: this.direccion || undefined
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/catalogo']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Error al crear la cuenta. Intenta con otro correo.';
      }
    });
  }
}
