import sys
from sqlalchemy import text
from app.db.session import engine

def test_supabase_connection():
    print("Conectando a Supabase PostgreSQL...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT current_database(), current_user, version();")).fetchone()
            print(f"EXITO: Conectado a la BD: '{result[0]}' como usuario: '{result[1]}'")
            
            # Consultar tablas existentes
            tables_result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """)).fetchall()
            
            tables = [t[0] for t in tables_result]
            print(f"Tablas encontradas en la BD ({len(tables)}):")
            for t in tables:
                print(f"  - {t}")
                
    except Exception as e:
        print(f"ERROR conectando a Supabase: {e}", file=sys.stderr)

if __name__ == "__main__":
    test_supabase_connection()
