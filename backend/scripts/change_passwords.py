# -*- coding: utf-8 -*-
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.usuario import Usuario, Rol, Cliente
from app.models.saas import Tenant
from app.models.sucursal import Sucursal
from app.core.security import get_password_hash, verify_password

def listar_y_actualizar():
    db = SessionLocal()
    try:
        new_password = "12345"
        new_hash = get_password_hash(new_password)
        
        # Test hash
        assert verify_password("12345", new_hash), "Error al verificar hash bcrypt"
        
        usuarios = db.query(Usuario).all()
        clientes = db.query(Cliente).all()
        
        print("=" * 80)
        print("USUARIOS INTERNOS (EMPLEADOS Y ADMINISTRADORES)")
        print("=" * 80)
        
        usuarios_list = []
        for u in usuarios:
            rol_nom = u.rol.nombre if u.rol else "Sin Rol"
            suc_nom = u.sucursal.nombre if u.sucursal else "Todas / Central"
            tenant_nom = "SuperAdmin / Plataforma"
            if u.tenant_id:
                t = db.query(Tenant).filter(Tenant.id == u.tenant_id).first()
                if t:
                    tenant_nom = f"{t.razon_social} (NIT: {t.nit})"
            
            usuarios_list.append({
                "id": u.id,
                "nombres": f"{u.nombres} {u.apellidos}",
                "email": u.email,
                "rol": rol_nom,
                "sucursal": suc_nom,
                "empresa": tenant_nom,
                "activo": u.activo
            })
            
            # Actualizar contraseña
            u.password_hash = new_hash
            
        print(f"Total Usuarios Internos encontrados: {len(usuarios_list)}")
        for u in usuarios_list:
            print(f"- ID: {u['id']} | Email: {u['email']} | Nombre: {u['nombres']} | Rol: {u['rol']} | Sucursal: {u['sucursal']} | Empresa: {u['empresa']}")
            
        print("\n" + "=" * 80)
        print("CLIENTES (TIENDA ONLINE / APP MÓVIL)")
        print("=" * 80)
        
        clientes_list = []
        for c in clientes:
            tenant_nom = "General"
            if c.tenant_id:
                t = db.query(Tenant).filter(Tenant.id == c.tenant_id).first()
                if t:
                    tenant_nom = f"{t.razon_social} (NIT: {t.nit})"
                    
            clientes_list.append({
                "id": c.id,
                "nombres": f"{c.nombres} {c.apellidos}",
                "email": c.email,
                "telefono": c.telefono,
                "empresa": tenant_nom,
                "activo": c.activo
            })
            
            # Actualizar contraseña
            c.password_hash = new_hash
            
        print(f"Total Clientes encontrados: {len(clientes_list)}")
        for c in clientes_list:
            print(f"- ID: {c['id']} | Email: {c['email']} | Nombre: {c['nombres']} | Empresa: {c['empresa']}")
            
        # Commit de cambios
        db.commit()
        print("\n" + "=" * 80)
        print(f"¡EXITO! Se actualizaron las contraseñas de {len(usuarios)} usuarios y {len(clientes)} clientes a '{new_password}'.")
        print("=" * 80)
        
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    listar_y_actualizar()
