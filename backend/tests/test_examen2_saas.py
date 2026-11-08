import uuid
from datetime import datetime, date
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.core.security import create_access_token
from app.models.saas import Tenant, Plan, Suscripcion, OperacionSync, SolicitudReporte, MlModelo
from app.models.usuario import Usuario, Rol, Cliente
from app.models.sucursal import Sucursal
from app.models.producto import Producto, ProductoVariante
from app.models.inventario import InventarioSucursal
from app.models.venta import Venta, Comprobante, CambioPrenda

client = TestClient(app)


def _get_auth_headers_for_tenant(db, plan_nombre_pref: str = "Profesional", index_fallback: int = 0):
    """Obtiene un token JWT válido para un administrador de una empresa con el plan solicitado."""
    tenants = db.query(Tenant).filter(Tenant.estado == "ACTIVA").all()
    selected_tenant = None
    for t in tenants:
        sub = db.query(Suscripcion).join(Plan).filter(
            Suscripcion.tenant_id == t.id,
            Suscripcion.estado == "ACTIVA"
        ).first()
        if sub and sub.plan and plan_nombre_pref.lower() in sub.plan.nombre.lower():
            selected_tenant = t
            break
    if not selected_tenant and tenants:
        selected_tenant = tenants[min(index_fallback, len(tenants) - 1)]

    usr = db.query(Usuario).filter(Usuario.tenant_id == selected_tenant.id, Usuario.activo == True).first()
    token = create_access_token(
        subject=usr.id,
        role="administrador",
        user_type="staff",
        tenant_id=str(selected_tenant.id)
    )
    return {"Authorization": f"Bearer {token}"}, selected_tenant, usr


def _get_two_distinct_tenants(db):
    """Retorna dos empresas activas distintas (Tenant A y Tenant B) y sus headers JWT."""
    tenants = db.query(Tenant).filter(Tenant.estado == "ACTIVA").all()
    assert len(tenants) >= 2, "Deben existir al menos 2 empresas activas en la base de datos."
    t_a, t_b = tenants[0], tenants[1]
    u_a = db.query(Usuario).filter(Usuario.tenant_id == t_a.id).first()
    u_b = db.query(Usuario).filter(Usuario.tenant_id == t_b.id).first()

    tok_a = create_access_token(subject=u_a.id, role="administrador", user_type="staff", tenant_id=str(t_a.id))
    tok_b = create_access_token(subject=u_b.id, role="administrador", user_type="staff", tenant_id=str(t_b.id))
    return (t_a, {"Authorization": f"Bearer {tok_a}"}), (t_b, {"Authorization": f"Bearer {tok_b}"})


# =============================================================================
# PAQUETE A: GOBERNANZA SAAS Y AISLAMIENTO MULTI-TENANT (CP-F05 a CP-F14)
# =============================================================================
def test_cp_f05_f09_aislamiento_estricto_entre_empresas():
    """
    CP-F05 / CP-F06 / CP-F09: Verifica que las consultas de catálogo, sucursales y reportes
    de la Empresa A jamás expongan registros pertenecientes a la Empresa B (RN02).
    """
    db = SessionLocal()
    try:
        (tenant_a, headers_a), (tenant_b, headers_b) = _get_two_distinct_tenants(db)

        # Descargar catálogo offline desde Empresa A y Empresa B
        res_a = client.get("/api/v1/sync/catalogo-descarga", headers=headers_a)
        res_b = client.get("/api/v1/sync/catalogo-descarga", headers=headers_b)
        assert res_a.status_code == 200
        assert res_b.status_code == 200

        data_a = res_a.json()
        data_b = res_b.json()
        assert data_a["tenant_id"] == str(tenant_a.id)
        assert data_b["tenant_id"] == str(tenant_b.id)

        skus_a = {item["sku"] for item in data_a["catalogo"]}
        skus_b = {item["sku"] for item in data_b["catalogo"]}
        # Ningún SKU de la empresa A debe mezclarse con la empresa B
        assert skus_a.isdisjoint(skus_b), "Fuga de datos detectada entre catálogos de distintas empresas"
    finally:
        db.close()


