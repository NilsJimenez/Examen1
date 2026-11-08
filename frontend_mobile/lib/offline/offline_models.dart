import 'dart:convert';

/// Estados posibles para ventas locales, reservas locales y elementos de la cola.
class OfflineSyncStatus {
  static const String pendiente = 'PENDIENTE_SINCRONIZACION';
  static const String sincronizando = 'SINCRONIZANDO';
  static const String sincronizada = 'SINCRONIZADA';
  static const String enConflicto = 'EN_CONFLICTO';
  static const String rechazada = 'RECHAZADA';
  static const String descartada = 'DESCARTADA';
}

/// Excepción controlada para validaciones locales offline (stock, efectivo, sesión).
class OfflineDomainException implements Exception {
  final String message;
  const OfflineDomainException(this.message);

  @override
  String toString() => message;
}

/// Sesión autenticada almacenada en SQLite (fila única id = 1).
class LocalSession {
  final int usuarioId;
  final String email;
  final String nombreCompleto;
  final String rol;
  final String userType;
  final String tokenJwt;
  final String tenantId;
  final String tenantNombre;
  final String planNombre;
  final int? sucursalAsignadaId;
  final int? sucursalActivaId;
  final DateTime? ultimaSincronizacion;
  final int umbralHorasDesactualizado;

  const LocalSession({
    required this.usuarioId,
    required this.email,
    required this.nombreCompleto,
    required this.rol,
    required this.userType,
    required this.tokenJwt,
    required this.tenantId,
    required this.tenantNombre,
    required this.planNombre,
    this.sucursalAsignadaId,
    this.sucursalActivaId,
    this.ultimaSincronizacion,
    this.umbralHorasDesactualizado = 12,
  });

  factory LocalSession.fromMap(Map<String, Object?> map) {
    final rawSync = map['ultima_sincronizacion'] as String?;
    return LocalSession(
      usuarioId: (map['usuario_id'] as num).toInt(),
      email: (map['email'] as String?) ?? '',
      nombreCompleto: (map['nombre_completo'] as String?) ?? '',
      rol: (map['rol'] as String?) ?? 'cajero',
      userType: (map['user_type'] as String?) ?? 'usuario',
      tokenJwt: (map['token_jwt'] as String?) ?? '',
      tenantId: (map['tenant_id'] as String?) ?? '',
      tenantNombre: (map['tenant_nombre'] as String?) ?? '',
      planNombre: (map['plan_nombre'] as String?) ?? 'Basico',
      sucursalAsignadaId: (map['sucursal_asignada_id'] as num?)?.toInt(),
      sucursalActivaId: (map['sucursal_activa_id'] as num?)?.toInt(),
      ultimaSincronizacion: rawSync != null ? DateTime.tryParse(rawSync) : null,
      umbralHorasDesactualizado:
          (map['umbral_horas_desactualizado'] as num?)?.toInt() ?? 12,
    );
  }

  /// Indica si el catálogo/stock local superó el umbral de horas configurado (Sección 6.2).
  bool get datosDesactualizados {
    if (ultimaSincronizacion == null) return true;
    final horas = DateTime.now()
        .toUtc()
        .difference(ultimaSincronizacion!.toUtc())
        .inHours;
    return horas >= umbralHorasDesactualizado;
  }

  /// Horas transcurridas desde la última sincronización exitosa.
  int get horasDesdeUltimaSync {
    if (ultimaSincronizacion == null) return 999;
    return DateTime.now()
        .toUtc()
        .difference(ultimaSincronizacion!.toUtc())
        .inHours;
  }
}

class OfflineBranch {
  final int id;
  final String tenantId;
  final String nombre;
  final String? ciudad;
  final String direccion;
  final String? telefono;
  final bool activo;

  const OfflineBranch({
    required this.id,
    required this.tenantId,
    required this.nombre,
    this.ciudad,
    required this.direccion,
    this.telefono,
    this.activo = true,
  });

