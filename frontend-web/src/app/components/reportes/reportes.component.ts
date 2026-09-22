import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesService, DashboardReporteOut } from '../../services/reportes.service';
import { ProductoService } from '../../services/producto.service';
import { Sucursal } from '../../models/sucursal.models';

declare var webkitSpeechRecognition: any;

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in" style="width: 100%;">
      
      <div class="flex items-center justify-between mb-8 pb-4" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h2 style="color: var(--text-main); font-family: serif; font-size: 2rem; margin: 0;">Panel de Inteligencia Comercial</h2>
          <p style="color: var(--text-muted); margin-top: 0.5rem; font-size: 0.95rem;">Monitor de KPIs, rentabilidad y efectividad de reservas en tiempo real.</p>
        </div>
        
        <div class="flex gap-3">
          <button (click)="descargar('pdf')" [disabled]="descargandoFormato === 'pdf'" class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 0.6rem 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid" [ngClass]="descargandoFormato === 'pdf' ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'"></i> {{ descargandoFormato === 'pdf' ? 'Generando...' : 'Descargar PDF' }}
          </button>
          <button (click)="descargar('xlsx')" [disabled]="descargandoFormato === 'xlsx'" class="btn btn-outline" style="border-color: #10b981; color: #10b981; padding: 0.6rem 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid" [ngClass]="descargandoFormato === 'xlsx' ? 'fa-circle-notch fa-spin' : 'fa-file-excel'"></i> {{ descargandoFormato === 'xlsx' ? 'Generando...' : 'Descargar Excel' }}
          </button>
        </div>
      </div>

      <!-- Barra de Comando por Voz para Descarga Directa de Reportes -->
      <div *ngIf="esAdmin" class="p-5 mb-6 rounded-xl" style="background: linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(99, 102, 241, 0.08)); border: 1px solid rgba(167, 139, 250, 0.35); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <div class="flex items-center justify-between mb-2">
          <label style="font-size: 0.82rem; color: #a78bfa; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <i class="fa-solid fa-microphone"></i> Descarga Rápida por Comando de Voz (PDF o Excel)
          </label>
          <span class="text-xs" style="color: var(--text-muted); font-style: italic;">
            <i class="fa-solid fa-bolt" style="color: #f59e0b;"></i> Di por micrófono: "Descargar en PDF" o "Descargar en Excel"
          </span>
        </div>

        <div class="flex gap-2 items-center" style="flex-wrap: wrap;">
          <input 
            type="text" 
            [(ngModel)]="promptTextoIA" 
            (keyup.enter)="enviarPromptTexto()" 
            placeholder="Habla o escribe: Ej: 'Reporte de ventas de este mes descargar en PDF'..." 
            class="input" 
            style="flex: 1; min-width: 250px; background: var(--card-bg); border: 1px solid rgba(167, 139, 250, 0.4); color: var(--text-main); padding: 0.65rem 1rem; border-radius: 8px;"
          >

          <!-- Botón de Micrófono / Voz interactivo -->
          <button 
            type="button"
            (click)="toggleEscucha()" 
            class="btn" 
            [style.background]="escuchando ? '#ef4444' : 'rgba(167, 139, 250, 0.15)'"
            [style.color]="escuchando ? '#ffffff' : '#a78bfa'"
            [style.border]="escuchando ? '1px solid #ef4444' : '1px solid #a78bfa'"
            style="padding: 0.65rem 1.2rem; display: flex; align-items: center; gap: 0.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
            title="Hablar por micrófono para descargar reporte"
          >
            <i class="fa-solid" [ngClass]="escuchando ? 'fa-microphone-lines fa-beat' : 'fa-microphone'"></i>
            <span>{{ escuchando ? 'Detener Micrófono' : 'Hablar por Micrófono' }}</span>
          </button>

          <!-- Botón Ejecutar -->
          <button 
            type="button"
            (click)="enviarPromptTexto()" 
            [disabled]="!promptTextoIA.trim()" 
            class="btn" 
            style="background: #a78bfa; color: #1e1b4b; font-weight: bold; padding: 0.65rem 1.2rem; display: flex; align-items: center; gap: 0.5rem; border-radius: 8px;"
          >
            <i class="fa-solid fa-cloud-arrow-down"></i>
            <span>Descargar</span>
          </button>
        </div>

        <!-- Banner animado mientras escucha -->
        <div *ngIf="escuchando" class="mt-3 p-3 rounded-lg flex items-center justify-between" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5;">
          <div class="flex items-center gap-3">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;" class="animate-ping"></span>
            <span class="text-xs sm:text-sm font-semibold">
              <i class="fa-solid fa-headphones mr-1"></i> Te estamos escuchando... Di: <em>"Descargar reporte en PDF"</em> o <em>"Descargar en Excel"</em>
            </span>
          </div>
          <button (click)="detenerEscucha()" type="button" class="text-xs px-2 py-1 rounded" style="background: #ef4444; color: white; border: none; cursor: pointer;">
            Finalizar
          </button>
        </div>

        <!-- Notificación de Descarga en Vivo -->
        <div *ngIf="mensajeVozEstado" class="mt-3 p-3 rounded-lg flex items-center gap-3 text-sm font-bold animate-fade-in" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981;">
          <i class="fa-solid" [ngClass]="descargandoFormato ? 'fa-circle-notch fa-spin' : 'fa-circle-check'"></i>
          <span>{{ mensajeVozEstado }}</span>
        </div>
      </div>

      <!-- Filtros Avanzados -->
      <div class="card p-5 mb-8" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
        <div class="flex flex-wrap items-end gap-5">
          <div style="flex: 1; min-width: 150px;">
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Fecha Inicio</label>
            <input type="date" [(ngModel)]="filtros.fecha_inicio" class="input" style="width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main);">
          </div>
          
          <div style="flex: 1; min-width: 150px;">
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Fecha Fin</label>
            <input type="date" [(ngModel)]="filtros.fecha_fin" class="input" style="width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main);">
          </div>
          
          <div *ngIf="esAdmin" style="flex: 1; min-width: 200px;">
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Sucursal</label>
            <select [(ngModel)]="filtros.sucursal_id" class="input" style="width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main);">
              <option [ngValue]="null">Todas las sucursales</option>
              <option *ngFor="let s of sucursales" [value]="s.id">{{ s.nombre }}</option>
            </select>
          </div>

          <div style="min-width: 150px;">
            <button (click)="cargarDashboard()" class="btn btn-primary" style="width: 100%; height: 42px; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <i class="fa-solid fa-filter"></i> Aplicar Filtros
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="cargando" style="text-align: center; padding: 4rem 0;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--accent); margin-bottom: 1rem;"></i>
        <p style="color: var(--text-muted);">Cargando reporte comercial...</p>
      </div>

      <!-- Excepción 1: Sin datos -->
      <div *ngIf="!cargando && data?.mensaje" class="card" style="text-align: center; padding: 4rem 2rem; border-style: dashed; border-color: var(--border-color); background: transparent;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--table-th-bg); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
          <i class="fa-solid fa-folder-open" style="font-size: 1.8rem; color: var(--text-muted);"></i>
        </div>
        <h3 style="font-size: 1.3rem; color: var(--text-main); margin-bottom: 0.5rem;">Sin transacciones</h3>
        <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto;">{{ data?.mensaje }}</p>
      </div>

      <!-- Resumen IA -->
      <div *ngIf="!cargando && data?.resumen_ia" class="card" style="padding: 1.5rem; margin-bottom: 2rem; background: linear-gradient(145deg, rgba(167, 139, 250, 0.1), var(--card-bg)); border: 1px solid #a78bfa; border-left: 4px solid #a78bfa;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
          <h3 style="font-size: 1.15rem; font-family: serif; color: #a78bfa; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Resumen Ejecutivo
          </h3>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button (click)="descargar('pdf')" [disabled]="descargandoFormato === 'pdf'" class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 0.35rem 0.8rem; font-size: 0.82rem; border-radius: 6px; display: flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid" [ngClass]="descargandoFormato === 'pdf' ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'"></i> {{ descargandoFormato === 'pdf' ? 'Generando...' : 'Descargar PDF' }}
            </button>
            <button (click)="descargar('xlsx')" [disabled]="descargandoFormato === 'xlsx'" class="btn btn-outline" style="border-color: #10b981; color: #10b981; padding: 0.35rem 0.8rem; font-size: 0.82rem; border-radius: 6px; display: flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid" [ngClass]="descargandoFormato === 'xlsx' ? 'fa-circle-notch fa-spin' : 'fa-file-excel'"></i> {{ descargandoFormato === 'xlsx' ? 'Generando...' : 'Descargar Excel' }}
            </button>
          </div>
        </div>
        <p style="color: var(--text-main); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap; margin: 0;">{{ data?.resumen_ia }}</p>

        <div *ngIf="data?.filtros_interpretados" style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed rgba(167, 139, 250, 0.3); display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap;">
          <span *ngIf="data?.filtros_interpretados?.sucursal_id"><i class="fa-solid fa-store" style="color: #a78bfa;"></i> Sucursal: #{{ data?.filtros_interpretados?.sucursal_id }}</span>
          <span *ngIf="data?.filtros_interpretados?.fecha_inicio"><i class="fa-solid fa-calendar-day" style="color: #a78bfa;"></i> Desde: {{ data?.filtros_interpretados?.fecha_inicio }}</span>
          <span *ngIf="data?.filtros_interpretados?.fecha_fin"><i class="fa-solid fa-calendar-day" style="color: #a78bfa;"></i> Hasta: {{ data?.filtros_interpretados?.fecha_fin }}</span>
          <span *ngIf="data?.filtros_interpretados?.formato_descarga"><i class="fa-solid fa-cloud-arrow-down" style="color: #10b981;"></i> Descarga solicitada: <b>{{ data?.filtros_interpretados?.formato_descarga?.toUpperCase() }}</b></span>
        </div>
      </div>

      <!-- Tarjetas de KPIs (Diseño Profesional en Grid puro inline) -->
      <div *ngIf="!cargando && !data?.mensaje && data" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        
        <!-- KPI 1 -->
        <div class="card" style="padding: 1.5rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid var(--accent);">
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Total Ingresos</span>
            <i class="fa-solid fa-sack-dollar" style="color: var(--accent); font-size: 1rem;"></i>
          </div>
          <div style="font-size: 2.2rem; font-family: serif; color: var(--text-main); font-weight: 700;">
            <span style="font-size: 1.2rem; color: var(--text-muted); margin-right: 0.2rem;">Bs.</span>{{ data.kpis.total_vendido.toFixed(2) }}
          </div>
        </div>
        
        <!-- KPI 2 -->
        <div class="card" style="padding: 1.5rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid #60a5fa;">
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Ticket Promedio</span>
            <i class="fa-solid fa-receipt" style="color: #60a5fa; font-size: 1rem;"></i>
          </div>
          <div style="font-size: 2.2rem; font-family: serif; color: var(--text-main); font-weight: 700;">
            <span style="font-size: 1.2rem; color: var(--text-muted); margin-right: 0.2rem;">Bs.</span>{{ data.kpis.ticket_promedio.toFixed(2) }}
          </div>
        </div>

        <!-- KPI 3 -->
        <div class="card" style="padding: 1.5rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid #a78bfa;">
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Rotación (Ventas)</span>
            <i class="fa-solid fa-tags" style="color: #a78bfa; font-size: 1rem;"></i>
          </div>
          <div style="font-size: 2.2rem; font-family: serif; color: var(--text-main); font-weight: 700;">
            {{ data.kpis.cantidad_ventas }} <span style="font-size: 1rem; color: var(--text-muted); font-weight: normal; font-family: sans-serif;">operaciones</span>
          </div>
        </div>

        <!-- KPI 4 -->
        <div class="card" style="padding: 1.5rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid #10b981;">
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Conversión Reservas</span>
            <i class="fa-solid fa-person-walking-arrow-right" style="color: #10b981; font-size: 1rem;"></i>
          </div>
          <div style="font-size: 2.2rem; font-family: serif; color: #10b981; font-weight: 700;">
            {{ data.kpis.reservas_concretadas_pct }}<span style="font-size: 1.5rem;">%</span>
          </div>
        </div>

      </div>

      <!-- Gráfico / Tabla Ventas por dia -->
      <div *ngIf="!cargando && !data?.mensaje && data" class="card" style="padding: 2rem; background: var(--card-bg); border: 1px solid var(--border-color);">
          <h3 style="font-size: 1.2rem; font-family: serif; color: var(--text-main); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
            <i class="fa-solid fa-chart-line" style="color: var(--accent);"></i> Desempeño Diario de Ventas
          </h3>
          
          <div style="background: var(--table-th-bg); border-radius: 0.75rem; border: 1px solid var(--border-color); overflow: hidden;">
              <table class="table" style="width: 100%; margin: 0; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-color);">
                    <th style="padding: 1rem; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Fecha</th>
                    <th style="padding: 1rem; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; text-align: right;">Ingreso Generado (Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let v of data.ventas_por_dia" style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                    <td style="padding: 1rem; font-weight: 600; color: var(--text-main);">
                      <i class="fa-regular fa-calendar-days" style="color: var(--text-muted); margin-right: 0.5rem;"></i> {{ v.fecha }}
                    </td>
                    <td style="padding: 1rem; text-align: right; color: var(--accent); font-weight: bold; font-size: 1.1rem;">
                      {{ v.total.toFixed(2) }}
                    </td>
                  </tr>
                </tbody>
              </table>
          </div>
      </div>

    </div>
  `
})
export class ReportesComponent implements OnInit {
  private reportesService = inject(ReportesService);
  private productoService = inject(ProductoService);
  
  @Input() esAdmin: boolean = false;

  filtros: any = { sucursal_id: null, fecha_inicio: null, fecha_fin: null };
  data: DashboardReporteOut | null = null;
  cargando = false;
  escuchando = false;
  promptTextoIA = '';
  mensajeVozEstado = '';
  descargandoFormato: 'pdf' | 'xlsx' | null = null;
  sucursales: Sucursal[] = [];

  private recognition: any = null;

  ngOnInit() {
    this.cargarDashboard();
    if (this.esAdmin) {
      this.cargarSucursales();
    }
  }

  cargarSucursales() {
    this.productoService.getSucursales().subscribe({
      next: (data) => this.sucursales = data || [],
      error: (err) => console.error("Error al cargar sucursales", err)
    });
  }

  cargarDashboard() {
    this.cargando = true;
    this.reportesService.getDashboard(this.filtros).subscribe({
      next: (res) => {
        this.data = res;
        this.cargando = false;
      },
      error: (err) => {
        alert(err.error?.detail || "Error al cargar reportes. Posible restricción de permisos.");
        this.cargando = false;
      }
    });
  }

  enviarPromptTexto() {
    if (!this.promptTextoIA.trim()) return;
    const p = this.promptTextoIA.trim();
    this.procesarComandoVoz(p);
  }

  toggleEscucha() {
    if (this.escuchando) {
      this.detenerEscucha();
    } else {
      this.iniciarEscucha();
    }
  }

  iniciarEscucha() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz por micrófono. Te recomendamos usar Google Chrome o Microsoft Edge.");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onstart = () => {
        this.escuchando = true;
        this.mensajeVozEstado = 'Escuchando... Di: "Descargar en PDF" o "Descargar en Excel"';
      };

      this.recognition.onresult = (event: any) => {
        let textoParcial = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          textoParcial += event.results[i][0].transcript;
        }
        if (textoParcial) {
          this.promptTextoIA = textoParcial;
        }

        if (event.results[0] && event.results[0].isFinal) {
          const textoFinal = event.results[0][0].transcript.trim();
          this.escuchando = false;
          this.promptTextoIA = textoFinal;
          this.procesarComandoVoz(textoFinal);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn("SpeechRecognition error:", event.error);
        this.escuchando = false;
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          alert("Permiso de micrófono bloqueado en tu navegador. Haz clic en el ícono del candado junto a la URL para permitir el micrófono.");
          this.mensajeVozEstado = '';
        } else if (event.error === 'no-speech') {
          this.mensajeVozEstado = 'No se escuchó comando. Haz clic en el micrófono e inténtalo de nuevo.';
          setTimeout(() => { if (!this.escuchando && !this.descargandoFormato) this.mensajeVozEstado = ''; }, 3000);
        } else {
          this.mensajeVozEstado = '';
        }
      };

      this.recognition.onend = () => {
        this.escuchando = false;
      };

      this.recognition.start();
    } catch (err) {
      console.error("Error al iniciar micrófono:", err);
      this.escuchando = false;
      this.mensajeVozEstado = '';
    }
  }

  detenerEscucha() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.escuchando = false;
  }

  procesarComandoVoz(comando: string) {
    if (!comando || !comando.trim()) return;
    const pLower = comando.toLowerCase();

    // 1. Detectar Formato solicitado (PDF o Excel)
    let formato: 'pdf' | 'xlsx' | null = null;
    if (pLower.includes('excel') || pLower.includes('xlsx') || pLower.includes('exel') || pLower.includes('ecxel')) {
      formato = 'xlsx';
    } else if (pLower.includes('pdf')) {
      formato = 'pdf';
    } else {
      // Si el comando pide "descargar" o "reporte" sin especificar, por defecto PDF
      if (pLower.includes('descarg') || pLower.includes('reporte') || pLower.includes('bajar')) {
        formato = 'pdf';
      }
    }

    if (!formato) {
      this.mensajeVozEstado = `Comando: "${comando}". Por favor menciona "PDF" o "Excel" para descargar.`;
      setTimeout(() => { if (!this.descargandoFormato) this.mensajeVozEstado = ''; }, 4000);
      return;
    }

    // 2. Detectar fechas mencionadas para aplicarlas
    const hoy = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : '' + n;
    const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

    if (pLower.includes('este mes') || pLower.includes('mes actual') || pLower.includes('del mes')) {
      this.filtros.fecha_inicio = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
      this.filtros.fecha_fin = hoyStr;
    } else if (pLower.includes('hoy') || pLower.includes('del dia') || pLower.includes('del día')) {
      this.filtros.fecha_inicio = hoyStr;
      this.filtros.fecha_fin = hoyStr;
    } else if (pLower.includes('esta semana') || pLower.includes('semana')) {
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - 7);
      this.filtros.fecha_inicio = `${inicioSemana.getFullYear()}-${pad(inicioSemana.getMonth() + 1)}-${pad(inicioSemana.getDate())}`;
      this.filtros.fecha_fin = hoyStr;
    } else if (pLower.includes('este año') || pLower.includes('año actual')) {
      this.filtros.fecha_inicio = `${hoy.getFullYear()}-01-01`;
      this.filtros.fecha_fin = hoyStr;
    }

    // 3. Detectar sucursal si se menciona
    if (this.sucursales && this.sucursales.length > 0) {
      for (const s of this.sucursales) {
        if (pLower.includes(s.nombre.toLowerCase())) {
          this.filtros.sucursal_id = s.id;
          break;
        }
      }
    }

    // 4. Iniciar descarga directa e inmediata (sin pantalla de bloqueo ni sonido)
    this.mensajeVozEstado = `Generando y descargando reporte en ${formato.toUpperCase()}...`;
    this.descargar(formato);
  }

  descargar(formato: 'pdf' | 'xlsx', filtrosCustom?: any) {
    this.descargandoFormato = formato;
    const f = filtrosCustom || this.filtros;
    this.reportesService.exportarReporte(formato, f).subscribe({
      next: (blob: any) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_fashionstore_${formato}_${new Date().getTime()}.${formato}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.descargandoFormato = null;
        this.mensajeVozEstado = `¡Reporte ${formato.toUpperCase()} descargado con éxito!`;
        setTimeout(() => {
          if (!this.descargandoFormato) this.mensajeVozEstado = '';
        }, 3500);
      },
      error: (err: any) => {
        console.error("Error al exportar reporte", err);
        this.descargandoFormato = null;
        this.mensajeVozEstado = `Error al descargar ${formato.toUpperCase()}. Verifica que existan ventas en el rango seleccionado.`;
        setTimeout(() => {
          if (!this.descargandoFormato) this.mensajeVozEstado = '';
        }, 4000);
      }
    });
  }
}
