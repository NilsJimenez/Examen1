-- =============================================================================
-- FASHIONSTORE - ESQUEMA DE BASE DE DATOS COMPLETO (POSTGRESQL)
-- Asignatura: Sistemas II (Examen 1 - S2-2026)
-- Metodología: PUDS | Arquitectura: FastAPI + Angular + Flutter
-- =============================================================================

-- Habilitar extensiones útiles si están disponibles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ESTRUCTURA GEOGRÁFICA Y SUCURSALES (RF03)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ciudades (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL UNIQUE,
    pais            VARCHAR(100) NOT NULL DEFAULT 'Bolivia'
);

CREATE TABLE IF NOT EXISTS sucursales (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    ciudad_id       INT NOT NULL REFERENCES ciudades(id) ON DELETE RESTRICT,
    direccion       VARCHAR(255) NOT NULL,
    telefono        VARCHAR(30),
    latitud         NUMERIC(9,6),
    longitud        NUMERIC(9,6),
    activo          BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 2. SEGURIDAD, ROLES Y USUARIOS INTERNOS (RF02)
-- =============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE  -- 'administrador', 'encargado_sucursal', 'cajero'
);

CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol_id          INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    sucursal_id     INT REFERENCES sucursales(id) ON DELETE SET NULL,  -- NULL = Administrador Global
    telefono        VARCHAR(30),
    activo          BOOLEAN DEFAULT TRUE,
    fecha_registro  TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- 3. CLIENTES (RF01)
