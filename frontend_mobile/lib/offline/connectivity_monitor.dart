import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;

import '../constants.dart';

/// Monitor reactivo de conectividad real (Desafío III - Secciones 6.2 y 6.3).
/// Combina eventos del sistema operativo (Wi-Fi / Datos móviles) con verificación HTTP ligera
/// hacia el backend, y soporta simulación manual de corte de red para pruebas en vivo.
class ConnectivityMonitor {
  final Connectivity _connectivity;
  final http.Client _httpClient;
  final String _healthUrl;
  final bool _enablePlatformStream;

  StreamSubscription<List<ConnectivityResult>>? _subscription;
  final StreamController<bool> _onlineController =
      StreamController<bool>.broadcast();

  bool _isOnline = true;
  bool _modoOfflineSimulado = false;
  bool _disposed = false;

  ConnectivityMonitor({
    Connectivity? connectivity,
    http.Client? httpClient,
    String? healthUrl,
    bool enablePlatformStream = true,
  })  : _connectivity = connectivity ?? Connectivity(),
        _httpClient = httpClient ?? http.Client(),
        _healthUrl = healthUrl ?? _resolverHealthUrl(Constants.apiUrl),
        _enablePlatformStream = enablePlatformStream;

  static String _resolverHealthUrl(String apiV1Url) {
    if (apiV1Url.endsWith('/api/v1')) {
      return '${apiV1Url.substring(0, apiV1Url.length - 7)}/health';
    }
    return '$apiV1Url/health';
  }

  bool get isOnline => !_modoOfflineSimulado && _isOnline;
  bool get modoOfflineSimulado => _modoOfflineSimulado;
  Stream<bool> get onOnlineChanged => _onlineController.stream;

  Future<void> initialize() async {
    await checkNow();
    _subscription?.cancel();
    if (!_enablePlatformStream) return;
    try {
      _subscription = _connectivity.onConnectivityChanged.listen(
        (results) async {
          await _evaluarInterfacesYServidor(results);
        },
        onError: (_) {},
      );
    } catch (_) {
      // En entorno de pruebas sin canales nativos, opera mediante checkNow / emitTestConnectivityState
    }
  }

  /// Permite forzar el modo sin conexión durante pruebas o demostraciones en emulador,
  /// y al desactivarlo reevalúa la red real disparando la reconexión automática.
  Future<void> setModoOfflineSimulado(bool forzarOffline) async {
    final estadoPrevio = isOnline;
    _modoOfflineSimulado = forzarOffline;
    if (!forzarOffline) {
      await checkNow();
    } else if (estadoPrevio != isOnline && !_disposed) {
      _onlineController.add(isOnline);
    }
  }

  /// Permite inyectar cambios de conectividad directamente en pruebas unitarias.
  void emitTestConnectivityState(bool online) {
    final previo = isOnline;
    _modoOfflineSimulado = false;
    _isOnline = online;
    if (previo != isOnline && !_disposed) {
      _onlineController.add(isOnline);
    }
  }

  Future<bool> checkNow() async {
    if (_modoOfflineSimulado) {
      _actualizarEstado(false);
      return false;
    }
    if (!_enablePlatformStream) {
      return await _verificarAlcanceServidor();
    }
    try {
      final results = await _connectivity.checkConnectivity();
      return await _evaluarInterfacesYServidor(results);
    } catch (_) {
      return await _verificarAlcanceServidor();
    }
  }

  Future<bool> _evaluarInterfacesYServidor(
    List<ConnectivityResult> results,
  ) async {
    if (_modoOfflineSimulado) {
      _actualizarEstado(false);
      return false;
    }
    final sinInterfaz = results.isEmpty ||
        results.every((r) => r == ConnectivityResult.none);
    if (sinInterfaz) {
      _actualizarEstado(false);
      return false;
    }
    return await _verificarAlcanceServidor();
  }

  Future<bool> _verificarAlcanceServidor() async {
    try {
      final resp = await _httpClient
          .get(Uri.parse(_healthUrl))
          .timeout(const Duration(seconds: 3));
      final disponible = resp.statusCode >= 200 && resp.statusCode < 500;
      _actualizarEstado(disponible);
      return disponible;
    } catch (_) {
      _actualizarEstado(false);
      return false;
    }
  }

  void _actualizarEstado(bool nuevoOnline) {
    final efectivoPrevio = isOnline;
    _isOnline = nuevoOnline;
    final efectivoNuevo = isOnline;
    if (efectivoPrevio != efectivoNuevo && !_disposed) {
      _onlineController.add(efectivoNuevo);
    }
  }

  void dispose() {
    _disposed = true;
    _subscription?.cancel();
    _onlineController.close();
  }
}