  factory OfflineBranch.fromMap(Map<String, Object?> map) {
    return OfflineBranch(
      id: (map['id'] as num).toInt(),
      tenantId: (map['tenant_id'] as String?) ?? '',
      nombre: (map['nombre'] as String?) ?? '',
      ciudad: map['ciudad'] as String?,
      direccion: (map['direccion'] as String?) ?? '',
      telefono: map['telefono'] as String?,
      activo: ((map['activo'] as num?)?.toInt() ?? 1) == 1,
    );
  }
}

class OfflineCategory {
  final int id;
  final String tenantId;
  final String nombre;

  const OfflineCategory({
    required this.id,
    required this.tenantId,
    required this.nombre,
  });

  factory OfflineCategory.fromMap(Map<String, Object?> map) {
    return OfflineCategory(
      id: (map['id'] as num).toInt(),
      tenantId: (map['tenant_id'] as String?) ?? '',
      nombre: (map['nombre'] as String?) ?? '',
    );
  }
}

/// Vista enriquecida de una variante con el stock real disponible en la sucursal activa.
class OfflineVariantStock {
  final int varianteId;
  final int productoId;
  final String tenantId;
  final String productoNombre;
  final String? descripcion;
  final int? categoriaId;
  final String? categoriaNombre;
  final String sku;
  final String talla;
  final String color;
  final String codigoHex;
  final double precioBase;
  final double precioAdicional;
  final double precioVigente;
  final String? imagenUrl;
  final int sucursalId;
  final int cantidadDisponibleServidor;
  final int cantidadReservadaServidor;
  final int comprometidoLocalVentas;
  final int comprometidoLocalReservas;
  final int stockMinimo;

  const OfflineVariantStock({
    required this.varianteId,
    required this.productoId,
    required this.tenantId,
    required this.productoNombre,
    this.descripcion,
    this.categoriaId,
    this.categoriaNombre,
    required this.sku,
    required this.talla,
    required this.color,
    required this.codigoHex,
    required this.precioBase,
    required this.precioAdicional,
    required this.precioVigente,
    this.imagenUrl,
    required this.sucursalId,
    required this.cantidadDisponibleServidor,
    required this.cantidadReservadaServidor,
    required this.comprometidoLocalVentas,
    required this.comprometidoLocalReservas,
    required this.stockMinimo,
  });

  /// Stock libre efectivo descontando reservas del servidor y operaciones locales pendientes.
  int get stockLibreEfectivo {
    final libre = cantidadDisponibleServidor -
        cantidadReservadaServidor -
        comprometidoLocalVentas -
        comprometidoLocalReservas;
    return libre < 0 ? 0 : libre;
  }

  bool get stockBajo => stockLibreEfectivo > 0 && stockLibreEfectivo <= stockMinimo;

  factory OfflineVariantStock.fromJoinedRow(Map<String, Object?> row) {
    return OfflineVariantStock(
      varianteId: (row['variante_id'] as num).toInt(),
      productoId: (row['producto_id'] as num).toInt(),
      tenantId: (row['tenant_id'] as String?) ?? '',
      productoNombre: (row['producto_nombre'] as String?) ?? '',
      descripcion: row['descripcion'] as String?,
      categoriaId: (row['categoria_id'] as num?)?.toInt(),
      categoriaNombre: row['categoria_nombre'] as String?,
      sku: (row['sku'] as String?) ?? '',
      talla: (row['talla'] as String?) ?? 'U',
      color: (row['color'] as String?) ?? 'Único',
      codigoHex: (row['codigo_hex'] as String?) ?? '#333333',
      precioBase: (row['precio_base'] as num?)?.toDouble() ?? 0.0,
      precioAdicional: (row['precio_adicional'] as num?)?.toDouble() ?? 0.0,
      precioVigente: (row['precio_vigente'] as num?)?.toDouble() ?? 0.0,
      imagenUrl: row['imagen_url'] as String?,
      sucursalId: (row['sucursal_id'] as num?)?.toInt() ?? 0,
      cantidadDisponibleServidor:
          (row['cantidad_disponible_servidor'] as num?)?.toInt() ?? 0,
      cantidadReservadaServidor:
          (row['cantidad_reservada_servidor'] as num?)?.toInt() ?? 0,
      comprometidoLocalVentas:
          (row['comprometido_local_ventas'] as num?)?.toInt() ?? 0,
      comprometidoLocalReservas:
          (row['comprometido_local_reservas'] as num?)?.toInt() ?? 0,
      stockMinimo: (row['stock_minimo'] as num?)?.toInt() ?? 5,
    );
  }
}

