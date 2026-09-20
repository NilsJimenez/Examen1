import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.models.producto import Color

def check():
    db = SessionLocal()
    colores = db.query(Color).all()
    for c in colores:
        print(f"ID: {c.id} | Nombre: {c.nombre} | Hex: {c.hex}")
    db.close()

if __name__ == "__main__":
    check()
