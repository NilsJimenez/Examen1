import 'package:shared_preferences/shared_preferences.dart';
import 'dart:async';
import 'package:flutter/foundation.dart';

import 'connectivity_monitor.dart';
import 'offline_models.dart';
import 'offline_repository.dart';
import 'offline_sync_service.dart';

/// Estados visuales del indicador global de conectividad exigido por la Sección 6.3.
enum OfflineBannerState {
  conectado,
  sinConexion,
  sincronizando,
}

/// Proveedor Reactivo Global (ChangeNotifier) que coordina SQLite, Conectividad
/// y Sincronización Automática/Manual en toda la aplicación Flutter.
class OfflineSyncProvider extends ChangeNotifier {
  final OfflineRepository repository;
  final ConnectivityMonitor connectivity;
  final OfflineSyncService syncService;

  StreamSubscription<bool>? _connSub;

  LocalSession? _sesion;
  List<OfflineBranch> _sucursales = [];
  int _pendientesCount = 0;
  int _sincronizadasCount = 0;
  int _conflictosCount = 0;
  int _rechazadasCount = 0;
  bool _sincronizando = false;
  String? _ultimoMensaje;
  String? _ultimoError;
  bool _inicializado = false;

  OfflineSyncProvider({
    OfflineRepository? repository,
    ConnectivityMonitor? connectivity,
    OfflineSyncService? syncService,
  })  : repository = repository ?? OfflineRepository(),
        connectivity = connectivity ?? ConnectivityMonitor(),
        syncService = syncService ??
            OfflineSyncService(repository: repository ?? OfflineRepository());

  bool get inicializado => _inicializado;
  bool get estaConectado => connectivity.isOnline;
  bool get modoOfflineSimulado => connectivity.modoOfflineSimulado;
  bool get estaSincronizando => _sincronizando || syncService.isSyncing;
  LocalSession? get sesion => _sesion;
  List<OfflineBranch> get sucursales => _sucursales;

  int get pendientesCount => _pendientesCount;
  int get sincronizadasCount => _sincronizadasCount;
  int get conflictosCount => _conflictosCount;
  int get rechazadasCount => _rechazadasCount;
  String? get ultimoMensaje => _ultimoMensaje;
  String? get ultimoError => _ultimoError;

  bool get datosDesactualizados => _sesion?.datosDesactualizados ?? false;
  int get horasDesdeUltimaSync => _sesion?.horasDesdeUltimaSync ?? 0;

  OfflineBranch? get sucursalActiva {
    final idActiva = _sesion?.sucursalActivaId;
    if (idActiva == null) return _sucursales.isNotEmpty ? _sucursales.first : null;
    for (final s in _sucursales) {
      if (s.id == idActiva) return s;
    }
    return _sucursales.isNotEmpty ? _sucursales.first : null;
  }

  OfflineBannerState get bannerState {
    if (estaSincronizando) return OfflineBannerState.sincronizando;
    if (!estaConectado) return OfflineBannerState.sinConexion;
    return OfflineBannerState.conectado;
  }

  /// Inicializa el estado desde SQLite, activa la escucha de red y dispara
  /// sincronización automática apenas el dispositivo recupera internet.
  Future<void> inicializar() async {
    if (kIsWeb) {
      _inicializado = true;
      return;
    }

    await recargarEstadoLocal();
    await connectivity.initialize();

    _connSub?.cancel();
    _connSub = connectivity.onOnlineChanged.listen((online) async {
      notifyListeners();
      if (online) {
        await sincronizarAhora(automatica: true);
      }
    });

    _inicializado = true;
    notifyListeners();

    if (estaConectado && _sesion != null && _pendientesCount > 0) {
      await sincronizarAhora(automatica: true);
    }
  }

  /// Recarga sesión, sucursales y contadores de cola desde SQLite.
  Future<void> recargarEstadoLocal() async {
    if (kIsWeb) return;
    _sesion = await repository.obtenerSesionActiva();
    if (_sesion == null) {
      // Auto-restaurar contexto de sesión en SQLite si ya existe token en SharedPreferences
      try {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('jwt_token');
        if (token != null && token.isNotEmpty) {
          final userId = prefs.getInt('user_id') ?? 1;
          final email = prefs.getString('user_email') ?? 'usuario@fashionstore.com';
          final nombre = prefs.getString('nombre_completo') ?? 'Usuario';
          final rol = prefs.getString('user_role') ?? 'cliente';
          final tenantId = prefs.getString('tenant_id') ?? '96c58c4c-a866-424e-8412-c22f273738cd';
          final tenantNombre = prefs.getString('tenant_nombre') ?? 'Boutique Aurora S.R.L.';
          final planNombre = prefs.getString('plan_nombre') ?? 'Pro Multi-Sucursal';
          final sucursalId = prefs.getInt('sucursal_id');

          await repository.guardarSesionConAislamiento(
            usuarioId: userId,
            email: email,
            nombreCompleto: nombre,
            rol: rol,
            userType: rol.toLowerCase() == 'cliente' ? 'cliente' : 'usuario',
            tokenJwt: token,
            tenantId: tenantId.isNotEmpty ? tenantId : '96c58c4c-a866-424e-8412-c22f273738cd',
            tenantNombre: tenantNombre.isNotEmpty ? tenantNombre : 'Boutique Aurora S.R.L.',
            planNombre: planNombre,
            sucursalAsignadaId: sucursalId,
          );
          _sesion = await repository.obtenerSesionActiva();
          if (estaConectado) {
            unawaited(syncService.descargarYActualizarPaqueteOffline());
          }
        }
      } catch (_) {}
    }

    if (_sesion != null) {
      _sucursales = await repository.obtenerSucursalesLocales();
      final contadores = await repository.obtenerContadoresCola();
      _pendientesCount = contadores[OfflineSyncStatus.pendiente] ?? 0;
      _sincronizadasCount = contadores[OfflineSyncStatus.sincronizada] ?? 0;
      _conflictosCount = contadores[OfflineSyncStatus.enConflicto] ?? 0;
      _rechazadasCount = contadores[OfflineSyncStatus.rechazada] ?? 0;
    } else {
      _sucursales = [];
      _pendientesCount = 0;
      _sincronizadasCount = 0;
      _conflictosCount = 0;
      _rechazadasCount = 0;
    }
    notifyListeners();
  }

