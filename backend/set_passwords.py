import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.usuario import Usuario
from app.core.security import get_password_hash

def reset_passwords():
    db = SessionLocal()
    
    encargado = db.query(Usuario).filter(Usuario.email == "encargado@fashionstore.com").first()
    if encargado:
        encargado.password_hash = get_password_hash("Encargado123!")
        
    cajero = db.query(Usuario).filter(Usuario.email == "cajero@fashionstore.com").first()
    if cajero:
        cajero.password_hash = get_password_hash("Cajero123!")

    db.commit()
    db.close()
    print("Contraseñas actualizadas con éxito.")

if __name__ == "__main__":
    reset_passwords()
