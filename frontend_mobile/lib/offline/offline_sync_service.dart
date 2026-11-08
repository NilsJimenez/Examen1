import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import '../constants.dart';
import 'offline_models.dart';
import 'offline_repository.dart';

/// Resultado resumido de una corrida de sincronización hacia el backend.
class SyncExecutionReport {
  final bool exitoComunicacion;
  final bool bloqueadoPorSuscripcionOSesion;
  final int enviadas;
  final int confirmadas;
  final int enConflicto;
  final int rechazadas;
  final int idempotentes;
  final String mensaje;

  const SyncExecutionReport({
    required this.exitoComunicacion,
    this.bloqueadoPorSuscripcionOSesion = false,
    this.enviadas = 0,
    this.confirmadas = 0,
    this.enConflicto = 0,
    this.rechazadas = 0,
    this.idempotentes = 0,
    required this.mensaje,
  });
}

/// Motor de Sincronización Offline-First con Idempotencia y Reintento Exponencial
/// (Desafío III - Secciones 6.2, 6.4, RNF05 y RNF10).
class OfflineSyncService {
  final OfflineRepository _repository;
  final http.Client _httpClient;
  final String _baseApiUrl;
  final Duration _baseRetryDelay;

  bool _isSyncing = false;

  OfflineSyncService({
    OfflineRepository? repository,
    http.Client? httpClient,
    String? baseApiUrl,
    Duration? baseRetryDelay,
  })  : _repository = repository ?? OfflineRepository(),
        _httpClient = httpClient ?? http.Client(),
        _baseApiUrl = baseApiUrl ?? Constants.apiUrl,
        _baseRetryDelay = baseRetryDelay ?? const Duration(seconds: 2);

  bool get isSyncing => _isSyncing;

