import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.usuario import Usuario
from app.core.security import get_password_hash

def reset_passwords():
    db = SessionLocal()
    users = db.query(Usuario).all()
    for u in users:
        u.password_hash = get_password_hash("Admin123!")
        print(f"Reset password for: {u.email}")
    db.commit()
    db.close()

if __name__ == "__main__":
    reset_passwords()
