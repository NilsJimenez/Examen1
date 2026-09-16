import random
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_cycle2_complete():
    print("\n=======================================================")
    print("=== INICIANDO PRUEBAS COMPLETAS DEL CICLO DE VIDA #2 ===")
    print("=======================================================")

    # 1. Login Admin y Login/Registro Cliente
    r_admin = client.post("/api/v1/auth/login", json={
        "email": "admin@fashionstore.com",
        "password": "Admin123!"
    })
    assert r_admin.status_code == 200, f"Error login admin: {r_admin.text}"
    token_admin = r_admin.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    print("1. Login Admin OK")

    # Registro y Login Cliente
    rand = random.randint(1000, 9999)
    email_cliente = f"cliente_c2_{rand}@test.com"
    r_reg = client.post("/api/v1/auth/register-cliente", json={
        "nombres": "Carolina",
        "apellidos": "Mendez",
        "email": email_cliente,
        "password": "Password123!",
        "telefono": "77665544",
        "direccion": "Av. Las Americas #450"
    })
    assert r_reg.status_code == 201, f"Error registro cliente: {r_reg.text}"
    token_cliente = r_reg.json()["access_token"]
    headers_cliente = {"Authorization": f"Bearer {token_cliente}"}
    print(f"2. Registro y Login Cliente OK ({email_cliente})")

    # 2. CU-11: Consultar disponibilidad de stock por sucursal
    r_stock = client.get("/api/v1/inventario/stock/1")
    assert r_stock.status_code == 200, f"Error consultando stock: {r_stock.text}"
    stock_data = r_stock.json()
    print(f"3. CU-11 Stock por Sucursal: Variante #{stock_data['variante_id']} ({stock_data['producto']})")
    assert len(stock_data["stock_por_sucursal"]) > 0

    # 3. CU-12: Controlar y registrar movimiento de inventario
    r_mov = client.post("/api/v1/inventario/movimiento", json={
        "variante_id": 1,
        "sucursal_id": 1,
        "tipo_movimiento": "ingreso",
        "cantidad": 25,
        "observaciones": "Ingreso de lote de temporada Ciclo 2"
    }, headers=headers_admin)
    assert r_mov.status_code == 201, f"Error registrando movimiento: {r_mov.text}"
    print(f"4. CU-12 Movimiento Inventario OK: {r_mov.json()['message']}")

    # 4. CU-14: Realizar reserva multi-prenda para probado en tienda
    r_reserva = client.post("/api/v1/reservas/", json={
        "sucursal_id": 1,
        "fecha_reserva": "2026-09-20",
        "horario_atencion": "16:30:00",
        "items": [
            {"variante_id": 1, "cantidad": 1}
        ],
        "observaciones": "Reserva para vestidor virtual"
    }, headers=headers_cliente)
    assert r_reserva.status_code == 201, f"Error creando reserva: {r_reserva.text}"
    reserva_data = r_reserva.json()
    codigo_reserva = reserva_data["codigo_reserva"]
    reserva_id = reserva_data["id"]
    print(f"5. CU-14 Reserva Multi-Prenda Creada: {codigo_reserva} con Pase QR")
    assert reserva_data["codigo_qr"].startswith("data:image/png;base64,")

    # 5. CU-15: Consultar estado de mis reservas
    r_mis_res = client.get("/api/v1/reservas/mis-reservas", headers=headers_cliente)
    assert r_mis_res.status_code == 200
    assert any(r["id"] == reserva_id for r in r_mis_res.json())
    print("6. CU-15 Mis Reservas consultadas con éxito")

    # 6. CU-16: Preparar reserva en sucursal (Encargado)
    r_prep = client.patch(f"/api/v1/reservas/{reserva_id}/preparar", headers=headers_admin)
    assert r_prep.status_code == 200
    print("7. CU-16 Encargado marca Reserva como 'Preparada'")

    # 7. CU-17: Check-in instantáneo con Pase QR
    r_checkin = client.get(f"/api/v1/reservas/qr/{codigo_reserva}", headers=headers_admin)
    assert r_checkin.status_code == 200
    assert r_checkin.json()["valido"] is True
    print(f"8. CU-17 Check-in QR Instantáneo Válido para cliente: {r_checkin.json()['cliente']}")

    # 8. CU-18: Gestionar carrito de compras digital
    r_add_cart = client.post("/api/v1/carrito/agregar", json={
        "variante_id": 1,
        "cantidad": 2
    }, headers=headers_cliente)
    assert r_add_cart.status_code == 200
    cart_data = r_add_cart.json()
    assert cart_data["total_items"] >= 1
    print(f"9. CU-18 Carrito de Compras: {cart_data['total_items']} items, Subtotal: Bs. {cart_data['subtotal']}")

    # 9. CU-19: Realizar compra digital (Checkout)
    r_checkout = client.post("/api/v1/ventas/checkout", json={
        "metodo_entrega": "delivery",
        "direccion_envio": "Av. Las Americas #450, Edif. Torre Moda, Dpto 4B"
    }, headers=headers_cliente)
    assert r_checkout.status_code == 201
    venta_digital = r_checkout.json()
    venta_id = venta_digital["venta_id"]
    print(f"10. CU-19 Checkout Digital Orden #{venta_id}: Total Bs. {venta_digital['total']}")

    # 10. CU-20: Pasarela de Pago Digital
    r_pago = client.post(f"/api/v1/ventas/pagar/{venta_id}", json={
        "metodo_pago": "tarjeta_credito",
        "monto": float(venta_digital["total"])
    }, headers=headers_cliente)
    assert r_pago.status_code == 200
    pago_res = r_pago.json()
    print(f"11. CU-20 Pasarela de Pagos: Pago Aprobado, Comprobante: {pago_res['numero_comprobante']}")

    # 11. CU-21: Venta Presencial en Caja (POS)
    r_pos = client.post("/api/v1/ventas/pos", json={
        "sucursal_id": 1,
        "metodo_pago": "efectivo",
        "items": [
            {"variante_id": 1, "cantidad": 1, "precio_unitario": 160.00}
        ]
    }, headers=headers_admin)
    assert r_pos.status_code == 201
    pos_res = r_pos.json()
    print(f"12. CU-21 Venta Presencial POS Exitosa: Recibo #{pos_res['numero_comprobante']}, Total: Bs. {pos_res['total']}")

    print("\n=======================================================")
    print("=== TODAS LAS PRUEBAS DEL CICLO #2 PASARON AL 100%! ===")
    print("=======================================================\n")

if __name__ == "__main__":
    test_cycle2_complete()
