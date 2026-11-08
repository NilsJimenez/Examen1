"""
Módulo de Generación y Preparación de Datos Sintéticos (CU27 - RF61, RF62, RN25).
Genera series temporales de demanda y perfiles RFM de clientes para entrenamiento
reproducible de modelos de Machine Learning (Supervisados y No Supervisados).
"""
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any


def generar_dataset_ventas(
    n_semanas: int = 104,
    n_sucursales: int = 4,
    semilla: int = 42,
    precio_promedio_prenda: float = 180.0
) -> pd.DataFrame:
    """
    Genera dataset sintético de ventas y demanda semanal por sucursal.
    Incorpora:
      - Tendencia temporal creciente (crecimiento de negocio).
      - Estacionalidad senoidal anual (52 semanas) simulando colecciones de moda.
      - Efecto promocional estocástico (probabilidad 15%).
      - Ruido gaussiano N(0, 40) en unidades vendidas.
    """
    rng = np.random.default_rng(semilla)
    filas = []

    for s in range(1, n_sucursales + 1):
        # Base de demanda por tamaño de tienda (entre 800 y 1500 unidades semanales)
        base_tienda = rng.uniform(850, 1450)
        
        for w in range(n_semanas):
            semana_anio = w % 52
            # Estacionalidad textil: picos en semanas 20-25 (invierno) y 48-52 (navidad/verano)
            estacion = 1.0 + 0.25 * np.sin(2 * np.pi * semana_anio / 52)
            # Efecto promocional (descuentos o campañas de temporada)
            promo = bool(rng.random() < 0.15)
            multiplicador_promo = 1.25 if promo else 1.0
            # Tendencia de crecimiento en el tiempo (3% anual acumulado)
            tendencia = 1.0 + (0.003 * w)
            
            # Cálculo de unidades demandadas
            demanda_esperada = (base_tienda * estacion * multiplicador_promo * tendencia)
            ruido = rng.normal(0, 35)
            unidades = max(100, int(round(demanda_esperada + ruido)))
            
            # Monto total en bolivianos
            monto_bs = round(unidades * precio_promedio_prenda * (0.85 if promo else 1.0), 2)
            
            filas.append({
                "semana_indice": w,
                "semana_del_anio": semana_anio,
                "sucursal_id": s,
                "tiene_promocion": int(promo),
                "tendencia_indice": w,
                "estacionalidad_indice": round(estacion, 4),
                "ventas_unidades": unidades,
                "monto_total_bs": monto_bs
            })

    df = pd.DataFrame(filas)
    return df


def generar_dataset_clientes(
    n_clientes: int = 600,
    semilla: int = 42
) -> pd.DataFrame:
    """
    Genera dataset sintético RFM (Recencia, Frecuencia, Monto) para segmentación no supervisada (RF61, RF64).
    Simula 3 perfiles arquetípicos de clientes en retail de moda:
      1. VIP / Alta Frecuencia (~25%): Recencia baja, alta frecuencia, alto ticket.
      2. Leales / Regulares (~45%): Recencia y frecuencia moderadas, ticket medio.
      3. Esporádicos / En Riesgo (~30%): Alta recencia, baja frecuencia, bajo ticket.
    """
    rng = np.random.default_rng(semilla)

    n_vip = int(n_clientes * 0.25)
    n_reg = int(n_clientes * 0.45)
    n_esp = n_clientes - n_vip - n_reg

    # 1. VIP
    r_vip = rng.integers(5, 35, size=n_vip)
    f_vip = rng.integers(12, 28, size=n_vip)
    m_vip = np.round(rng.uniform(3200, 7500, size=n_vip), 2)

    # 2. Regular
    r_reg = rng.integers(30, 110, size=n_reg)
    f_reg = rng.integers(4, 11, size=n_reg)
    m_reg = np.round(rng.uniform(900, 2600, size=n_reg), 2)

    # 3. Esporádico
    r_esp = rng.integers(120, 360, size=n_esp)
    f_esp = rng.integers(1, 4, size=n_esp)
    m_esp = np.round(rng.uniform(120, 750, size=n_esp), 2)

    recencia = np.concatenate([r_vip, r_reg, r_esp])
    frecuencia = np.concatenate([f_vip, f_reg, f_esp])
    monto_total = np.concatenate([m_vip, m_reg, m_esp])

    # Barajar preservando la correspondencia
    perm = rng.permutation(n_clientes)
    recencia = recencia[perm]
    frecuencia = frecuencia[perm]
    monto_total = monto_total[perm]
    ticket_promedio = np.round(monto_total / frecuencia, 2)

    df = pd.DataFrame({
        "cliente_id": np.arange(1, n_clientes + 1),
        "recencia_dias": recencia,
        "frecuencia_compras": frecuencia,
        "monto_total_bs": monto_total,
        "ticket_promedio_bs": ticket_promedio
    })
    return df
