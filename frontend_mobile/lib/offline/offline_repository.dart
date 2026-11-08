import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import 'local_database.dart';
import 'offline_models.dart';

/// Repositorio Offline-First sobre SQLite (Desafío III - Secciones 6.1, 6.2, 6.4, 7.1 y 7.2).
/// Garantiza aislamiento multi-tenant local, integridad transaccional de stock
/// y persistencia duradera de la cola de sincronización.
class OfflineRepository {
  final LocalDatabase _localDb;
  static const Uuid _uuid = Uuid();

  OfflineRepository({LocalDatabase? localDb})
      : _localDb = localDb ?? LocalDatabase.instance;

  // ===========================================================================
  // 1. GESTIÓN DE SESIÓN Y AISLAMIENTO ESTRICTO MULTI-TENANT (SECCIÓN 6.1.3)
  // ===========================================================================

  Future<LocalSession?> obtenerSesionActiva() async {
    final db = await _localDb.database;
    final rows = await db.query('local_sesion', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    return LocalSession.fromMap(rows.first);
  }

  /// Guarda la sesión autenticada en SQLite.
  /// Si el dispositivo tenía datos de OTRO usuario o de OTRO tenant, limpia de forma
  /// atómica todas las tablas locales para impedir mezcla de datos empresariales (Sección 6.1.3).
  Future<bool> guardarSesionConAislamiento({
    required int usuarioId,
    required String email,
    required String nombreCompleto,
    required String rol,
    required String userType,
    required String tokenJwt,
    required String tenantId,
    required String tenantNombre,
    required String planNombre,
    int? sucursalAsignadaId,
  }) async {
    final db = await _localDb.database;
    bool sePurgaronDatosPrevios = false;

    await db.transaction((txn) async {
      final prevRows = await txn.query('local_sesion', where: 'id = 1', limit: 1);
      String? ultimaSyncPrevia;
      int? sucursalActivaPrevia;
      int umbralPrevio = 12;

      if (prevRows.isNotEmpty) {
        final prev = LocalSession.fromMap(prevRows.first);
        final cambioTenant = prev.tenantId != tenantId;
        final cambioUsuario = prev.usuarioId != usuarioId;

        if (cambioTenant || cambioUsuario) {
          await _purgarTodasLasTablasEnTransaccion(txn);
          sePurgaronDatosPrevios = true;
        } else {
          ultimaSyncPrevia = prevRows.first['ultima_sincronizacion'] as String?;
          sucursalActivaPrevia = prev.sucursalActivaId;
          umbralPrevio = prev.umbralHorasDesactualizado;
        }
      }

      await txn.insert(
        'local_sesion',
        {
          'id': 1,
          'usuario_id': usuarioId,
          'email': email,
          'nombre_completo': nombreCompleto,
          'rol': rol,
          'user_type': userType,
          'token_jwt': tokenJwt,
          'tenant_id': tenantId,
          'tenant_nombre': tenantNombre,
          'plan_nombre': planNombre,
          'sucursal_asignada_id': sucursalAsignadaId,
          'sucursal_activa_id': sucursalAsignadaId ?? sucursalActivaPrevia,
          'ultima_sincronizacion': ultimaSyncPrevia,
          'umbral_horas_desactualizado': umbralPrevio,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });

    return sePurgaronDatosPrevios;
  }

  /// Limpia únicamente el token de sesión o toda la base local según se requiera al cerrar sesión.
  /// Por defecto conserva operaciones pendientes del mismo tenant/usuario si existen, o limpia todo si [limpiarDatos] es true.
  Future<void> limpiarSesion({bool limpiarDatos = false}) async {
    final db = await _localDb.database;
    await db.transaction((txn) async {
      if (limpiarDatos) {
        await _purgarTodasLasTablasEnTransaccion(txn);
      } else {
        await txn.delete('local_sesion');
      }
    });
  }

  Future<void> _purgarTodasLasTablasEnTransaccion(Transaction txn) async {
    await txn.delete('cola_sincronizacion');
    await txn.delete('local_venta_detalles');
    await txn.delete('local_ventas');
    await txn.delete('local_reserva_detalles');
    await txn.delete('local_reservas');
    await txn.delete('local_inventario');
    await txn.delete('local_variantes');
    await txn.delete('local_productos');
    await txn.delete('local_categorias');
    await txn.delete('local_clientes');
    await txn.delete('local_sucursales');
    await txn.delete('local_sesion');
  }

  Future<void> cambiarSucursalActiva(int sucursalId) async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final sucRows = await db.query(
      'local_sucursales',
      where: 'id = ? AND tenant_id = ? AND activo = 1',
      whereArgs: [sucursalId, sesion.tenantId],
      limit: 1,
    );
    if (sucRows.isEmpty) {
      throw const OfflineDomainException(
        'La sucursal seleccionada no pertenece a la empresa activa o no está autorizada.',
      );
    }
    await db.update(
      'local_sesion',
      {'sucursal_activa_id': sucursalId},
      where: 'id = 1',
    );
  }

  Future<LocalSession> _requerirSesion() async {
    final sesion = await obtenerSesionActiva();
    if (sesion == null || sesion.tenantId.isEmpty) {
      throw const OfflineDomainException(
        'No existe una sesión empresarial activa en el dispositivo. Inicie sesión con conexión a internet primero.',
      );
    }
    return sesion;
  }

  // ===========================================================================
  // 2. ALMACENAMIENTO DEL PAQUETE OFFLINE DESCARGADO (SECCIÓN 6.1.1)
  // ===========================================================================

  /// Almacena de forma atómica el paquete recibido desde GET /api/v1/sync/paquete-offline
  /// preservando cualquier compromiso local de operaciones aún pendientes en la cola.
  Future<void> guardarPaqueteOffline(Map<String, dynamic> paquete) async {
    final sesion = await _requerirSesion();
    final paqueteTenantId = (paquete['tenant_id'] as String?) ?? '';
    if (paqueteTenantId.isEmpty || paqueteTenantId != sesion.tenantId) {
      throw const OfflineDomainException(
        'El paquete descargado no corresponde al tenant de la sesión activa (aislamiento multi-tenant).',
      );
    }

    final sucursales = (paquete['sucursales'] as List<dynamic>? ?? []);
    final categorias = (paquete['categorias'] as List<dynamic>? ?? []);
    final productos = (paquete['productos'] as List<dynamic>? ?? []);
    final variantes = (paquete['variantes'] as List<dynamic>? ?? []);
    final inventario = (paquete['inventario'] as List<dynamic>? ?? []);
    final clientes = (paquete['clientes'] as List<dynamic>? ?? []);
    final descargadoEn = (paquete['descargado_en'] as String?) ??
        DateTime.now().toUtc().toIso8601String();
    final umbralHoras =
        (paquete['umbral_horas_desactualizado'] as num?)?.toInt() ?? 12;
    final sucAsignada = (paquete['sucursal_asignada_id'] as num?)?.toInt();

    final db = await _localDb.database;
    await db.transaction((txn) async {
      // 1. Calcular compromisos locales aún pendientes de sincronización
      final ventasPendRows = await txn.rawQuery('''
        SELECT v.sucursal_id, d.variante_id, SUM(d.cantidad) AS total_cant
        FROM local_ventas v
        INNER JOIN local_venta_detalles d ON d.venta_local_id = v.local_id
        WHERE v.tenant_id = ? AND v.estado_sync IN (?, ?)
        GROUP BY v.sucursal_id, d.variante_id
      ''', [
        sesion.tenantId,
        OfflineSyncStatus.pendiente,
        OfflineSyncStatus.sincronizando,
      ]);

      final reservasPendRows = await txn.rawQuery('''
        SELECT r.sucursal_id, d.variante_id, SUM(d.cantidad) AS total_cant
        FROM local_reservas r
        INNER JOIN local_reserva_detalles d ON d.reserva_local_id = r.local_id
        WHERE r.tenant_id = ? AND r.estado_sync IN (?, ?)
        GROUP BY r.sucursal_id, d.variante_id
      ''', [
        sesion.tenantId,
        OfflineSyncStatus.pendiente,
        OfflineSyncStatus.sincronizando,
      ]);

      final Map<String, int> mapaVentasComprometidas = {};
      for (final row in ventasPendRows) {
        final key = '${row['sucursal_id']}_${row['variante_id']}';
        mapaVentasComprometidas[key] = (row['total_cant'] as num?)?.toInt() ?? 0;
      }

      final Map<String, int> mapaReservasComprometidas = {};
      for (final row in reservasPendRows) {
        final key = '${row['sucursal_id']}_${row['variante_id']}';
        mapaReservasComprometidas[key] = (row['total_cant'] as num?)?.toInt() ?? 0;
      }

      // 2. Reemplazar catálogo e inventario base del tenant
      await txn.delete('local_inventario', where: 'tenant_id = ?', whereArgs: [sesion.tenantId]);
      await txn.delete('local_variantes', where: 'tenant_id = ?', whereArgs: [sesion.tenantId]);
      await txn.delete('local_productos', where: 'tenant_id = ?', whereArgs: [sesion.tenantId]);
      await txn.delete('local_categorias', where: 'tenant_id = ?', whereArgs: [sesion.tenantId]);
      await txn.delete('local_sucursales', where: 'tenant_id = ?', whereArgs: [sesion.tenantId]);
      await txn.delete(
        'local_clientes',
        where: 'tenant_id = ? AND es_creado_offline = 0',
        whereArgs: [sesion.tenantId],
      );

      for (final s in sucursales) {
        final m = s as Map<String, dynamic>;
        await txn.insert(
          'local_sucursales',
          {
            'id': (m['id'] as num).toInt(),
            'tenant_id': sesion.tenantId,
            'nombre': m['nombre'] ?? '',
            'ciudad': m['ciudad'],
            'direccion': m['direccion'] ?? '',
            'telefono': m['telefono'],
            'activo': (m['activo'] == false) ? 0 : 1,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      for (final c in categorias) {
        final m = c as Map<String, dynamic>;
        await txn.insert(
          'local_categorias',
          {
            'id': (m['id'] as num).toInt(),
            'tenant_id': sesion.tenantId,
            'nombre': m['nombre'] ?? '',
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      for (final pItem in productos) {
        final m = pItem as Map<String, dynamic>;
        await txn.insert(
          'local_productos',
          {
            'id': (m['id'] as num).toInt(),
            'tenant_id': sesion.tenantId,
            'nombre': m['nombre'] ?? '',
            'descripcion': m['descripcion'],
            'categoria_id': (m['categoria_id'] as num?)?.toInt(),
            'categoria_nombre': m['categoria_nombre'],
            'precio_base': (m['precio_base'] as num?)?.toDouble() ?? 0.0,
            'imagen_url': m['imagen_url'],
            'genero': m['genero'] ?? 'Unisex',
            'activo': (m['activo'] == false) ? 0 : 1,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      for (final vItem in variantes) {
        final m = vItem as Map<String, dynamic>;
        await txn.insert(
          'local_variantes',
          {
            'id': (m['id'] as num).toInt(),
            'tenant_id': sesion.tenantId,
            'producto_id': (m['producto_id'] as num).toInt(),
            'producto_nombre': m['producto_nombre'] ?? '',
            'sku': m['sku'] ?? '',
            'talla_id': (m['talla_id'] as num?)?.toInt() ?? 0,
            'talla': m['talla'] ?? 'U',
            'color_id': (m['color_id'] as num?)?.toInt() ?? 0,
            'color': m['color'] ?? 'Único',
            'codigo_hex': m['codigo_hex'] ?? '#333333',
            'precio_base': (m['precio_base'] as num?)?.toDouble() ?? 0.0,
            'precio_adicional': (m['precio_adicional'] as num?)?.toDouble() ?? 0.0,
            'precio_vigente': (m['precio_vigente'] as num?)?.toDouble() ?? 0.0,
            'imagen_url': m['imagen_url'],
            'activo': (m['activo'] == false) ? 0 : 1,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      for (final invItem in inventario) {
        final m = invItem as Map<String, dynamic>;
        final sucId = (m['sucursal_id'] as num).toInt();
        final varId = (m['variante_id'] as num).toInt();
        final key = '${sucId}_$varId';

        await txn.insert(
          'local_inventario',
          {
            'servidor_inv_id': (m['id'] as num?)?.toInt(),
            'tenant_id': sesion.tenantId,
            'sucursal_id': sucId,
            'variante_id': varId,
            'cantidad_disponible_servidor':
                (m['cantidad_disponible'] as num?)?.toInt() ?? 0,
            'cantidad_reservada_servidor':
                (m['cantidad_reservada'] as num?)?.toInt() ?? 0,
            'comprometido_local_ventas': mapaVentasComprometidas[key] ?? 0,
            'comprometido_local_reservas': mapaReservasComprometidas[key] ?? 0,
            'stock_minimo': (m['stock_minimo'] as num?)?.toInt() ?? 5,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      for (final cliItem in clientes) {
        final m = cliItem as Map<String, dynamic>;
        await txn.insert(
          'local_clientes',
          {
            'servidor_id': (m['id'] as num).toInt(),
            'tenant_id': sesion.tenantId,
            'nombres': m['nombres'] ?? '',
            'apellidos': m['apellidos'] ?? '',
            'email': m['email'],
            'telefono': m['telefono'],
            'es_creado_offline': 0,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      // Determinar sucursal activa por defecto si aún no estaba fijada o ya no existe
      final idsSucursales = sucursales
          .map((e) => ((e as Map<String, dynamic>)['id'] as num).toInt())
          .toList();
      int? nuevaSucActiva = sesion.sucursalActivaId;
      if (nuevaSucActiva == null || !idsSucursales.contains(nuevaSucActiva)) {
        if (sucAsignada != null && idsSucursales.contains(sucAsignada)) {
          nuevaSucActiva = sucAsignada;
        } else if (idsSucursales.isNotEmpty) {
          nuevaSucActiva = idsSucursales.first;
        }
      }

      await txn.update(
        'local_sesion',
        {
          'sucursal_asignada_id': sucAsignada ?? sesion.sucursalAsignadaId,
          'sucursal_activa_id': nuevaSucActiva,
          'ultima_sincronizacion': descargadoEn,
          'umbral_horas_desactualizado': umbralHoras,
        },
        where: 'id = 1',
      );
    });
  }

  // ===========================================================================
  // 3. CONSULTAS DE CATÁLOGO, STOCK Y CLIENTES DESDE SQLITE (SECCIÓN 6.2)
  // ===========================================================================

  Future<List<OfflineBranch>> obtenerSucursalesLocales() async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final rows = await db.query(
      'local_sucursales',
      where: 'tenant_id = ? AND activo = 1',
      whereArgs: [sesion.tenantId],
      orderBy: 'id ASC',
    );
    return rows.map(OfflineBranch.fromMap).toList();
  }

  Future<List<OfflineCategory>> obtenerCategoriasLocales() async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final rows = await db.query(
      'local_categorias',
      where: 'tenant_id = ?',
      whereArgs: [sesion.tenantId],
      orderBy: 'nombre ASC',
    );
    return rows.map(OfflineCategory.fromMap).toList();
  }

  Future<List<OfflineCustomer>> buscarClientesLocales({String? busqueda}) async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    if (busqueda != null && busqueda.trim().isNotEmpty) {
      final like = '%${busqueda.trim()}%';
      final rows = await db.query(
        'local_clientes',
        where:
            'tenant_id = ? AND (nombres LIKE ? OR apellidos LIKE ? OR email LIKE ? OR telefono LIKE ?)',
        whereArgs: [sesion.tenantId, like, like, like, like],
        orderBy: 'nombres ASC, apellidos ASC',
      );
      return rows.map(OfflineCustomer.fromMap).toList();
    }
    final rows = await db.query(
      'local_clientes',
      where: 'tenant_id = ?',
      whereArgs: [sesion.tenantId],
      orderBy: 'nombres ASC, apellidos ASC',
    );
    return rows.map(OfflineCustomer.fromMap).toList();
  }

  /// Consulta instantánea sobre SQLite filtrando por nombre, categoría, talla, color o SKU.
  Future<List<OfflineVariantStock>> consultarCatalogoConStockLocal({
    int? sucursalId,
    int? categoriaId,
    String? busqueda,
    String? talla,
    String? color,
    bool soloConStock = false,
  }) async {
    final sesion = await _requerirSesion();
    final targetSucursalId = sucursalId ?? sesion.sucursalActivaId;
    if (targetSucursalId == null) return [];

    final db = await _localDb.database;
    final whereClauses = <String>[
      'v.tenant_id = ?',
      'v.activo = 1',
      'p.activo = 1',
    ];
    final args = <Object?>[targetSucursalId, sesion.tenantId];

    if (categoriaId != null) {
      whereClauses.add('p.categoria_id = ?');
      args.add(categoriaId);
    }
    if (talla != null && talla.trim().isNotEmpty) {
      whereClauses.add('LOWER(v.talla) = LOWER(?)');
      args.add(talla.trim());
    }
    if (color != null && color.trim().isNotEmpty) {
      whereClauses.add('LOWER(v.color) = LOWER(?)');
      args.add(color.trim());
    }
    if (busqueda != null && busqueda.trim().isNotEmpty) {
      final q = '%${busqueda.trim()}%';
      whereClauses.add(
        '(p.nombre LIKE ? OR v.sku LIKE ? OR v.color LIKE ? OR v.talla LIKE ? OR p.categoria_nombre LIKE ?)',
      );
      args.addAll([q, q, q, q, q]);
    }

    final sql = '''
      SELECT
        v.id AS variante_id,
        v.producto_id,
        v.tenant_id,
        p.nombre AS producto_nombre,
        p.descripcion,
        p.categoria_id,
        p.categoria_nombre,
        v.sku,
        v.talla,
        v.color,
        v.codigo_hex,
        v.precio_base,
        v.precio_adicional,
        v.precio_vigente,
        COALESCE(v.imagen_url, p.imagen_url) AS imagen_url,
        ? AS sucursal_id_param,
        COALESCE(i.sucursal_id, $targetSucursalId) AS sucursal_id,
        COALESCE(i.cantidad_disponible_servidor, 0) AS cantidad_disponible_servidor,
        COALESCE(i.cantidad_reservada_servidor, 0) AS cantidad_reservada_servidor,
        COALESCE(i.comprometido_local_ventas, 0) AS comprometido_local_ventas,
        COALESCE(i.comprometido_local_reservas, 0) AS comprometido_local_reservas,
        COALESCE(i.stock_minimo, 5) AS stock_minimo
      FROM local_variantes v
      INNER JOIN local_productos p ON p.id = v.producto_id
      LEFT JOIN local_inventario i
        ON i.variante_id = v.id AND i.sucursal_id = ?
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY p.nombre ASC, v.talla ASC, v.color ASC
    ''';

    // Ajustar parámetros posicionales para los dos '?' del SELECT / LEFT JOIN + whereArgs
    final fullArgs = <Object?>[targetSucursalId, targetSucursalId, ...args.sublist(1)];
    final rows = await db.rawQuery(sql, fullArgs);
    final items = rows.map(OfflineVariantStock.fromJoinedRow).toList();

    if (soloConStock) {
      return items.where((item) => item.stockLibreEfectivo > 0).toList();
    }
    return items;
  }

  // ===========================================================================
  // 4. REGISTRO TRANSACCIONAL DE VENTA OFFLINE DE CONTADO (SECCIONES 6.2 Y 7.2)
  // ===========================================================================

  Future<LocalSaleRecord> registrarVentaOfflineContado({
    int? sucursalId,
    required List<OfflineDraftItem> items,
    String metodoPago = 'efectivo',
    int? clienteServidorId,
    String? clienteNombre,
    DateTime? fechaLocalOverride,
  }) async {
    if (items.isEmpty) {
      throw const OfflineDomainException('Debe agregar al menos una prenda a la venta.');
    }
    if (metodoPago.trim().toLowerCase() != 'efectivo') {
      throw const OfflineDomainException(
        'En modo sin conexión solo se permiten ventas presenciales al contado en efectivo (Regla 7.2).',
      );
    }

    final sesion = await _requerirSesion();
    final sucId = sucursalId ?? sesion.sucursalActivaId;
    if (sucId == null) {
      throw const OfflineDomainException('Debe seleccionar una sucursal autorizada.');
    }

    final fechaLocal = (fechaLocalOverride ?? DateTime.now()).toUtc();
    final localId = _uuid.v4();
    final operationId = _uuid.v4();

    final db = await _localDb.database;
    late LocalSaleRecord ventaCreada;

    await db.transaction((txn) async {
      await _verificarSucursalAutorizadaEnTxn(txn, sesion.tenantId, sucId);

      // Agrupar cantidades por variante para impedir exceder el stock local en líneas repetidas
      final Map<int, int> cantPorVariante = {};
      for (final item in items) {
        if (item.cantidad < 1) {
          throw const OfflineDomainException('La cantidad de cada prenda debe ser al menos 1.');
        }
        cantPorVariante[item.varianteId] =
            (cantPorVariante[item.varianteId] ?? 0) + item.cantidad;
      }

      final Map<int, Map<String, Object?>> infoVariantes = {};
      for (final entry in cantPorVariante.entries) {
        final varRow = await _validarStockLocalEnTxn(
          txn: txn,
          tenantId: sesion.tenantId,
          sucursalId: sucId,
          varianteId: entry.key,
          cantidadSolicitada: entry.value,
        );
        infoVariantes[entry.key] = varRow;
      }

      double totalCalculado = 0.0;
      final List<Map<String, dynamic>> payloadItems = [];

      // Insertar cabecera primero para satisfacer llave foránea de detalles
      await txn.insert('local_ventas', {
        'local_id': localId,
        'operation_id': operationId,
        'tenant_id': sesion.tenantId,
        'usuario_id': sesion.usuarioId,
        'sucursal_id': sucId,
        'cliente_servidor_id': clienteServidorId,
        'cliente_nombre': clienteNombre ?? 'Cliente en Tienda (Efectivo)',
        'metodo_pago': 'efectivo',
        'total': 0.0,
        'fecha_local': fechaLocal.toIso8601String(),
        'estado_sync': OfflineSyncStatus.pendiente,
      });

      for (final item in items) {
        final vInfo = infoVariantes[item.varianteId]!;
        final precioUnit = item.precioUnitario ??
            ((vInfo['precio_vigente'] as num?)?.toDouble() ?? 0.0);
        if (precioUnit <= 0) {
          throw OfflineDomainException(
            'Precio inválido para SKU ${vInfo['sku']}.',
          );
        }
        final subtotal = double.parse((precioUnit * item.cantidad).toStringAsFixed(2));
        totalCalculado = double.parse((totalCalculado + subtotal).toStringAsFixed(2));

        await txn.insert('local_venta_detalles', {
          'venta_local_id': localId,
          'variante_id': item.varianteId,
          'sku': vInfo['sku'],
          'producto_nombre': vInfo['producto_nombre'],
          'talla': vInfo['talla'],
          'color': vInfo['color'],
          'cantidad': item.cantidad,
          'precio_unitario': precioUnit,
          'subtotal': subtotal,
        });

        payloadItems.add({
          'variante_id': item.varianteId,
          'cantidad': item.cantidad,
          'precio_unitario': precioUnit,
        });
      }

      await txn.update(
        'local_ventas',
        {'total': totalCalculado},
        where: 'local_id = ?',
        whereArgs: [localId],
      );

      // Comprometer stock local inmediatamente (Sección 7.1)
      for (final entry in cantPorVariante.entries) {
        await txn.rawUpdate('''
          UPDATE local_inventario
          SET comprometido_local_ventas = comprometido_local_ventas + ?
          WHERE tenant_id = ? AND sucursal_id = ? AND variante_id = ?
        ''', [entry.value, sesion.tenantId, sucId, entry.key]);
      }

      // Encolar operación idempotente lista para POST /api/v1/sync/lote
      final payloadSync = <String, dynamic>{
        'operation_id': operationId,
        'tipo': 'VENTA',
        'client_local_id': localId,
        'sucursal_id': sucId,
        if (clienteServidorId != null) 'cliente_id': clienteServidorId,
        'metodo_pago': 'efectivo',
        'fecha_local': fechaLocal.toIso8601String(),
        'total_local': totalCalculado,
        'items': payloadItems,
      };

      await txn.insert('cola_sincronizacion', {
        'operation_id': operationId,
        'tenant_id': sesion.tenantId,
        'usuario_id': sesion.usuarioId,
        'tipo': 'VENTA',
        'entidad_local_id': localId,
        'sucursal_id': sucId,
        'payload_json': jsonEncode(payloadSync),
        'estado': OfflineSyncStatus.pendiente,
        'intentos': 0,
        'fecha_local': fechaLocal.toIso8601String(),
      });

      final savedRows = await txn.query(
        'local_ventas',
        where: 'local_id = ?',
        whereArgs: [localId],
        limit: 1,
      );
      ventaCreada = LocalSaleRecord.fromMap(savedRows.first);
    });

    return ventaCreada;
  }

  // ===========================================================================
  // 5. REGISTRO TRANSACCIONAL DE RESERVA OFFLINE (SECCIONES 6.2 Y 7.1)
  // ===========================================================================

  Future<LocalReservationRecord> registrarReservaOffline({
    int? sucursalId,
    required List<OfflineDraftItem> items,
    int? clienteServidorId,
    String? clienteNombres,
    String? clienteApellidos,
    String? clienteEmail,
    String? clienteTelefono,
    required String fechaReserva,
    required String horarioAtencion,
    String? observaciones,
    DateTime? fechaLocalOverride,
  }) async {
    if (items.isEmpty) {
      throw const OfflineDomainException('Debe incluir al menos una prenda en la reserva.');
    }

    final sesion = await _requerirSesion();
    final sucId = sucursalId ?? sesion.sucursalActivaId;
    if (sucId == null) {
      throw const OfflineDomainException('Debe seleccionar una sucursal autorizada.');
    }

    final fechaLocal = (fechaLocalOverride ?? DateTime.now()).toUtc();
    final localId = _uuid.v4();
    final operationId = _uuid.v4();

    final db = await _localDb.database;
    late LocalReservationRecord reservaCreada;

    await db.transaction((txn) async {
      await _verificarSucursalAutorizadaEnTxn(txn, sesion.tenantId, sucId);

      // Resolver datos del cliente (existente en caché o nuevo cliente offline)
      String nombresFinal = (clienteNombres ?? '').trim();
      String apellidosFinal = (clienteApellidos ?? '').trim();
      String? emailFinal = clienteEmail?.trim();
      String? telefonoFinal = clienteTelefono?.trim();

      if (clienteServidorId != null) {
        final cliRows = await txn.query(
          'local_clientes',
          where: 'servidor_id = ? AND tenant_id = ?',
          whereArgs: [clienteServidorId, sesion.tenantId],
          limit: 1,
        );
        if (cliRows.isEmpty) {
          throw const OfflineDomainException(
            'El cliente seleccionado no pertenece al catálogo local de esta empresa.',
          );
        }
        final c = OfflineCustomer.fromMap(cliRows.first);
        nombresFinal = c.nombres;
        apellidosFinal = c.apellidos;
        emailFinal = c.email;
        telefonoFinal = c.telefono;
      } else {
        if (nombresFinal.isEmpty) {
          throw const OfflineDomainException(
            'Para registrar una reserva offline debe seleccionar un cliente o ingresar su nombre.',
          );
        }
        await txn.insert('local_clientes', {
          'servidor_id': null,
          'tenant_id': sesion.tenantId,
          'nombres': nombresFinal,
          'apellidos': apellidosFinal.isEmpty ? 'Cliente Tienda' : apellidosFinal,
          'email': (emailFinal != null && emailFinal.isNotEmpty) ? emailFinal : null,
          'telefono': (telefonoFinal != null && telefonoFinal.isNotEmpty) ? telefonoFinal : null,
          'es_creado_offline': 1,
        });
      }

      final Map<int, int> cantPorVariante = {};
      for (final item in items) {
        if (item.cantidad < 1) {
          throw const OfflineDomainException('La cantidad reservada debe ser al menos 1.');
        }
        cantPorVariante[item.varianteId] =
            (cantPorVariante[item.varianteId] ?? 0) + item.cantidad;
      }

      final Map<int, Map<String, Object?>> infoVariantes = {};
      for (final entry in cantPorVariante.entries) {
        final varRow = await _validarStockLocalEnTxn(
          txn: txn,
          tenantId: sesion.tenantId,
          sucursalId: sucId,
          varianteId: entry.key,
          cantidadSolicitada: entry.value,
        );
        infoVariantes[entry.key] = varRow;
      }

      await txn.insert('local_reservas', {
        'local_id': localId,
        'operation_id': operationId,
        'tenant_id': sesion.tenantId,
        'usuario_id': sesion.usuarioId,
        'sucursal_id': sucId,
        'cliente_servidor_id': clienteServidorId,
        'cliente_nombres': nombresFinal,
        'cliente_apellidos': apellidosFinal,
        'cliente_email': emailFinal,
        'cliente_telefono': telefonoFinal,
        'fecha_reserva': fechaReserva,
        'horario_atencion': horarioAtencion,
        'observaciones': observaciones,
        'fecha_local': fechaLocal.toIso8601String(),
        'estado_sync': OfflineSyncStatus.pendiente,
      });

      final List<Map<String, dynamic>> payloadItems = [];
      for (final item in items) {
        final vInfo = infoVariantes[item.varianteId]!;
        await txn.insert('local_reserva_detalles', {
          'reserva_local_id': localId,
          'variante_id': item.varianteId,
          'sku': vInfo['sku'],
          'producto_nombre': vInfo['producto_nombre'],
          'talla': vInfo['talla'],
          'color': vInfo['color'],
          'cantidad': item.cantidad,
        });
        payloadItems.add({
          'variante_id': item.varianteId,
          'cantidad': item.cantidad,
        });
      }

      for (final entry in cantPorVariante.entries) {
        await txn.rawUpdate('''
          UPDATE local_inventario
          SET comprometido_local_reservas = comprometido_local_reservas + ?
          WHERE tenant_id = ? AND sucursal_id = ? AND variante_id = ?
        ''', [entry.value, sesion.tenantId, sucId, entry.key]);
      }

      final payloadSync = <String, dynamic>{
        'operation_id': operationId,
        'tipo': 'RESERVA',
        'client_local_id': localId,
        'sucursal_id': sucId,
        if (clienteServidorId != null)
          'cliente_id': clienteServidorId
        else
          'cliente_offline': {
            'nombres': nombresFinal,
            'apellidos': apellidosFinal,
            if (emailFinal != null && emailFinal.isNotEmpty) 'email': emailFinal,
            if (telefonoFinal != null && telefonoFinal.isNotEmpty) 'telefono': telefonoFinal,
          },
        'fecha_local': fechaLocal.toIso8601String(),
        'fecha_reserva': fechaReserva,
        'horario_atencion': horarioAtencion,
        if (observaciones != null && observaciones.isNotEmpty)
          'observaciones': observaciones,
        'items': payloadItems,
      };

      await txn.insert('cola_sincronizacion', {
        'operation_id': operationId,
        'tenant_id': sesion.tenantId,
        'usuario_id': sesion.usuarioId,
        'tipo': 'RESERVA',
        'entidad_local_id': localId,
        'sucursal_id': sucId,
        'payload_json': jsonEncode(payloadSync),
        'estado': OfflineSyncStatus.pendiente,
        'intentos': 0,
        'fecha_local': fechaLocal.toIso8601String(),
      });

      final savedRows = await txn.query(
        'local_reservas',
        where: 'local_id = ?',
        whereArgs: [localId],
        limit: 1,
      );
      reservaCreada = LocalReservationRecord.fromMap(savedRows.first);
    });

    return reservaCreada;
  }

  Future<void> _verificarSucursalAutorizadaEnTxn(
    Transaction txn,
    String tenantId,
    int sucursalId,
  ) async {
    final rows = await txn.query(
      'local_sucursales',
      where: 'id = ? AND tenant_id = ? AND activo = 1',
      whereArgs: [sucursalId, tenantId],
      limit: 1,
    );
    if (rows.isEmpty) {
      throw const OfflineDomainException(
        'La sucursal indicada no pertenece a la empresa activa o no está autorizada.',
      );
    }
  }

  Future<Map<String, Object?>> _validarStockLocalEnTxn({
    required Transaction txn,
    required String tenantId,
    required int sucursalId,
    required int varianteId,
    required int cantidadSolicitada,
  }) async {
    final rows = await txn.rawQuery('''
      SELECT
        v.id AS variante_id,
        v.sku,
        v.producto_nombre,
        v.talla,
        v.color,
        v.precio_vigente,
        i.cantidad_disponible_servidor,
        i.cantidad_reservada_servidor,
        i.comprometido_local_ventas,
        i.comprometido_local_reservas
      FROM local_variantes v
      LEFT JOIN local_inventario i
        ON i.variante_id = v.id AND i.sucursal_id = ?
      WHERE v.id = ? AND v.tenant_id = ? AND v.activo = 1
      LIMIT 1
    ''', [sucursalId, varianteId, tenantId]);

    if (rows.isEmpty) {
      throw OfflineDomainException(
        'La variante #$varianteId no existe en el catálogo local de esta empresa.',
      );
    }

    final r = rows.first;
    final disp = (r['cantidad_disponible_servidor'] as num?)?.toInt() ?? 0;
    final res = (r['cantidad_reservada_servidor'] as num?)?.toInt() ?? 0;
    final compV = (r['comprometido_local_ventas'] as num?)?.toInt() ?? 0;
    final compR = (r['comprometido_local_reservas'] as num?)?.toInt() ?? 0;
    final libreEfectivo = disp - res - compV - compR;

    if (libreEfectivo < cantidadSolicitada) {
      final libreMostrado = libreEfectivo < 0 ? 0 : libreEfectivo;
      throw OfflineDomainException(
        'Stock local insuficiente para ${r['producto_nombre']} (${r['talla']} / ${r['color']} - SKU ${r['sku']}): '
        'disponible $libreMostrado, solicitado $cantidadSolicitada.',
      );
    }

    return r;
  }

  // ===========================================================================
  // 6. GESTIÓN DE COLA PERSISTENTE Y CONCILIACIÓN DE RESULTADOS (SECCIÓN 6.4)
  // ===========================================================================

  /// Obtiene las operaciones pendientes en estricto orden cronológico (FIFO).
  Future<List<SyncQueueItem>> obtenerColaPendienteOrdenada() async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final rows = await db.query(
      'cola_sincronizacion',
      where: 'tenant_id = ? AND estado = ?',
      whereArgs: [sesion.tenantId, OfflineSyncStatus.pendiente],
      orderBy: 'fecha_local ASC',
    );
    return rows.map(SyncQueueItem.fromMap).toList();
  }

  Future<List<SyncQueueItem>> obtenerHistorialColaLocal({String? estado}) async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final where = estado != null
        ? 'tenant_id = ? AND estado = ?'
        : 'tenant_id = ?';
    final args = estado != null
        ? <Object?>[sesion.tenantId, estado]
        : <Object?>[sesion.tenantId];

    final rows = await db.query(
      'cola_sincronizacion',
      where: where,
      whereArgs: args,
      orderBy: 'fecha_local DESC',
    );
    return rows.map(SyncQueueItem.fromMap).toList();
  }

  Future<Map<String, int>> obtenerContadoresCola() async {
    final sesion = await obtenerSesionActiva();
    if (sesion == null) {
      return {
        OfflineSyncStatus.pendiente: 0,
        OfflineSyncStatus.sincronizada: 0,
        OfflineSyncStatus.enConflicto: 0,
        OfflineSyncStatus.rechazada: 0,
      };
    }
    final db = await _localDb.database;
    final rows = await db.rawQuery('''
      SELECT estado, COUNT(*) AS total
      FROM cola_sincronizacion
      WHERE tenant_id = ?
      GROUP BY estado
    ''', [sesion.tenantId]);

    final mapa = <String, int>{
      OfflineSyncStatus.pendiente: 0,
      OfflineSyncStatus.sincronizada: 0,
      OfflineSyncStatus.enConflicto: 0,
      OfflineSyncStatus.rechazada: 0,
    };
    for (final r in rows) {
      final est = r['estado'] as String;
      mapa[est] = (r['total'] as num).toInt();
    }
    return mapa;
  }

  Future<List<LocalSaleRecord>> listarVentasLocales() async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final rows = await db.query(
      'local_ventas',
      where: 'tenant_id = ?',
      whereArgs: [sesion.tenantId],
      orderBy: 'fecha_local DESC',
    );
    return rows.map(LocalSaleRecord.fromMap).toList();
  }

  Future<List<LocalReservationRecord>> listarReservasLocales() async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    final rows = await db.query(
      'local_reservas',
      where: 'tenant_id = ?',
      whereArgs: [sesion.tenantId],
      orderBy: 'fecha_local DESC',
    );
    return rows.map(LocalReservationRecord.fromMap).toList();
  }

  /// Aplica de forma atómica los resultados devueltos por POST /api/v1/sync/lote,
  /// actualizando estados locales, comprobantes/códigos y liberando/consolidando stock local.
  Future<void> aplicarResultadosSincronizacionLote(
    List<dynamic> resultadosServidor,
  ) async {
    final sesion = await _requerirSesion();
    final ahoraIso = DateTime.now().toUtc().toIso8601String();
    final db = await _localDb.database;

    await db.transaction((txn) async {
      for (final raw in resultadosServidor) {
        final res = raw as Map<String, dynamic>;
        final opId = res['operation_id'] as String;
        final estadoServidor = res['estado'] as String; // CONFIRMADA | EN_CONFLICTO | RECHAZADA

        final colaRows = await txn.query(
          'cola_sincronizacion',
          where: 'operation_id = ? AND tenant_id = ?',
          whereArgs: [opId, sesion.tenantId],
          limit: 1,
        );
        if (colaRows.isEmpty) continue;

        final colaItem = SyncQueueItem.fromMap(colaRows.first);
        // Si ya había sido procesada localmente antes, evitamos aplicar ajustes dobles
        if (colaItem.estado == OfflineSyncStatus.sincronizada ||
            colaItem.estado == OfflineSyncStatus.enConflicto ||
            colaItem.estado == OfflineSyncStatus.rechazada) {
          continue;
        }

        final itemsPayload =
            (colaItem.payload['items'] as List<dynamic>? ?? []);
        final Map<int, int> cantPorVariante = {};
        for (final it in itemsPayload) {
          final m = it as Map<String, dynamic>;
          final vid = (m['variante_id'] as num).toInt();
          final cant = (m['cantidad'] as num).toInt();
          cantPorVariante[vid] = (cantPorVariante[vid] ?? 0) + cant;
        }

        if (estadoServidor == 'CONFIRMADA') {
          final entidadServidorId = (res['entidad_id'] as num?)?.toInt();
          final numComprobante = res['numero_comprobante'] as String?;
          final codReserva = res['codigo_reserva'] as String?;
          final refTexto = numComprobante ?? codReserva;

          await txn.update(
            'cola_sincronizacion',
            {
              'estado': OfflineSyncStatus.sincronizada,
              'intentos': colaItem.intentos + 1,
              'ultimo_intento': ahoraIso,
              'sincronizado_en': ahoraIso,
              'servidor_entidad_id': entidadServidorId,
              'referencia_servidor': refTexto,
              'motivo_conflicto': null,
            },
            where: 'operation_id = ?',
            whereArgs: [opId],
          );

          if (colaItem.tipo == 'VENTA') {
            await txn.update(
              'local_ventas',
              {
                'estado_sync': OfflineSyncStatus.sincronizada,
                'servidor_venta_id': entidadServidorId,
                'numero_comprobante': numComprobante,
                'motivo_error': null,
              },
              where: 'local_id = ?',
              whereArgs: [colaItem.entidadLocalId],
            );

            for (final entry in cantPorVariante.entries) {
              await txn.rawUpdate('''
                UPDATE local_inventario
                SET cantidad_disponible_servidor = MAX(0, cantidad_disponible_servidor - ?),
                    comprometido_local_ventas = MAX(0, comprometido_local_ventas - ?)
                WHERE tenant_id = ? AND sucursal_id = ? AND variante_id = ?
              ''', [
                entry.value,
                entry.value,
                sesion.tenantId,
                colaItem.sucursalId,
                entry.key,
              ]);
            }
          } else {
            await txn.update(
              'local_reservas',
              {
                'estado_sync': OfflineSyncStatus.sincronizada,
                'servidor_reserva_id': entidadServidorId,
                'codigo_reserva': codReserva,
                'motivo_error': null,
              },
              where: 'local_id = ?',
              whereArgs: [colaItem.entidadLocalId],
            );

            for (final entry in cantPorVariante.entries) {
              await txn.rawUpdate('''
                UPDATE local_inventario
                SET cantidad_reservada_servidor = cantidad_reservada_servidor + ?,
                    comprometido_local_reservas = MAX(0, comprometido_local_reservas - ?)
                WHERE tenant_id = ? AND sucursal_id = ? AND variante_id = ?
              ''', [
                entry.value,
                entry.value,
                sesion.tenantId,
                colaItem.sucursalId,
                entry.key,
              ]);
            }
          }
        } else {
          // EN_CONFLICTO o RECHAZADA: liberar el stock local comprometido y registrar el motivo
          final estadoLocal = estadoServidor == 'EN_CONFLICTO'
              ? OfflineSyncStatus.enConflicto
              : OfflineSyncStatus.rechazada;
          final motivo = (res['motivo'] as String?) ??
              'Operación observada por el servidor durante la sincronización.';
          final detalles = res['detalles_conflicto'];

          await txn.update(
            'cola_sincronizacion',
            {
              'estado': estadoLocal,
              'intentos': colaItem.intentos + 1,
              'ultimo_intento': ahoraIso,
              'motivo_conflicto': motivo,
              'detalles_conflicto_json':
                  detalles != null ? jsonEncode(detalles) : null,
            },
            where: 'operation_id = ?',
            whereArgs: [opId],
          );

          if (colaItem.tipo == 'VENTA') {
            await txn.update(
              'local_ventas',
              {
                'estado_sync': estadoLocal,
                'motivo_error': motivo,
              },
              where: 'local_id = ?',
              whereArgs: [colaItem.entidadLocalId],
            );

            for (final entry in cantPorVariante.entries) {
              await txn.rawUpdate('''
                UPDATE local_inventario
                SET comprometido_local_ventas = MAX(0, comprometido_local_ventas - ?)
                WHERE tenant_id = ? AND sucursal_id = ? AND variante_id = ?
              ''', [
                entry.value,
                sesion.tenantId,
                colaItem.sucursalId,
                entry.key,
              ]);
            }
          } else {
            await txn.update(
              'local_reservas',
              {
                'estado_sync': estadoLocal,
                'motivo_error': motivo,
              },
              where: 'local_id = ?',
              whereArgs: [colaItem.entidadLocalId],
            );

            for (final entry in cantPorVariante.entries) {
              await txn.rawUpdate('''
                UPDATE local_inventario
                SET comprometido_local_reservas = MAX(0, comprometido_local_reservas - ?)
                WHERE tenant_id = ? AND sucursal_id = ? AND variante_id = ?
              ''', [
                entry.value,
                sesion.tenantId,
                colaItem.sucursalId,
                entry.key,
              ]);
            }
          }
        }
      }

      await txn.update(
        'local_sesion',
        {'ultima_sincronizacion': ahoraIso},
        where: 'id = 1',
      );
    });
  }

  /// Permite al operador marcar localmente un conflicto como descartado/revisado.
  Future<void> marcarConflictoDescartadoLocalmente(String operationId) async {
    final sesion = await _requerirSesion();
    final db = await _localDb.database;
    await db.update(
      'cola_sincronizacion',
      {'estado': OfflineSyncStatus.descartada},
      where: 'operation_id = ? AND tenant_id = ?',
      whereArgs: [operationId, sesion.tenantId],
    );
  }

  /// Registra un intento de red fallido sin perder las operaciones pendientes.
  Future<void> registrarIntentoFallidoRed(
    List<String> operationIds,
    String detalleError,
  ) async {
    if (operationIds.isEmpty) return;
    final sesion = await obtenerSesionActiva();
    if (sesion == null) return;
    final ahoraIso = DateTime.now().toUtc().toIso8601String();
    final db = await _localDb.database;

    await db.transaction((txn) async {
      for (final opId in operationIds) {
        await txn.rawUpdate('''
          UPDATE cola_sincronizacion
          SET intentos = intentos + 1,
              ultimo_intento = ?,
              motivo_conflicto = ?
          WHERE operation_id = ? AND tenant_id = ? AND estado = ?
        ''', [
          ahoraIso,
          detalleError,
          opId,
          sesion.tenantId,
          OfflineSyncStatus.pendiente,
        ]);
      }
    });
  }
}
