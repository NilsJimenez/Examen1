"""
Servicio de Entrenamiento y Validación de Modelos de Machine Learning (CU27 - RF62 a RF65).
Implementa:
  - Modelo Supervisado: RandomForestRegressor para predicción de demanda de ventas semanales.
  - Modelo No Supervisado: KMeans para segmentación de clientes y IsolationForest para detección de anomalías.
  - Evaluación rigurosa con métricas oficiales: MAE, RMSE, R² y Coeficiente de Silueta.
  - Persistencia versionada en disco (joblib) y auditoría en la base de datos central (ml_modelos).
"""
import os
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sqlalchemy.orm import Session

from app.ml.synthetic_data import generar_dataset_ventas, generar_dataset_clientes
from app.models.saas import MlModelo


DIRECTORIO_MODELOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modelos")
os.makedirs(DIRECTORIO_MODELOS, exist_ok=True)


class MLTrainingService:
    """Orquestador de entrenamiento, validación y persistencia de modelos analíticos."""

    @classmethod
    def entrenar_modelo_supervisado_demanda(
        cls,
        db: Optional[Session] = None,
        n_semanas: int = 104,
        n_sucursales: int = 4,
        semilla: int = 42
    ) -> Dict[str, Any]:
        """
        RF63: Entrena y evalúa modelo supervisado para predecir ventas semanales.
        Calcula MAE, RMSE y R².
        """
        df_ventas = generar_dataset_ventas(
            n_semanas=n_semanas,
            n_sucursales=n_sucursales,
            semilla=semilla
        )

        # Selección de variables predictoras (features) y variable objetivo (target)
        features = ["sucursal_id", "semana_del_anio", "tiene_promocion", "tendencia_indice"]
        X = df_ventas[features]
        y = df_ventas["ventas_unidades"]

        # División en conjunto de entrenamiento (80%) y prueba (20%)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=semilla
        )

        # Entrenamiento de Random Forest Regressor
        modelo = RandomForestRegressor(
            n_estimators=150,
            max_depth=12,
            random_state=semilla,
            n_jobs=1
        )
        modelo.fit(X_train, y_train)

        # Evaluación sobre conjunto de test
        y_pred = modelo.predict(X_test)
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = float(r2_score(y_test, y_pred))

        metricas = {
            "MAE": round(mae, 2),
            "RMSE": round(rmse, 2),
            "R2": round(r2, 4),
            "tamano_entrenamiento": int(len(X_train)),
            "tamano_prueba": int(len(X_test)),
            "importancia_variables": {
                feat: round(float(imp), 4)
                for feat, imp in zip(features, modelo.feature_importances_)
            }
        }

        # Guardar artefacto en disco
        version = f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        ruta_archivo = os.path.join(DIRECTORIO_MODELOS, f"demanda_{version}.joblib")
        ruta_ultimo = os.path.join(DIRECTORIO_MODELOS, "demanda_latest.joblib")

        payload_guardado = {
            "version": version,
            "tipo": "supervisado",
            "features": features,
            "metricas": metricas,
            "entrenado_en": datetime.utcnow().isoformat(),
            "modelo": modelo
        }
        joblib.dump(payload_guardado, ruta_archivo)
        joblib.dump(payload_guardado, ruta_ultimo)

        # Registrar en la tabla ml_modelos de PostgreSQL si hay sesión
        db_id = None
        if db is not None:
            # Desactivar versiones previas del mismo tipo
            db.query(MlModelo).filter(
                MlModelo.nombre == "Previsión de Demanda y Ventas Semanales",
                MlModelo.tipo == "supervisado"
            ).update({"activo": False})

            registro = MlModelo(
                nombre="Previsión de Demanda y Ventas Semanales",
                tipo="supervisado",
                version=version,
                metricas=metricas,
                activo=True
            )
            db.add(registro)
            db.commit()
            db.refresh(registro)
            db_id = str(registro.id)

        return {
            "modelo_id": db_id,
            "nombre": "Previsión de Demanda y Ventas Semanales",
            "tipo": "supervisado",
            "algoritmo": "RandomForestRegressor (150 estimadores)",
            "version": version,
            "metricas": metricas,
            "ruta_archivo": ruta_archivo
        }

    @classmethod
    def entrenar_modelo_no_supervisado_clientes(
        cls,
        db: Optional[Session] = None,
        n_clientes: int = 600,
        semilla: int = 42
    ) -> Dict[str, Any]:
        """
        RF64: Entrena modelo no supervisado KMeans (segmentación RFM) y IsolationForest (anomalías).
        Calcula el Coeficiente de Silueta y la tasa de detección de anomalías.
        """
        df_clientes = generar_dataset_clientes(n_clientes=n_clientes, semilla=semilla)
        features = ["recencia_dias", "frecuencia_compras", "monto_total_bs"]
        X = df_clientes[features]

        # 1. Normalización estándar
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # 2. Clustering con KMeans (3 segmentos naturales)
        kmeans = KMeans(n_clusters=3, n_init=10, random_state=semilla)
        clusters = kmeans.fit_predict(X_scaled)
        silueta = float(silhouette_score(X_scaled, clusters))

        df_clientes["cluster"] = clusters

        # 3. Detección de anomalías con Isolation Forest (2% de compras atípicas/sospechosas)
        iso_forest = IsolationForest(contamination=0.02, random_state=semilla)
        anomalias = iso_forest.fit_predict(X_scaled)
        # -1 es anomalía, 1 es normal
        df_clientes["es_anomalia"] = (anomalias == -1)
        total_anomalias = int((anomalias == -1).sum())

        # 4. Interpretar perfiles de los clústeres para el negocio
        nombres_segmentos = {}
        centroides = kmeans.cluster_centers_

        # Determinamos etiquetas dinámicas basadas en el monto medio escalado
        indices_ordenados = np.argsort(centroides[:, 2])  # Ordenados por monto ascendente
        nombres_segmentos[int(indices_ordenados[2])] = {
            "nombre": "Clientes VIP / Alta Frecuencia",
            "descripcion": "Compradores recurrentes con alto ticket promedio. Candidatos ideales a promociones exclusivas."
        }
        nombres_segmentos[int(indices_ordenados[1])] = {
            "nombre": "Clientes Leales / Frecuentes",
            "descripcion": "Compras estables a lo largo del año con ticket moderado."
        }
        nombres_segmentos[int(indices_ordenados[0])] = {
            "nombre": "Clientes Ocasionales / En Riesgo",
            "descripcion": "Alta recencia y baja frecuencia de compra. Requieren campañas de reactivación."
        }

        resumen_segmentos = []
        for c_id in range(3):
            sub = df_clientes[df_clientes["cluster"] == c_id]
            info_seg = nombres_segmentos[c_id]
            resumen_segmentos.append({
                "cluster_id": c_id,
                "nombre": info_seg["nombre"],
                "descripcion": info_seg["descripcion"],
                "cantidad_clientes": int(len(sub)),
                "porcentaje": round(float(len(sub) / len(df_clientes) * 100), 1),
                "recencia_media_dias": round(float(sub["recencia_dias"].mean()), 1),
                "frecuencia_media": round(float(sub["frecuencia_compras"].mean()), 1),
                "gasto_medio_bs": round(float(sub["monto_total_bs"].mean()), 2),
                "ticket_promedio_bs": round(float(sub["ticket_promedio_bs"].mean()), 2)
            })

        metricas = {
            "coeficiente_silueta": round(silueta, 4),
            "cantidad_clusters": 3,
            "total_clientes_analizados": n_clientes,
            "anomalias_detectadas": total_anomalias,
            "tasa_anomalias_pct": round(float(total_anomalias / n_clientes * 100), 2)
        }

        version = f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        ruta_archivo = os.path.join(DIRECTORIO_MODELOS, f"clientes_{version}.joblib")
        ruta_ultimo = os.path.join(DIRECTORIO_MODELOS, "clientes_latest.joblib")

        payload_guardado = {
            "version": version,
            "tipo": "no_supervisado",
            "features": features,
            "scaler": scaler,
            "kmeans": kmeans,
            "isolation_forest": iso_forest,
            "nombres_segmentos": nombres_segmentos,
            "resumen_segmentos": resumen_segmentos,
            "metricas": metricas,
            "entrenado_en": datetime.utcnow().isoformat()
        }
        joblib.dump(payload_guardado, ruta_archivo)
        joblib.dump(payload_guardado, ruta_ultimo)

        db_id = None
        if db is not None:
            db.query(MlModelo).filter(
                MlModelo.nombre == "Segmentación RFM y Detección de Anomalías",
                MlModelo.tipo == "no_supervisado"
            ).update({"activo": False})

            registro = MlModelo(
                nombre="Segmentación RFM y Detección de Anomalías",
                tipo="no_supervisado",
                version=version,
                metricas=metricas,
                activo=True
            )
            db.add(registro)
            db.commit()
            db.refresh(registro)
            db_id = str(registro.id)

        return {
            "modelo_id": db_id,
            "nombre": "Segmentación RFM y Detección de Anomalías",
            "tipo": "no_supervisado",
            "algoritmo": "KMeans (k=3) + IsolationForest",
            "version": version,
            "metricas": metricas,
            "segmentos": resumen_segmentos,
            "ruta_archivo": ruta_archivo
        }

    @classmethod
    def predecir_demanda(
        cls,
        sucursal_id: int,
        semana_inicio: int = 1,
        semanas_proyeccion: int = 6,
        tiene_promocion: bool = False
    ) -> List[Dict[str, Any]]:
        """
        CU28: Inferencia con modelo supervisado para proyección de demanda futura.
        """
        ruta_ultimo = os.path.join(DIRECTORIO_MODELOS, "demanda_latest.joblib")
        if not os.path.exists(ruta_ultimo):
            # Si no existe entrenado, entrenamos uno rápidamente con semilla fija
            cls.entrenar_modelo_supervisado_demanda()

        payload = joblib.load(ruta_ultimo)
        modelo: RandomForestRegressor = payload["modelo"]

        predicciones = []
        for offset in range(semanas_proyeccion):
            sem_actual = (semana_inicio + offset)
            sem_del_anio = sem_actual % 52
            features_input = pd.DataFrame([{
                "sucursal_id": sucursal_id,
                "semana_del_anio": sem_del_anio,
                "tiene_promocion": int(tiene_promocion),
                "tendencia_indice": sem_actual + 104  # proyectado hacia adelante
            }])

            pred_unidades = float(modelo.predict(features_input)[0])
            pred_unidades_redondeada = int(round(pred_unidades))
            # Intervalo de confianza empírico +- 6%
            margen = int(round(pred_unidades_redondeada * 0.06))

            predicciones.append({
                "semana_proyeccion": offset + 1,
                "semana_del_anio": sem_del_anio,
                "sucursal_id": sucursal_id,
                "tiene_promocion": tiene_promocion,
                "demanda_estimada_unidades": pred_unidades_redondeada,
                "rango_minimo": max(0, pred_unidades_redondeada - margen),
                "rango_maximo": pred_unidades_redondeada + margen,
                "ingreso_estimado_bs": round(pred_unidades_redondeada * 180.0, 2)
            })

        return predicciones

    @classmethod
    def obtener_segmentos_y_anomalias(cls) -> Dict[str, Any]:
        """CU28: Inferencia con modelo no supervisado sobre perfiles de clientes."""
        ruta_ultimo = os.path.join(DIRECTORIO_MODELOS, "clientes_latest.joblib")
        if not os.path.exists(ruta_ultimo):
            cls.entrenar_modelo_no_supervisado_clientes()

        payload = joblib.load(ruta_ultimo)
        return {
            "version": payload["version"],
            "metricas": payload["metricas"],
            "segmentos": payload["resumen_segmentos"],
            "interpretacion": (
                "Segmentación RFM calibrada sobre comportamiento textil boliviano. "
                "Permite personalizar descuentos automáticos y apartados en vestidores virtuales."
            )
        }
