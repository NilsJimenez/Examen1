import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LookbookService, LookbookRequest, LookbookResponse, PrendaLookbook } from '../../services/lookbook.service';
import { ProductoService } from '../../services/producto.service';
import { CarritoService } from '../../services/carrito.service';

@Component({
  selector: 'app-lookbook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './lookbook.component.html',
  styleUrl: './lookbook.component.css'
})
export class LookbookComponent implements OnInit {
  cargando = false;
  
  // Formulario
  ocasion = '';
  presupuestoMax = 500;
  talla = '';
  sucursalId?: number;
  genero = 'Cualquier Género';

  sucursales: any[] = [];
  tallasDisponibles = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];

  // Resultado
  resultado?: LookbookResponse;
  conjuntoActual: PrendaLookbook[] = [];
  prendaSeleccionada3D?: PrendaLookbook;

  constructor(
    private lookbookService: LookbookService,
    private productoService: ProductoService,
    private carritoService: CarritoService
  ) {}

  ngOnInit(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => this.sucursales = data
    });
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

    // Timeout por seguridad de Gemini
    const timeoutMsg = setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        alert("La IA está demorando demasiado, intenta de nuevo.");
      }
    }, 20000);

    this.lookbookService.generarLookbook(req).subscribe({
      next: (res) => {
        clearTimeout(timeoutMsg);
        if (this.cargando) {
          this.resultado = res;
          if (res.outfits && res.outfits.length > 0) {
            this.conjuntoActual = res.outfits[0];
            if (this.conjuntoActual.length > 0) {
              this.prendaSeleccionada3D = this.getPrendaByRol('Superior') || this.conjuntoActual[0];
            }
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
    
    // Simplificamos agregando uno por uno
    let agregados = 0;
    this.conjuntoActual.forEach(p => {
      this.carritoService.agregarItem(p.producto.id, 1).subscribe({
        next: () => {
          agregados++;
          if (agregados === this.conjuntoActual.length) {
            alert("¡Todo el Outfit ha sido agregado a tu carrito!");
          }
        },
        error: (err) => console.error(err)
      });
    });
  }

  seleccionarPrenda3D(prenda: PrendaLookbook) {
    this.prendaSeleccionada3D = prenda;
  }

  getPrendaByRol(rolBuscado: string): PrendaLookbook | undefined {
    return this.conjuntoActual.find(p => p.rol.toLowerCase() === rolBuscado.toLowerCase());
  }

  getOtrasPrendas(): PrendaLookbook[] {
    const rolesPrincipales = ['superior', 'inferior', 'calzado'];
    return this.conjuntoActual.filter(p => !rolesPrincipales.includes(p.rol.toLowerCase()));
  }
}
