import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Gestor Singleton de Base de Datos Relacional Local con SQLite (Desafío III - Sección 6.1).
/// Mantiene 12 tablas normalizadas con llaves foráneas activas e índices de búsqueda rápida.
class LocalDatabase {
  LocalDatabase._internal();
  static final LocalDatabase instance = LocalDatabase._internal();

  static const String dbFileName = 'fashionstore_offline_v1.db';
  static const int dbVersion = 1;

  Database? _database;
  String? _overridePathForTesting;

  /// Permite usar una base en memoria o ruta temporal durante pruebas automatizadas (Fase 2 / Fase 5).
  void configureForTesting(String customPath) {
    _overridePathForTesting = customPath;
  }

  Future<Database> get database async {
    if (_database != null && _database!.isOpen) {
      return _database!;
    }
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final String path;
    if (_overridePathForTesting != null) {
      path = _overridePathForTesting!;
    } else {
      final dbDir = await getDatabasesPath();
      path = p.join(dbDir, dbFileName);
    }

    return openDatabase(
      path,
      version: dbVersion,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
      onCreate: _createSchema,
    );
  }

  Future<void> _createSchema(Database db, int version) async {
    final batch = db.batch();

    // 1. Sesión activa y configuración de sincronización (fila única id = 1)
    batch.execute('''
      CREATE TABLE local_sesion (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        usuario_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        nombre_completo TEXT NOT NULL,
        rol TEXT NOT NULL,
        user_type TEXT NOT NULL,
        token_jwt TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        tenant_nombre TEXT NOT NULL,
        plan_nombre TEXT NOT NULL,
        sucursal_asignada_id INTEGER,
        sucursal_activa_id INTEGER,
        ultima_sincronizacion TEXT,
        umbral_horas_desactualizado INTEGER NOT NULL DEFAULT 12
      )
    ''');

    // 2. Sucursales autorizadas del tenant
    batch.execute('''
      CREATE TABLE local_sucursales (
        id INTEGER PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        nombre TEXT NOT NULL,
        ciudad TEXT,
        direccion TEXT NOT NULL,
        telefono TEXT,
        activo INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 3. Categorías del catálogo local
    batch.execute('''
      CREATE TABLE local_categorias (
        id INTEGER PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        nombre TEXT NOT NULL
      )
    ''');

    // 4. Productos activos del tenant
    batch.execute('''
      CREATE TABLE local_productos (
        id INTEGER PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        categoria_id INTEGER,
        categoria_nombre TEXT,
        precio_base REAL NOT NULL,
        imagen_url TEXT,
        genero TEXT,
        activo INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 5. Variantes de producto (SKU, talla, color y precio vigente)
    batch.execute('''
      CREATE TABLE local_variantes (
        id INTEGER PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        producto_id INTEGER NOT NULL REFERENCES local_productos(id) ON DELETE CASCADE,
        producto_nombre TEXT NOT NULL,
        sku TEXT NOT NULL,
        talla_id INTEGER NOT NULL,
        talla TEXT NOT NULL,
        color_id INTEGER NOT NULL,
        color TEXT NOT NULL,
        codigo_hex TEXT,
        precio_base REAL NOT NULL,
        precio_adicional REAL NOT NULL DEFAULT 0,
        precio_vigente REAL NOT NULL,
        imagen_url TEXT,
        activo INTEGER NOT NULL DEFAULT 1
      )
    ''');

    // 6. Inventario descargado por sucursal + contadores de compromiso local offline
    batch.execute('''
      CREATE TABLE local_inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        servidor_inv_id INTEGER,
        tenant_id TEXT NOT NULL,
        sucursal_id INTEGER NOT NULL REFERENCES local_sucursales(id) ON DELETE CASCADE,
        variante_id INTEGER NOT NULL REFERENCES local_variantes(id) ON DELETE CASCADE,
        cantidad_disponible_servidor INTEGER NOT NULL DEFAULT 0,
        cantidad_reservada_servidor INTEGER NOT NULL DEFAULT 0,
        comprometido_local_ventas INTEGER NOT NULL DEFAULT 0,
        comprometido_local_reservas INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 5,
        UNIQUE(sucursal_id, variante_id)
      )
    ''');

    // 7. Datos mínimos de clientes del tenant (y clientes registrados offline)
    batch.execute('''
      CREATE TABLE local_clientes (
        local_pk INTEGER PRIMARY KEY AUTOINCREMENT,
        servidor_id INTEGER UNIQUE,
        tenant_id TEXT NOT NULL,
        nombres TEXT NOT NULL,
        apellidos TEXT NOT NULL,
        email TEXT,
        telefono TEXT,
        es_creado_offline INTEGER NOT NULL DEFAULT 0
      )
    ''');

    // 8. Ventas presenciales locales (Regla 7.2: exclusivamente efectivo en modo offline)
    batch.execute('''
      CREATE TABLE local_ventas (
        local_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        sucursal_id INTEGER NOT NULL,
        cliente_servidor_id INTEGER,
        cliente_nombre TEXT,
        metodo_pago TEXT NOT NULL CHECK (metodo_pago = 'efectivo'),
        total REAL NOT NULL,
        fecha_local TEXT NOT NULL,
        estado_sync TEXT NOT NULL DEFAULT 'PENDIENTE_SINCRONIZACION',
        servidor_venta_id INTEGER,
        numero_comprobante TEXT,
        motivo_error TEXT
      )
    ''');

    // 9. Detalle de ítems de ventas locales
    batch.execute('''
      CREATE TABLE local_venta_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_local_id TEXT NOT NULL REFERENCES local_ventas(local_id) ON DELETE CASCADE,
        variante_id INTEGER NOT NULL,
        sku TEXT NOT NULL,
        producto_nombre TEXT NOT NULL,
        talla TEXT NOT NULL,
        color TEXT NOT NULL,
        cantidad INTEGER NOT NULL CHECK (cantidad >= 1),
        precio_unitario REAL NOT NULL,
        subtotal REAL NOT NULL
      )
    ''');

    // 10. Reservas registradas en modo offline
    batch.execute('''
      CREATE TABLE local_reservas (
        local_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        sucursal_id INTEGER NOT NULL,
        cliente_servidor_id INTEGER,
        cliente_nombres TEXT NOT NULL,
        cliente_apellidos TEXT,
        cliente_email TEXT,
        cliente_telefono TEXT,
        fecha_reserva TEXT NOT NULL,
        horario_atencion TEXT NOT NULL,
        observaciones TEXT,
        fecha_local TEXT NOT NULL,
        estado_sync TEXT NOT NULL DEFAULT 'PENDIENTE_SINCRONIZACION',
        servidor_reserva_id INTEGER,
        codigo_reserva TEXT,
        motivo_error TEXT
      )
    ''');

    // 11. Detalle de ítems de reservas locales
    batch.execute('''
      CREATE TABLE local_reserva_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reserva_local_id TEXT NOT NULL REFERENCES local_reservas(local_id) ON DELETE CASCADE,
        variante_id INTEGER NOT NULL,
        sku TEXT NOT NULL,
        producto_nombre TEXT NOT NULL,
        talla TEXT NOT NULL,
        color TEXT NOT NULL,
        cantidad INTEGER NOT NULL CHECK (cantidad >= 1)
      )
    ''');

    // 12. Cola persistente FIFO de sincronización e historial local de conflictos
    batch.execute('''
      CREATE TABLE cola_sincronizacion (
        operation_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('VENTA', 'RESERVA')),
        entidad_local_id TEXT NOT NULL,
        sucursal_id INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE_SINCRONIZACION',
        intentos INTEGER NOT NULL DEFAULT 0,
        fecha_local TEXT NOT NULL,
        ultimo_intento TEXT,
        sincronizado_en TEXT,
        servidor_entidad_id INTEGER,
        referencia_servidor TEXT,
        motivo_conflicto TEXT,
        detalles_conflicto_json TEXT
      )
    ''');

    // Índices para consultas instantáneas en catálogo POS y cola de sincronización
    batch.execute('CREATE INDEX idx_var_tenant_sku ON local_variantes(tenant_id, sku)');
    batch.execute('CREATE INDEX idx_var_producto ON local_variantes(producto_id)');
    batch.execute('CREATE INDEX idx_inv_suc_var ON local_inventario(sucursal_id, variante_id)');
    batch.execute('CREATE INDEX idx_cola_tenant_estado ON cola_sincronizacion(tenant_id, estado, fecha_local)');
    batch.execute('CREATE INDEX idx_ventas_tenant_fecha ON local_ventas(tenant_id, fecha_local DESC)');
    batch.execute('CREATE INDEX idx_reservas_tenant_fecha ON local_reservas(tenant_id, fecha_local DESC)');

    await batch.commit(noResult: true);
  }

  /// Cierra la conexión actual (útil en pruebas unitarias o reinicios controlados).
  Future<void> close() async {
    if (_database != null && _database!.isOpen) {
      await _database!.close();
      _database = null;
    }
  }
}
