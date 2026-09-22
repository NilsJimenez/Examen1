import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
export class LookbookComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private lookbookService = inject(LookbookService);
  private productoService = inject(ProductoService);
  private carritoService = inject(CarritoService);

  cargando = false;
  agregandoCarrito = false;
  
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

  // Variables Espejo / Cámara Virtual
  espejoActivo = false;
  cargandoEspejo = false;
  errorEspejo = '';
  prendaEnFoco?: PrendaLookbook;

  private mediaStream?: MediaStream;
  private animFrameId?: number;
  private videoElement?: HTMLVideoElement;
  private canvasElement?: HTMLCanvasElement;
  private canvasCtx?: CanvasRenderingContext2D | null;
  private pose: any = null;
  private cameraUtil: any = null;
  private imagenesCargadas: { [url: string]: HTMLImageElement } = {};

  ngOnInit(): void {
    this.productoService.getSucursales().subscribe({
      next: (data) => this.sucursales = data || []
    });
  }

  ngOnDestroy(): void {
    this.apagarEspejo();
  }

  seleccionarOcasionRapida(ocas: string) {
    this.ocasion = ocas;
    this.armarOutfit();
  }

  getBadgeColor(rol: string): string {
    const r = (rol || '').toLowerCase();
    if (r.includes('superior')) return '#3b82f6'; // Azul
    if (r.includes('inferior')) return '#8b5cf6'; // Púrpura
    if (r.includes('vestid')) return '#ec4899'; // Rosa Fucsia
    if (r.includes('abrig') || r.includes('chaquet')) return '#f59e0b'; // Ámbar
    return '#10b981'; // Esmeralda
  }

  armarOutfit() {
    if (!this.ocasion || !this.presupuestoMax) {
      alert("Por favor ingresa la ocasión y tu presupuesto máximo.");
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
            if (this.conjuntoActual.length > 0) {
              this.prendaEnFoco = this.getPrendaByRol('superior') || this.getPrendaByRol('vestid') || this.conjuntoActual[0];
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

  // --- COMPRAR Y ENVIAR AL CARRITO ---
  comprarOutfit() {
    this.agregarTodoAlCarrito(true);
  }

  agregarTodoAlCarrito(redirigir: boolean = true) {
    if (!this.conjuntoActual.length || this.agregandoCarrito) return;
    this.agregandoCarrito = true;

    let completados = 0;
    const total = this.conjuntoActual.length;

    this.conjuntoActual.forEach(p => {
      this.carritoService.agregarItem(p.producto.id, 1, true).subscribe({
        next: () => {
          completados++;
          if (completados === total) {
            this.finalizarAgregado(redirigir);
          }
        },
        error: (err) => {
          completados++;
          console.error("Error al agregar prenda:", err);
          if (completados === total) {
            this.finalizarAgregado(redirigir);
          }
        }
      });
    });
  }

  private finalizarAgregado(redirigir: boolean) {
    this.agregandoCarrito = false;
    this.carritoService.refreshCount();
    alert("¡Todas las prendas del Outfit recomendado han sido enviadas a tu carrito!");
    if (redirigir) {
      this.router.navigate(['/carrito']);
    }
  }

  agregarAlCarrito(prenda: PrendaLookbook) {
    this.carritoService.agregarItem(prenda.producto.id, 1, true).subscribe({
      next: () => {
        this.carritoService.refreshCount();
        alert(`¡${prenda.producto.nombre} agregada a tu carrito!`);
      },
      error: (err) => {
        alert(err.error?.detail || "Error al agregar la prenda al carrito.");
      }
    });
  }

  // --- PROBADOR VIRTUAL / CÁMARA (ESPEJO) ---
  toggleEspejo() {
    if (this.espejoActivo) {
      this.apagarEspejo();
    } else {
      this.encenderEspejo();
    }
  }

  encenderEspejo() {
    this.espejoActivo = true;
    this.cargandoEspejo = true;
    this.errorEspejo = '';
    setTimeout(() => this.iniciarCamara(), 200);
  }

  apagarEspejo() {
    this.espejoActivo = false;
    this.cargandoEspejo = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = undefined;
    }
    if (this.cameraUtil) {
      try { this.cameraUtil.stop(); } catch (e) {}
      this.cameraUtil = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = undefined;
    }
  }

  seleccionarPrendaEnFoco(prenda: PrendaLookbook) {
    this.prendaEnFoco = prenda;
  }

  getPrendaByRol(rolBuscado: string): PrendaLookbook | undefined {
    return this.conjuntoActual.find(p => (p.rol || '').toLowerCase().includes(rolBuscado.toLowerCase()));
  }

  private async iniciarCamara() {
    this.videoElement = document.getElementById('webcam-video') as HTMLVideoElement;
    this.canvasElement = document.getElementById('webcam-canvas') as HTMLCanvasElement;

    if (!this.videoElement || !this.canvasElement) {
      setTimeout(() => this.iniciarCamara(), 200);
      return;
    }

    this.canvasCtx = this.canvasElement.getContext('2d');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.errorEspejo = 'Tu navegador no soporta acceso a la cámara web.';
      this.cargandoEspejo = false;
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();
      this.cargandoEspejo = false;

      // Iniciar MediaPipe si está disponible o fallback inteligente
      this.iniciarDetectorOVisualizador();
    } catch (err: any) {
      console.error("Error al acceder a la cámara:", err);
      this.cargandoEspejo = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.errorEspejo = 'Permiso denegado. Permite el acceso a la cámara en el ícono del candado del navegador.';
      } else {
        this.errorEspejo = 'No se pudo iniciar la cámara web.';
      }
    }
  }

  private async iniciarDetectorOVisualizador() {
    try {
      await this.cargarScriptsMediaPipe();

      if ((window as any).Pose && (window as any).Camera) {
        this.pose = new (window as any).Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        this.pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        this.pose.onResults((results: any) => this.onPoseResults(results));

        this.cameraUtil = new (window as any).Camera(this.videoElement!, {
          onFrame: async () => {
            if (this.espejoActivo && this.videoElement) {
              await this.pose.send({ image: this.videoElement });
            }
          },
          width: 640,
          height: 480
        });

        await this.cameraUtil.start();
        return;
      }
    } catch (e) {
      console.warn("MediaPipe no disponible, usando probador overlay directo:", e);
    }

    // Fallback: Loop de renderizado directo en Canvas
    this.iniciarBucleFallback();
  }

  private cargarScriptsMediaPipe(): Promise<void> {
    const s1 = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    const s2 = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    return Promise.all([this.loadScript(s1), this.loadScript(s2)]).then(() => {});
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.body.appendChild(script);
    });
  }

  private onPoseResults(results: any) {
    if (!this.canvasCtx || !this.canvasElement || !this.espejoActivo) return;

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Espejo real
    this.canvasCtx.translate(this.canvasElement.width, 0);
    this.canvasCtx.scale(-1, 1);
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

    if (results.poseLandmarks) {
      const lShoulder = results.poseLandmarks[12];
      const rShoulder = results.poseLandmarks[11];
      const lHip = results.poseLandmarks[24];
      const rHip = results.poseLandmarks[23];

      if (lShoulder && rShoulder) {
        const lsX = lShoulder.x * this.canvasElement.width;
        const lsY = lShoulder.y * this.canvasElement.height;
        const rsX = rShoulder.x * this.canvasElement.width;
        const rsY = rShoulder.y * this.canvasElement.height;
        const shoulderWidth = Math.abs(lsX - rsX);

        // Prenda Superior o Vestido
        const prendaSup = this.getPrendaByRol('superior') || this.getPrendaByRol('vestid');
        if (prendaSup?.producto?.imagen_url) {
          this.renderPrendaEnCanvas(
            prendaSup.producto.imagen_url,
            (lsX + rsX) / 2,
            (lsY + rsY) / 2,
            shoulderWidth * 2.3,
            true
          );
        }

        // Prenda Inferior (si hay cadera detectada y no es vestido)
        if (lHip && rHip && !this.getPrendaByRol('vestid')) {
          const lhX = lHip.x * this.canvasElement.width;
          const lhY = lHip.y * this.canvasElement.height;
          const rhX = rHip.x * this.canvasElement.width;
          const rhY = rHip.y * this.canvasElement.height;
          const hipWidth = Math.abs(lhX - rhX);

          const prendaInf = this.getPrendaByRol('inferior');
          if (prendaInf?.producto?.imagen_url) {
            this.renderPrendaEnCanvas(
              prendaInf.producto.imagen_url,
              (lhX + rhX) / 2,
              (lhY + rhY) / 2,
              hipWidth * 2.4,
              false
            );
          }
        }
      }
    } else {
      this.dibujarPrendasFallback();
    }

    this.canvasCtx.restore();
  }

  private iniciarBucleFallback() {
    const loop = () => {
      if (!this.espejoActivo || !this.canvasCtx || !this.videoElement || !this.canvasElement) return;

      this.canvasCtx.save();
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

      this.canvasCtx.translate(this.canvasElement.width, 0);
      this.canvasCtx.scale(-1, 1);
      this.canvasCtx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);

      this.dibujarPrendasFallback();

      this.canvasCtx.restore();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private dibujarPrendasFallback() {
    if (!this.canvasCtx || !this.canvasElement) return;
    const w = this.canvasElement.width;
    const h = this.canvasElement.height;

    // Si hay una prenda en foco
    const prendaParaMostrar = this.prendaEnFoco || this.conjuntoActual[0];
    if (prendaParaMostrar?.producto?.imagen_url) {
      this.renderPrendaEnCanvas(
        prendaParaMostrar.producto.imagen_url,
        w * 0.5,
        h * 0.52,
        w * 0.48,
        true
      );
    }
  }

  private renderPrendaEnCanvas(url: string, centerX: number, centerY: number, width: number, isSuperior: boolean) {
    if (!this.imagenesCargadas[url]) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      this.imagenesCargadas[url] = img;
    }

    const img = this.imagenesCargadas[url];
    if (img.complete && this.canvasCtx) {
      const aspect = (img.height || 1) / (img.width || 1);
      const h = width * aspect;
      const offsetY = isSuperior ? h * 0.18 : h * 0.1;

      this.canvasCtx.globalAlpha = 0.88;
      this.canvasCtx.drawImage(img, centerX - width / 2, centerY - offsetY, width, h);
      this.canvasCtx.globalAlpha = 1.0;
    }
  }
}