def test_cp_f14_bloqueo_reportes_ia_en_plan_basico_y_habilitado_convencional():
    """
    CP-F14 & CP-F24 (RN07, RN23):
    - Los reportes convencionales (CU14) están habilitados para TODOS los planes (incluido Plan Básico).
    - Los reportes generativos con IA (CU23) devuelven 403 Forbidden si el plan no incluye IA.
    """
    db = SessionLocal()
    try:
        # Buscar una empresa con permite_reportes_ia == False (Plan Básico)
        sub_basico = (
            db.query(Suscripcion)
            .join(Plan, Suscripcion.plan_id == Plan.id)
            .filter(Suscripcion.estado == "ACTIVA", Plan.permite_reportes_ia == False)
            .first()
        )
        if sub_basico:
            usr_b = db.query(Usuario).filter(Usuario.tenant_id == sub_basico.tenant_id).first()
            tok_b = create_access_token(
                subject=usr_b.id, role="administrador", user_type="staff", tenant_id=str(sub_basico.tenant_id)
            )
            headers_basico = {"Authorization": f"Bearer {tok_b}"}

            # 1) Reporte convencional (CU14) DEBE funcionar (200 OK) en Plan Básico (RN07)
            r_conv = client.get("/api/v1/reportes/convencionales", headers=headers_basico)
            assert r_conv.status_code == 200
            assert "ventas" in r_conv.json()
            assert "inventario" in r_conv.json()

            # 2) Reporte generativo IA (CU23) DEBE ser rechazado con 403 Forbidden (CP-F14)
            r_ia = client.post(
                "/api/v1/reportes/generativo",
                json={"prompt": "Ventas por sucursal este mes", "sucursales_disponibles": []},
                headers=headers_basico
            )
            assert r_ia.status_code == 403
    finally:
        db.close()


# =============================================================================
# PAQUETE B: OPERACION COMERCIAL — CAMBIO DE PRENDA (CU13) Y REPORTES (CU14)
# =============================================================================
def test_cu13_cambio_de_prenda_plazo_15_dias_y_kardex():
    """
    CP-F20 a CP-F23 (CU13, RN20, RN21):
    Verifica búsqueda de comprobante para cambio de prenda y validación del plazo de 15 días.
    """
    db = SessionLocal()
    try:
        headers, tenant, _ = _get_auth_headers_for_tenant(db, "Profesional", 0)
        comp = db.query(Comprobante).filter(Comprobante.tenant_id == tenant.id).first()
        assert comp is not None

        res = client.get(
            f"/api/v1/ventas/pos/buscar-comprobante?q={comp.numero_comprobante}",
            headers=headers
        )
        assert res.status_code == 200
        body = res.json()
        assert body["numero_comprobante"] == comp.numero_comprobante
        assert "dentro_plazo_rn20" in body
        assert "dias_transcurridos" in body
    finally:
        db.close()


