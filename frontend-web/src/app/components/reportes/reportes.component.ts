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

      <!-- Barra de Comando Inteligente con IA (Voz o Texto) -->
      <div *ngIf="esAdmin" class="p-4 mb-6 rounded-xl" style="background: linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(99, 102, 241, 0.08)); border: 1px solid rgba(167, 139, 250, 0.3);">
        <label style="display: block; font-size: 0.8rem; color: #a78bfa; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Consulta Inteligente con IA (Voz o Texto con Descarga Automática)
        </label>
        <div class="flex gap-2">
          <input 
            type="text" 
            [(ngModel)]="promptTextoIA" 
            (keyup.enter)="enviarPromptTexto()" 
            placeholder="Ej: 'Ventas de este mes y descargar en PDF' o 'Reporte en Excel de la sucursal Central'..." 
            class="input" 
            style="flex: 1; background: var(--card-bg); border: 1px solid rgba(167, 139, 250, 0.4); color: var(--text-main); padding: 0.6rem 1rem;"
          >
          <button 
            (click)="enviarPromptTexto()" 
            [disabled]="cargando || !promptTextoIA.trim()" 
            class="btn" 
            style="background: #a78bfa; color: #1e1b4b; font-weight: bold; padding: 0 1.2rem; display: flex; align-items: center; gap: 0.5rem;"
          >
            <i class="fa-solid fa-paper-plane"></i> Pedir
          </button>
          <button 
            (click)="iniciarEscucha()" 
            [disabled]="escuchando || cargando" 
            class="btn btn-outline" 
            style="border-color: #a78bfa; color: #a78bfa; padding: 0 1.2rem; display: flex; align-items: center; gap: 0.5rem;"
            title="Hablar por micrófono"
          >
            <i class="fa-solid fa-microphone" [class.fa-beat-fade]="escuchando"></i> {{ escuchando ? 'Escuchando...' : 'Voz' }}
          </button>
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
        <p style="color: var(--text-muted);">Procesando Big Data Comercial...</p>
      </div>

      <!-- Excepción 1: Sin datos -->
      <div *ngIf="!cargando && data?.mensaje" class="card" style="text-align: center; padding: 4rem 2rem; border-style: dashed; border-color: var(--border-color); background: transparent;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--table-th-bg); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
          <i class="fa-solid fa-folder-open" style="font-size: 1.8rem; color: var(--text-muted);"></i>
        </div>
        <h3 style="font-size: 1.3rem; color: var(--text-main); margin-bottom: 0.5rem;">Sin transacciones</h3>
        <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto;">{{ data?.mensaje }}</p>
      </div>

      <!-- Texto Escuchado transitorio -->
      <div *ngIf="textoEscuchado" class="card" style="padding: 1rem; margin-bottom: 1rem; border: 1px dashed #a78bfa; background: transparent; text-align: center;">
         <i class="fa-solid fa-quote-left" style="color: #a78bfa; margin-right: 0.5rem;"></i>
         <span style="color: var(--text-muted); font-style: italic;">{{ textoEscuchado }}</span>
         <i class="fa-solid fa-quote-right" style="color: #a78bfa; margin-left: 0.5rem;"></i>
      </div>

      <!-- Resumen IA -->
      <div *ngIf="!cargando && data?.resumen_ia" class="card" style="padding: 1.5rem; margin-bottom: 2rem; background: linear-gradient(145deg, rgba(167, 139, 250, 0.1), var(--card-bg)); border: 1px solid #a78bfa; border-left: 4px solid #a78bfa;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
          <h3 style="font-size: 1.15rem; font-family: serif; color: #a78bfa; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Resumen Ejecutivo de IA
          </h3>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button (click)="descargar('pdf')" [disabled]="descargandoFormato === 'pdf'" class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 0.35rem 0.8rem; font-size: 0.82rem; border-radius: 6px; display: flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid" [ngClass]="descargandoFormato === 'pdf' ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'"></i> {{ descargandoFormato === 'pdf' ? 'Generando...' : 'Descargar PDF' }}
            </button>
            <button (click)="descargar('xlsx')" [disabled]="descargandoFormato === 'xlsx'" class="btn btn-outline" style="border-color: #10b981; color: #10b981; padding: 0.35rem 0.8rem; font-size: 0.82rem; border-radius: 6px; display: flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid" [ngClass]="descargandoFormato === 'xlsx' ? 'fa-circle-notch fa-spin' : 'fa-file-excel'"></i> {{ descargandoFormato === 'xlsx' ? 'Generando...' : 'Descargar Excel' }}
            </button>
            <button (click)="toggleVoz()" class="btn btn-outline" style="border-color: #a78bfa; color: #a78bfa; padding: 0.35rem 0.8rem; font-size: 0.82rem; border-radius: 50px;">
              <i class="fa-solid" [ngClass]="hablando ? 'fa-volume-xmark' : 'fa-volume-high'"></i> {{ hablando ? 'Detener Voz' : 'Escuchar' }}
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

  filtros: any = { sucursal_id: null };
  data: DashboardReporteOut | null = null;
  cargando = false;
  escuchando = false;
  textoEscuchado = '';
  promptTextoIA = '';
  descargandoFormato: 'pdf' | 'xlsx' | null = null;
  hablando = false;
  sucursales: Sucursal[] = [];

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
    if (this.hablando) this.detenerVoz(); // Detener voz si se carga otro reporte
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
    if (!this.promptTextoIA.trim() || this.cargando) return;
    const p = this.promptTextoIA.trim();
    this.textoEscuchado = p;
    this.promptTextoIA = '';
    this.procesarComandoIA(p);
  }

  iniciarEscucha() {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Tu navegador no soporta reconocimiento de voz. Puedes escribir tu consulta en el campo de texto de IA.");
      return;
    }
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      this.escuchando = true;
      this.textoEscuchado = 'Escuchando tu voz...';
      this.detenerVoz(); // Callar a la IA si empieza a escuchar al usuario
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.textoEscuchado = transcript;
      this.procesarComandoIA(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      alert("Error con el micrófono. Puedes escribir tu solicitud directamente en el recuadro de texto.");
      this.escuchando = false;
      this.textoEscuchado = '';
    };

    recognition.onend = () => {
      this.escuchando = false;
    };

    recognition.start();
  }

  procesarComandoIA(prompt: string) {
    this.cargando = true;
    
    // Configuramos un temporizador de seguridad en caso de que el backend o la IA no respondan en 15s
    const timeoutError = setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        this.textoEscuchado = '';
        alert("Los servidores de Inteligencia Artificial tardaron demasiado en responder. Puedes usar los filtros manuales o los botones de descarga directa.");
      }
    }, 15000);

    this.reportesService.generarReporteIA(prompt, this.sucursales).subscribe({
      next: (res) => {
        clearTimeout(timeoutError);
        if (this.cargando) {
          this.data = res;
          this.cargando = false;
          setTimeout(() => this.textoEscuchado = '', 6000);
          
          // Sincronizar filtros si la IA detectó fechas o sucursal
          if (res.filtros_interpretados) {
            if (res.filtros_interpretados.sucursal_id !== undefined && res.filtros_interpretados.sucursal_id !== null) {
              this.filtros.sucursal_id = res.filtros_interpretados.sucursal_id;
            }
            if (res.filtros_interpretados.fecha_inicio) {
              this.filtros.fecha_inicio = res.filtros_interpretados.fecha_inicio;
            }
            if (res.filtros_interpretados.fecha_fin) {
              this.filtros.fecha_fin = res.filtros_interpretados.fecha_fin;
            }

            // Descarga automática si el usuario la solicitó
            if (res.filtros_interpretados.formato_descarga) {
              this.descargar(res.filtros_interpretados.formato_descarga);
            }
          }

          // --- TEXT TO SPEECH ---
          if (this.data?.resumen_ia && !this.data.resumen_ia.includes("saturada")) {
            this.reproducirVoz(this.data.resumen_ia);
          }
        }
      },
      error: (err) => {
        clearTimeout(timeoutError);
        if (this.cargando) {
          alert(err.error?.detail || "Los servidores de Inteligencia Artificial están ocupados. Por favor, intenta de nuevo o usa los filtros y botones de descarga directa.");
          this.cargando = false;
          this.textoEscuchado = '';
        }
      }
    });
  }

  // --- MÉTODOS DE SÍNTESIS DE VOZ ---
  reproducirVoz(texto: string) {
    if (!('speechSynthesis' in window)) return;
    
    this.detenerVoz(); // Limpiar cualquier voz previa
    
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    
    utterance.onstart = () => this.hablando = true;
    utterance.onend = () => this.hablando = false;
    utterance.onerror = () => this.hablando = false;

    window.speechSynthesis.speak(utterance);
  }

  detenerVoz() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.hablando = false;
  }

  toggleVoz() {
    if (this.hablando) {
      this.detenerVoz();
    } else if (this.data?.resumen_ia) {
      this.reproducirVoz(this.data.resumen_ia);
    }
  }

  descargar(formato: 'pdf' | 'xlsx') {
    this.descargandoFormato = formato;
    this.reportesService.exportarReporte(formato, this.filtros).subscribe({
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
      },
      error: (err: any) => {
        console.error("Error al exportar reporte", err);
        alert(`No se pudo descargar el archivo ${formato.toUpperCase()}. Verifica que existan datos de ventas.`);
        this.descargandoFormato = null;
      }
    });
  }
}