class OfflineCustomer {
  final int localPk;
  final int? servidorId;
  final String tenantId;
  final String nombres;
  final String apellidos;
  final String? email;
  final String? telefono;
  final bool esCreadoOffline;

  const OfflineCustomer({
    required this.localPk,
    this.servidorId,
    required this.tenantId,
    required this.nombres,
    required this.apellidos,
    this.email,
    this.telefono,
    this.esCreadoOffline = false,
  });

  String get nombreCompleto => '$nombres $apellidos'.trim();

  factory OfflineCustomer.fromMap(Map<String, Object?> map) {
    return OfflineCustomer(
      localPk: (map['local_pk'] as num).toInt(),
      servidorId: (map['servidor_id'] as num?)?.toInt(),
      tenantId: (map['tenant_id'] as String?) ?? '',
      nombres: (map['nombres'] as String?) ?? '',
      apellidos: (map['apellidos'] as String?) ?? '',
      email: map['email'] as String?,
      telefono: map['telefono'] as String?,
      esCreadoOffline: ((map['es_creado_offline'] as num?)?.toInt() ?? 0) == 1,
    );
  }
}

/// Ítem individual para registrar una venta o reserva local en SQLite.
class OfflineDraftItem {
  final int varianteId;
  final int cantidad;
  final double? precioUnitario;

  const OfflineDraftItem({
    required this.varianteId,
    required this.cantidad,
    this.precioUnitario,
  });
}

class LocalSaleRecord {
  final String localId;
  final String operationId;
  final String tenantId;
  final int usuarioId;
  final int sucursalId;
  final int? clienteServidorId;
  final String? clienteNombre;
  final String metodoPago;
  final double total;
  final DateTime fechaLocal;
  final String estadoSync;
  final int? servidorVentaId;
  final String? numeroComprobante;
  final String? motivoError;

  const LocalSaleRecord({
    required this.localId,
    required this.operationId,
    required this.tenantId,
    required this.usuarioId,
    required this.sucursalId,
    this.clienteServidorId,
    this.clienteNombre,
    required this.metodoPago,
    required this.total,
    required this.fechaLocal,
    required this.estadoSync,
    this.servidorVentaId,
    this.numeroComprobante,
    this.motivoError,
  });

  factory LocalSaleRecord.fromMap(Map<String, Object?> map) {
    return LocalSaleRecord(
      localId: map['local_id'] as String,
      operationId: map['operation_id'] as String,
      tenantId: map['tenant_id'] as String,
      usuarioId: (map['usuario_id'] as num).toInt(),
      sucursalId: (map['sucursal_id'] as num).toInt(),
      clienteServidorId: (map['cliente_servidor_id'] as num?)?.toInt(),
      clienteNombre: map['cliente_nombre'] as String?,
      metodoPago: (map['metodo_pago'] as String?) ?? 'efectivo',
      total: (map['total'] as num).toDouble(),
      fechaLocal: DateTime.parse(map['fecha_local'] as String),
      estadoSync: map['estado_sync'] as String,
      servidorVentaId: (map['servidor_venta_id'] as num?)?.toInt(),
      numeroComprobante: map['numero_comprobante'] as String?,
      motivoError: map['motivo_error'] as String?,
    );
  }
}

class LocalReservationRecord {
  final String localId;
  final String operationId;
  final String tenantId;
  final int usuarioId;
  final int sucursalId;
  final int? clienteServidorId;
  final String clienteNombres;
  final String? clienteApellidos;
  final String? clienteEmail;
  final String? clienteTelefono;
  final String fechaReserva;
  final String horarioAtencion;
  final String? observaciones;
  final DateTime fechaLocal;
  final String estadoSync;
  final int? servidorReservaId;
  final String? codigoReserva;
  final String? motivoError;