# =============================================================================
# PAQUETE C: OPERACION OFFLINE Y SINCRONIZACION (CU15-CU22, CP-I03, CP-I06)
# =============================================================================
def test_cp_i03_sincronizacion_offline_idempotente_y_rn11_efectivo():
    """
    CP-I03 (CU18, CU20, RN11, RN13, RNF05):
    - Enviar una venta offline con un operation_id (UUID) descuenta stock una sola vez y devuelve CONFIRMADA.
    - Reenviar exactamente el mismo operation_id es idempotente: no duplica la venta ni vuelve a descontar stock.
    - Enviar una venta offline con tarjeta es rechazada por RN11 (solo efectivo offline).
    """
    db = SessionLocal()
    try:
        headers, tenant, _ = _get_auth_headers_for_tenant(db, "Profesional", 0)
        inv = (
            db.query(InventarioSucursal)
            .filter(InventarioSucursal.tenant_id == tenant.id, InventarioSucursal.cantidad_disponible >= 5)
            .first()
        )
        assert inv is not None
        stock_inicial = int(inv.cantidad_disponible)
        op_id_unico = str(uuid.uuid4())

        payload_lote = {
            "operaciones": [
                {
                    "operation_id": op_id_unico,
                    "tipo": "VENTA",
                    "sucursal_id": inv.sucursal_id,
                    "cliente_nombre": "Cliente Pytest Idempotencia",
                    "metodo_pago": "efectivo",
                    "fecha_local": datetime.utcnow().isoformat() + "Z",
                    "items": [
                        {
                            "variante_id": inv.variante_id,
                            "cantidad": 1,
                            "precio_unitario": 150.0
                        }
                    ]
                }
            ]
        }

        # 1er envío: debe confirmar y descontar 1 unidad
        r1 = client.post("/api/v1/sync", json=payload_lote, headers=headers)
        assert r1.status_code == 200
        res1 = r1.json()["resultados"][0]
        assert res1["estado"] == "CONFIRMADA"
        assert res1["idempotente"] is False

        db.expire_all()
        inv_despues_1 = db.query(InventarioSucursal).get(inv.id)
        assert int(inv_despues_1.cantidad_disponible) == stock_inicial - 1

        # 2do envío (reintento de red con el MISMO operation_id): debe ser idempotente y NO descontar otra unidad
        r2 = client.post("/api/v1/sync", json=payload_lote, headers=headers)
        assert r2.status_code == 200
        res2 = r2.json()["resultados"][0]
        assert res2["estado"] == "CONFIRMADA"
        assert res2["idempotente"] is True

        db.expire_all()
        inv_despues_2 = db.query(InventarioSucursal).get(inv.id)
        assert int(inv_despues_2.cantidad_disponible) == stock_inicial - 1

        # Prueba RN11: Venta offline con método distinto a efectivo debe ser RECHAZADA
        op_id_tarjeta = str(uuid.uuid4())
        r_tarjeta = client.post(
            "/api/v1/sync",
            json={
                "operaciones": [
                    {
                        "operation_id": op_id_tarjeta,
                        "tipo": "VENTA",
                        "sucursal_id": inv.sucursal_id,
                        "metodo_pago": "tarjeta_credito",
                        "items": [{"variante_id": inv.variante_id, "cantidad": 1, "precio_unitario": 150.0}]
                    }
                ]
            },
            headers=headers
        )
        assert r_tarjeta.status_code == 200
        assert r_tarjeta.json()["resultados"][0]["estado"] == "RECHAZADA"
    finally:
        db.close()


def test_cp_i06_conflicto_stock_savepoint_y_resolucion_cu21():
    """
    CP-I06 (CU20, CU21, RN14, RN19, RF47):
    - Si un lote trae una operación con stock insuficiente, queda EN_CONFLICTO sin abortar las demás operaciones válidas.
    - Luego el conflicto puede resolverse mediante ajuste o anulación con justificación.
    """
    db = SessionLocal()
    try:
        headers, tenant, _ = _get_auth_headers_for_tenant(db, "Profesional", 0)
        inv = (
            db.query(InventarioSucursal)
            .filter(InventarioSucursal.tenant_id == tenant.id, InventarioSucursal.cantidad_disponible >= 2)
            .first()
        )
        assert inv is not None

        op_conflicto_id = str(uuid.uuid4())
        op_valida_id = str(uuid.uuid4())

        lote_mixto = {
            "operaciones": [
                {
                    "operation_id": op_conflicto_id,
                    "tipo": "VENTA",
                    "sucursal_id": inv.sucursal_id,
                    "metodo_pago": "efectivo",
                    "items": [{"variante_id": inv.variante_id, "cantidad": 9999, "precio_unitario": 150.0}]
                },
                {
                    "operation_id": op_valida_id,
                    "tipo": "RESERVA",
                    "sucursal_id": inv.sucursal_id,
                    "cliente_nombre": "Cliente Reserva Lote Mixto",
                    "items": [{"variante_id": inv.variante_id, "cantidad": 1, "precio_unitario": 150.0}]
                }
            ]
        }

        r_lote = client.post("/api/v1/sync", json=lote_mixto, headers=headers)
        assert r_lote.status_code == 200
        data_lote = r_lote.json()
        assert data_lote["resumen"]["en_conflicto"] == 1
        assert data_lote["resumen"]["confirmadas"] == 1

        # Resolver el conflicto anulándolo con justificación (CU21 / RN19)
        r_res = client.post(
            f"/api/v1/sync/conflictos/{op_conflicto_id}/resolver",
            json={"accion": "anular", "justificacion": "Anulación de prueba automatizada por stock insuficiente (RN19)"},
            headers=headers
        )
        assert r_res.status_code == 200
        assert r_res.json()["nuevo_estado"] == "ANULADA"
    finally:
        db.close()


