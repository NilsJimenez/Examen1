import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.usuario import Usuario, Rol
from sqlalchemy.orm import joinedload

def check_users():
    db = SessionLocal()
    users = db.query(Usuario).options(joinedload(Usuario.rol)).all()
    for u in users:
        print(f"Email: {u.email} | Rol: {u.rol.nombre if u.rol else 'None'}")
    db.close()

if __name__ == "__main__":
    check_users()
