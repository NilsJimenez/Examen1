import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:frontend_mobile/offline/connectivity_monitor.dart';
import 'package:frontend_mobile/offline/local_database.dart';
import 'package:frontend_mobile/offline/offline_models.dart';
import 'package:frontend_mobile/offline/offline_repository.dart';
import 'package:frontend_mobile/offline/offline_sync_provider.dart';
import 'package:frontend_mobile/offline/offline_sync_service.dart';

Map<String, dynamic> _crearPaqueteTenantA() {
  return {
    'tenant_id': 'tenant-aurora-0001',
    'tenant_nombre': 'Boutique Aurora S.R.L.',
    'plan_nombre': 'Profesional',
    'usuario_id': 101,
    'rol': 'cajero',
    'sucursal_asignada_id': 10,
    'descargado_en': DateTime.now().toUtc().toIso8601String(),
    'umbral_horas_desactualizado': 12,
    'sucursales': [
      {
        'id': 10,
        'tenant_id': 'tenant-aurora-0001',
        'nombre': 'Sucursal Equipetrol Central',
        'ciudad': 'Santa Cruz',
        'direccion': 'Av. San Martín #450',
        'telefono': '70012345',
        'activo': true,
      }
    ],
    'categorias': [
      {'id': 1, 'nombre': 'Trajes y Blazers'},
      {'id': 2, 'nombre': 'Vestidos de Gala'},
    ],
    'productos': [
      {
        'id': 501,
        'tenant_id': 'tenant-aurora-0001',
        'nombre': 'Blazer Sastrería Italiana',
        'descripcion': 'Lino premium',
        'categoria_id': 1,
        'categoria_nombre': 'Trajes y Blazers',
        'precio_base': 450.0,
        'imagen_url': null,
        'genero': 'Unisex',
        'activo': true,
      }
    ],
    'variantes': [
      {
        'id': 7001,
        'producto_id': 501,
        'producto_nombre': 'Blazer Sastrería Italiana',
        'sku': 'AUR-BLZ-M-NEGRO',
        'talla_id': 2,
        'talla': 'M',
        'color_id': 1,
        'color': 'Negro',
        'codigo_hex': '#111111',
        'precio_base': 450.0,
        'precio_adicional': 0.0,
        'precio_vigente': 450.0,
        'imagen_url': null,
        'activo': true,
      }
    ],
    'inventario': [
      {
        'id': 9001,
        'sucursal_id': 10,
        'variante_id': 7001,
        'cantidad_disponible': 10,
        'cantidad_reservada': 0,
        'cantidad_libre': 10,
        'stock_minimo': 3,
      }
    ],
    'clientes': [
      {
        'id': 301,
        'nombres': 'Mariana',
        'apellidos': 'Roca Céspedes',
        'email': 'mariana.roca@test.bo',
        'telefono': '71002233',
      }
    ],
  };
}