  /// Descarga forzada del catálogo y existencias desde el servidor.
  Future<bool> descargarCatalogo() async {
    if (!estaConectado) {
      _ultimoError = 'Sin conexión a internet para descargar el catálogo.';
      notifyListeners();
      return false;
    }
    _sincronizando = true;
    _ultimoError = null;
    notifyListeners();
    try {
      final ok = await syncService.descargarYActualizarPaqueteOffline();
      await recargarEstadoLocal();
      if (ok) {
        _ultimoMensaje = 'Catálogo y existencias descargadas con éxito.';
      }
      return ok;
    } catch (e) {
      _ultimoError = e.toString();
      return false;
    } finally {
      _sincronizando = false;
      notifyListeners();
    }
  }

  /// Activa o desactiva la simulación manual de corte de internet.
  /// Al volver a línea, dispara automáticamente la sincronización de la cola pendiente.
  Future<void> alternarModoOfflineSimulado(bool activarOffline) async {
    await connectivity.setModoOfflineSimulado(activarOffline);
    notifyListeners();
  }

  /// Cambia la sucursal activa de trabajo local.
  Future<void> seleccionarSucursalActiva(int sucursalId) async {
    await repository.cambiarSucursalActiva(sucursalId);
    await recargarEstadoLocal();
  }

  /// Sincronización manual o automática disparada al volver internet (Sección 6.2).
  Future<SyncExecutionReport> sincronizarAhora({bool automatica = false}) async {
    if (!estaConectado) {
      const msg = 'Sin conexión a internet. Las operaciones siguen seguras en la cola local.';
      _ultimoError = msg;
      notifyListeners();
      return const SyncExecutionReport(
        exitoComunicacion: false,
        mensaje: msg,
      );
    }

    _sincronizando = true;
    _ultimoError = null;
    notifyListeners();

    try {
      final reporte = await syncService.sincronizarColaPendiente(
        maxReintentosRed: automatica ? 2 : 1,
        refrescarPaqueteAlTerminar: true,
      );
      await recargarEstadoLocal();

      if (reporte.exitoComunicacion) {
        _ultimoMensaje = reporte.mensaje;
        _ultimoError = null;
      } else {
        _ultimoError = reporte.mensaje;
      }
      return reporte;
    } finally {
      _sincronizando = false;
      notifyListeners();
    }
  }

  /// Registra una venta presencial en efectivo en SQLite y, si hay conexión,
  /// intenta sincronizarla de inmediato sin bloquear al cajero.
  Future<LocalSaleRecord> registrarVentaContado({
    int? sucursalId,
    required List<OfflineDraftItem> items,
    int? clienteServidorId,
    String? clienteNombre,
  }) async {
    final venta = await repository.registrarVentaOfflineContado(
      sucursalId: sucursalId,
      items: items,
      metodoPago: 'efectivo',
      clienteServidorId: clienteServidorId,
      clienteNombre: clienteNombre,
    );
    await recargarEstadoLocal();

    if (estaConectado) {
      unawaited(sincronizarAhora(automatica: true));
    }
    return venta;
  }

  /// Registra una reserva en SQLite y, si hay conexión, dispara su sincronización inmediata.
  Future<LocalReservationRecord> registrarReserva({
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
  }) async {
    final reserva = await repository.registrarReservaOffline(
      sucursalId: sucursalId,
      items: items,
      clienteServidorId: clienteServidorId,
      clienteNombres: clienteNombres,
      clienteApellidos: clienteApellidos,
      clienteEmail: clienteEmail,
      clienteTelefono: clienteTelefono,
      fechaReserva: fechaReserva,
      horarioAtencion: horarioAtencion,
      observaciones: observaciones,
    );
    await recargarEstadoLocal();

    if (estaConectado) {
      unawaited(sincronizarAhora(automatica: true));
    }
    return reserva;
  }

  /// Marca un conflicto como descartado/revisado y actualiza contadores locales.
  Future<void> descartarConflicto(String operationId, {String? nota}) async {
    await syncService.resolverConflicto(
      operationId: operationId,
      accion: 'DESCARTADA_LOCALMENTE',
      nota: nota,
    );
    await recargarEstadoLocal();
  }

  @override
  void dispose() {
    _connSub?.cancel();
    connectivity.dispose();
    super.dispose();
  }
}
