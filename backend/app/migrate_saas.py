import sys
import os
sys.path.insert(0, os.path.abspath("backend"))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    print("Connecting to Supabase Database...")
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.begin() as conn:
        print("Ensuring uuid-ossp or pgcrypto extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"))

        print("1. Creating SaaS Core Tables if not exists...")
        # 1. tenants
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                razon_social VARCHAR(200) NOT NULL,
                nit VARCHAR(30) UNIQUE NOT NULL,
                estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'SUSPENDIDA')),
                creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        # 2. planes
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS planes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nombre VARCHAR(50) UNIQUE NOT NULL CHECK (nombre IN ('Basico', 'Profesional')),
                max_sucursales INT NOT NULL CHECK (max_sucursales > 0),
                permite_reportes_ia BOOLEAN NOT NULL DEFAULT FALSE,
                activo BOOLEAN NOT NULL DEFAULT TRUE
            );
        """))

        # 3. suscripciones
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS suscripciones (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                plan_id UUID NOT NULL REFERENCES planes(id),
                fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
                fecha_vencimiento DATE NOT NULL,
                estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'VENCIDA', 'CANCELADA'))
            );
        """))

        # 4. operaciones_sync (Offline-first idempotency)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS operaciones_sync (
                operation_id UUID PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('VENTA', 'RESERVA')),
                entidad_id VARCHAR(100) NULL,
                estado VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA' CHECK (estado IN ('CONFIRMADA', 'RECHAZADA', 'EN_CONFLICTO')),
                motivo TEXT NULL,
                resultado JSONB NULL,
                recibida_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        # 5. ml_modelos (ML global)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ml_modelos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nombre VARCHAR(100) NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                version VARCHAR(20) NOT NULL,
                metricas JSONB NULL,
                entrenado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                activo BOOLEAN NOT NULL DEFAULT TRUE
            );
        """))

        # 6. solicitudes_reporte (CU28 AI report audit)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS solicitudes_reporte (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                usuario_id INT NOT NULL REFERENCES usuarios(id),
                texto TEXT NOT NULL,
                tipo_reporte VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
                filtros JSONB NULL,
                estado VARCHAR(20) NOT NULL DEFAULT 'COMPLETADO',
                creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        # 7. cambios_prenda (CU14)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cambios_prenda (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                venta_id INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
                variante_devuelta_id INT NOT NULL REFERENCES producto_variantes(id),
                variante_entregada_id INT NOT NULL REFERENCES producto_variantes(id),
                diferencia NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                autorizado_por INT NOT NULL REFERENCES usuarios(id),
                creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))

        print("2. Adding tenant_id and offline fields to existing tables...")
        # Add tenant_id to tables
        tables_with_tenant = [
            "usuarios", "clientes", "sucursales", "proveedores", "categorias",
            "temporadas", "colecciones", "productos", "inventario_sucursal",
            "movimientos_inventario", "alertas_reabastecimiento",
            "ventas", "venta_detalle", "pagos", "comprobantes",
            "reservas", "reserva_detalle"
        ]

        for tbl in tables_with_tenant:
            conn.execute(text(f"""
                ALTER TABLE {tbl} 
                ADD COLUMN IF NOT EXISTS tenant_id UUID NULL REFERENCES tenants(id) ON DELETE CASCADE;
            """))
            conn.execute(text(f"""
                CREATE INDEX IF NOT EXISTS idx_{tbl}_tenant_id ON {tbl}(tenant_id);
            """))

        # Add specific offline sync and audit columns
        conn.execute(text("""
            ALTER TABLE ventas 
            ADD COLUMN IF NOT EXISTS client_sale_id VARCHAR(100) NULL,
            ADD COLUMN IF NOT EXISTS estado_sync VARCHAR(30) DEFAULT 'CONFIRMADA',
            ADD COLUMN IF NOT EXISTS fecha_local TIMESTAMP WITH TIME ZONE NULL,
            ADD COLUMN IF NOT EXISTS fecha_servidor TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ventas_client_sale_id ON ventas(client_sale_id);"))

        conn.execute(text("""
            ALTER TABLE reservas 
            ADD COLUMN IF NOT EXISTS estado_sync VARCHAR(30) DEFAULT 'CONFIRMADA',
            ADD COLUMN IF NOT EXISTS fecha_local TIMESTAMP WITH TIME ZONE NULL;
        """))

        conn.execute(text("""
            ALTER TABLE sucursales 
            ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT TRUE;
        """))

        print("Migration executed successfully!")

if __name__ == "__main__":
    run_migration()
