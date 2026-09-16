import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductoService } from '../../services/producto.service';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-sucursales',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-12">
      
      <div class="text-center mb-10">
        <span class="badge badge-admin mb-2">
          <i class="fa-solid fa-location-dot"></i> Presencia Nacional
        </span>
        <h1 class="font-serif text-3xl font-bold" style="color: var(--text-main);">Nuestras Sucursales Físicas</h1>
        <p class="max-w-xl mx-auto mt-2" style="color: var(--text-muted);">
          Visítanos en nuestras tiendas para probarte las prendas reservadas en vestidores físicos y realizar tus pagos en caja.
        </p>
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
        <p class="mt-3" style="color: var(--text-muted);">Cargando sucursales...</p>
      </div>

      <div *ngIf="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div *ngFor="let s of sucursales" class="card p-6 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">{{ s.nombre }}</h3>
              <span class="badge" style="background:#dbeafe; color:#1e40af;">
                {{ s.ciudad.nombre }}
              </span>
            </div>

            <p class="text-sm mb-2" style="color: var(--text-muted);">
              <i class="fa-solid fa-map-pin mr-2 text-amber-600"></i> {{ s.direccion }}
            </p>
            
            <p *ngIf="s.telefono" class="text-sm mb-2" style="color: var(--text-muted);">
              <i class="fa-solid fa-phone mr-2 text-amber-600"></i> Tel: {{ s.telefono }}
            </p>

            <p class="text-xs mt-3" style="color: var(--text-muted);">
              <i class="fa-regular fa-clock mr-1"></i> Horario: Lunes a Sábado de 09:00 a 20:30
            </p>
          </div>

          <div class="mt-6 pt-4 border-t flex items-center justify-between" style="border-color: var(--border-color);">
            <span class="badge badge-stock">
              <i class="fa-solid fa-door-open"></i> Vestidores Físicos Habilitados
            </span>
            <button class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
              <i class="fa-solid fa-diamond-turn-right"></i> Ver en Mapa
            </button>
          </div>
        </div>

      </div>

    </div>
  `
})
export class SucursalesComponent implements OnInit {
  private productoService = inject(ProductoService);

  sucursales: Sucursal[] = [];
  loading: boolean = true;

  ngOnInit(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => {
        this.sucursales = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando sucursales:', err);
        this.loading = false;
      }
    });
  }
}
