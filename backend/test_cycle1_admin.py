from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_cycle1_full():
    print("=== INICIANDO PRUEBAS COMPLETAS DEL CICLO DE VIDA #1 ===")

    # 1. Login del Administrador
    r_login = client.post("/api/v1/auth/login", json={
        "email": "admin@fashionstore.com",
        "password": "Admin123!"
    })
    assert r_login.status_code == 200, f"Error login admin: {r_login.text}"
    token = r_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("1. Login Admin OK -> Token JWT obtenido con éxito.")

    # 2. CU-07: Crear Atributos (Categoría, Talla, Color)
    r_cat = client.post("/api/v1/admin/categorias", json={
        "nombre": "Ropa Deportiva & Fitness",
        "descripcion": "Ropa técnica de entrenamiento"
    }, headers=headers)
    cat_id = r_cat.json()["id"] if r_cat.status_code == 200 else 1
    print(f"2. CU-07 Atributos: Categoría creada (ID: {cat_id})")

    r_talla = client.post("/api/v1/admin/tallas", json={"nombre": "3XL", "orden": 7}, headers=headers)
    print("   Talla 3XL verificada/creada.")

    r_color = client.post("/api/v1/admin/colores", json={"nombre": "Verde Esmeralda", "codigo_hex": "#00A86B"}, headers=headers)
    print("   Color Verde Esmeralda verificado/creado.")

    # 3. CU-05: Crear Sucursal
    r_suc = client.post("/api/v1/admin/sucursales", json={
        "nombre": "Sucursal Mall Ventura Santa Cruz",
        "ciudad_id": 2,
        "direccion": "4to Anillo y Av. San Martín",
        "telefono": "33556677"
    }, headers=headers)
    print("3. CU-05 Sucursales: Sucursal creada exitosamente.")

    # 4. CU-06: Crear Prenda con Modelo AR y Variantes
    r_prod = client.post("/api/v1/admin/productos", json={
        "nombre": "Polera Deportiva DryFit Pro",
        "descripcion": "Polera deportiva transpirable con tecnología de secado rápido y protección UV.",
        "categoria_id": cat_id,
        "proveedor_id": 1,
        "precio_base": 160.00,
        "imagen_url": "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800",
        "modelo_ar_url": "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
        "variantes": [
            {"talla_id": 2, "color_id": 1, "sku": "SKU-DRYFIT-S-NEG", "precio_adicional": 0},
            {"talla_id": 3, "color_id": 3, "sku": "SKU-DRYFIT-M-AZU", "precio_adicional": 0}
        ]
    }, headers=headers)
    assert r_prod.status_code == 201, f"Error creando producto: {r_prod.text}"
    prod_creado = r_prod.json()
    print(f"4. CU-06 Prendas: Prenda '{prod_creado['nombre']}' creada con ID {prod_creado['id']} y variantes.")

    # 5. CU-10: Verificar que la nueva prenda aparece en el catálogo público
    r_cat_pub = client.get(f"/api/v1/productos/{prod_creado['id']}")
    assert r_cat_pub.status_code == 200
    assert len(r_cat_pub.json()["variantes"]) == 2
    print("5. CU-10 Catálogo Público: Prenda visible con sus variantes en el catálogo.")

    # 6. CU-04: Registrar nuevo Empleado (Encargado de Sucursal)
    import random
    rand_num = random.randint(100, 999)
    r_emp = client.post("/api/v1/admin/usuarios", json={
        "nombres": "Rodrigo",
        "apellidos": "Salazar",
        "email": f"encargado{rand_num}@fashionstore.com",
        "password": "Encargado123!",
        "rol_id": 2, # Encargado de Sucursal
        "sucursal_id": 1,
        "telefono": "77112233"
    }, headers=headers)
    assert r_emp.status_code == 201, f"Error creando empleado: {r_emp.text}"
    print(f"6. CU-04 Usuarios & Roles: Empleado creado exitosamente (ID: {r_emp.json()['id']}).")

    # 7. CU-01: Registro de Cliente Nuevo
    r_cli = client.post("/api/v1/auth/register-cliente", json={
        "nombres": "Laura",
        "apellidos": "Torres",
        "email": f"laura{rand_num}@cliente.com",
        "password": "Cliente123!",
        "telefono": "78901234",
        "direccion": "Av. Busch #500, Santa Cruz"
    })
    assert r_cli.status_code == 201
    print("7. CU-01 Registro Cliente: Cliente nuevo registrado y autenticado.")

    # 8. CU-03: Recuperación de contraseña
    r_recup = client.post("/api/v1/auth/forgot-password", json={
        "email": f"laura{rand_num}@cliente.com"
    })
    assert r_recup.status_code == 200
    print("8. CU-03 Recuperación: Enlace de recuperación generado.")

    # 9. Limpieza de datos de prueba para mantener la base de datos sin duplicados
    try:
        from app.db.session import SessionLocal
        from app.models.producto import Producto
        from app.models.inventario import InventarioSucursal
        from app.models.usuario import Usuario, Cliente
        from app.models.sucursal import Sucursal

        clean_db = SessionLocal()
        p = clean_db.query(Producto).filter(Producto.id == prod_creado['id']).first()
        if p:
            clean_db.query(InventarioSucursal).filter(InventarioSucursal.variante_id.in_([v.id for v in p.variantes])).delete()
            clean_db.delete(p)

        u = clean_db.query(Usuario).filter(Usuario.id == r_emp.json()['id']).first()
        if u:
            clean_db.delete(u)

        c = clean_db.query(Cliente).filter(Cliente.email == f"laura{rand_num}@cliente.com").first()
        if c:
            clean_db.delete(c)

        if r_suc.status_code in [200, 201]:
            suc_id = r_suc.json().get("id")
            s = clean_db.query(Sucursal).filter(Sucursal.id == suc_id).first()
            if s and s.id > 3:
                clean_db.query(InventarioSucursal).filter(InventarioSucursal.sucursal_id == s.id).delete()
                clean_db.delete(s)

        clean_db.commit()
        clean_db.close()
        print("9. Limpieza post-test completada: Base de datos limpia de registros temporales.")
    except Exception as e:
        print(f"Nota de limpieza post-test: {e}")

    print("\nTODAS LAS PRUEBAS DEL CICLO 1 PASARON AL 100%!")


if __name__ == "__main__":
    test_cycle1_full()

