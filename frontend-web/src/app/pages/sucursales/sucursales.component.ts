import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { Sucursal } from '../../models/sucursal.models';

declare const L: any;

interface SucursalConDistancia extends Sucursal {
  distanciaKm?: number;
  esMasCercana?: boolean;
}

@Component({
  selector: 'app-sucursales',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container py-10 max-w-7xl mx-auto px-4">
      
      <!-- Encabezado Principal -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-8 pb-5" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <span class="badge mb-2" style="background: rgba(245,158,11,0.12); color: var(--accent); border: 1px solid rgba(245,158,11,0.3); font-size: 0.72rem; padding: 0.2rem 0.65rem;">
            <i class="fa-solid fa-location-dot mr-1"></i> Presencia Nacional en Bolivia
          </span>
          <h1 class="font-serif text-3xl font-bold" style="color: var(--text-main);">Nuestras Sucursales Físicas</h1>
          <p class="text-sm mt-1 max-w-2xl" style="color: var(--text-muted);">
            Encuentra tu tienda más cercana para probarte prendas reservadas en vestidores físicos y retirar pedidos online
          </p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Botón de Geolocalización GPS -->
          <button 
            (click)="localizarSucursalMasCercana()" 
            [disabled]="localizandoGps" 
            class="btn btn-primary"
            style="font-size: 0.85rem; padding: 0.6rem 1.1rem;"
            title="Calcular la sucursal más próxima a tu ubicación actual mediante GPS"
          >
            <span *ngIf="localizandoGps"><i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Localizando...</span>
            <span *ngIf="!localizandoGps"><i class="fa-solid fa-crosshairs mr-1.5"></i> Localizar Tienda más Cercana</span>
          </button>
        </div>
      </div>

      <!-- Alerta de Geolocalización GPS -->
      <div *ngIf="mensajeGps" class="p-4 mb-6 rounded-xl flex items-center justify-between text-sm animate-fade-in" style="background: rgba(245, 158, 11, 0.12); color: var(--accent); border: 1px solid rgba(245, 158, 11, 0.3);">
        <div class="flex items-center gap-2.5">
          <i class="fa-solid fa-location-crosshairs text-base"></i>
          <span>{{ mensajeGps }}</span>
        </div>
        <button (click)="mensajeGps = ''" class="opacity-70 hover:opacity-100"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- Spinner de Carga -->
      <div *ngIf="loading" class="text-center py-16">
        <i class="fa-solid fa-circle-notch fa-spin text-3xl" style="color: var(--accent);"></i>
        <p class="text-xs mt-3" style="color: var(--text-muted);">Cargando puntos de atención física...</p>
      </div>

      <div *ngIf="!loading">
        
        <!-- =================================================================== -->
        <!-- MAPA INTERACTIVO LEAFLET (BOLIVIA: LA PAZ Y SANTA CRUZ)             -->
        <!-- =================================================================== -->
        <div class="card p-4 mb-10 overflow-hidden" style="border: 1.5px solid var(--border-color); border-radius: 20px;">
          <div class="flex items-center justify-between px-3 py-2 mb-3">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);">
              <i class="fa-solid fa-map-location-dot text-base" style="color: var(--accent);"></i>
              <span>Mapa Geográfico Interactivo en Tiempo Real</span>
            </div>
            <div class="flex items-center gap-4 text-xs" style="color: var(--text-muted);">
              <span class="flex items-center gap-1.5">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
                Sucursal FashionStore
              </span>
              <span *ngIf="usuarioUbicacion" class="flex items-center gap-1.5">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; display: inline-block;"></span>
                Tu Ubicación GPS
              </span>
            </div>
          </div>

          <!-- Contenedor del Mapa -->
          <div id="sucursales-map" style="width: 100%; height: 460px; border-radius: 14px; background: #18181b; z-index: 1;"></div>
        </div>

        <!-- =================================================================== -->
        <!-- GRID DE TARJETAS DE SUCURSALES FÍSICAS                              -->
        <!-- =================================================================== -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div 
            *ngFor="let s of sucursales" 
            class="card p-6 flex flex-col justify-between transition-all duration-200"
            [style.border-color]="s.esMasCercana ? 'var(--accent)' : 'var(--border-color)'"
            [style.box-shadow]="s.esMasCercana ? '0 8px 30px rgba(245, 158, 11, 0.15)' : 'none'"
          >
            <div>
              <!-- Cabecera de la Tarjeta -->
              <div class="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 class="font-serif text-xl font-bold" style="color: var(--text-main);">{{ s.nombre }}</h3>
                  <span class="text-xs font-semibold block mt-0.5" style="color: var(--text-muted);">
                    <i class="fa-solid fa-city mr-1"></i> {{ s.ciudad.nombre || 'Bolivia' }}
                  </span>
                </div>
                <span 
                  *ngIf="s.esMasCercana" 
                  class="badge" 
                  style="background: rgba(245,158,11,0.2); color: var(--accent); border: 1px solid rgba(245,158,11,0.5); font-size: 0.68rem; font-weight: 800;"
                >
                  <i class="fa-solid fa-star mr-1"></i> MÁS CERCANA
                </span>
                <span 
                  *ngIf="!s.esMasCercana" 
                  class="badge" 
                  style="background: var(--table-th-bg); color: var(--text-muted); font-size: 0.7rem;"
                >
                  {{ s.ciudad.nombre }}
                </span>
              </div>

              <!-- Distancia en Km calculada con GPS -->
              <div *ngIf="s.distanciaKm !== undefined" class="mb-3 px-3 py-2 rounded-lg flex items-center justify-between text-xs font-bold" style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25);">
                <span><i class="fa-solid fa-route mr-1"></i> Distancia estimada:</span>
                <span>{{ s.distanciaKm }} km de ti</span>
              </div>

              <!-- Dirección y Teléfono -->
              <p class="text-sm mb-3" style="color: var(--text-muted);">
                <i class="fa-solid fa-map-pin mr-2" style="color: var(--accent);"></i> {{ s.direccion }}
              </p>
              
              <p *ngIf="s.telefono" class="text-sm mb-3" style="color: var(--text-muted);">
                <i class="fa-solid fa-phone mr-2" style="color: var(--accent);"></i> Tel: {{ s.telefono }}
              </p>

              <p class="text-xs mt-4 pb-4" style="color: var(--text-muted); border-bottom: 1px dashed var(--border-color);">
                <i class="fa-regular fa-clock mr-1"></i> Horario: Lunes a Sábado 09:00 - 20:30
              </p>

              <div class="mt-3 text-xs font-bold text-green-500 flex items-center gap-1.5">
                <i class="fa-solid fa-door-open"></i>
                <span>3 Vestidores Físicos con Reserva Virtual Habilitados</span>
              </div>
            </div>

            <!-- Acciones Funcionales -->
            <div class="mt-6 pt-4 flex flex-col gap-2" style="border-top: 1px solid var(--border-color);">
              <div class="flex gap-2">
                <!-- Ver en Mapa Interactivo -->
                <button 
                  (click)="centrarEnMapa(s)" 
                  class="btn btn-outline flex-1" 
                  style="font-size: 0.78rem; padding: 0.45rem 0.6rem;"
                  title="Enfocar esta tienda en el mapa"
                >
                  <i class="fa-solid fa-location-crosshairs mr-1"></i> Ver en Mapa
                </button>

                <!-- Cómo Llegar (Google Maps) -->
                <a 
                  [href]="getUrlGoogleMaps(s)" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="btn flex-1 text-center" 
                  style="font-size: 0.78rem; padding: 0.45rem 0.6rem; background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3);"
                  title="Abrir ruta GPS paso a paso en Google Maps o Waze"
                >
                  <i class="fa-solid fa-diamond-turn-right mr-1"></i> Cómo Llegar
                </a>
              </div>

              <!-- Ver Prendas Disponibles en esta Sucursal -->
              <a 
                [routerLink]="['/catalogo']" 
                [queryParams]="{ sucursal: s.id }" 
                class="btn btn-primary w-full text-center" 
                style="font-size: 0.8rem; padding: 0.5rem;"
              >
                <i class="fa-solid fa-shirt mr-1.5"></i> Ver Prendas en esta Tienda
              </a>
            </div>
          </div>
        </div>

      </div>

    </div>
  `
})
export class SucursalesComponent implements OnInit, AfterViewInit, OnDestroy {
  private productoService = inject(ProductoService);
  private router = inject(Router);

  sucursales: SucursalConDistancia[] = [];
  loading: boolean = true;
  localizandoGps: boolean = false;
  mensajeGps: string = '';
  usuarioUbicacion: { lat: number; lng: number } | null = null;

  private map: any = null;
  private markers: any[] = [];
  private userMarker: any = null;

  ngOnInit(): void {
    this.cargarSucursales();
  }

  ngAfterViewInit(): void {
    // Si los datos ya cargaron, inicializamos el mapa
    if (!this.loading && this.sucursales.length > 0) {
      setTimeout(() => this.iniciarMapa(), 300);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  cargarSucursales(): void {
    this.loading = true;
    this.productoService.getSucursales().subscribe({
      next: (data) => {
        // Asignamos coordenadas por defecto si no vinieran
        this.sucursales = (data || []).map(s => {
          if (!s.latitud || !s.longitud) {
            if (s.nombre.includes('La Paz')) {
              s.latitud = -16.5028; s.longitud = -68.1332;
            } else if (s.nombre.includes('Equipetrol')) {
              s.latitud = -17.7685; s.longitud = -63.1952;
            } else if (s.nombre.includes('Ventura')) {
              s.latitud = -17.7554; s.longitud = -63.1989;
            }
          }
          return { ...s };
        });
        this.loading = false;
        setTimeout(() => this.iniciarMapa(), 300);
      },
      error: (err) => {
        console.error('Error cargando sucursales:', err);
        this.loading = false;
      }
    });
  }

  iniciarMapa(): void {
    const mapElement = document.getElementById('sucursales-map');
    if (!mapElement || typeof L === 'undefined') return;

    if (this.map) {
      this.map.remove();
    }

    // Centro inicial de Bolivia (mostrando La Paz y Santa Cruz)
    this.map = L.map('sucursales-map').setView([-17.2, -65.5], 6);

    // Tiles de OpenStreetMap con estilo limpio
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | FashionStore Bolivia'
    }).addTo(this.map);

    this.agregarMarcadoresSucursales();
  }

  agregarMarcadoresSucursales(): void {
    if (!this.map || typeof L === 'undefined') return;

    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    // Icono dorado personalizado para las sucursales
    const storeIcon = L.divIcon({
      className: 'custom-store-pin',
      html: `
        <div style="
          background: #f59e0b; 
          color: #000; 
          width: 34px; 
          height: 34px; 
          border-radius: 50% 50% 50% 0; 
          transform: rotate(-45deg); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          box-shadow: 0 4px 14px rgba(0,0,0,0.5); 
          border: 2px solid #ffffff;
        ">
          <i class="fa-solid fa-store" style="transform: rotate(45deg); font-size: 14px; color: #18181b;"></i>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });

    this.sucursales.forEach(s => {
      if (s.latitud && s.longitud) {
        const marker = L.marker([s.latitud, s.longitud], { icon: storeIcon }).addTo(this.map);
        
        const popupContent = `
          <div style="font-family: inherit; min-width: 200px; padding: 4px;">
            <strong style="font-size: 0.95rem; color: #18181b; display: block; margin-bottom: 2px;">${s.nombre}</strong>
            <span style="font-size: 0.75rem; color: #71717a; display: block; margin-bottom: 6px;"><i class="fa-solid fa-map-pin mr-1"></i> ${s.direccion}</span>
            <div style="display: flex; gap: 4px; margin-top: 8px;">
              <a href="${this.getUrlGoogleMaps(s)}" target="_blank" style="flex: 1; text-align: center; background: #22c55e; color: #fff; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; text-decoration: none; font-weight: bold;">
                Cómo Llegar
              </a>
              <a href="/catalogo?sucursal=${s.id}" style="flex: 1; text-align: center; background: #f59e0b; color: #000; padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; text-decoration: none; font-weight: bold;">
                Ver Catálogo
              </a>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        (marker as any).sucursalId = s.id;
        this.markers.push(marker);
      }
    });
  }

  centrarEnMapa(s: SucursalConDistancia): void {
    if (!this.map || !s.latitud || !s.longitud) return;

    // Desplazamiento animado suave (flyTo) hacia la sucursal seleccionada
    this.map.flyTo([s.latitud, s.longitud], 16, { duration: 1.5 });

    // Abrir el popup del marcador correspondiente
    const marker = this.markers.find(m => (m as any).sucursalId === s.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 1600);
    }

    // Scroll suave hacia el mapa si está en pantallas móviles
    const mapElement = document.getElementById('sucursales-map');
    if (mapElement && window.innerWidth < 768) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  getUrlGoogleMaps(s: Sucursal): string {
    if (s.latitud && s.longitud) {
      return `https://www.google.com/maps/dir/?api=1&destination=${s.latitud},${s.longitud}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.nombre + ' ' + s.direccion)}`;
  }

  localizarSucursalMasCercana(): void {
    if (!navigator.geolocation) {
      this.mensajeGps = 'Tu navegador no soporta geolocalización GPS.';
      return;
    }

    this.localizandoGps = true;
    this.mensajeGps = 'Obteniendo tu ubicación satelital...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        this.usuarioUbicacion = { lat: uLat, lng: uLng };
        this.localizandoGps = false;

        // Calcular distancia Haversine a cada sucursal
        this.sucursales.forEach(s => {
          if (s.latitud && s.longitud) {
            s.distanciaKm = this.calcularDistanciaKm(uLat, uLng, s.latitud, s.longitud);
          }
        });

        // Ordenar de la más cercana a la más lejana
        this.sucursales.sort((a, b) => (a.distanciaKm || 99999) - (b.distanciaKm || 99999));
        
        // Marcar la más cercana
        this.sucursales.forEach((s, idx) => s.esMasCercana = (idx === 0));

        const masCercana = this.sucursales[0];
        this.mensajeGps = `¡Tu tienda más cercana es "${masCercana.nombre}" a solo ${masCercana.distanciaKm} km de tu ubicación!`;

        // Agregar marcador de usuario en el mapa
        if (this.map && typeof L !== 'undefined') {
          if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
          }

          const userIcon = L.divIcon({
            className: 'user-gps-pin',
            html: `
              <div style="
                background: #3b82f6; 
                width: 18px; 
                height: 18px; 
                border-radius: 50%; 
                border: 3px solid #ffffff; 
                box-shadow: 0 0 12px #3b82f6;
              "></div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });

          this.userMarker = L.marker([uLat, uLng], { icon: userIcon }).addTo(this.map);
          this.userMarker.bindPopup('<strong style="color:#18181b;">Tu Ubicación Actual</strong>').openPopup();

          // Ajustar zoom para mostrar al usuario y a la tienda más cercana
          const bounds = L.latLngBounds([
            [uLat, uLng],
            [masCercana.latitud, masCercana.longitud]
          ]);
          this.map.fitBounds(bounds, { padding: [50, 50] });
        }
      },
      (error) => {
        this.localizandoGps = false;
        if (error.code === error.PERMISSION_DENIED) {
          this.mensajeGps = 'Permiso de ubicación denegado. Por favor habilita el GPS en tu navegador para ver la tienda más cercana.';
        } else {
          this.mensajeGps = 'No se pudo obtener la posición satelital en este momento.';
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // Fórmula matemática de Haversine para calcular distancia esférica en la Tierra
  private calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }
}
