# Modelos UML 2.5 y Arquitectura del Sistema - FashionStore

Este documento contiene la especificación formal y los diagramas en **UML 2.5 (Mermaid)** para la defensa del proyecto, cubriendo el ciclo de vida de prendas, concurrencia en reservas, pasarela de pagos y gestión multi-sucursal.

---

## 1. Diagrama de Clases UML 2.5: Ciclo de Vida de Reserva, Inventario y Ventas

Este diagrama ilustra la estructura de datos que permite que **una misma reserva contenga prendas en diferentes estados** (`reservada`, `disponible`, `vendida`), así como la relación con el stock por sucursal y la pasarela de pagos.

```mermaid
classDiagram
    direction TB

    class Sucursal {
        +int id
        +string nombre
        +string direccion
        +int ciudad_id
        +bool activa
    }

    class ProductoVariante {
        +int id
        +int producto_id
        +int talla_id
        +int color_id
        +string sku
        +float precio_adicional
    }

    class InventarioSucursal {
        +int id
        +int sucursal_id
        +int variante_id
        +int cantidad_disponible
        +int cantidad_reservada
        +int stock_minimo
        +calcularStockLibre() int
    }

    class MovimientoInventario {
        +int id
        +int variante_id
        +int sucursal_id
        +string tipo_movimiento
        +int cantidad
        +string referencia_tipo
        +int referencia_id
        +datetime fecha
    }

    class Reserva {
        +int id
        +int cliente_id
        +int sucursal_id
        +string codigo_reserva
        +string codigo_qr
        +date fecha_reserva
        +time horario_atencion
        +string estado
        +cancelar() void
        +preparar() void
        +atender() void
    }

    class ReservaDetalle {
        +int id
        +int reserva_id
        +int variante_id
        +int cantidad
        +string estado_prenda
        +cambiarEstado(nuevo_estado) void
    }

    class Venta {
        +int id
        +int cliente_id
        +int sucursal_id
        +string tipo_venta
        +string metodo_entrega
        +float subtotal
        +float costo_envio
        +float total
        +string estado
    }

    class VentaDetalle {
        +int id
        +int venta_id
        +int variante_id
        +int cantidad
        +float precio_unitario
        +float subtotal
    }

    class Pago {
        +int id
        +int venta_id
        +string metodo_pago
        +float monto
        +string estado
        +string pasarela
        +string referencia_transaccion
        +datetime fecha_pago
    }

    class Comprobante {
        +int id
        +int venta_id
        +string numero_comprobante
        +string tipo
        +datetime fecha_emision
    }

    Sucursal "1" --> "*" InventarioSucursal : posee
    ProductoVariante "1" --> "*" InventarioSucursal : stockeada en
    InventarioSucursal "1" --> "*" MovimientoInventario : registra kárdex
    Sucursal "1" --> "*" Reserva : atiende
    Reserva "1" *-- "1..*" ReservaDetalle : compuesta por
    ProductoVariante "1" --> "*" ReservaDetalle : reservada en
    ReservaDetalle ..> InventarioSucursal : bloquea/libera
    Venta "1" *-- "1..*" VentaDetalle : contiene
    Venta "1" --> "0..1" Comprobante : genera
    Venta "1" --> "1..*" Pago : liquidada mediante
```

### Explicación del Estado de Prenda en la Reserva:
- **`ReservaDetalle.estado_prenda`**:
  - `reservada`: Prenda apartada en el vestidor. El stock de la sucursal la contabiliza en `cantidad_reservada`.
  - `disponible`: La prenda fue probada por el cliente y descartada, o liberada anticipadamente. Se resta de `cantidad_reservada` y queda libre para otros clientes.
  - `vendida`: El cliente decidió quedarse con la prenda y comprarla en caja. Se descuenta de `cantidad_disponible` y se asienta el movimiento en el kárdex.

---

## 2. Diagrama de Secuencia UML 2.5: Concurrencia y Bloqueo Pesimista (`FOR UPDATE`)

Cómo el sistema evita que dos clientes puedan reservar simultáneamente la misma prenda cuando solo queda 1 unidad en stock.

