from sqlalchemy import text
from app.db.session import SessionLocal

db = SessionLocal()
try:
    db.execute(text("ALTER TABLE usuarios ADD COLUMN reset_code VARCHAR(6);"))
    db.execute(text("ALTER TABLE usuarios ADD COLUMN reset_code_expires TIMESTAMP;"))
except Exception as e:
    print("Usuarios error:", e)
try:
    db.execute(text("ALTER TABLE clientes ADD COLUMN reset_code VARCHAR(6);"))
    db.execute(text("ALTER TABLE clientes ADD COLUMN reset_code_expires TIMESTAMP;"))
except Exception as e:
    print("Clientes error:", e)
db.commit()
print("Done")