  const LocalReservationRecord({
    required this.localId,
    required this.operationId,
    required this.tenantId,
    required this.usuarioId,
    required this.sucursalId,
    this.clienteServidorId,
    required this.clienteNombres,
    this.clienteApellidos,
    this.clienteEmail,
    this.clienteTelefono,
    required this.fechaReserva,
    required this.horarioAtencion,
    this.observaciones,
    required this.fechaLocal,
    required this.estadoSync,
    this.servidorReservaId,
    this.codigoReserva,
    this.motivoError,
  });

  factory LocalReservationRecord.fromMap(Map<String, Object?> map) {
    return LocalReservationRecord(
      localId: map['local_id'] as String,
      operationId: map['operation_id'] as String,
      tenantId: map['tenant_id'] as String,
      usuarioId: (map['usuario_id'] as num).toInt(),
      sucursalId: (map['sucursal_id'] as num).toInt(),
      clienteServidorId: (map['cliente_servidor_id'] as num?)?.toInt(),
      clienteNombres: (map['cliente_nombres'] as String?) ?? '',
      clienteApellidos: map['cliente_apellidos'] as String?,
      clienteEmail: map['cliente_email'] as String?,
      clienteTelefono: map['cliente_telefono'] as String?,
      fechaReserva: map['fecha_reserva'] as String,
      horarioAtencion: map['horario_atencion'] as String,
      observaciones: map['observaciones'] as String?,
      fechaLocal: DateTime.parse(map['fecha_local'] as String),
      estadoSync: map['estado_sync'] as String,
      servidorReservaId: (map['servidor_reserva_id'] as num?)?.toInt(),
      codigoReserva: map['codigo_reserva'] as String?,
      motivoError: map['motivo_error'] as String?,
    );
  }
}

/// Registro persistente en la tabla cola_sincronizacion.
class SyncQueueItem {
  final String operationId;
  final String tenantId;
  final int usuarioId;
  final String tipo;
  final String entidadLocalId;
  final int sucursalId;
  final Map<String, dynamic> payload;
  final String estado;
  final int intentos;
  final DateTime fechaLocal;
  final DateTime? ultimoIntento;
  final DateTime? sincronizadoEn;
  final int? servidorEntidadId;
  final String? referenciaServidor;
  final String? motivoConflicto;
  final List<dynamic>? detallesConflicto;

  const SyncQueueItem({
    required this.operationId,
    required this.tenantId,
    required this.usuarioId,
    required this.tipo,
    required this.entidadLocalId,
    required this.sucursalId,
    required this.payload,
    required this.estado,
    required this.intentos,
    required this.fechaLocal,
    this.ultimoIntento,
    this.sincronizadoEn,
    this.servidorEntidadId,
    this.referenciaServidor,
    this.motivoConflicto,
    this.detallesConflicto,
  });

  factory SyncQueueItem.fromMap(Map<String, Object?> map) {
    final rawPayload = map['payload_json'] as String? ?? '{}';
    final rawDetalles = map['detalles_conflicto_json'] as String?;
    return SyncQueueItem(
      operationId: map['operation_id'] as String,
      tenantId: map['tenant_id'] as String,
      usuarioId: (map['usuario_id'] as num).toInt(),
      tipo: map['tipo'] as String,
      entidadLocalId: map['entidad_local_id'] as String,
      sucursalId: (map['sucursal_id'] as num).toInt(),
      payload: jsonDecode(rawPayload) as Map<String, dynamic>,
      estado: map['estado'] as String,
      intentos: (map['intentos'] as num?)?.toInt() ?? 0,
      fechaLocal: DateTime.parse(map['fecha_local'] as String),
      ultimoIntento: map['ultimo_intento'] != null
          ? DateTime.tryParse(map['ultimo_intento'] as String)
          : null,
      sincronizadoEn: map['sincronizado_en'] != null
          ? DateTime.tryParse(map['sincronizado_en'] as String)
          : null,
      servidorEntidadId: (map['servidor_entidad_id'] as num?)?.toInt(),
      referenciaServidor: map['referencia_servidor'] as String?,
      motivoConflicto: map['motivo_conflicto'] as String?,
      detallesConflicto:
          rawDetalles != null ? (jsonDecode(rawDetalles) as List<dynamic>) : null,
    );
  }
}
