import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesService, DashboardReporteOut, ReportesConvencionalesOut } from '../../services/reportes.service';
import { ProductoService } from '../../services/producto.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { Sucursal } from '../../models/sucursal.models';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in" style="width: 100%;">
      
      <!-- ================================================================= -->
      <!-- CABECERA REPORTES CONVENCIONALES (CU14) + IA (CU23/CU24)          -->
      <!-- ================================================================= -->
      <div class="flex items-center justify-between mb-6 pb-4" style="border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 1rem;">
        <div>
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 0.72rem; font-weight: 800;">
              <i class="fa-solid fa-table-list mr-1"></i> CU14: Reportes Convencionales Activos (RN07)
            </span>
            <span class="badge" [style.background]="permiteIA ? 'rgba(167, 139, 250, 0.16)' : 'rgba(239, 68, 68, 0.14)'" [style.color]="permiteIA ? '#a78bfa' : '#f87171'" style="font-size: 0.72rem; font-weight: 800;">
              <i class="fa-solid" [ngClass]="permiteIA ? 'fa-wand-magic-sparkles' : 'fa-lock'"></i>
              {{ permiteIA ? 'Plan Profesional • IA Gemini + Voz Habilitada' : 'Plan ' + (planActual || 'Estándar/Básico') + ' • IA Generativa Bloqueada (RN07)' }}
            </span>
          </div>
          <h2 style="color: var(--text-main); font-family: serif; font-size: 1.9rem; margin: 0;">
            Reportes Convencionales de Ventas e Inventario (CU14)
          </h2>
          <p style="color: var(--text-muted); margin-top: 0.35rem; font-size: 0.9rem;">
            Consulta tablas estructuradas de ventas e inventario por sucursal exportables a PDF y Excel para tu empresa.
          </p>
        </div>
        
        <div class="flex gap-2.5 flex-wrap">
          <button (click)="descargar('pdf', vistaConvencional === 'inventario' ? 'inventario' : 'ventas')" [disabled]="descargandoFormato === 'pdf'" class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 0.55rem 1.1rem; display: flex; align-items: center; gap: 0.45rem; font-weight: 700;">
            <i class="fa-solid" [ngClass]="descargandoFormato === 'pdf' ? 'fa-circle-notch fa-spin' : 'fa-file-pdf'"></i>
            {{ descargandoFormato === 'pdf' ? 'Generando...' : (vistaConvencional === 'inventario' ? 'PDF Inventario' : 'PDF Ventas') }}
          </button>
          <button (click)="descargar('xlsx', vistaConvencional === 'inventario' ? 'inventario' : 'ventas')" [disabled]="descargandoFormato === 'xlsx'" class="btn btn-outline" style="border-color: #10b981; color: #10b981; padding: 0.55rem 1.1rem; display: flex; align-items: center; gap: 0.45rem; font-weight: 700;">
            <i class="fa-solid" [ngClass]="descargandoFormato === 'xlsx' ? 'fa-circle-notch fa-spin' : 'fa-file-excel'"></i>
            {{ descargandoFormato === 'xlsx' ? 'Generando...' : (vistaConvencional === 'inventario' ? 'Excel Inventario' : 'Excel Ventas') }}
          </button>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- BLOQUE IA GENERATIVA Y VOZ (HABILITADO EN PLAN PROFESIONAL - RN07)-->
      <!-- ================================================================= -->
      <div *ngIf="permiteIA" class="p-5 mb-6 rounded-xl" style="background: linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(99, 102, 241, 0.08)); border: 1px solid rgba(167, 139, 250, 0.35); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
          <label style="font-size: 0.82rem; color: #a78bfa; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Consultas en Lenguaje Natural con IA Gemini &amp; Voz (CU23 / CU24)
          </label>
          <span class="text-xs" style="color: var(--text-muted); font-style: italic;">
            <i class="fa-solid fa-bolt" style="color: #f59e0b;"></i> Escribe o habla por micrófono: "Analizar ventas de este mes" o "Descargar en PDF"
          </span>
        </div>

        <div class="flex gap-2 items-center" style="flex-wrap: wrap;">
          <input 
            type="text" 
            [(ngModel)]="promptTextoIA" 
            (keyup.enter)="consultarConIA()" 
            placeholder="Ej: 'Analiza las ventas de este mes y dame una recomendación' o 'Descargar en Excel'..." 
            class="input" 
            style="flex: 1; min-width: 250px; background: var(--card-bg); border: 1px solid rgba(167, 139, 250, 0.4); color: var(--text-main); padding: 0.65rem 1rem; border-radius: 8px;"
          >

          <button 
            type="button"
            (click)="toggleEscucha()" 
            class="btn" 
            [style.background]="escuchando ? '#ef4444' : 'rgba(167, 139, 250, 0.15)'"
            [style.color]="escuchando ? '#ffffff' : '#a78bfa'"
            [style.border]="escuchando ? '1px solid #ef4444' : '1px solid #a78bfa'"
            style="padding: 0.65rem 1.1rem; display: flex; align-items: center; gap: 0.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;"
          >
            <i class="fa-solid" [ngClass]="escuchando ? 'fa-microphone-lines fa-beat' : 'fa-microphone'"></i>
            <span>{{ escuchando ? 'Detener' : 'Voz' }}</span>
          </button>

          <button 
            type="button"
            (click)="consultarConIA()" 
            [disabled]="!promptTextoIA.trim() || consultandoIA" 
            class="btn" 
            style="background: #a78bfa; color: #1e1b4b; font-weight: 800; padding: 0.65rem 1.2rem; display: flex; align-items: center; gap: 0.5rem; border-radius: 8px;"
          >
            <i class="fa-solid" [ngClass]="consultandoIA ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
            <span>{{ consultandoIA ? 'Analizando con IA...' : 'Consultar IA' }}</span>
          </button>
        </div>

        <div *ngIf="escuchando" class="mt-3 p-3 rounded-lg flex items-center justify-between" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5;">
          <div class="flex items-center gap-3">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
            <span class="text-xs sm:text-sm font-semibold">
              <i class="fa-solid fa-headphones mr-1"></i> Escuchando tu comando de voz...
            </span>
          </div>
          <button (click)="detenerEscucha()" type="button" class="text-xs px-2 py-1 rounded" style="background: #ef4444; color: white; border: none; cursor: pointer;">
            Finalizar
          </button>
        </div>

        <div *ngIf="mensajeVozEstado" class="mt-3 p-3 rounded-lg flex items-center gap-3 text-sm font-bold animate-fade-in" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981;">
          <i class="fa-solid" [ngClass]="descargandoFormato ? 'fa-circle-notch fa-spin' : 'fa-circle-check'"></i>
          <span>{{ mensajeVozEstado }}</span>
        </div>
      </div>

      <!-- AVISO CANDADO SAAS SI EL PLAN ES BÁSICO O ESTÁNDAR (REGLA RN07 / RN23) -->
      <div *ngIf="!permiteIA" class="p-4 mb-6 rounded-xl flex items-center justify-between flex-wrap gap-4" style="background: rgba(245, 158, 11, 0.08); border: 1.5px dashed rgba(245, 158, 11, 0.4);">
        <div class="flex items-center gap-3">
          <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(245, 158, 11, 0.16); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
            <i class="fa-solid fa-lock"></i>
          </div>
          <div>
            <strong style="color: var(--text-main); font-size: 0.9rem; display: block;">
              Reportes Generativos con IA Gemini y Voz bloqueados en tu Plan {{ planActual }} (Regla RN07 / RN23)
            </strong>
            <span style="color: var(--text-muted); font-size: 0.78rem;">
              Tu empresa tiene acceso completo a los <strong>Reportes Convencionales de Ventas e Inventario (CU14)</strong> abajo. Solicita al SuperAdmin actualizar al <strong>Plan Profesional</strong> para habilitar IA.
            </span>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- BARRA DE FILTROS Y CONMUTADOR DE REPORTE CONVENCIONAL (CU14)      -->
      <!-- ================================================================= -->
      <div class="card p-5 mb-6" style="background: var(--table-th-bg); border: 1px solid var(--border-color);">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex flex-wrap items-end gap-4" style="flex: 1;">
            <div style="min-width: 150px;">
              <label style="display: block; font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem;">Fecha Inicio</label>
              <input type="date" [(ngModel)]="filtros.fecha_inicio" class="input" style="width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main);">
            </div>
            
            <div style="min-width: 150px;">
              <label style="display: block; font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem;">Fecha Fin</label>
              <input type="date" [(ngModel)]="filtros.fecha_fin" class="input" style="width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main);">
            </div>
            
            <div *ngIf="esAdmin && sucursales.length > 0" style="min-width: 190px;">
              <label style="display: block; font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem;">Sucursal</label>
              <select [(ngModel)]="filtros.sucursal_id" class="input" style="width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-main);">
                <option [ngValue]="null">Todas las sucursales de mi empresa</option>
                <option *ngFor="let s of sucursales" [ngValue]="s.id">{{ s.nombre }}</option>
              </select>
            </div>

            <button (click)="cargarTodo()" class="btn btn-primary" style="height: 40px; padding: 0 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-filter"></i> Filtrar Reportes
            </button>
          </div>

          <!-- Selector de Vista Convencional (CU14) -->
          <div style="display: inline-flex; background: var(--card-bg); padding: 0.28rem; border-radius: 12px; border: 1px solid var(--border-color); gap: 0.25rem;">
            <button
              type="button"
              (click)="vistaConvencional = 'ventas'"
              class="btn"
              [style.background]="vistaConvencional === 'ventas' ? 'var(--accent)' : 'transparent'"
              [style.color]="vistaConvencional === 'ventas' ? '#09090b' : 'var(--text-muted)'"
              style="padding: 0.45rem 0.95rem; font-size: 0.78rem; font-weight: 800; border-radius: 9px; border: none;"
            >
              <i class="fa-solid fa-receipt mr-1"></i> Reporte de Ventas ({{ convencionales?.ventas?.length || 0 }})
            </button>
            <button
              type="button"
              (click)="vistaConvencional = 'inventario'"
              class="btn"
              [style.background]="vistaConvencional === 'inventario' ? 'var(--accent)' : 'transparent'"
              [style.color]="vistaConvencional === 'inventario' ? '#09090b' : 'var(--text-muted)'"
              style="padding: 0.45rem 0.95rem; font-size: 0.78rem; font-weight: 800; border-radius: 9px; border: none;"
            >
              <i class="fa-solid fa-boxes-stacked mr-1"></i> Reporte de Inventario ({{ convencionales?.inventario?.length || 0 }})
            </button>
          </div>
        </div>
      </div>

      <!-- Resumen Ejecutivo IA cuando se ejecuta consulta IA -->
      <div *ngIf="!cargando && data?.resumen_ia" class="card" style="padding: 1.5rem; margin-bottom: 1.75rem; background: linear-gradient(145deg, rgba(167, 139, 250, 0.1), var(--card-bg)); border: 1px solid #a78bfa; border-left: 4px solid #a78bfa;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem; font-family: serif; color: #a78bfa; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Análisis Ejecutivo Generado por IA Gemini
          </h3>
        </div>
        <p style="color: var(--text-main); line-height: 1.6; font-size: 0.92rem; white-space: pre-wrap; margin: 0;">{{ data?.resumen_ia }}</p>
      </div>

      <!-- ================================================================= -->
      <!-- TARJETAS KPI GLOBALES DE LA EMPRESA                               -->
      <!-- ================================================================= -->
      <div *ngIf="!cargando && data" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1.25rem; margin-bottom: 1.75rem;">
        <div class="card" style="padding: 1.35rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid var(--accent);">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Total Ingresos Ventas</span>
            <i class="fa-solid fa-sack-dollar" style="color: var(--accent);"></i>
          </div>
          <div style="font-size: 1.9rem; font-family: serif; color: var(--text-main); font-weight: 700;">
            <span style="font-size: 1rem; color: var(--text-muted); margin-right: 0.2rem;">Bs.</span>{{ data.kpis.total_vendido.toFixed(2) }}
          </div>
        </div>

        <div class="card" style="padding: 1.35rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid #60a5fa;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Operaciones Confirmadas</span>
            <i class="fa-solid fa-receipt" style="color: #60a5fa;"></i>
          </div>
          <div style="font-size: 1.9rem; font-family: serif; color: var(--text-main); font-weight: 700;">
            {{ data.kpis.cantidad_ventas }} <span style="font-size: 0.88rem; color: var(--text-muted); font-family: sans-serif;">ventas</span>
          </div>
        </div>

        <div class="card" style="padding: 1.35rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid #10b981;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Stock Físico Total</span>
            <i class="fa-solid fa-boxes-stacked" style="color: #10b981;"></i>
          </div>
          <div style="font-size: 1.9rem; font-family: serif; color: #10b981; font-weight: 700;">
            {{ convencionales?.resumen_inventario?.total_unidades_stock || 0 }} <span style="font-size: 0.88rem; color: var(--text-muted); font-family: sans-serif;">uds.</span>
          </div>
        </div>

        <div class="card" style="padding: 1.35rem; background: linear-gradient(145deg, var(--card-bg), var(--table-th-bg)); border: 1px solid var(--border-color); border-top: 3px solid #a78bfa;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
            <span>Valorizado en Inventario</span>
            <i class="fa-solid fa-warehouse" style="color: #a78bfa;"></i>
          </div>
          <div style="font-size: 1.9rem; font-family: serif; color: var(--text-main); font-weight: 700;">
            <span style="font-size: 1rem; color: var(--text-muted); margin-right: 0.2rem;">Bs.</span>{{ (convencionales?.resumen_inventario?.valorizacion_total_bs || 0).toFixed(2) }}
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- VISTA 1: TABLA CONVENCIONAL DE VENTAS DETALLADAS (CU14)           -->
      <!-- ================================================================= -->
      <div *ngIf="!cargando && vistaConvencional === 'ventas'" class="card" style="padding: 1.75rem; background: var(--card-bg); border: 1px solid var(--border-color);">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 style="font-size: 1.15rem; font-family: serif; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.6rem;">
              <i class="fa-solid fa-file-invoice-dollar" style="color: var(--accent);"></i>
              Reporte Convencional de Ventas por Comprobante y Sucursal (CU14)
            </h3>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">
              Listado oficial de ventas presenciales (POS) y digitales confirmadas en tu empresa
            </p>
          </div>
        </div>

        <div style="background: var(--table-th-bg); border-radius: 0.75rem; border: 1px solid var(--border-color); overflow-x: auto;">
          <table class="table" style="width: 100%; margin: 0; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color);">
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Comprobante</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Fecha y Hora</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Sucursal</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Cliente / Canal</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; text-align: center;">Unidades</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; text-align: right;">Total (Bs.)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of convencionales?.ventas" style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.8rem 1rem; font-family: monospace; font-weight: 800; color: var(--accent);">
                  {{ v.numero_comprobante }}
                </td>
                <td style="padding: 0.8rem 1rem; color: var(--text-main); font-size: 0.84rem;">
                  {{ v.fecha_venta }}
                </td>
                <td style="padding: 0.8rem 1rem; color: var(--text-main); font-size: 0.84rem; font-weight: 600;">
                  {{ v.sucursal_nombre }}
                </td>
                <td style="padding: 0.8rem 1rem; color: var(--text-muted); font-size: 0.82rem;">
                  {{ v.cliente }} <span class="badge" style="margin-left: 0.35rem; font-size: 0.65rem; background: var(--card-bg); color: var(--text-main);">{{ v.tipo_venta | uppercase }}</span>
                </td>
                <td style="padding: 0.8rem 1rem; text-align: center; font-weight: 700; color: var(--text-main);">
                  {{ v.unidades }}
                </td>
                <td style="padding: 0.8rem 1rem; text-align: right; color: var(--accent); font-weight: 800; font-size: 0.98rem;">
                  Bs. {{ v.total.toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- VISTA 2: TABLA CONVENCIONAL DE INVENTARIO POR SUCURSAL (CU14)     -->
      <!-- ================================================================= -->
      <div *ngIf="!cargando && vistaConvencional === 'inventario'" class="card" style="padding: 1.75rem; background: var(--card-bg); border: 1px solid var(--border-color);">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 style="font-size: 1.15rem; font-family: serif; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.6rem;">
              <i class="fa-solid fa-boxes-stacked" style="color: #10b981;"></i>
              Reporte Convencional de Existencias e Inventario Valorizado (CU14)
            </h3>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0 0 0;">
              Control consolidado de stock físico, unidades reservadas y valorización en Bs. por variante y sucursal
            </p>
          </div>
          <div class="flex gap-2">
            <button (click)="descargar('pdf', 'inventario')" class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; font-size: 0.78rem; padding: 0.4rem 0.85rem;">
              <i class="fa-solid fa-file-pdf mr-1"></i> Exportar Inventario PDF
            </button>
            <button (click)="descargar('xlsx', 'inventario')" class="btn btn-outline" style="border-color: #10b981; color: #10b981; font-size: 0.78rem; padding: 0.4rem 0.85rem;">
              <i class="fa-solid fa-file-excel mr-1"></i> Exportar Inventario Excel
            </button>
          </div>
        </div>

        <div style="background: var(--table-th-bg); border-radius: 0.75rem; border: 1px solid var(--border-color); overflow-x: auto;">
          <table class="table" style="width: 100%; margin: 0; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color);">
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">SKU &amp; Prenda</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Talla / Color</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Sucursal</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; text-align: center;">Stock Físico</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; text-align: right;">Precio Unit.</th>
                <th style="padding: 0.85rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; text-align: right;">Valorizado (Bs.)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of convencionales?.inventario" style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.8rem 1rem;">
                  <strong style="color: var(--text-main); font-size: 0.86rem; display: block;">{{ it.producto }}</strong>
                  <span style="font-family: monospace; font-size: 0.72rem; color: var(--text-muted);">{{ it.sku }} • {{ it.categoria }}</span>
                </td>
                <td style="padding: 0.8rem 1rem; font-size: 0.82rem; color: var(--text-main);">
                  <span class="badge" style="background: var(--card-bg); color: var(--text-main); margin-right: 0.35rem;">{{ it.talla }}</span>
                  <span>{{ it.color }}</span>
                </td>
                <td style="padding: 0.8rem 1rem; font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">
                  {{ it.sucursal_nombre }}
                </td>
                <td style="padding: 0.8rem 1rem; text-align: center;">
                  <span style="font-weight: 800; font-size: 0.92rem;" [style.color]="it.bajo_stock ? '#ef4444' : '#10b981'">
                    {{ it.cantidad_disponible }} uds.
                  </span>
                </td>
                <td style="padding: 0.8rem 1rem; text-align: right; color: var(--text-muted); font-size: 0.84rem;">
                  Bs. {{ it.precio_unitario.toFixed(2) }}
                </td>
                <td style="padding: 0.8rem 1rem; text-align: right; color: var(--accent); font-weight: 800; font-size: 0.94rem;">
                  Bs. {{ it.valor_stock_bs.toFixed(2) }}
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
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  
  @Input() esAdmin: boolean = false;

  filtros: any = { sucursal_id: null, fecha_inicio: null, fecha_fin: null };
  data: DashboardReporteOut | null = null;
  convencionales: ReportesConvencionalesOut | null = null;
  vistaConvencional: 'ventas' | 'inventario' = 'ventas';

  cargando = false;
  consultandoIA = false;
  escuchando = false;
  promptTextoIA = '';
  mensajeVozEstado = '';
  descargandoFormato: 'pdf' | 'xlsx' | null = null;
  sucursales: Sucursal[] = [];

  private recognition: any = null;

  get permiteIA(): boolean {
    const u = this.authService.currentUserValue;
    if (!u) return false;
    if (u.permite_reportes_ia !== undefined) {
      return Boolean(u.permite_reportes_ia);
    }
    return u.plan === 'Profesional';
  }

  get planActual(): string {
    return this.authService.currentUserValue?.plan || 'Estándar';
  }

  ngOnInit() {
    this.cargarTodo();
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

  cargarTodo() {
    this.cargando = true;
    this.reportesService.getDashboard(this.filtros).subscribe({
      next: (res) => {
        this.data = res;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });

    this.reportesService.getReportesConvencionales(this.filtros).subscribe({
      next: (conv) => {
        this.convencionales = conv;
      }
    });
  }

  consultarConIA() {
    if (!this.promptTextoIA.trim()) return;
    const comando = this.promptTextoIA.trim();
    const pLower = comando.toLowerCase();

    // Si pide descarga directa en PDF o Excel
    if (pLower.includes('descarg') || pLower.includes('export') || pLower.includes('pdf') || pLower.includes('excel')) {
      this.procesarComandoVoz(comando);
      return;
    }

    this.consultandoIA = true;
    const sucs = (this.sucursales || []).map(s => ({ id: s.id, nombre: s.nombre }));
    this.reportesService.generarReporteIA(comando, sucs).subscribe({
      next: (res) => {
        this.consultandoIA = false;
        this.data = res;
        if (res.filtros_interpretados?.formato_descarga) {
          this.descargar(res.filtros_interpretados.formato_descarga);
        }
      },
      error: (err) => {
        this.consultandoIA = false;
        this.toastService.error('Restricción IA (RN07)', err.error?.detail || 'No se pudo consultar el reporte generativo con IA.');
      }
    });
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
        this.mensajeVozEstado = 'Escuchando... Di: "Descargar en PDF" o "Analizar ventas de este mes"';
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
          this.consultarConIA();
        }
      };

      this.recognition.onerror = () => {
        this.escuchando = false;
      };

      this.recognition.onend = () => {
        this.escuchando = false;
      };

      this.recognition.start();
    } catch (err) {
      this.escuchando = false;
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

    let formato: 'pdf' | 'xlsx' = 'pdf';
    if (pLower.includes('excel') || pLower.includes('xlsx') || pLower.includes('exel')) {
      formato = 'xlsx';
    }

    const tipo: 'ventas' | 'inventario' = pLower.includes('inventario') || pLower.includes('stock') ? 'inventario' : 'ventas';
    this.mensajeVozEstado = `Generando y descargando reporte de ${tipo.toUpperCase()} en ${formato.toUpperCase()}...`;
    this.descargar(formato, tipo);
  }

  descargar(formato: 'pdf' | 'xlsx', tipo: 'ventas' | 'inventario' = 'ventas') {
    this.descargandoFormato = formato;
    this.reportesService.exportarReporte(formato, this.filtros, tipo).subscribe({
      next: (blob: any) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${tipo}_${formato}_${new Date().getTime()}.${formato}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.descargandoFormato = null;
        this.mensajeVozEstado = `¡Reporte de ${tipo} (${formato.toUpperCase()}) descargado con éxito!`;
        setTimeout(() => {
          if (!this.descargandoFormato) this.mensajeVozEstado = '';
        }, 3500);
      },
      error: () => {
        this.descargandoFormato = null;
        this.mensajeVozEstado = `Error al descargar ${formato.toUpperCase()}.`;
      }
    });
  }
}
