import sys
import os
import uuid
sys.path.insert(0, os.path.abspath("backend"))

from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_saas_flow():
    print("\n" + "="*70)
    print("EJECUTANDO PRUEBAS AUTOMATIZADAS DE VALIDACIÓN SAAS MULTI-TENANT")
    print("="*70)

    # ---------------------------------------------------------
    # 1. LOGIN SUPERADMIN GLOBAL (CU02, RNF02)
    # ---------------------------------------------------------
    print("\n[TEST 1] Autenticación de Super Administrador de la Plataforma...")
    res_sa = client.post("/api/v1/auth/login", json={
        "email": "admin@fashionstore.saas",
        "password": "cambiar-en-produccion"
    })
    assert res_sa.status_code == 200, f"Error en login SuperAdmin: {res_sa.text}"
    sa_data = res_sa.json()
    sa_token = sa_data["access_token"]
    assert sa_data["role"].lower() == "superadmin"
    print(f" -> OK: Token obtenido para SuperAdmin ({sa_data['nombre_completo']})")

    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # ---------------------------------------------------------
    # 2. LISTAR TENANTS Y PLANES (CU03)
    # ---------------------------------------------------------
    print("\n[TEST 2] CU03: Listar Planes y Empresas (Tenants) desde SuperAdmin...")
    res_planes = client.get("/api/v1/saas/planes")
    assert res_planes.status_code == 200
    planes = res_planes.json()
    print(f" -> Planes activos en la plataforma ({len(planes)}): {[p['nombre'] for p in planes]}")
    assert any(p["nombre"] == "Basico" and p["max_sucursales"] == 2 for p in planes)
    assert any(p["nombre"] == "Profesional" and p["permite_reportes_ia"] == True for p in planes)

    res_tenants = client.get("/api/v1/saas/tenants", headers=sa_headers)
    assert res_tenants.status_code == 200
    tenants = res_tenants.json()
    print(f" -> Empresas registradas ({len(tenants)}):")
    for t in tenants:
        print(f"    * {t['razon_social']} (NIT: {t['nit']}) - Plan: {t['plan_activo']} - Sucursales: {t['total_sucursales']}")

    tenant_a = next((t for t in tenants if t["nit"] == "1023451010"), None)
    tenant_b = next((t for t in tenants if t["nit"] == "2045602018"), None)
    assert tenant_a is not None, "Tenant A no encontrado"
    assert tenant_b is not None, "Tenant B no encontrado"

    # ---------------------------------------------------------
    # 3. LOGIN TENANT A (Plan Profesional, con IA)
    # ---------------------------------------------------------
    print("\n[TEST 3] Autenticación de Empresa A: Boutique Aurora (Plan Profesional)...")
    res_a = client.post("/api/v1/auth/login", json={
        "email": "admin@1023451010.test",
        "password": "cambiar-en-produccion"
    })
    assert res_a.status_code == 200, f"Error en login Tenant A: {res_a.text}"
    data_a = res_a.json()
    assert data_a["plan"] == "Profesional"
    assert data_a["permite_reportes_ia"] == True
    assert data_a["max_sucursales"] == 10
    token_a = data_a["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f" -> OK: Logueado en '{data_a['tenant_nombre']}'. Plan: {data_a['plan']} (IA: {data_a['permite_reportes_ia']}, Límite sucursales: {data_a['max_sucursales']})")

    # ---------------------------------------------------------
    # 4. LOGIN TENANT B (Plan Básico, sin IA, max 2 sucursales)
    # ---------------------------------------------------------
    print("\n[TEST 4] Autenticación de Empresa B: Urban Wear (Plan Básico)...")
    res_b = client.post("/api/v1/auth/login", json={
        "email": "admin@2045602018.test",
        "password": "cambiar-en-produccion"
    })
    assert res_b.status_code == 200, f"Error en login Tenant B: {res_b.text}"
    data_b = res_b.json()
    assert data_b["plan"] == "Basico"
    assert data_b["permite_reportes_ia"] == False
    assert data_b["max_sucursales"] == 2
    token_b = data_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f" -> OK: Logueado en '{data_b['tenant_nombre']}'. Plan: {data_b['plan']} (IA: {data_b['permite_reportes_ia']}, Límite sucursales: {data_b['max_sucursales']})")

    # ---------------------------------------------------------
    # 5. REGLA RN23: BLOQUEO DE REPORTES IA PARA PLAN BÁSICO (CP-F46)
    # ---------------------------------------------------------
    print("\n[TEST 5] Regla RN23: Intentar solicitar Reporte IA con Empresa B (Plan Básico)...")
    res_ia_b = client.post("/api/v1/reportes/generativo", json={
        "prompt": "Total de ventas de este mes",
        "sucursales_disponibles": []
    }, headers=headers_b)
    print(f" -> Status recibido: {res_ia_b.status_code} (Detalle: {res_ia_b.json().get('detail')})")
    assert res_ia_b.status_code == 403, f"Esperaba 403 Forbidden pero obtuve {res_ia_b.status_code}"
    print(" -> OK: El Plan Básico fue bloqueado correctamente con 403 Forbidden por no incluir IA.")

    # ---------------------------------------------------------
    # 6. REGLA RN04: VALIDAR TOPE DE SUCURSALES EN PLAN BÁSICO (CP-F10)
    # ---------------------------------------------------------
    print("\n[TEST 6] Regla RN04: Comprobar límite de sucursales en Plan Básico (máximo 2)...")
    # Urban Wear tiene 1 sucursal activa. Creamos la 2da (debe permitirlo):
    res_suc2 = client.post("/api/v1/admin/sucursales", json={
        "nombre": "Urban Wear - Sucursal 2 Test",
        "ciudad_id": 1,
        "direccion": "Calle 21 de Calacoto",
        "telefono": "70011122"
    }, headers=headers_b)
    print(f" -> Creación sucursal 2/2: Status {res_suc2.status_code}")
    assert res_suc2.status_code == 200

    # Ahora intentamos crear la 3ra sucursal (debe arrojar 409 Conflict):
    res_suc3 = client.post("/api/v1/admin/sucursales", json={
        "nombre": "Urban Wear - Sucursal 3 Ilegal",
        "ciudad_id": 1,
        "direccion": "Av. Heroínas 102",
        "telefono": "70011133"
    }, headers=headers_b)
    print(f" -> Creación sucursal 3/2 (Excede límite): Status {res_suc3.status_code} (Detalle: {res_suc3.json().get('detail')})")
    assert res_suc3.status_code == 409, f"Esperaba 409 Conflict pero obtuve {res_suc3.status_code}"
    print(" -> OK: El sistema rechazó la 3ra sucursal con 409 Conflict respetando RN04.")

    # ---------------------------------------------------------
    # 7. REGLA RN05: SUSPENDER EMPRESA Y BLOQUEAR ACCESO (CU04)
    # ---------------------------------------------------------
    print("\n[TEST 7] CU04 & RN05: Suspender Empresa B y verificar bloqueo de login...")
    tenant_b_id = data_b["tenant_id"]
    res_susp = client.patch(f"/api/v1/saas/tenants/{tenant_b_id}/estado", json={
        "estado": "SUSPENDIDA"
    }, headers=sa_headers)
    assert res_susp.status_code == 200
    assert res_susp.json()["estado"] == "SUSPENDIDA"
    print(" -> Empresa B marcada como 'SUSPENDIDA' por SuperAdmin.")

    # Intentar login con empleado de Empresa B suspendida
    res_b_bloq = client.post("/api/v1/auth/login", json={
        "email": "admin@2045602018.test",
        "password": "cambiar-en-produccion"
    })
    print(f" -> Login en empresa suspendida: Status {res_b_bloq.status_code} (Detalle: {res_b_bloq.json().get('detail')})")
    assert res_b_bloq.status_code == 403, f"Esperaba 403 Forbidden pero obtuve {res_b_bloq.status_code}"
    print(" -> OK: El sistema deniega el acceso con 403 a usuarios de empresas suspendidas (RN05).")

    # Reactivar Empresa B
    res_react = client.patch(f"/api/v1/saas/tenants/{tenant_b_id}/estado", json={
        "estado": "ACTIVA"
    }, headers=sa_headers)
    assert res_react.status_code == 200
    assert res_react.json()["estado"] == "ACTIVA"
    print(" -> Empresa B reactivada a 'ACTIVA'.")

    # Verificar que el login vuelve a funcionar
    res_b_ok = client.post("/api/v1/auth/login", json={
        "email": "admin@2045602018.test",
        "password": "cambiar-en-produccion"
    })
    assert res_b_ok.status_code == 200
    print(" -> OK: Login restablecido exitosamente tras reactivación.")

    print("\n" + "="*70)
    print("¡TODAS LAS PRUEBAS DE LA FASE 1 SAAS MULTI-TENANT PASARON CON ÉXITO!")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_saas_flow()
