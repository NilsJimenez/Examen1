import sqlite3
conn = sqlite3.connect('backend/fashionstore.db')
c = conn.cursor()
c.execute("SELECT id, nombre, imagen_url FROM productos")
print("PRODUCTOS:")
for row in c.fetchall():
    print(row)

c.execute("SELECT id, producto_id, imagen_url FROM variantes_producto")
print("VARIANTES:")
for row in c.fetchall():
    print(row)
