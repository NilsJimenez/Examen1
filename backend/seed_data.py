from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.usuario import Rol, Usuario
from app.models.sucursal import Sucursal
from app.models.producto import Proveedor, Categoria, Talla, Color, Producto, ProductoVariante
from app.models.inventario import InventarioSucursal

def populate_initial_data():
    db = SessionLocal()
    print("Poblando datos iniciales de prueba en Supabase...")
    try:
        # 1. Crear Usuario Administrador si no existe
        admin_email = "admin@fashionstore.com"
        admin = db.query(Usuario).filter(Usuario.email == admin_email).first()
        rol_admin = db.query(Rol).filter(Rol.nombre == "administrador").first()
        
        if not admin and rol_admin:
            admin = Usuario(
                nombres="Administrador",
                apellidos="FashionStore",
                email=admin_email,
                password_hash=get_password_hash("Admin123!"),
                rol_id=rol_admin.id,
                activo=True
            )
            db.add(admin)
            db.commit()
            print(f"Usuario Administrador creado: {admin_email} | Password: Admin123!")
        else:
            print("El usuario administrador ya existe.")

        # 2. Crear Proveedor si no existe
        proveedor = db.query(Proveedor).first()
        if not proveedor:
            proveedor = Proveedor(
                nombre="Textiles & Confecciones Andinas S.R.L.",
                contacto_nombre="Carlos Mendoza",
                telefono="77889900",
                email="ventas@textilesandinas.com",
                direccion="Zona Industrial Parque A, Santa Cruz",
                activo=True
            )
            db.add(proveedor)
            db.commit()
            db.refresh(proveedor)
            print("Proveedor inicial creado.")

        # 3. Crear Productos de Demostración con Variantes e Inventario
        if db.query(Producto).count() == 0:
            cat_camisas = db.query(Categoria).filter(Categoria.nombre == "Camisas y Blusas").first()
            cat_pantalones = db.query(Categoria).filter(Categoria.nombre == "Pantalones y Jeans").first()
            cat_vestidos = db.query(Categoria).filter(Categoria.nombre == "Vestidos").first()
            cat_abrigos = db.query(Categoria).filter(Categoria.nombre == "Abrigos y Chaquetas").first()

            talla_m = db.query(Talla).filter(Talla.nombre == "M").first()
            talla_l = db.query(Talla).filter(Talla.nombre == "L").first()
            color_blanco = db.query(Color).filter(Color.nombre == "Blanco").first()
            color_negro = db.query(Color).filter(Color.nombre == "Negro").first()
            color_azul = db.query(Color).filter(Color.nombre == "Azul Marino").first()

            sucursales = db.query(Sucursal).all()

            prendas_demo = [
                {
                    "nombre": "Camisa Oxford Slim Fit",
                    "descripcion": "Camisa 100% algodón de corte entallado, ideal para ocasiones formales y casuales.",
                    "categoria_id": cat_camisas.id,
                    "precio_base": 180.00,
                    "imagen_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop",
                    "modelo_ar_url": "https://modelviewer.dev/shared-assets/models/Astronaut.glb"
                },
                {
                    "nombre": "Pantalón Denim Jeans Premium",
                    "descripcion": "Jeans clásicos con costura reforzada y tela stretch para máxima comodidad.",
                    "categoria_id": cat_pantalones.id,
                    "precio_base": 240.00,
                    "imagen_url": "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop",
                    "modelo_ar_url": "https://modelviewer.dev/shared-assets/models/Astronaut.glb"
                },
                {
                    "nombre": "Vestido Elegante de Gala",
                    "descripcion": "Vestido largo con caída fluida, escote refinado y acabados de alta costura.",
                    "categoria_id": cat_vestidos.id,
                    "precio_base": 420.00,
                    "imagen_url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop",
                    "modelo_ar_url": "https://modelviewer.dev/shared-assets/models/Astronaut.glb"
                },
                {
                    "nombre": "Chaqueta Cuero Clásica Biker",
                    "descripcion": "Chaqueta estilo motociclista en cuero sintético de alta resistencia con cierres metálicos.",
                    "categoria_id": cat_abrigos.id,
                    "precio_base": 390.00,
                    "imagen_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop",
                    "modelo_ar_url": "https://modelviewer.dev/shared-assets/models/Astronaut.glb"
                }
            ]

            for p_data in prendas_demo:
                p = Producto(
                    nombre=p_data["nombre"],
                    descripcion=p_data["descripcion"],
                    categoria_id=p_data["categoria_id"],
                    proveedor_id=proveedor.id,
                    precio_base=p_data["precio_base"],
                    imagen_url=p_data["imagen_url"],
                    modelo_ar_url=p_data["modelo_ar_url"],
                    activo=True
                )
                db.add(p)
                db.commit()
                db.refresh(p)

                # Crear variantes Talla M y L para cada prenda
                v1 = ProductoVariante(
                    producto_id=p.id,
                    talla_id=talla_m.id,
                    color_id=color_negro.id if "Vestido" in p.nombre or "Chaqueta" in p.nombre else color_blanco.id,
                    sku=f"SKU-{p.id}-M-01",
                    precio_adicional=0,
                    activo=True
                )
                v2 = ProductoVariante(
                    producto_id=p.id,
                    talla_id=talla_l.id,
                    color_id=color_azul.id if "Jeans" in p.nombre else color_negro.id,
                    sku=f"SKU-{p.id}-L-02",
                    precio_adicional=0,
                    activo=True
                )
                db.add_all([v1, v2])
                db.commit()
                db.refresh(v1)
                db.refresh(v2)

                # Asignar stock en cada sucursal
                for suc in sucursales:
                    inv1 = InventarioSucursal(
                        variante_id=v1.id,
                        sucursal_id=suc.id,
                        cantidad_disponible=15,
                        cantidad_reservada=0,
                        stock_minimo=3
                    )
                    inv2 = InventarioSucursal(
                        variante_id=v2.id,
                        sucursal_id=suc.id,
                        cantidad_disponible=10,
                        cantidad_reservada=0,
                        stock_minimo=3
                    )
                    db.add_all([inv1, inv2])

                db.commit()
                print(f"Prenda '{p.nombre}' creada con variantes y stock por sucursal.")

        print("Poblado de datos de prueba finalizado con EXITO.")

    except Exception as e:
        db.rollback()
        print(f"Error poblando datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    populate_initial_data()