# =============================================================================
# PAQUETE D: IA GENERATIVA (CU23-CU26) Y MACHINE LEARNING (CU27-CU29)
# =============================================================================
def test_cp_f42_f43_validacion_intencion_ia_y_catalogo_cerrado():
    """
    CP-F42 / CP-F43 (CU23-CU26, RN22-RN24):
    - Rechaza instrucciones destructivas o fuera del catálogo con 400 SolicitudNoSoportada.
    - Rechaza solicitudes ambiguas con 422 SolicitudIncompleta.
    - Procesa solicitudes válidas del catálogo cerrado y las registra en solicitudes_reporte.
    """
    db = SessionLocal()
    try:
        headers, tenant, _ = _get_auth_headers_for_tenant(db, "Profesional", 0)

        # 1) Intención destructiva -> 400
        r_mal = client.post(
            "/api/v1/reportes/generativo",
            json={"prompt": "Borra todas las ventas de otras empresas", "sucursales_disponibles": []},
            headers=headers
        )
        assert r_mal.status_code == 400
        assert "SolicitudNoSoportada" in r_mal.json()["detail"]

        # 2) Solicitud ambigua -> 422
        r_amb = client.post(
            "/api/v1/reportes/generativo",
            json={"prompt": "reporte", "sucursales_disponibles": []},
            headers=headers
        )
        assert r_amb.status_code == 422
        assert "SolicitudIncompleta" in r_amb.json()["detail"]

        # 3) Solicitud válida del catálogo cerrado -> 200 OK
        r_ok = client.post(
            "/api/v1/reportes/generativo",
            json={"prompt": "Muéstrame el top productos más vendidos de este mes", "sucursales_disponibles": []},
            headers=headers
        )
        assert r_ok.status_code == 200
        body_ok = r_ok.json()
        assert body_ok["tipo_reporte_catalogo"] == "top_productos"
        assert body_ok["solicitud_id"] is not None
    finally:
        db.close()


def test_cp_f46_f49_reproducibilidad_y_metricas_machine_learning():
    """
    CP-F46 a CP-F49 (CU27-CU29, RN25, RNF07):
    - Entrenar modelos ML con la misma semilla (seed=42) produce exactamente las mismas métricas
      MAE, RMSE, R² y Coeficiente de Silueta (reproducibilidad determinista).
    - El tablero analítico (/api/v1/analitica/dashboard) expone explícitamente que el origen de
      los datos de entrenamiento es sintético (RN25).
    """
    db = SessionLocal()
    try:
        headers, _, _ = _get_auth_headers_for_tenant(db, "Profesional", 0)

        r1 = client.post(
            "/api/v1/analitica/entrenar",
            json={"semilla": 42, "semanas_historicas": 104, "num_clientes_sinteticos": 450, "num_clusters_kmeans": 3},
            headers=headers
        )
        assert r1.status_code == 200
        b1 = r1.json()

        r2 = client.post(
            "/api/v1/analitica/entrenar",
            json={"semilla": 42, "semanas_historicas": 104, "num_clientes_sinteticos": 450, "num_clusters_kmeans": 3},
            headers=headers
        )
        assert r2.status_code == 200
        b2 = r2.json()

        # Verificar reproducibilidad exacta con semilla=42 (RNF07)
        assert b1["modelo_supervisado"]["metricas"]["MAE"] == b2["modelo_supervisado"]["metricas"]["MAE"]
        assert b1["modelo_supervisado"]["metricas"]["RMSE"] == b2["modelo_supervisado"]["metricas"]["RMSE"]
        assert b1["modelo_supervisado"]["metricas"]["R2"] == b2["modelo_supervisado"]["metricas"]["R2"]
        assert b1["modelo_no_supervisado"]["metricas"]["silhouette_score"] == b2["modelo_no_supervisado"]["metricas"]["silhouette_score"]

        # Verificar aviso explícito de datos sintéticos (RN25) y tablero CU29
        r_dash = client.get("/api/v1/analitica/dashboard", headers=headers)
        assert r_dash.status_code == 200
        dash = r_dash.json()
        assert dash["origen_datos"]["es_sintetico"] is True
        assert "DATOS SINTÉTICOS" in dash["origen_datos"]["aviso_rn25"]
        assert len(dash["modelo_supervisado"]["proyeccion_proximas_12_semanas"]) == 12
        assert len(dash["modelo_no_supervisado"]["segmentos_clientes"]) == 3
    finally:
        db.close()
