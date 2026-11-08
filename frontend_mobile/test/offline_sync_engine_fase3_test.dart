import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:frontend_mobile/offline/connectivity_monitor.dart';
import 'package:frontend_mobile/offline/local_database.dart';
import 'package:frontend_mobile/offline/offline_models.dart';
import 'package:frontend_mobile/offline/offline_repository.dart';
import 'package:frontend_mobile/offline/offline_sync_provider.dart';
import 'package:frontend_mobile/offline/offline_sync_service.dart';

Map<String, dynamic> _paqueteServidor({
  required String tenantId,
  required int stockDisponible,
}) {
  return {
    'tenant_id': tenantId,
    'tenant_nombre': 'Boutique Aurora S.R.L.',
    'plan_nombre': 'Profesional',
    'usuario_id': 10,
    'rol': 'cajero',
    'sucursal_asignada_id': 1,
    'descargado_en': DateTime.now().toUtc().toIso8601String(),
    'umbral_horas_desactualizado': 12,
    'sucursales': [
      {
        'id': 1,
        'tenant_id': tenantId,
        'nombre': 'Sucursal Equipetrol',
        'ciudad': 'Santa Cruz',
        'direccion': 'Av. San Martín #450',
        'telefono': '70012345',
        'activo': true,
      }
    ],
    'categorias': [
      {'id': 1, 'nombre': 'Blazers'},
    ],
    'productos': [
      {
        'id': 200,
        'tenant_id': tenantId,
        'nombre': 'Blazer Lino Italiano',
        'descripcion': 'Corte sastre',
        'categoria_id': 1,
        'categoria_nombre': 'Blazers',
        'precio_base': 380.0,
        'imagen_url': null,
        'genero': 'Unisex',
        'activo': true,
      }
    ],
    'variantes': [
      {
        'id': 2001,
        'producto_id': 200,
        'producto_nombre': 'Blazer Lino Italiano',
        'sku': 'AUR-BLZ-L-BEI',
        'talla_id': 3,
        'talla': 'L',
        'color_id': 4,
        'color': 'Beige',
        'codigo_hex': '#D8C3A5',
        'precio_base': 380.0,
        'precio_adicional': 0.0,
        'precio_vigente': 380.0,
        'imagen_url': null,
        'activo': true,
      }
    ],
    'inventario': [
      {
        'id': 900,
        'sucursal_id': 1,
        'variante_id': 2001,
        'cantidad_disponible': stockDisponible,
        'cantidad_reservada': 0,
        'cantidad_libre': stockDisponible,
        'stock_minimo': 3,
      }
    ],
    'clientes': [],
  };
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late Directory tempDir;
  late OfflineRepository repo;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('fashionstore_fase3_test_');
    await LocalDatabase.instance.close();
    LocalDatabase.instance.configureForTesting(p.join(tempDir.path, 'fase3.db'));
    repo = OfflineRepository(localDb: LocalDatabase.instance);
  });

  tearDown(() async {
    await LocalDatabase.instance.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'Fase 3 completa: reintento exponencial idempotente, auto-sync al reconectar red, bloqueo RN05/RN08 y resolución de conflicto',
    () async {
      const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      await repo.guardarSesionConAislamiento(
        usuarioId: 10,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'token-valido',
        tenantId: tenantId,
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 1,
      );
      await repo.guardarPaqueteOffline(
        _paqueteServidor(tenantId: tenantId, stockDisponible: 8),
      );

      int llamadasSyncLote = 0;
      bool simularSuspension403 = false;
      bool patchConflictoRecibido = false;
      String? operationIdEnviadoIntento1;
      String? operationIdEnviadoIntento2;

      final mockHttp = MockClient((http.Request req) async {
        if (req.url.path.endsWith('/health')) {
          return http.Response('{"status":"ok"}', 200);
        }

        if (req.url.path.endsWith('/sync/paquete-offline')) {
          return http.Response(
            jsonEncode(_paqueteServidor(tenantId: tenantId, stockDisponible: 6)),
            200,
          );
        }

        if (req.url.path.endsWith('/sync/lote')) {
          if (simularSuspension403) {
            return http.Response(
              jsonEncode({
                'detail':
                    'La empresa se encuentra suspendida. No se permiten sincronizaciones (RN05).'
              }),
              403,
            );
          }

          llamadasSyncLote++;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          final ops = body['operaciones'] as List<dynamic>;
          final primeraOp = ops.first as Map<String, dynamic>;

          // Primer intento simula caída súbita de red/servidor (503)
          if (llamadasSyncLote == 1) {
            operationIdEnviadoIntento1 = primeraOp['operation_id'] as String;
            return http.Response('{"detail":"Gateway Timeout"}', 503);
          }

          operationIdEnviadoIntento2 = primeraOp['operation_id'] as String;
          final resultados = <Map<String, dynamic>>[];
          int confCnt = 0;
          int okCnt = 0;

          for (final rawOp in ops) {
            final op = rawOp as Map<String, dynamic>;
            final cant = ((op['items'] as List).first['cantidad'] as num).toInt();
            if (cant > 5) {
              confCnt++;
              resultados.add({
                'operation_id': op['operation_id'],
                'tipo': op['tipo'],
                'estado': 'EN_CONFLICTO',
                'idempotente': false,
                'motivo': 'Stock insuficiente en servidor',
                'procesada_en': DateTime.now().toUtc().toIso8601String(),
              });
            } else {
              okCnt++;
              resultados.add({
                'operation_id': op['operation_id'],
                'tipo': op['tipo'],
                'estado': 'CONFIRMADA',
                'idempotente': false,
                'entidad_id': 501,
                'numero_comprobante': 'POS-SYNC501',
                'total_confirmado': 760.0,
                'procesada_en': DateTime.now().toUtc().toIso8601String(),
              });
            }
          }

          return http.Response(
            jsonEncode({
              'tenant_id': tenantId,
              'procesado_en': DateTime.now().toUtc().toIso8601String(),
              'total_recibidas': ops.length,
              'confirmadas': okCnt,
              'en_conflicto': confCnt,
              'rechazadas': 0,
              'idempotentes': 0,
              'resultados': resultados,
            }),
            200,
          );
        }

        if (req.url.path.contains('/resolver-conflicto') && req.method == 'PATCH') {
          patchConflictoRecibido = true;
          return http.Response('{"status":"ok"}', 200);
        }

        return http.Response('Not found', 404);
      });

      final monitor = ConnectivityMonitor(
        httpClient: mockHttp,
        healthUrl: 'http://test.local/health',
      );
      final syncService = OfflineSyncService(
        repository: repo,
        httpClient: mockHttp,
        baseApiUrl: 'http://test.local/api/v1',
        baseRetryDelay: const Duration(milliseconds: 20),
      );
      final provider = OfflineSyncProvider(
        repository: repo,
        connectivity: monitor,
        syncService: syncService,
      );

      // 1. Inicializar provider y pasar a modo SIN CONEXIÓN; registrar 2 ventas (2 uds + 6 uds)
      await provider.alternarModoOfflineSimulado(true);
      await provider.inicializar();
      expect(provider.estaConectado, isFalse);
      expect(provider.bannerState, OfflineBannerState.sinConexion);

      final ventaOk = await provider.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 2001, cantidad: 2)],
      );
      final ventaConflicto = await provider.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 2001, cantidad: 6)],
      );
      expect(provider.pendientesCount, 2);

      // 2. Reconectar internet -> dispara auto-sync; intento 1 falla con 503 y el reintento exponencial 2 triunfa con el MISMO operation_id
      monitor.emitTestConnectivityState(true);
      await Future<void>.delayed(const Duration(milliseconds: 250));
      await provider.recargarEstadoLocal();

      expect(llamadasSyncLote, 2);
      expect(operationIdEnviadoIntento1, equals(ventaOk.operationId));
      expect(operationIdEnviadoIntento2, equals(ventaOk.operationId));
      expect(provider.pendientesCount, 0);
      expect(provider.sincronizadasCount, 1);
      expect(provider.conflictosCount, 1);

      // 3. Resolver el conflicto descartándolo y auditándolo en el backend (RNF10)
      await provider.descartarConflicto(
        ventaConflicto.operationId,
        nota: 'Cliente decidió llevar otra prenda',
      );
      expect(patchConflictoRecibido, isTrue);
      expect(provider.conflictosCount, 0);

      // 4. Probar bloqueo por suspensión SaaS (403 Forbidden - RN05) en sincronización manual
      await provider.alternarModoOfflineSimulado(true);
      await provider.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 2001, cantidad: 1)],
      );
      expect(provider.pendientesCount, 1);

      simularSuspension403 = true;
      monitor.emitTestConnectivityState(true);
      await Future<void>.delayed(const Duration(milliseconds: 150));
      // Ahora probamos también el botón manual sincronizarAhora()
      final rep403 = await provider.sincronizarAhora();
      expect(rep403.exitoComunicacion, isFalse);
      expect(rep403.bloqueadoPorSuscripcionOSesion, isTrue);
      expect(provider.ultimoError, contains('suspendida'));
      // La venta sigue protegida en SQLite sin perderse
      expect(provider.pendientesCount, 1);

      provider.dispose();
    },
  );
}
