import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
export class LookbookComponent implements OnInit, OnDestroy {
  cargando = false;
  
  // Formulario
  ocasion = '';
  presupuestoMax = 500;
  talla = '';
  sucursalId?: number;
  genero = 'Cualquier GǸnero';

  sucursales: any[] = [];
  tallasDisponibles = ['XS', 'S', 'M', 'L', 'XL', 'Unica'];

  // Resultado
  resultado?: LookbookResponse;
  conjuntoActual: PrendaLookbook[] = [];
  prendaSeleccionada3D?: PrendaLookbook;

  // Variables Espejo Magico
  espejoActivo = false;
  cargandoEspejo = false;
  private videoElement!: HTMLVideoElement;
  private canvasElement!: HTMLCanvasElement;
  private canvasCtx!: CanvasRenderingContext2D | null;
  private pose: any;
  private camera: any;
  imagenesCargadas: {[url: string]: HTMLImageElement} = {};

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

  ngOnDestroy() {
    if(this.camera) this.camera.stop();
  }

  async encenderEspejo() {
    this.espejoActivo = true;
    this.cargandoEspejo = true;
    
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');

    setTimeout(() => this.iniciarCamara(), 500);
  }

  apagarEspejo() {
    this.espejoActivo = false;
    if(this.camera) {
      this.camera.stop();
    }
  }

  loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }

  iniciarCamara() {
    this.videoElement = document.getElementById('webcam-video') as HTMLVideoElement;
    this.canvasElement = document.getElementById('webcam-canvas') as HTMLCanvasElement;
    if(!this.canvasElement || !this.videoElement) return;
    this.canvasCtx = this.canvasElement.getContext('2d');

    this.pose = new (window as any).Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults((results: any) => this.onPoseResults(results));

    this.camera = new (window as any).Camera(this.videoElement, {
      onFrame: async () => {
        await this.pose.send({ image: this.videoElement });
      },
      width: 640,
      height: 480
    });

    this.camera.start().then(() => {
        this.cargandoEspejo = false;
    });
  }

  onPoseResults(results: any) {
    if (!this.canvasCtx || !this.canvasElement) return;
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Espejar el video (mirroring) para que sea un espejo real
    this.canvasCtx.translate(this.canvasElement.width, 0);
    this.canvasCtx.scale(-1, 1);
    
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

    if (results.poseLandmarks) {
      const lShoulder = results.poseLandmarks[12]; // Derecha real es 12
      const rShoulder = results.poseLandmarks[11]; // Izquierda real es 11
      const lHip = results.poseLandmarks[24];
      const rHip = results.poseLandmarks[23];

      if(lShoulder && rShoulder && lHip && rHip) {
        const lsX = lShoulder.x * this.canvasElement.width;
        const lsY = lShoulder.y * this.canvasElement.height;
        const rsX = rShoulder.x * this.canvasElement.width;
        const rsY = rShoulder.y * this.canvasElement.height;
        
        const lhX = lHip.x * this.canvasElement.width;
        const lhY = lHip.y * this.canvasElement.height;
        const rhX = rHip.x * this.canvasElement.width;
        const rhY = rHip.y * this.canvasElement.height;

        const shoulderWidth = Math.abs(lsX - rsX);
        const hipWidth = Math.abs(lhX - rhX);

        // Prenda Superior
        const prendaSup = this.getPrendaByRol('Superior');
        if(prendaSup && prendaSup.producto.imagen_url) {
          this.dibujarPrenda(prendaSup.producto.imagen_url, (lsX + rsX)/2, (lsY + rsY)/2, shoulderWidth * 2.2, true);
        }

        // Prenda Inferior
        const prendaInf = this.getPrendaByRol('Inferior');
        if(prendaInf && prendaInf.producto.imagen_url) {
          this.dibujarPrenda(prendaInf.producto.imagen_url, (lhX + rhX)/2, (lhY + rhY)/2, hipWidth * 2.5, false);
        }
      }
    }
    this.canvasCtx.restore();
  }

  dibujarPrenda(url: string, centerX: number, centerY: number, width: number, isSuperior: boolean) {
    if(!this.imagenesCargadas[url]) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      this.imagenesCargadas[url] = img;
    }
    
    const img = this.imagenesCargadas[url];
    if(img.complete && this.canvasCtx) {
      const aspect = img.height / img.width;
      const h = width * aspect;
      const offsetY = isSuperior ? h * 0.15 : h * 0.1; 
      
      this.canvasCtx.globalCompositeOperation = "multiply"; 
      this.canvasCtx.drawImage(img, centerX - width/2, centerY - offsetY, width, h);
      this.canvasCtx.globalCompositeOperation = "source-over";
    }
  }

  armarOutfit() {
    if (!this.ocasion || !this.presupuestoMax) {
      alert("Por favor ingresa la ocasin y tu presupuesto mǭximo.");
      return;
    }

    this.cargando = true;
    this.resultado = undefined;
    this.conjuntoActual = [];
    this.apagarEspejo();

    const req: LookbookRequest = {
      ocasion: this.ocasion,
      presupuesto_max: this.presupuestoMax,
      talla_preferida: this.talla || undefined,
      sucursal_id: this.sucursalId ? Number(this.sucursalId) : undefined,
      genero: this.genero !== 'Cualquier GǸnero' ? this.genero : undefined
    };

    const timeoutMsg = setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        alert("La IA estǭ demorando demasiado, intenta de nuevo.");
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
          alert(err.error?.detail || "No se pudo armar el outfit. Revisa tus filtros o intenta mǭs tarde.");
          this.cargando = false;
        }
      }
    });
  }

  agregarAlCarrito(prenda: PrendaLookbook) {
    this.carritoService.agregarItem(prenda.producto.id, 1).subscribe({
      next: () => alert(`${prenda.producto.nombre} agregado al carrito!`),
      error: (err) => alert(err.error?.detail || "Error al agregar al carrito")
    });
  }

  agregarTodoAlCarrito() {
    if (!this.conjuntoActual.length) return;
    let agregados = 0;
    this.conjuntoActual.forEach(p => {
      this.carritoService.agregarItem(p.producto.id, 1).subscribe({
        next: () => {
          agregados++;
          if (agregados === this.conjuntoActual.length) {
            alert("Todo el Outfit ha sido agregado a tu carrito!");
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
