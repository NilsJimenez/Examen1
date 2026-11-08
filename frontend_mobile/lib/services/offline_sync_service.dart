import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

/// Servicio de Operación Offline y Sincronización por Lotes en Dispositivo Móvil (CU15 - CU22).
/// Persiste el catálogo descargado y la cola de operaciones pendientes con operation_id (UUID v4)
/// garantizando idempotencia (RN13), pago en efectivo (RN11) y resolución de conflictos (CU21).
class OfflineSyncMobileService {
  static const String _catalogoKey = 'fs_mobile_catalogo_offline';
  static const String _fechaDescargaKey = 'fs_mobile_fecha_descarga';
  static const String _colaOperacionesKey = 'fs_mobile_operaciones_pendientes';

  String generarUuidV4() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int b) => b.toRadixString(16).padLeft(2, '0');
    return '${hex(bytes[0])}${hex(bytes[1])}${hex(bytes[2])}${hex(bytes[3])}-'
        '${hex(bytes[4])}${hex(bytes[5])}-'
        '${hex(bytes[6])}${hex(bytes[7])}-'
        '${hex(bytes[8])}${hex(bytes[9])}-'
        '${hex(bytes[10])}${hex(bytes[11])}${hex(bytes[12])}${hex(bytes[13])}${hex(bytes[14])}${hex(bytes[15])}';
  }

  /// CU15: Descarga el subconjunto del catálogo de la empresa autenticada para uso offline
  Future<Map<String, dynamic>> descargarCatalogoOffline({int? sucursalId}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    var url = '${Constants.apiUrl}/sync/catalogo-descarga';
    if (sucursalId != null) {
      url += '?sucursal_id=$sucursalId';
    }

    final response = await http.get(
      Uri.parse(url),
      headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      await prefs.setString(_catalogoKey, jsonEncode(data['catalogo'] ?? []));
      await prefs.setString(_fechaDescargaKey, (data['fecha_descarga'] ?? DateTime.now().toIso8601String()).toString());
      return data;
    } else {
      throw Exception('Error al descargar catálogo offline (${response.statusCode})');
    }
  }

  /// CU16: Consulta el catálogo almacenado localmente cuando no hay conexión
  Future<List<dynamic>> obtenerCatalogoLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_catalogoKey);
    if (raw == null || raw.isEmpty) return [];
    return jsonDecode(raw) as List<dynamic>;
  }

  /// CU17 y CU18: Registra una reserva o venta de contado en efectivo (RN11) en la cola local
  Future<Map<String, dynamic>> registrarOperacionLocal({
    required String tipo, // 'VENTA' | 'RESERVA'
    required int sucursalId,
    required String clienteNombre,
    required List<Map<String, dynamic>> items,
    String? fechaReserva,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final operationId = generarUuidV4();
    final nuevaOp = {
      'operation_id': operationId,
      'tipo': tipo.toUpperCase(),
      'sucursal_id': sucursalId,
      'cliente_nombre': clienteNombre,
      'metodo_pago': 'efectivo', // RN11
      'fecha_local': DateTime.now().toUtc().toIso8601String(),
      'fecha_reserva': fechaReserva,
      'estado_local': 'REGISTRADA_LOCAL',
      'items': items,
    };

    final colaActual = await obtenerColaLocal();
    colaActual.insert(0, nuevaOp);
    await prefs.setString(_colaOperacionesKey, jsonEncode(colaActual));
    return nuevaOp;
  }

  /// CU19: Consulta la cola de operaciones almacenadas en el dispositivo
  Future<List<dynamic>> obtenerColaLocal() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_colaOperacionesKey);
    if (raw == null || raw.isEmpty) return [];
    return jsonDecode(raw) as List<dynamic>;
  }

  /// CU20: Sincroniza el lote de operaciones pendientes con el servidor central (/api/v1/sync)
  Future<Map<String, dynamic>> sincronizarOperacionesPendientes() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final cola = await obtenerColaLocal();
    final pendientes = cola.where((op) => op['estado_local'] == 'REGISTRADA_LOCAL').toList();

    final response = await http.post(
      Uri.parse('${Constants.apiUrl}/sync'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode({'operaciones': pendientes}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final resultados = (data['resultados'] ?? []) as List<dynamic>;
      final mapaEstados = <String, dynamic>{};
      for (final r in resultados) {
        mapaEstados[r['operation_id'].toString()] = r;
      }

      for (var i = 0; i < cola.length; i++) {
        final id = cola[i]['operation_id'].toString();
        if (mapaEstados.containsKey(id)) {
          cola[i]['estado_local'] = mapaEstados[id]['estado'];
          cola[i]['motivo_servidor'] = mapaEstados[id]['motivo'];
        }
      }
      await prefs.setString(_colaOperacionesKey, jsonEncode(cola));
      return data;
    } else {
      throw Exception('Error al sincronizar lote offline (${response.statusCode})');
    }
  }
}