Map<String, dynamic> _crearPaqueteTenantB() {
  return {
    'tenant_id': 'tenant-urban-0002',
    'tenant_nombre': 'Urban Wear Ltda.',
    'plan_nombre': 'Básico',
    'usuario_id': 202,
    'rol': 'cajero',
    'sucursal_asignada_id': 20,
    'descargado_en': DateTime.now().toUtc().toIso8601String(),
    'umbral_horas_desactualizado': 12,
    'sucursales': [
      {
        'id': 20,
        'tenant_id': 'tenant-urban-0002',
        'nombre': 'Sucursal Centro',
        'ciudad': 'La Paz',
        'direccion': 'Calle Comercio #800',
        'telefono': '72004455',
        'activo': true,
      }
    ],
    'categorias': [
      {'id': 10, 'nombre': 'Streetwear'},
    ],
    'productos': [
      {
        'id': 601,
        'tenant_id': 'tenant-urban-0002',
        'nombre': 'Hoodie Oversized Urban',
        'descripcion': 'Algodón frizado',
        'categoria_id': 10,
        'categoria_nombre': 'Streetwear',
        'precio_base': 220.0,
        'imagen_url': null,
        'genero': 'Unisex',
        'activo': true,
      }
    ],
    'variantes': [
      {
        'id': 8001,
        'producto_id': 601,
        'producto_nombre': 'Hoodie Oversized Urban',
        'sku': 'URB-HOD-L-GRIS',
        'talla_id': 3,
        'talla': 'L',
        'color_id': 2,
        'color': 'Gris',
        'codigo_hex': '#888888',
        'precio_base': 220.0,
        'precio_adicional': 0.0,
        'precio_vigente': 220.0,
        'imagen_url': null,
        'activo': true,
      }
    ],
    'inventario': [
      {
        'id': 9501,
        'sucursal_id': 20,
        'variante_id': 8001,
        'cantidad_disponible': 15,
        'cantidad_reservada': 0,
        'cantidad_libre': 15,
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

  group('Fase 5 — Suite E2E Integral Desafío III (Offline Mobile + SQLite):', () {
    late OfflineRepository repo;

    setUp(() async {
      await LocalDatabase.instance.close();
      LocalDatabase.instance.configureForTesting(inMemoryDatabasePath);
      repo = OfflineRepository(localDb: LocalDatabase.instance);
    });

    tearDown(() async {
      await LocalDatabase.instance.close();
    });

    test('1. Aislamiento Multi-Tenant y Purga Automática en SQLite (Sección 6.1.3 & RNF02)', () async {
      // Iniciar sesión con Tenant A y guardar su paquete
      await repo.guardarSesionConAislamiento(
        usuarioId: 101,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-tenant-a',
        tenantId: 'tenant-aurora-0001',
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 10,
      );
      await repo.guardarPaqueteOffline(_crearPaqueteTenantA());

      // Registrar una venta en Tenant A
      await repo.registrarVentaOfflineContado(
        sucursalId: 10,
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 2)],
      );

      final catalogoA = await repo.consultarCatalogoConStockLocal();
      final ventasA = await repo.listarVentasLocales();
      final colaA = await repo.obtenerColaPendienteOrdenada();
      expect(catalogoA.length, 1);
      expect(catalogoA.first.sku, 'AUR-BLZ-M-NEGRO');
      expect(ventasA.length, 1);
      expect(colaA.length, 1);

      // Ahora cambia de usuario a Tenant B: la base de datos debe purgarse completamente
      await repo.guardarSesionConAislamiento(
        usuarioId: 202,
        email: 'cajero@urbanwear.bo',
        nombreCompleto: 'Carlos Cajero Urban',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-tenant-b',
        tenantId: 'tenant-urban-0002',
        tenantNombre: 'Urban Wear Ltda.',
        planNombre: 'Básico',
        sucursalAsignadaId: 20,
      );

      // Verificar que los datos de Tenant A desaparecieron en un 100%
      final ventasTrasCambio = await repo.listarVentasLocales();
      final colaTrasCambio = await repo.obtenerColaPendienteOrdenada();
      final catalogoTrasCambio = await repo.consultarCatalogoConStockLocal();
      expect(ventasTrasCambio, isEmpty, reason: 'Las ventas del tenant previo deben ser eliminadas por aislamiento');
      expect(colaTrasCambio, isEmpty, reason: 'La cola del tenant previo debe ser purgada');
      expect(catalogoTrasCambio, isEmpty, reason: 'El catálogo del tenant previo debe ser purgado');

      // Guardar el paquete de Tenant B y verificar que solo contiene sus datos
      await repo.guardarPaqueteOffline(_crearPaqueteTenantB());
      final catalogoB = await repo.consultarCatalogoConStockLocal();
      expect(catalogoB.length, 1);
      expect(catalogoB.first.sku, 'URB-HOD-L-GRIS');
      expect(catalogoB.first.productoNombre, 'Hoodie Oversized Urban');
    });

    test('2. Validación Estricta Regla 7.2 (Solo Efectivo Offline) y Control de Stock Libre', () async {
      await repo.guardarSesionConAislamiento(
        usuarioId: 101,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-tenant-a',
        tenantId: 'tenant-aurora-0001',
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 10,
      );
      await repo.guardarPaqueteOffline(_crearPaqueteTenantA());

      // 2.1 Intentar registrar con QR o Tarjeta debe lanzar OfflineDomainException (Regla 7.2)
      expect(
        () => repo.registrarVentaOfflineContado(
          sucursalId: 10,
          items: const [OfflineDraftItem(varianteId: 7001, cantidad: 1)],
          metodoPago: 'qr',
        ),
        throwsA(isA<OfflineDomainException>()),
      );

      expect(
        () => repo.registrarVentaOfflineContado(
          sucursalId: 10,
          items: const [OfflineDraftItem(varianteId: 7001, cantidad: 1)],
          metodoPago: 'tarjeta',
        ),
        throwsA(isA<OfflineDomainException>()),
      );

      // 2.2 Venta en efectivo válida de 3 unidades
      final venta1 = await repo.registrarVentaOfflineContado(
        sucursalId: 10,
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 3)],
        metodoPago: 'efectivo',
      );
      expect(venta1.total, 1350.0);

      // 2.3 Reserva offline de 2 unidades
      await repo.registrarReservaOffline(
        sucursalId: 10,
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 2)],
        clienteNombres: 'Mateo',
        clienteApellidos: 'Gutiérrez',
        clienteTelefono: '70899887',
        fechaReserva: '2026-11-20',
        horarioAtencion: '15:30',
      );

      // 2.4 Verificar cálculo de stock libre efectivo: 10 disponibles - 3 ventas - 2 reservas = 5 libres
      final cat = await repo.consultarCatalogoConStockLocal();
      final item = cat.first;
      expect(item.cantidadDisponibleServidor, 10);
      expect(item.comprometidoLocalVentas, 3);
      expect(item.comprometidoLocalReservas, 2);
      expect(item.stockLibreEfectivo, 5);

      // 2.5 Intentar vender 6 unidades cuando solo quedan 5 debe ser rechazado
      expect(
        () => repo.registrarVentaOfflineContado(
          sucursalId: 10,
          items: const [OfflineDraftItem(varianteId: 7001, cantidad: 6)],
        ),
        throwsA(isA<OfflineDomainException>()),
      );
    });

    test('3. Detección de Datos Desactualizados (Sección 6.2.6) e Idempotencia y Reintento Exponencial', () async {
      await repo.guardarSesionConAislamiento(
        usuarioId: 101,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-tenant-a',
        tenantId: 'tenant-aurora-0001',
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 10,
      );
      await repo.guardarPaqueteOffline(_crearPaqueteTenantA());

      // 3.1 Simular datos sincronizados hace 15 horas (> 12 h de umbral)
      final db = await LocalDatabase.instance.database;
      final hace15Horas = DateTime.now().toUtc().subtract(const Duration(hours: 15));
      await db.update(
        'local_sesion',
        {'ultima_sincronizacion': hace15Horas.toIso8601String()},
        where: 'id = 1',
      );

      final sesionStale = await repo.obtenerSesionActiva();
      expect(sesionStale, isNotNull);
      expect(sesionStale!.datosDesactualizados, isTrue);
      expect(sesionStale.horasDesdeUltimaSync, greaterThanOrEqualTo(14));

      // 3.2 Flujo E2E de Sincronización con Reintento y Conciliación
      int llamadasLote = 0;
      final Set<String> idsRecibidosServidor = {};

      final mockHttp = MockClient((http.Request req) async {
        if (req.url.path.endsWith('/health')) {
          return http.Response('{"status":"ok"}', 200);
        }
        if (req.url.path.endsWith('/sync/paquete-offline')) {
          return http.Response(jsonEncode(_crearPaqueteTenantA()), 200);
        }
        if (req.url.path.endsWith('/sync/lote')) {
          llamadasLote++;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          final ops = body['operaciones'] as List<dynamic>;

          for (final op in ops) {
            idsRecibidosServidor.add(op['operation_id'] as String);
          }

          // Simular fallo de red transitorio 503 en primer intento
          if (llamadasLote == 1) {
            return http.Response('{"detail":"Backend temporariamente sobrecargado"}', 503);
          }

          // En segundo intento confirmar VENTA y RESERVA
          final resultados = ops.map((op) {
            final opId = op['operation_id'] as String;
            final tipo = op['tipo'] as String;
            return {
              'operation_id': opId,
              'tipo': tipo,
              'estado': 'CONFIRMADA',
              'numero_comprobante': tipo == 'VENTA' ? 'POS-2026-E2E-001' : null,
              'codigo_reserva': tipo == 'RESERVA' ? 'RES-2026-E2E-002' : null,
              'motivo': null,
            };
          }).toList();

          return http.Response(
            jsonEncode({
              'procesadas': resultados.length,
              'confirmadas': resultados.length,
              'en_conflicto': 0,
              'rechazadas': 0,
              'idempotentes': 0,
              'resultados': resultados,
            }),
            200,
          );
        }
        return http.Response('{"status":"ok"}', 200);
      });

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

      // Registrar 1 venta y 1 reserva en SQLite
      final ventaCreada = await provider.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 2)],
      );
      final reservaCreada = await provider.registrarReserva(
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 1)],
        clienteNombres: 'Valeria',
        clienteApellidos: 'Suárez',
        fechaReserva: '2026-11-25',
        horarioAtencion: '17:00',
      );

      expect(provider.pendientesCount, 2);

      // Simular reconexión de red: auto-sync ejecuta reintento exponencial y consolida
      monitor.emitTestConnectivityState(true);
      final reporte = await provider.sincronizarAhora(automatica: true);

      expect(reporte.exitoComunicacion, isTrue);
      expect(llamadasLote, 2, reason: 'Debe haber reintentado tras el primer error 503');
      expect(idsRecibidosServidor.contains(ventaCreada.operationId), isTrue);
      expect(idsRecibidosServidor.contains(reservaCreada.operationId), isTrue);

      // Verificar que la cola se vació y las operaciones quedaron SINCRONIZADAS
      await provider.recargarEstadoLocal();
      expect(provider.pendientesCount, 0);
      expect(provider.sincronizadasCount, 2);
      expect(provider.conflictosCount, 0);

      final ventasFinales = await repo.listarVentasLocales();
      expect(ventasFinales.first.estadoSync, OfflineSyncStatus.sincronizada);
      expect(ventasFinales.first.numeroComprobante, 'POS-2026-E2E-001');

      final reservasFinales = await repo.listarReservasLocales();
      expect(reservasFinales.first.estadoSync, OfflineSyncStatus.sincronizada);
      expect(reservasFinales.first.codigoReserva, 'RES-2026-E2E-002');

      provider.dispose();
    });

    test('4. Resolución de Conflicto (RNF10) y Manejo de Suspensión SaaS (RN05 / RN08)', () async {
      await repo.guardarSesionConAislamiento(
        usuarioId: 101,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-tenant-a',
        tenantId: 'tenant-aurora-0001',
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 10,
      );
      await repo.guardarPaqueteOffline(_crearPaqueteTenantA());

      bool patchConflictoRecibido = false;

      final mockHttp = MockClient((http.Request req) async {
        if (req.url.path.endsWith('/health')) {
          return http.Response('{"status":"ok"}', 200);
        }
        if (req.url.path.endsWith('/sync/paquete-offline')) {
          return http.Response(jsonEncode(_crearPaqueteTenantA()), 200);
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
                  'motivo': 'Stock agotado en servidor por venta concurrente en web.',
                }
              ],
            }),
            200,
          );
        }
        if (req.url.path.contains('/resolver-conflicto') && req.method == 'PATCH') {
          patchConflictoRecibido = true;
          return http.Response('{"status":"ok"}', 200);
        }
        return http.Response('{"status":"ok"}', 200);
      });

      final monitor = ConnectivityMonitor(
        httpClient: mockHttp,
        healthUrl: 'http://test.local/health',
        enablePlatformStream: false,
      );
      final syncSvc = OfflineSyncService(
        repository: repo,
        httpClient: mockHttp,
        baseApiUrl: 'http://test.local/api/v1',
      );
      final provider = OfflineSyncProvider(
        repository: repo,
        connectivity: monitor,
        syncService: syncSvc,
      );

      await provider.alternarModoOfflineSimulado(true);
      await provider.inicializar();

      // Registrar venta offline
      final venta = await provider.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 4)],
      );

      // Conectar y sincronizar: el servidor responde EN_CONFLICTO
      monitor.emitTestConnectivityState(true);
      await provider.sincronizarAhora();

      await provider.recargarEstadoLocal();
      expect(provider.conflictosCount, 1);

      // El stock comprometido debe haberse liberado automáticamente al fallar
      final catTrasConflicto = await repo.consultarCatalogoConStockLocal();
      expect(catTrasConflicto.first.comprometidoLocalVentas, 0);

      // El operador descarta el conflicto tras revisarlo
      await provider.descartarConflicto(
        venta.operationId,
        nota: 'Prenda vendida en efectivo pero sustituida en mostrador.',
      );

      expect(patchConflictoRecibido, isTrue);
      await provider.recargarEstadoLocal();
      expect(provider.conflictosCount, 0);
      provider.dispose();

      // 4.2 Probar rechazo por suspensión de suscripción (RN05 / RN08)
      final mockHttpSaaSBloqueado = MockClient((http.Request req) async {
        if (req.url.path.endsWith('/health')) {
          return http.Response('{"status":"ok"}', 200);
        }
        if (req.url.path.endsWith('/sync/lote')) {
          return http.Response(
            jsonEncode({
              'detail': 'La empresa se encuentra suspendida. No se permiten sincronizaciones (RN05).'
            }),
            403,
          );
        }
        return http.Response('{"status":"ok"}', 200);
      });

      final monitorBloqueado = ConnectivityMonitor(
        httpClient: mockHttpSaaSBloqueado,
        healthUrl: 'http://test.local/health',
        enablePlatformStream: false,
      );
      final syncSvcBloqueado = OfflineSyncService(
        repository: repo,
        httpClient: mockHttpSaaSBloqueado,
        baseApiUrl: 'http://test.local/api/v1',
      );
      final providerBloqueado = OfflineSyncProvider(
        repository: repo,
        connectivity: monitorBloqueado,
        syncService: syncSvcBloqueado,
      );
      await providerBloqueado.alternarModoOfflineSimulado(true);
      await providerBloqueado.inicializar();

      // Registrar una venta offline (sin auto-sync concurrente)
      await providerBloqueado.registrarVentaContado(
        items: const [OfflineDraftItem(varianteId: 7001, cantidad: 1)],
      );
      await providerBloqueado.recargarEstadoLocal();
      expect(providerBloqueado.pendientesCount, 1);

      // Restaurar conectividad e invocar sync: debe capturar el error 403 y notificarlo en la UI
      monitorBloqueado.emitTestConnectivityState(true);
      final repSaaS = await providerBloqueado.sincronizarAhora();

      expect(repSaaS.exitoComunicacion, isFalse);
      expect(providerBloqueado.ultimoError, contains('suspendida'));
      expect(providerBloqueado.pendientesCount, 1, reason: 'La cola no debe borrarse al haber error SaaS');

      providerBloqueado.dispose();
    });
  });
}