  /// Descarga el paquete actualizado del tenant y sucursales autorizadas desde FastAPI.
  Future<bool> descargarYActualizarPaqueteOffline({int? sucursalId}) async {
    final sesion = await _repository.obtenerSesionActiva();
    if (sesion == null || sesion.tokenJwt.isEmpty) return false;

    final query = sucursalId != null ? '?sucursal_id=$sucursalId' : '';
    final uri = Uri.parse('$_baseApiUrl/sync/paquete-offline$query');

    final response = await _httpClient
        .get(
          uri,
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer ${sesion.tokenJwt}',
          },
        )
        .timeout(const Duration(seconds: 12));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      await _repository.guardarPaqueteOffline(data);
      return true;
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      final body = _extraerDetalleError(response.body);
      throw OfflineDomainException(body);
    }

    return false;
  }

  /// Procesa en orden cronológico todas las operaciones pendientes en SQLite,
  /// aplicando reintentos exponenciales ante microcortes de red y refrescando
  /// el inventario local al finalizar.
  Future<SyncExecutionReport> sincronizarColaPendiente({
    int maxReintentosRed = 2,
    bool refrescarPaqueteAlTerminar = true,
  }) async {
    if (_isSyncing) {
      return const SyncExecutionReport(
        exitoComunicacion: false,
        mensaje: 'Ya existe una sincronización en curso.',
      );
    }

    _isSyncing = true;
    try {
      final sesion = await _repository.obtenerSesionActiva();
      if (sesion == null || sesion.tokenJwt.isEmpty) {
        return const SyncExecutionReport(
          exitoComunicacion: true,
          bloqueadoPorSuscripcionOSesion: false,
          mensaje: 'Modo en línea activo.',
        );
      }

      final pendientes = await _repository.obtenerColaPendienteOrdenada();
      if (pendientes.isEmpty) {
        if (refrescarPaqueteAlTerminar) {
          try {
            await descargarYActualizarPaqueteOffline();
          } on OfflineDomainException catch (e) {
            return SyncExecutionReport(
              exitoComunicacion: false,
              bloqueadoPorSuscripcionOSesion: true,
              mensaje: e.message,
            );
          } catch (_) {
            // Si falló el refresco silencioso sin operaciones pendientes, reportamos sin error crítico
          }
        }
        return const SyncExecutionReport(
          exitoComunicacion: true,
          mensaje: 'Catálogo e inventario local al día. Sin operaciones pendientes.',
        );
      }

      final payloads = pendientes.map((e) => e.payload).toList();
      final opIds = pendientes.map((e) => e.operationId).toList();
      final uri = Uri.parse('$_baseApiUrl/sync/lote');

      int intentoActual = 0;
      while (true) {
        try {
          final response = await _httpClient
              .post(
                uri,
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': 'Bearer ${sesion.tokenJwt}',
                },
                body: jsonEncode({'operaciones': payloads}),
              )
              .timeout(const Duration(seconds: 15));

          if (response.statusCode == 200) {
            final data = jsonDecode(response.body) as Map<String, dynamic>;
            final resultados = (data['resultados'] as List<dynamic>? ?? []);
            await _repository.aplicarResultadosSincronizacionLote(resultados);

            if (refrescarPaqueteAlTerminar) {
              try {
                await descargarYActualizarPaqueteOffline();
              } catch (_) {
                // La conciliación local ya actualizó el stock; el refresco completo es complementario
              }
            }

            final confirmadas = (data['confirmadas'] as num?)?.toInt() ?? 0;
            final conflictos = (data['en_conflicto'] as num?)?.toInt() ?? 0;
            final rechazadas = (data['rechazadas'] as num?)?.toInt() ?? 0;
            final idempotentes = (data['idempotentes'] as num?)?.toInt() ?? 0;

            final resumenPartes = <String>[];
            if (confirmadas + idempotentes > 0) {
              resumenPartes.add('${confirmadas + idempotentes} confirmada(s)');
            }
            if (conflictos > 0) {
              resumenPartes.add('$conflictos en conflicto');
            }
            if (rechazadas > 0) {
              resumenPartes.add('$rechazadas rechazada(s)');
            }

            return SyncExecutionReport(
              exitoComunicacion: true,
              enviadas: pendientes.length,
              confirmadas: confirmadas,
              enConflicto: conflictos,
              rechazadas: rechazadas,
              idempotentes: idempotentes,
              mensaje: resumenPartes.isEmpty
                  ? 'Sincronización completada.'
                  : 'Sincronización finalizada: ${resumenPartes.join(', ')}.',
            );
          }

          // Errores de autorización o suscripción SaaS (RN05 / RN08): no reintentar
          if (response.statusCode == 401 || response.statusCode == 403) {
            final detalle = _extraerDetalleError(response.body);
            await _repository.registrarIntentoFallidoRed(opIds, detalle);
            return SyncExecutionReport(
              exitoComunicacion: false,
              bloqueadoPorSuscripcionOSesion: true,
              enviadas: pendientes.length,
              mensaje: detalle,
            );
          }

          throw Exception('HTTP ${response.statusCode}: ${_extraerDetalleError(response.body)}');
        } catch (err) {
          final msgError = 'Corte de conexión al sincronizar: $err';
          await _repository.registrarIntentoFallidoRed(opIds, msgError);

          if (intentoActual >= maxReintentosRed) {
            return SyncExecutionReport(
              exitoComunicacion: false,
              enviadas: pendientes.length,
              mensaje:
                  'No se pudo completar la sincronización tras ${intentoActual + 1} intento(s). '
                  'Las ${pendientes.length} operación(es) siguen resguardadas en SQLite.',
            );
          }

          // Espera exponencial: base * 2^intento (ej. 2s, 4s, 8s)
          final factor = 1 << intentoActual;
          await Future<void>.delayed(_baseRetryDelay * factor);
          intentoActual++;
        }
      }
    } finally {
      _isSyncing = false;
    }
  }

  /// Registra la resolución de un conflicto en SQLite y, si hay red, también en el servidor (RNF10).
  Future<void> resolverConflicto({
    required String operationId,
    String accion = 'DESCARTADA_LOCALMENTE',
    String? nuevaOperationId,
    String? nota,
  }) async {
    await _repository.marcarConflictoDescartadoLocalmente(operationId);

    final sesion = await _repository.obtenerSesionActiva();
    if (sesion == null || sesion.tokenJwt.isEmpty) return;

    try {
      final uri = Uri.parse(
        '$_baseApiUrl/sync/operaciones/$operationId/resolver-conflicto',
      );
      await _httpClient
          .patch(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': 'Bearer ${sesion.tokenJwt}',
            },
            body: jsonEncode({
              'accion': accion,
              if (nuevaOperationId != null)
                'nueva_operation_id': nuevaOperationId,
              if (nota != null && nota.isNotEmpty) 'nota': nota,
            }),
          )
          .timeout(const Duration(seconds: 6));
    } catch (_) {
      // Si el dispositivo sigue offline, la marca local ya quedó persistida en SQLite
    }
  }

  String _extraerDetalleError(String rawBody) {
    try {
      final decoded = jsonDecode(rawBody);
      if (decoded is Map<String, dynamic> && decoded['detail'] != null) {
        return decoded['detail'].toString();
      }
    } catch (_) {}
    return 'No fue posible validar la operación con el servidor.';
  }
}