-- =============================================================================
CREATE TABLE IF NOT EXISTS clientes (
    id              SERIAL PRIMARY KEY,
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    telefono        VARCHAR(30),
    direccion       VARCHAR(255),
    fecha_nacimiento DATE,
    genero          VARCHAR(20),
    activo          BOOLEAN DEFAULT TRUE,
    fecha_registro  TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- 4. PROVEEDORES, TEMPORADAS Y COLECCIONES (RF06, RF23)
-- =============================================================================
CREATE TABLE IF NOT EXISTS proveedores (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    contacto_nombre VARCHAR(100),
    telefono        VARCHAR(30),
    email           VARCHAR(150),
    direccion       VARCHAR(255),
    activo          BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categorias (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL UNIQUE,
    descripcion     TEXT
);

CREATE TABLE IF NOT EXISTS temporadas (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,   -- 'Primavera-Verano 2026', 'Invierno 2026', 'Escolar'
    tipo            VARCHAR(50),             
    fecha_inicio    DATE,
    fecha_fin       DATE,
    activo          BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS colecciones (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    temporada_id    INT REFERENCES temporadas(id) ON DELETE SET NULL,
    descripcion     TEXT,
    fecha_lanzamiento DATE
);

-- =============================================================================
-- 5. ATRIBUTOS Y CATÁLOGO DE PRENDAS (RF04, RF05, RF07)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tallas (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(20) NOT NULL UNIQUE,  -- 'XS', 'S', 'M', 'L', 'XL', 'XXL'
    orden           INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS colores (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE,
    codigo_hex      CHAR(7)                       -- Ej: '#FFFFFF', '#000000'
);

CREATE TABLE IF NOT EXISTS productos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    categoria_id    INT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    proveedor_id    INT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    coleccion_id    INT REFERENCES colecciones(id) ON DELETE SET NULL,
    precio_base     NUMERIC(10,2) NOT NULL CHECK (precio_base >= 0),
    imagen_url      VARCHAR(500),
    modelo_ar_url   VARCHAR(500),                 -- Archivo .glb / .usdz para vestidor virtual AR
    activo          BOOLEAN DEFAULT TRUE,
    fecha_creacion  TIMESTAMP DEFAULT NOW()
);

-- Variantes reales de producto (Combinación de Producto + Talla + Color con SKU único)
CREATE TABLE IF NOT EXISTS producto_variantes (
    id                  SERIAL PRIMARY KEY,
    producto_id         INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    talla_id            INT NOT NULL REFERENCES tallas(id) ON DELETE RESTRICT,
    color_id            INT NOT NULL REFERENCES colores(id) ON DELETE RESTRICT,
    sku                 VARCHAR(50) NOT NULL UNIQUE,
    precio_adicional    NUMERIC(10,2) DEFAULT 0,
    activo              BOOLEAN DEFAULT TRUE,
    UNIQUE (producto_id, talla_id, color_id)
);

-- =============================================================================
-- 6. INVENTARIOS POR SUCURSAL Y MOVIMIENTOS KÁRDEX (RF08, RF20, RF21, RF22)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventario_sucursal (
    id                      SERIAL PRIMARY KEY,
    variante_id             INT NOT NULL REFERENCES producto_variantes(id) ON DELETE CASCADE,
    sucursal_id             INT NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cantidad_disponible     INT NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
    cantidad_reservada      INT NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
    stock_minimo            INT DEFAULT 5,
    UNIQUE (variante_id, sucursal_id)
);

DO $$ BEGIN
    CREATE TYPE tipo_movimiento_enum AS ENUM
        ('ingreso', 'venta', 'reserva', 'liberacion_reserva', 'devolucion', 'ajuste', 'transferencia');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              BIGSERIAL PRIMARY KEY,
    variante_id     INT NOT NULL REFERENCES producto_variantes(id) ON DELETE RESTRICT,
    sucursal_id     INT NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    tipo_movimiento tipo_movimiento_enum NOT NULL,
    cantidad        INT NOT NULL,
    usuario_id      INT REFERENCES usuarios(id) ON DELETE SET NULL,
    referencia_tipo VARCHAR(30),   -- 'reserva', 'venta', 'ajuste_manual', 'traspaso'
    referencia_id   INT,
    fecha           TIMESTAMP DEFAULT NOW(),
    observaciones   TEXT
);

-- =============================================================================
-- 7. RESERVAS DE PRENDAS PARA PROBADO PRESENCIAL (RF09, RF10, RF11, RF12)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE estado_reserva_enum AS ENUM
        ('pendiente', 'preparada', 'atendida', 'cancelada', 'expirada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS reservas (
    id                  SERIAL PRIMARY KEY,
    cliente_id          INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    sucursal_id         INT NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    codigo_reserva      VARCHAR(50) NOT NULL UNIQUE,  -- Código alfanumérico único para el cliente
    codigo_qr           VARCHAR(255) UNIQUE,          -- Token para escaneo instantáneo (Check-in QR)
    fecha_reserva       DATE NOT NULL,
    horario_atencion    TIME NOT NULL,
    vestidor_asignado   VARCHAR(30),                  -- Vestidor físico asignado (ej: 'Vestidor 02')
    estado              estado_reserva_enum DEFAULT 'pendiente',
    notificado          BOOLEAN DEFAULT FALSE,
    fecha_creacion      TIMESTAMP DEFAULT NOW(),
    fecha_atencion      TIMESTAMP,
    observaciones       TEXT
);

CREATE TABLE IF NOT EXISTS reserva_detalle (
    id              SERIAL PRIMARY KEY,
    reserva_id      INT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    variante_id     INT NOT NULL REFERENCES producto_variantes(id) ON DELETE RESTRICT,
    cantidad        INT NOT NULL CHECK (cantidad > 0)
);

-- =============================================================================
-- 8. CARRITO DE COMPRAS DIGITAL (RF14)
-- =============================================================================
CREATE TABLE IF NOT EXISTS carritos (
    id              SERIAL PRIMARY KEY,
    cliente_id      INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_creacion  TIMESTAMP DEFAULT NOW(),
    activo          BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS carrito_detalle (
    id              SERIAL PRIMARY KEY,
    carrito_id      INT NOT NULL REFERENCES carritos(id) ON DELETE CASCADE,
    variante_id     INT NOT NULL REFERENCES producto_variantes(id) ON DELETE CASCADE,
    cantidad        INT NOT NULL CHECK (cantidad > 0)
);

-- =============================================================================
-- 9. VENTAS (DIGITAL Y POS PRESENCIAL) (RF15, RF16, RF17, RF18, RF20)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE tipo_venta_enum AS ENUM ('presencial', 'digital');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_venta_enum AS ENUM ('completada', 'anulada', 'pendiente_pago');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS ventas (
    id                  SERIAL PRIMARY KEY,
    cliente_id          INT REFERENCES clientes(id) ON DELETE SET NULL,
    tipo_venta          tipo_venta_enum NOT NULL,
    sucursal_id         INT REFERENCES sucursales(id) ON DELETE SET NULL,
    usuario_id          INT REFERENCES usuarios(id) ON DELETE SET NULL,     -- Cajero o vendedor
    reserva_id          INT REFERENCES reservas(id) ON DELETE SET NULL,    -- Si vino de una cita presencial
    metodo_entrega      VARCHAR(30) DEFAULT 'retiro_tienda',               -- 'retiro_tienda', 'delivery'
    direccion_envio     TEXT,
    costo_envio         NUMERIC(10,2) DEFAULT 0,
    fecha_venta         TIMESTAMP DEFAULT NOW(),
    subtotal            NUMERIC(10,2) NOT NULL,
    descuento           NUMERIC(10,2) DEFAULT 0,
    impuestos           NUMERIC(10,2) DEFAULT 0,
    total               NUMERIC(10,2) NOT NULL,
    estado              estado_venta_enum DEFAULT 'pendiente_pago'
);

CREATE TABLE IF NOT EXISTS venta_detalle (
    id                  SERIAL PRIMARY KEY,
    venta_id            INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    variante_id         INT NOT NULL REFERENCES producto_variantes(id) ON DELETE RESTRICT,
    cantidad            INT NOT NULL CHECK (cantidad > 0),
    precio_unitario     NUMERIC(10,2) NOT NULL,
    subtotal            NUMERIC(10,2) NOT NULL
);

-- =============================================================================
-- 10. PAGOS Y COMPROBANTES FISCALES (RF18, RF19)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE metodo_pago_enum AS ENUM
        ('tarjeta_credito', 'tarjeta_debito', 'qr', 'transferencia', 'efectivo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_pago_enum AS ENUM
        ('pendiente', 'aprobado', 'rechazado', 'reembolsado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS pagos (
    id                      SERIAL PRIMARY KEY,
    venta_id                INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo_pago             metodo_pago_enum NOT NULL,
    monto                   NUMERIC(10,2) NOT NULL,
    estado                  estado_pago_enum DEFAULT 'pendiente',
    pasarela                VARCHAR(50),   -- 'Stripe', 'PayPal', 'Libélula', 'POS_Fisico'
    referencia_transaccion  VARCHAR(150),
    fecha_pago              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comprobantes (
    id                  SERIAL PRIMARY KEY,
    venta_id            INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    numero_comprobante  VARCHAR(50) NOT NULL UNIQUE,
    tipo                VARCHAR(30) DEFAULT 'recibo',  -- 'recibo', 'factura'
    fecha_emision       TIMESTAMP DEFAULT NOW(),
    archivo_url         VARCHAR(500)
);

-- =============================================================================
-- 11. PROMOCIONES (RF05)
-- =============================================================================
CREATE TABLE IF NOT EXISTS promociones (
    id                      SERIAL PRIMARY KEY,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    descuento_porcentaje    NUMERIC(5,2) CHECK (descuento_porcentaje BETWEEN 0 AND 100),
    producto_id             INT REFERENCES productos(id) ON DELETE CASCADE,
    categoria_id            INT REFERENCES categorias(id) ON DELETE CASCADE,
    fecha_inicio            DATE NOT NULL,
    fecha_fin               DATE NOT NULL,
    activo                  BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 12. INTELIGENCIA ARTIFICIAL, VESTIDOR VIRTUAL Y REPORTES POR VOZ (RF13, RF24, RF25)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE tipo_interaccion_enum AS ENUM
        ('vista', 'busqueda', 'favorito', 'vestidor_virtual', 'clic_recomendacion');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS historial_interacciones (
    id                  BIGSERIAL PRIMARY KEY,
    cliente_id          INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    producto_id         INT REFERENCES productos(id) ON DELETE SET NULL,
    tipo_interaccion    tipo_interaccion_enum NOT NULL,
    termino_busqueda    VARCHAR(200),
    fecha               TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recomendaciones (
    id              SERIAL PRIMARY KEY,
    cliente_id      INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    producto_id     INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    score           NUMERIC(5,4),
    motivo          VARCHAR(255),
    fecha_generada  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interacciones_chatbot (
    id              BIGSERIAL PRIMARY KEY,
    cliente_id      INT REFERENCES clientes(id) ON DELETE SET NULL,
    mensaje_usuario TEXT NOT NULL,
    respuesta_ia    TEXT,
    fecha           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sesiones_vestidor_virtual (
    id                      BIGSERIAL PRIMARY KEY,
    cliente_id              INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    variante_id             INT REFERENCES producto_variantes(id) ON DELETE SET NULL,
    fecha                   TIMESTAMP DEFAULT NOW(),
    imagen_resultado_url    VARCHAR(500),
    dispositivo             VARCHAR(100)
);

-- Reportes generativos solicitados por comando de voz o IA bajo demanda (RF25)
CREATE TABLE IF NOT EXISTS reportes_ia (
    id                      BIGSERIAL PRIMARY KEY,
    usuario_id              INT REFERENCES usuarios(id) ON DELETE SET NULL,
    comando_voz_transcrito  TEXT NOT NULL,
    tipo_reporte            VARCHAR(100),   -- 'ventas_semanales', 'rotacion_inventario', 'tendencias'
    contenido_generado      TEXT NOT NULL,
    fecha                   TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- 13. ÍNDICES DE RENDIMIENTO (RNF02)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_variantes_producto ON producto_variantes(producto_id);
CREATE INDEX IF NOT EXISTS idx_inventario_sucursal ON inventario_sucursal(variante_id, sucursal_id);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_sucursal ON reservas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal ON ventas(sucursal_id);

-- =============================================================================
-- 14. DATOS SEMILLA (SEEDS) - BASE INICIAL
-- =============================================================================
INSERT INTO roles (nombre) VALUES 
    ('administrador'),
    ('encargado_sucursal'),
    ('cajero')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO ciudades (nombre, pais) VALUES 
    ('La Paz', 'Bolivia'),
    ('Santa Cruz', 'Bolivia'),
    ('Cochabamba', 'Bolivia')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tallas (nombre, orden) VALUES 
    ('XS', 1), ('S', 2), ('M', 3), ('L', 4), ('XL', 5), ('XXL', 6)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO colores (nombre, codigo_hex) VALUES 
    ('Negro', '#000000'),
    ('Blanco', '#FFFFFF'),
    ('Azul Marino', '#001F3F'),
    ('Rojo', '#FF4136'),
    ('Beige', '#F5F5DC')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO categorias (nombre, descripcion) VALUES 
    ('Camisas y Blusas', 'Prendas superiores elegantes y casuales'),
    ('Pantalones y Jeans', 'Prendas inferiores formales e informales'),
    ('Vestidos', 'Vestidos de temporada y fiesta'),
    ('Abrigos y Chaquetas', 'Prendas de invierno y media estación')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO sucursales (nombre, ciudad_id, direccion, telefono) VALUES 
    ('Sucursal Central La Paz', 1, 'Av. 16 de Julio #1234, El Prado', '22441122'),
    ('Sucursal Equipetrol Santa Cruz', 2, 'Av. San Martín #456, Equipetrol', '33445566')
ON CONFLICT DO NOTHING;
