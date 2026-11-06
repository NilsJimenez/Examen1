import sys
import os
import uuid
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.abspath("backend"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.usuario import Rol, Usuario
from app.models.sucursal import Ciudad, Sucursal
from app.models.saas import Tenant, Plan, Suscripcion
from app.models.producto import Categoria, Proveedor, Talla, Color, Producto, ProductoVariante
from app.models.inventario import InventarioSucursal


def seed_database():
    print("========================================================")
    print("INICIANDO POBLACIÓN DE DATOS SEMILLA SAAS MULTI-TENANT")
    print("Documento SI2 - UAGRM (Páginas 48 y 61)")
    print("========================================================")

    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # 1. Asegurar Roles del Sistema
        roles_necesarios = ["SuperAdmin", "Administrador", "Encargado", "Cajero", "Cliente"]
        roles_dict = {}
        for r_nom in roles_necesarios:
            r = db.query(Rol).filter(Rol.nombre == r_nom).first()
            if not r:
                r = Rol(nombre=r_nom)
                db.add(r)
                db.flush()
                print(f" [+] Rol creado: {r_nom}")
            roles_dict[r_nom] = r

        # 2. Asegurar Ciudad Base
        ciudad_scz = db.query(Ciudad).filter(Ciudad.nombre == "Santa Cruz").first()
        if not ciudad_scz:
            ciudad_scz = Ciudad(nombre="Santa Cruz", pais="Bolivia")
            db.add(ciudad_scz)
            db.flush()
            print(" [+] Ciudad creada: Santa Cruz")

        # 3. Planes SaaS Oficiales
        # Plan Básico: max 2 sucursales, sin IA
        plan_basico = db.query(Plan).filter(Plan.nombre == "Basico").first()
        if not plan_basico:
            plan_basico = Plan(
                id=uuid.uuid4(),
                nombre="Basico",
                max_sucursales=2,
                permite_reportes_ia=False,
                activo=True
            )
            db.add(plan_basico)
            db.flush()
            print(" [+] Plan creado: Básico (Máx 2 sucursales, Sin IA)")
        else:
            plan_basico.max_sucursales = 2
            plan_basico.permite_reportes_ia = False

        # Plan Profesional: max 10 sucursales, con IA
        plan_pro = db.query(Plan).filter(Plan.nombre == "Profesional").first()
        if not plan_pro:
            plan_pro = Plan(
                id=uuid.uuid4(),
                nombre="Profesional",
                max_sucursales=10,
                permite_reportes_ia=True,
                activo=True
            )
            db.add(plan_pro)
            db.flush()
            print(" [+] Plan creado: Profesional (Máx 10 sucursales, Con IA)")
        else:
            plan_pro.max_sucursales = 10
            plan_pro.permite_reportes_ia = True

        pwd_default_hash = get_password_hash("cambiar-en-produccion")

        # 4. Super Administrador de la Plataforma SaaS (Global)
        super_admin_email = "admin@fashionstore.saas"
        super_admin = db.query(Usuario).filter(Usuario.email == super_admin_email).first()
        if not super_admin:
            super_admin = Usuario(
                nombres="Super",
                apellidos="Admin SaaS",
                email=super_admin_email,
                password_hash=pwd_default_hash,
                rol_id=roles_dict["SuperAdmin"].id,
                tenant_id=None,  # No pertenece a ningún tenant en particular
                activo=True
            )
            db.add(super_admin)
            db.flush()
            print(f" [+] SuperAdmin Plataforma creado: {super_admin_email}")

        # 5. Empresa A: "Boutique Aurora S.R.L." (NIT: 1023451010, Plan Profesional)
        tenant_a = db.query(Tenant).filter(Tenant.nit == "1023451010").first()
        if not tenant_a:
            tenant_a = Tenant(
                id=uuid.uuid4(),
                razon_social="Boutique Aurora S.R.L.",
                nit="1023451010",
                estado="ACTIVA"
            )
            db.add(tenant_a)
            db.flush()
            print(f" [+] Tenant A creado: {tenant_a.razon_social} (NIT: {tenant_a.nit})")

        # Suscripción Tenant A -> Plan Profesional
        sub_a = db.query(Suscripcion).filter(Suscripcion.tenant_id == tenant_a.id, Suscripcion.estado == "ACTIVA").first()
        if not sub_a:
            sub_a = Suscripcion(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                plan_id=plan_pro.id,
                fecha_inicio=date.today(),
                fecha_vencimiento=date.today() + timedelta(days=365),
                estado="ACTIVA"
            )
            db.add(sub_a)
            db.flush()
            print(" [+] Suscripción Tenant A: Plan Profesional ACTIVA hasta 1 año")

        # Admin Tenant A
        admin_a_email = "admin@1023451010.test"
        admin_a = db.query(Usuario).filter(Usuario.email == admin_a_email).first()
        if not admin_a:
            admin_a = Usuario(
                nombres="Aurora Admin",
                apellidos="Boutique",
                email=admin_a_email,
                password_hash=pwd_default_hash,
                rol_id=roles_dict["Administrador"].id,
                tenant_id=tenant_a.id,
                activo=True
            )
            db.add(admin_a)
            db.flush()
            print(f" [+] Admin Tenant A creado: {admin_a_email}")

        # Sucursales Tenant A (2 de 10 permitidas)
        suc_a1 = db.query(Sucursal).filter(Sucursal.tenant_id == tenant_a.id, Sucursal.nombre == "Aurora Central - Equipetrol").first()
        if not suc_a1:
            suc_a1 = Sucursal(
                tenant_id=tenant_a.id,
                nombre="Aurora Central - Equipetrol",
                ciudad_id=ciudad_scz.id,
                direccion="Av. San Martín #450, Equipetrol",
                telefono="77011223",
                activo=True
            )
            db.add(suc_a1)
            db.flush()
            print(" [+] Sucursal A1 creada: Aurora Central - Equipetrol")

        suc_a2 = db.query(Sucursal).filter(Sucursal.tenant_id == tenant_a.id, Sucursal.nombre == "Aurora Norte - Mall Las Brisas").first()
        if not suc_a2:
            suc_a2 = Sucursal(
                tenant_id=tenant_a.id,
                nombre="Aurora Norte - Mall Las Brisas",
                ciudad_id=ciudad_scz.id,
                direccion="4to Anillo y Av. Cristo Redentor, Local 12",
                telefono="77011224",
                activo=True
            )
            db.add(suc_a2)
            db.flush()
            print(" [+] Sucursal A2 creada: Aurora Norte - Mall Las Brisas")

        # 6. Empresa B: "Urban Wear Ltda." (NIT: 2045602018, Plan Básico)
        tenant_b = db.query(Tenant).filter(Tenant.nit == "2045602018").first()
        if not tenant_b:
            tenant_b = Tenant(
                id=uuid.uuid4(),
                razon_social="Urban Wear Ltda.",
                nit="2045602018",
                estado="ACTIVA"
            )
            db.add(tenant_b)
            db.flush()
            print(f" [+] Tenant B creado: {tenant_b.razon_social} (NIT: {tenant_b.nit})")

        # Suscripción Tenant B -> Plan Básico
        sub_b = db.query(Suscripcion).filter(Suscripcion.tenant_id == tenant_b.id, Suscripcion.estado == "ACTIVA").first()
        if not sub_b:
            sub_b = Suscripcion(
                id=uuid.uuid4(),
                tenant_id=tenant_b.id,
                plan_id=plan_basico.id,
                fecha_inicio=date.today(),
                fecha_vencimiento=date.today() + timedelta(days=365),
                estado="ACTIVA"
            )
            db.add(sub_b)
            db.flush()
            print(" [+] Suscripción Tenant B: Plan Básico ACTIVA hasta 1 año")

        # Admin Tenant B
        admin_b_email = "admin@2045602018.test"
        admin_b = db.query(Usuario).filter(Usuario.email == admin_b_email).first()
        if not admin_b:
            admin_b = Usuario(
                nombres="Urban Admin",
                apellidos="Streetwear",
                email=admin_b_email,
                password_hash=pwd_default_hash,
                rol_id=roles_dict["Administrador"].id,
                tenant_id=tenant_b.id,
                activo=True
            )
            db.add(admin_b)
            db.flush()
            print(f" [+] Admin Tenant B creado: {admin_b_email}")

        # Sucursal Tenant B (1 de 2 permitidas)
        suc_b1 = db.query(Sucursal).filter(Sucursal.tenant_id == tenant_b.id, Sucursal.nombre == "Urban Wear - Ventura Mall").first()
        if not suc_b1:
            suc_b1 = Sucursal(
                tenant_id=tenant_b.id,
                nombre="Urban Wear - Ventura Mall",
                ciudad_id=ciudad_scz.id,
                direccion="4to Anillo Ventura Mall, Piso 1 Local 45",
                telefono="78901234",
                activo=True
            )
            db.add(suc_b1)
            db.flush()
            print(" [+] Sucursal B1 creada: Urban Wear - Ventura Mall")

        # Asociar registros existentes sin tenant a Tenant A para que no queden huérfanos
        db.query(Sucursal).filter(Sucursal.tenant_id == None).update({Sucursal.tenant_id: tenant_a.id})
        db.query(Categoria).filter(Categoria.tenant_id == None).update({Categoria.tenant_id: tenant_a.id})
        db.query(Proveedor).filter(Proveedor.tenant_id == None).update({Proveedor.tenant_id: tenant_a.id})
        db.query(Producto).filter(Producto.tenant_id == None).update({Producto.tenant_id: tenant_a.id})
        db.query(InventarioSucursal).filter(InventarioSucursal.tenant_id == None).update({InventarioSucursal.tenant_id: tenant_a.id})

        db.commit()
        print("========================================================")
        print("¡DATOS SEMILLA SAAS MULTI-TENANT POBLADOS CON ÉXITO!")
        print("========================================================")
        print("Cuentas de Acceso Disponibles:")
        print("1. SuperAdmin Global:")
        print("   Email:    admin@fashionstore.saas")
        print("   Password: cambiar-en-produccion")
        print("2. Empresa A (Plan Profesional - con IA y hasta 10 sucursales):")
        print("   Tenant:   Boutique Aurora S.R.L. (NIT: 1023451010)")
        print("   Email:    admin@1023451010.test")
        print("   Password: cambiar-en-produccion")
        print("3. Empresa B (Plan Básico - sin IA y hasta 2 sucursales):")
        print("   Tenant:   Urban Wear Ltda. (NIT: 2045602018)")
        print("   Email:    admin@2045602018.test")
        print("   Password: cambiar-en-produccion")
        print("========================================================")

    except Exception as e:
        db.rollback()
        print("[!] Error durante el seed de la base de datos:", e)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
