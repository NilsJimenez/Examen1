import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-analitica-ml',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- BANNER PRINCIPAL Y AVISO EXPLICITO DE ORIGEN SINTETICO (RN25, CU27-CU29) -->
      <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 rounded-2xl p-6 text-white shadow-xl border border-purple-500/30">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-extrabold">
                <i class="fas fa-brain mr-1.5"></i> MACHINE LEARNING SUPERVISADO Y NO SUPERVISADO (CU27 – CU29)
              </span>
              <span class="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
                RN25: Datos Sintéticos Deterministas (Semilla = {{ semillaForm }})
              </span>
            </div>
            <h2 class="text-2xl font-extrabold mt-2">Tablero Analítico de Predicción de Demanda y Segmentación RFM</h2>
            <p class="text-sm text-slate-300 mt-1">
              {{ dashboardData()?.origen_datos?.aviso_rn25 || 'Modelos entrenados con semilla reproducible (RNF07) para pronóstico semanal (MAE, RMSE, R²) y clustering K-Means (Coeficiente de Silueta).' }}
            </p>
          </div>

          <!-- Controles de Re-entrenamiento Determinista (CU27) -->
          <div class="flex flex-wrap items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/10">
            <div>
              <label class="block text-[10px] uppercase text-slate-400 font-bold">Semilla (Seed)</label>
              <input type="number" [(ngModel)]="semillaForm" class="w-20 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold">
            </div>
            <div>
              <label class="block text-[10px] uppercase text-slate-400 font-bold">Clusters K</label>
              <input type="number" [(ngModel)]="clustersForm" min="2" max="6" class="w-16 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold">
            </div>
            <button (click)="entrenarModelos()"
                    [disabled]="entrenando()"
                    class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg transition flex items-center gap-2">
              <i class="fas" [ngClass]="entrenando() ? 'fa-cog fa-spin' : 'fa-play'"></i>
              {{ entrenando() ? 'Entrenando Modelos...' : 'Generar Datos y Entrenar ML (CU27)' }}
            </button>
          </div>
        </div>

        <!-- METRICAS OFICIALES DE EVALUACION DEL MODELO SUPERVISADO Y NO SUPERVISADO (RF65, RF66) -->
        <div *ngIf="dashboardData()" class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div class="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div class="text-xs text-indigo-300 font-semibold">MAE (Error Absoluto Medio)</div>
            <div class="text-2xl font-extrabold text-white mt-1">
              Bs. {{ dashboardData().modelo_supervisado.metricas.MAE | number:'1.2-2' }}
            </div>
            <div class="text-[11px] text-slate-400">Modelo Supervisado (80/20 Train-Test)</div>
          </div>

          <div class="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div class="text-xs text-indigo-300 font-semibold">RMSE (Error Cuadrático Medio)</div>
            <div class="text-2xl font-extrabold text-white mt-1">
              Bs. {{ dashboardData().modelo_supervisado.metricas.RMSE | number:'1.2-2' }}
            </div>
            <div class="text-[11px] text-slate-400">Penalización de desvíos estacionales</div>
          </div>

          <div class="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div class="text-xs text-emerald-300 font-semibold">Coeficiente R² (Ajuste Demanda)</div>
            <div class="text-2xl font-extrabold text-emerald-400 mt-1">
              {{ (dashboardData().modelo_supervisado.metricas.R2 * 100) | number:'1.1-1' }}% ({{ dashboardData().modelo_supervisado.metricas.R2 }})
            </div>
            <div class="text-[11px] text-slate-400">Varianza explicada sobre Test Set</div>
          </div>

          <div class="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div class="text-xs text-purple-300 font-semibold">Coeficiente de Silueta (K-Means)</div>
            <div class="text-2xl font-extrabold text-purple-300 mt-1">
              {{ dashboardData().modelo_no_supervisado.metricas.silhouette_score | number:'1.3-3' }}
            </div>
            <div class="text-[11px] text-slate-400">Cohesión y separación ({{ dashboardData().modelo_no_supervisado.metricas.clientes_analizados }} clientes)</div>
          </div>
        </div>
      </div>

      <!-- SECCION 1: MODELO SUPERVISADO — PRONOSTICO DE DEMANDA PROXIMAS 12 SEMANAS (CU28, CU29) -->
      <div *ngIf="dashboardData()" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Proyección Futura 12 Semanas -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Aprendizaje Supervisado · Regresión Estacional
              </span>
              <h3 class="text-base font-extrabold text-gray-900 mt-1">Proyección de Ventas y Demanda (Próximas 12 Semanas)</h3>
            </div>
          </div>

          <div class="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            <div *ngFor="let p of dashboardData().modelo_supervisado.proyeccion_proximas_12_semanas"
                 class="p-3 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-indigo-50/40 transition">
              <div class="flex items-center justify-between text-xs mb-1">
                <div class="font-extrabold text-gray-900">
                  {{ p.horizonte_semana }} <span class="text-gray-500 font-normal">({{ p.fecha_estimada }})</span>
                  <span *ngIf="p.temporada_alta" class="ml-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    Pico Campaña
                  </span>
                </div>
                <div class="font-extrabold text-indigo-700">
                  Bs. {{ p.ventas_estimadas_bs | number:'1.2-2' }} ({{ p.demanda_unidades_estimada }} prendas)
                </div>
              </div>
              <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 h-full rounded-full"
                     [style.width.%]="(p.ventas_estimadas_bs / 30000) * 100 > 100 ? 100 : (p.ventas_estimadas_bs / 30000) * 100"></div>
              </div>
              <div class="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>Intervalo confianza 80%: Bs. {{ p.intervalo_inferior_bs | number:'1.0-0' }} – Bs. {{ p.intervalo_superior_bs | number:'1.0-0' }}</span>
                <span>Versión: {{ dashboardData().modelo_supervisado.version }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Validación Real vs Predicho en Conjunto de Prueba (Test Set) -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div class="mb-4">
            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Validación Cruzada · Conjunto de Prueba (20% Test)
            </span>
            <h3 class="text-base font-extrabold text-gray-900 mt-1">Comparativa Valor Real vs. Valor Predicho</h3>
          </div>

          <div class="overflow-x-auto max-h-[360px]">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-100 text-slate-700 uppercase text-[11px]">
                  <th class="p-2.5">Semana / Fecha</th>
                  <th class="p-2.5 text-right">Real (Bs)</th>
                  <th class="p-2.5 text-right">Predicho ML (Bs)</th>
                  <th class="p-2.5 text-right">Desvío Abs.</th>
                  <th class="p-2.5 text-center">Unidades</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr *ngFor="let c of dashboardData().modelo_supervisado.comparativa_real_vs_predicho" class="hover:bg-gray-50">
                  <td class="p-2.5 font-semibold text-gray-800">Sem #{{ c.semana }} ({{ c.fecha }})</td>
                  <td class="p-2.5 text-right font-bold text-gray-900">Bs. {{ c.real_bs | number:'1.2-2' }}</td>
                  <td class="p-2.5 text-right font-bold text-indigo-700">Bs. {{ c.predicho_bs | number:'1.2-2' }}</td>
                  <td class="p-2.5 text-right text-emerald-700 font-semibold">±Bs. {{ c.error_abs_bs | number:'1.0-0' }}</td>
                  <td class="p-2.5 text-center">{{ c.unidades_reales }} / {{ c.unidades_predichas }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SECCION 2: MODELO NO SUPERVISADO — SEGMENTACION K-MEANS Y ANOMALIAS ISOLATION (CU28, CU29) -->
      <div *ngIf="dashboardData()" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Segmentos RFM K-Means -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div class="mb-4">
            <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-purple-100 text-purple-800">
              Aprendizaje No Supervisado · Clustering K-Means RFM
            </span>
            <h3 class="text-base font-extrabold text-gray-900 mt-1">Segmentación Automática de Clientes (Recencia, Frecuencia, Monto)</h3>
          </div>

          <div class="space-y-3">
            <div *ngFor="let seg of dashboardData().modelo_no_supervisado.segmentos_clientes"
                 class="p-4 rounded-xl border border-purple-100 bg-purple-50/30">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-extrabold text-gray-900">{{ seg.nombre }}</h4>
                <span class="px-2.5 py-1 rounded-full bg-purple-600 text-white text-xs font-extrabold">
                  {{ seg.cantidad_clientes }} clientes ({{ seg.porcentaje }}%)
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2 my-2.5 text-center bg-white p-2.5 rounded-xl border border-purple-100 text-xs">
                <div>
                  <div class="text-[10px] text-gray-500">Recencia Prom.</div>
                  <div class="font-extrabold text-gray-900">{{ seg.recencia_promedio_dias }} días</div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500">Frecuencia Anual</div>
                  <div class="font-extrabold text-indigo-700">{{ seg.frecuencia_anual_promedio }} compras</div>
                </div>
                <div>
                  <div class="text-[10px] text-gray-500">Gasto Anual Prom.</div>
                  <div class="font-extrabold text-emerald-700">Bs. {{ seg.gasto_anual_promedio_bs | number:'1.0-0' }}</div>
                </div>
              </div>
              <p class="text-xs text-gray-600">
                <i class="fas fa-lightbulb text-amber-500 mr-1"></i>
                <strong>Acción comercial sugerida:</strong> {{ seg.estrategia_recomendada }}
              </p>
            </div>
          </div>
        </div>

        <!-- Detección de Anomalías Operativas + Recomendación de Reabastecimiento por Prenda -->
        <div class="space-y-6">
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div class="mb-3">
              <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded bg-rose-100 text-rose-800">
                Detector No Supervisado · Isolation Anomaly Score
              </span>
              <h3 class="text-base font-extrabold text-gray-900 mt-1">Patrones Atípicos y Anomalías Operativas Detectadas</h3>
            </div>
            <div class="space-y-2.5">
              <div *ngFor="let a of dashboardData().modelo_no_supervisado.anomalias_operativas"
                   class="p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs">
                <div class="flex items-center justify-between font-extrabold text-rose-900">
                  <span>{{ a.codigo_alerta }} · {{ a.tipo }}</span>
                  <span class="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px]">Score: {{ a.isolation_score }}</span>
                </div>
                <p class="text-gray-700 mt-1">{{ a.descripcion }}</p>
                <p class="text-indigo-800 font-semibold mt-1">Recomendación: {{ a.accion_sugerida }}</p>
              </div>
            </div>
          </div>

          <div *ngIf="dashboardData().predicciones_reabastecimiento_empresa?.length" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 class="text-sm font-extrabold text-gray-900 mb-2">Sugerencia de Reabastecimiento por Prenda (Próximos 30 Días)</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-100 text-slate-700 text-[10px] uppercase">
                    <th class="p-2">Prenda / SKU</th>
                    <th class="p-2 text-center">Stock Actual</th>
                    <th class="p-2 text-center">Demanda 30d</th>
                    <th class="p-2 text-center">Sugerido</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr *ngFor="let pr of dashboardData().predicciones_reabastecimiento_empresa">
                    <td class="p-2">
                      <div class="font-bold text-gray-900">{{ pr.prenda }} ({{ pr.talla }})</div>
                      <div class="text-[10px] text-gray-500">{{ pr.sku }} · {{ pr.sucursal }}</div>
                    </td>
                    <td class="p-2 text-center font-bold">{{ pr.stock_actual }}</td>
                    <td class="p-2 text-center font-bold text-indigo-700">{{ pr.demanda_predicha_30d }}</td>
                    <td class="p-2 text-center">
                      <span class="px-2 py-0.5 rounded-full font-extrabold text-[10px]"
                            [ngClass]="pr.unidades_sugeridas_reabastecer > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'">
                        +{{ pr.unidades_sugeridas_reabastecer }} uds ({{ pr.prioridad }})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AnaliticaMlComponent implements OnInit {
  private apiUrl = `${environment.apiUrl}/analitica`;

  dashboardData = signal<any | null>(null);
  entrenando = signal<boolean>(false);
  semillaForm = 42;
  clustersForm = 3;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.http.get<any>(`${this.apiUrl}/dashboard`).subscribe({
      next: res => this.dashboardData.set(res),
      error: err => console.error('Error cargando dashboard ML:', err)
    });
  }

  entrenarModelos(): void {
    this.entrenando.set(true);
    this.http.post<any>(`${this.apiUrl}/entrenar`, {
      semilla: this.semillaForm || 42,
      semanas_historicas: 104,
      num_clientes_sinteticos: 450,
      num_clusters_kmeans: this.clustersForm || 3
    }).subscribe({
      next: () => {
        this.entrenando.set(false);
        this.cargarDashboard();
      },
      error: () => {
        this.entrenando.set(false);
      }
    });
  }
}