```mermaid
sequenceDiagram
    autonumber
    actor ClienteA as Cliente A (App Móvil)
    actor ClienteB as Cliente B (Web / App)
    participant API as FastAPI Backend (/reservas/)
    participant DB as PostgreSQL (Supabase)
    participant Lock as Fila Inventario (Row Lock)

    Note over ClienteA, ClienteB: Prenda X en Sucursal Central tiene Stock Libre = 1

    ClienteA->>+API: POST /reservas/ (Item: Prenda X, Cant: 1)
    ClienteB->>+API: POST /reservas/ (Item: Prenda X, Cant: 1)

    rect rgb(240, 248, 255)
    Note over API, DB: Cliente A inicia transacción e invoca with_for_update()
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM inventario_sucursal<br/>WHERE variante_id=X AND sucursal_id=1<br/>FOR UPDATE;
    DB->>Lock: Adquiere Bloqueo Exclusivo de Fila (Cliente A)
    DB-->>API: Retorna fila: disponible=1, reservada=0 (Libre = 1)
    end

    rect rgb(255, 240, 240)
    Note over API, DB: Cliente B intenta leer la misma fila con FOR UPDATE
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM inventario_sucursal<br/>WHERE variante_id=X AND sucursal_id=1<br/>FOR UPDATE;
    Note over DB, Lock: Cliente B queda EN ESPA (Bloqueado) hasta que A termine
    end

    rect rgb(240, 255, 240)
    Note over API, DB: Cliente A confirma la reserva
    API->>DB: INSERT INTO reserva ...
    API->>DB: INSERT INTO reserva_detalle (estado_prenda='reservada') ...
    API->>DB: UPDATE inventario_sucursal SET cantidad_reservada = 1 ...
    API->>DB: INSERT INTO movimiento_inventario (tipo='reserva') ...
    API->>DB: COMMIT;
    DB->>Lock: Libera Bloqueo Exclusivo de Fila
    API-->>ClienteA: 201 Created {"codigo_reserva": "RES-XXXX", "qr": "..."}
    end

    rect rgb(255, 235, 235)
    Note over API, DB: Se reanuda la consulta del Cliente B
    DB-->>API: Retorna fila actualizada: disponible=1, reservada=1 (Libre = 0)
    API->>API: Valida: stock_libre (0) < cantidad_solicitada (1)
    API->>DB: ROLLBACK;
    API-->>ClienteB: 400 Bad Request {"detail": "Stock insuficiente para variante X"}
    end
```

---

## 3. Diagrama de Secuencia UML 2.5: Pasarela de Pagos (Flujo Aprobado vs Rechazado)

Muestra el procesamiento de cobros (QR Simple, Tarjeta y Efectivo) y cómo la pasarela devuelve la **aprobación o rechazo** de la transacción garantizando la integridad del inventario.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Cliente (Web / Móvil)
    participant Frontend as Frontend (Angular / App)
    participant Backend as Backend FastAPI (/ventas/pagar)
    participant Pasarela as Pasarela de Pago (Simulador / Bancaria)
    participant BD as PostgreSQL (Ventas, Pagos, Inventario)

    Cliente->>Frontend: Selecciona Forma de Pago (QR / Tarjeta) y confirma
    Frontend->>+Backend: POST /ventas/pagar/{id} {metodo, monto, simular_rechazo, tarjeta}

    Backend->>BD: SELECT * FROM venta WHERE id={id} FOR UPDATE
    BD-->>Backend: Venta encontrada (estado: pendiente_pago)

    alt Caso 1: Pasarela Deniega Operación (Rechazo / Fondos Insuficientes / Tarjeta Declinada)
        Backend->>Pasarela: Procesar Cobro (Payload de Pago)
        Pasarela-->>Backend: RECHAZADO (Code: DECLINED, Ref: TXN-RECH-XXXX)
        Backend->>BD: INSERT INTO pago (estado='rechazado', ref='TXN-RECH-XXXX')
        Note over BD: Inventario NO se modifica. Venta permanece pendiente.
        Backend->>BD: COMMIT
        Backend-->>Frontend: 400 Bad Request ("Transacción Rechazada por Pasarela...")
        Frontend-->>Cliente: Muestra Banner Rojo de Alerta con Ref y opción de reintento
    else Caso 2: Pasarela Aprueba Operación (Éxito)
        Backend->>Pasarela: Procesar Cobro (Payload de Pago)
        Pasarela-->>Backend: APROBADO (Code: 00_SUCCESS, Ref: TXN-XXXX)
        Backend->>BD: INSERT INTO pago (estado='aprobado', ref='TXN-XXXX')
        Backend->>BD: UPDATE venta SET estado='completada'
        
        loop Para cada detalle de la venta
            Backend->>BD: UPDATE inventario_sucursal SET cantidad_disponible = cantidad_disponible - item.cantidad
            Backend->>BD: INSERT INTO movimiento_inventario (tipo='venta')
        end
        
        Backend->>BD: INSERT INTO comprobante (numero_comprobante='COMP-XXXX', tipo='recibo')
        Backend->>BD: DELETE FROM carrito_detalle WHERE carrito_id=cliente.carrito_id
        Backend->>BD: COMMIT
        Backend-->>Frontend: 200 OK {"mensaje": "Pago aprobado", "numero_comprobante": "COMP-XXXX"}
        Frontend-->>Cliente: Muestra Pantalla de Comprobante Verde Oficial y Pase de Compra
    end
