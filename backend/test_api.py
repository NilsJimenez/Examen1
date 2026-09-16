from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoints():
    print("--- 1. PROBANDO ENDPOINT RAIZ Y SALUD ---")
    r_root = client.get("/")
    print("GET / :", r_root.status_code, r_root.json())
    assert r_root.status_code == 200

    print("\n--- 2. PROBANDO LOGIN DEL ADMINISTRADOR (POST /api/v1/auth/login) ---")
    login_data = {
        "email": "admin@fashionstore.com",
        "password": "Admin123!"
    }
    r_login = client.post("/api/v1/auth/login", json=login_data)
    print("Status:", r_login.status_code)
    login_res = r_login.json()
    token = login_res.get("access_token")
    print(f"Login exitoso! Token recibido: {token[:25]}... (Rol: {login_res.get('role')})")
    assert r_login.status_code == 200

    print("\n--- 3. PROBANDO CONSULTA DE CATÁLOGO (GET /api/v1/productos/) ---")
    r_prods = client.get("/api/v1/productos/")
    print("Status:", r_prods.status_code)
    productos = r_prods.json()
    print(f"Total productos en catálogo: {len(productos)}")
    for p in productos:
        print(f"  - [{p['id']}] {p['nombre']} | Bs. {p['precio_base']} | Cat: {p['categoria']['nombre']}")
    assert len(productos) > 0

    print("\n--- 4. PROBANDO CONSULTA DE SUCURSALES (GET /api/v1/sucursales/) ---")
    r_sucs = client.get("/api/v1/sucursales/")
    print("Status:", r_sucs.status_code)
    sucursales = r_sucs.json()
    for s in sucursales:
        print(f"  - [{s['id']}] {s['nombre']} ({s['ciudad']['nombre']}) - Dir: {s['direccion']}")
    assert len(sucursales) > 0

    print("\nTODAS LAS PRUEBAS DE LA API PASARON EXITOSAMENTE!")

if __name__ == "__main__":
    test_endpoints()
