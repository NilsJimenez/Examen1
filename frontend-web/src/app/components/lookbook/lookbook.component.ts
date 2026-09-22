import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LookbookService, LookbookRequest, LookbookResponse, PrendaLookbook } from '../../services/lookbook.service';
import { ProductoService } from '../../services/producto.service';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-lookbook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lookbook.component.html',
  styleUrl: './lookbook.component.css'
})
export class LookbookComponent implements OnInit {
  cargando = false;
  
  // Formulario
  ocasion = 'Casual Urbano';
  presupuestoMax = 700;
  talla = '';
  sucursalId?: number;
  genero: 'Hombre' | 'Mujer' | 'Cualquier Género' = 'Cualquier Género';

  sucursales: any[] = [];
  tallasDisponibles = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];

  // Resultado
  resultado?: LookbookResponse;
  conjuntoActual: PrendaLookbook[] = [];

  constructor(
    private lookbookService: LookbookService,
    private productoService: ProductoService,
    private carritoService: CarritoService
  ) {}

  ngOnInit(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => this.sucursales = data || []
    });
  }

  seleccionarOcasionRapida(ocas: string) {
    this.ocasion = ocas;
    this.armarOutfit();
  }

  getBadgeColor(rol: string): string {
    const r = (rol || '').toLowerCase();
    if (r.includes('superior')) return '#3b82f6'; // Azul
    if (r.includes('inferior')) return '#8b5cf6'; // Púrpura
    if (r.includes('calzado')) return '#10b981'; // Verde Esmeralda
    if (r.includes('vestid')) return '#ec4899'; // Rosa Fucsia
    return '#f59e0b'; // Ámbar para accesorio
  }

  armarOutfit() {
    if (!this.ocasion || !this.presupuestoMax) {
      alert("Por favor ingresa la ocasión y tu presupuesto máximo.");
      return;
    }

    this.cargando = true;
    this.resultado = undefined;
    this.conjuntoActual = [];

    const req: LookbookRequest = {
      ocasion: this.ocasion,
      presupuesto_max: this.presupuestoMax,
      talla_preferida: this.talla || undefined,
      sucursal_id: this.sucursalId ? Number(this.sucursalId) : undefined,
      genero: this.genero !== 'Cualquier Género' ? this.genero : undefined
    };

    const timeoutMsg = setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        alert("El servidor de estilismo tardó en responder. Por favor reintenta.");
      }
    }, 18000);

    this.lookbookService.generarLookbook(req).subscribe({
      next: (res) => {
        clearTimeout(timeoutMsg);
        if (this.cargando) {
          this.resultado = res;
          if (res.outfits && res.outfits.length > 0) {
            this.conjuntoActual = res.outfits[0];
          }
          this.cargando = false;
        }
      },
      error: (err) => {
        clearTimeout(timeoutMsg);
        if (this.cargando) {
          alert(err.error?.detail || "No se pudo armar el outfit. Revisa tus filtros o intenta más tarde.");
          this.cargando = false;
        }
      }
    });
  }

  agregarAlCarrito(prenda: PrendaLookbook) {
    this.carritoService.agregarItem(prenda.producto.id, 1).subscribe({
      next: () => alert(`¡${prenda.producto.nombre} agregado al carrito!`),
      error: (err) => alert(err.error?.detail || "Error al agregar al carrito")
    });
  }

  agregarTodoAlCarrito() {
    if (!this.conjuntoActual.length) return;
    let agregados = 0;
    const total = this.conjuntoActual.length;
    this.conjuntoActual.forEach(p => {
      this.carritoService.agregarItem(p.producto.id, 1).subscribe({
        next: () => {
          agregados++;
          if (agregados === total) {
            alert("¡Todas las prendas del Outfit fueron agregadas a tu carrito!");
          }
        },
        error: (err) => console.error(err)
      });
    });
  }
}