```

---

## 4. Respuestas Técnicas Concisas para la Mesa de Examen

1. **¿Cómo se diferencia si una prenda está disponible, reservada y vendida?**
   - Se maneja a nivel de `inventario_sucursal` (`cantidad_disponible` y `cantidad_reservada`), y a nivel de cada ítem en `reserva_detalle` con la columna `estado_prenda` (`'reservada'`, `'disponible'`, `'vendida'`).
   - El stock libre vendible se calcula estrictamente como:
     $$\text{Stock Libre} = \text{cantidad\_disponible} - \text{cantidad\_reservada}$$

2. **¿Cómo se evita que dos clientes reserven simultáneamente la misma prenda?**
   - Mediante **Bloqueo Pesimista en Base de Datos** (`SELECT ... FOR UPDATE` en PostgreSQL/SQLAlchemy: `inv = db.query(InventarioSucursal).filter(...).with_for_update().first()`).
   - La primera transacción que llega adquiere el lock a nivel de fila; la segunda espera a que la primera haga `COMMIT`. Al reanudarse la segunda, detecta que el stock libre es 0 y devuelve `400 Bad Request`.

3. **¿El cliente puede comprar desde la aplicación móvil y recibir confirmaciones?**
   - Sí, la API REST es 100% agnóstica para clientes Web y Móvil (`/api/v1/ventas/checkout` y `/api/v1/ventas/pagar`). Al completarse la compra, se genera el registro del comprobante fiscal oficial, se actualiza el estado de la venta y se devuelve el identificador de transacción bancaria.

4. **¿El stock puede ser diferente por sucursal y una reserva puede contener prendas reservadas, disponibles y vendidas?**
   - Sí. Cada registro en `inventario_sucursal` tiene clave compuesta (`sucursal_id`, `variante_id`), con stock independiente por tienda física.
   - En una reserva (`reserva_detalle`), cada ítem tiene su propio `estado_prenda`, permitiendo que dentro de una misma reserva una prenda esté ya aprobada/vendida, otra aún apartada/reservada en vestidor y otra probada/disponible. Todo respaldado en el Modelo UML de Clases anterior.

5. **¿Tienen probador de ropa en Realidad Aumentada?**
   - Sí, implementado en el catálogo con `Vestidor Virtual 3D/AR` utilizando Three.js y WebGL interactivo en tiempo real con rotación 360°, ajuste de escala y previsualización de texturas de tela sobre modelo anatómico.

6. **¿Recomendaciones por IA según cliente, temporada, talla o disponibilidad?**
   - Sí, a través del servicio `/ia/recomendaciones` y `/ia/alerta-reabastecimiento`. Considera el historial del cliente, las condiciones climáticas/temporada, la disponibilidad por sucursal y sugiere prendas afines y niveles óptimos de reposición.

7. **¿Formas de pago por QR, efectivo y tarjeta con aprobación y rechazo?**
   - Sí, pasarela multi-método (`qr`, `tarjeta_credito`, `efectivo`). Cuenta con simulación de transacciones aprobadas y rechazadas (por bandera bancaria o tarjeta declinada), registrando el estado del pago en la tabla `pagos` y protegiendo el inventario ante rechazos.
