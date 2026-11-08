import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:frontend_mobile/offline/connectivity_monitor.dart';
import 'package:frontend_mobile/offline/local_database.dart';
import 'package:frontend_mobile/offline/offline_models.dart';
import 'package:frontend_mobile/offline/offline_repository.dart';
import 'package:frontend_mobile/offline/offline_sync_provider.dart';
import 'package:frontend_mobile/offline/offline_sync_service.dart';
import 'package:frontend_mobile/screens/offline/catalogo_offline_screen.dart';
import 'package:frontend_mobile/screens/offline/centro_sincronizacion_screen.dart';
import 'package:frontend_mobile/screens/offline/pos_offline_screen.dart';
import 'package:frontend_mobile/widgets/offline_status_banner.dart';

Map<String, dynamic> _paqueteDemo(String tenantId) {
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
        'cantidad_disponible': 5,
        'cantidad_reservada': 0,
        'cantidad_libre': 5,
        'stock_minimo': 2,
      }
    ],
    'clientes': [],
  };
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfiNoIsolate;

  testWidgets(
    'Fase 4 UI: Banner reactivo (Sin Conexión / Conectado), Catálogo/POS SQLite y Centro de Conflictos',
    (WidgetTester tester) async {
      const tenantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      final mockHttp = MockClient((http.Request req) async {
        if (req.url.path.endsWith('/health')) {
          return http.Response('{"status":"ok"}', 200);
        }
        if (req.url.path.endsWith('/sync/paquete-offline')) {
          return http.Response(jsonEncode(_paqueteDemo(tenantId)), 200);
        }
        if (req.url.path.endsWith('/sync/lote')) {
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          final ops = body['operaciones'] as List<dynamic>;
          final op = ops.first as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'procesadas': 1,
              'confirmadas': 0,
              'en_conflicto': 1,
              'rechazadas': 0,
              'idempotentes': 0,
              'resultados': [
                {
                  'operation_id': op['operation_id'],
                  'tipo': op['tipo'],
                  'estado': 'EN_CONFLICTO',
                  'motivo': 'Stock insuficiente en servidor: quedaban 0 uds libres.',
                }
              ],
            }),
            200,
          );
        }
        return http.Response('{"status":"ok"}', 200);
      });

      await LocalDatabase.instance.close();
      LocalDatabase.instance.configureForTesting(inMemoryDatabasePath);
      final repo = OfflineRepository(localDb: LocalDatabase.instance);

      await repo.guardarSesionConAislamiento(
        usuarioId: 10,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-demo',
        tenantId: tenantId,
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 1,
      );
      await repo.guardarPaqueteOffline(_paqueteDemo(tenantId));

      final monitor = ConnectivityMonitor(
        httpClient: mockHttp,
        healthUrl: 'http://test.local/health',
        enablePlatformStream: false,
      );
      final syncSvc = OfflineSyncService(
        repository: repo,
        httpClient: mockHttp,
        baseApiUrl: 'http://test.local/api/v1',
        baseRetryDelay: const Duration(milliseconds: 10),
      );
      final provider = OfflineSyncProvider(
        repository: repo,
        connectivity: monitor,
        syncService: syncSvc,
      );

      await provider.alternarModoOfflineSimulado(true);
      await provider.inicializar();

      // Registrar 1 venta en modo offline para verificar el contador en el banner
      await provider.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 2001, cantidad: 2)],
      );

      // 1. Verificar OfflineStatusBanner en estado SIN CONEXIÓN + 1 pendiente
      await tester.pumpWidget(
        ChangeNotifierProvider<OfflineSyncProvider>.value(
          value: provider,
          child: const MaterialApp(
            home: Scaffold(body: OfflineStatusBanner(mostrarAccesoCentroSync: false)),
          ),
        ),
      );
      await tester.pump();

      expect(find.textContaining('SIN CONEXIÓN'), findsOneWidget);
      expect(find.textContaining('Boutique Aurora S.R.L.'), findsOneWidget);
      expect(find.text('1 pendiente(s)'), findsOneWidget);

      // 2. Verificar PosOfflineScreen muestra catálogo local y restricción SOLO EFECTIVO OFFLINE
      await tester.pumpWidget(
        ChangeNotifierProvider<OfflineSyncProvider>.value(
          value: provider,
          child: const MaterialApp(home: PosOfflineScreen()),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('SOLO EFECTIVO OFFLINE'), findsOneWidget);
      expect(find.text('COBRAR EFECTIVO'), findsOneWidget);
      expect(find.textContaining('Blazer Lino Italiano'), findsWidgets);

      // 3. Verificar CatalogoOfflineScreen carga variantes desde SQLite
      await tester.pumpWidget(
        ChangeNotifierProvider<OfflineSyncProvider>.value(
          value: provider,
          child: const MaterialApp(home: CatalogoOfflineScreen()),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.textContaining('AUR-BLZ-L-BEI'), findsWidgets);

      // 4. Restaurar conexión y sincronizar -> pasa a EN_CONFLICTO -> verificar CentroSincronizacionScreen
      monitor.emitTestConnectivityState(true);
      await provider.sincronizarAhora();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      await tester.pumpWidget(
        ChangeNotifierProvider<OfflineSyncProvider>.value(
          value: provider,
          child: const MaterialApp(home: CentroSincronizacionScreen()),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.textContaining('CONECTADO'), findsOneWidget);
      expect(find.text('EN_CONFLICTO'), findsWidgets);
      expect(
        find.textContaining('Stock insuficiente en servidor: quedaban 0 uds libres.'),
        findsOneWidget,
      );

      // Limpieza
      await tester.pumpWidget(const SizedBox.shrink());
      provider.dispose();
      await LocalDatabase.instance.close();
    },
  );
}
