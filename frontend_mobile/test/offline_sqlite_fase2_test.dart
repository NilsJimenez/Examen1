import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:frontend_mobile/offline/local_database.dart';
import 'package:frontend_mobile/offline/offline_models.dart';
import 'package:frontend_mobile/offline/offline_repository.dart';

Map<String, dynamic> _crearPaqueteMock({
  required String tenantId,
  required String tenantNombre,
  required int sucursalId,
  required int productoId,
  required int varianteId,
  required String sku,
  required int stockDisponible,
  int stockReservado = 0,
}) {
  return {
    'tenant_id': tenantId,
    'tenant_nombre': tenantNombre,
    'plan_nombre': 'Profesional',
    'usuario_id': 10,
    'rol': 'cajero',
    'sucursal_asignada_id': sucursalId,
    'descargado_en': DateTime.now().toUtc().toIso8601String(),
    'umbral_horas_desactualizado': 12,
    'sucursales': [
      {
        'id': sucursalId,
        'tenant_id': tenantId,
        'nombre': 'Sucursal Centro $tenantNombre',
        'ciudad': 'Santa Cruz',
        'direccion': 'Av. Monseñor Rivero #200',
        'telefono': '70011223',
        'activo': true,
      }
    ],
    'categorias': [
      {'id': 1, 'nombre': 'Vestidos'},
    ],
    'productos': [
      {
        'id': productoId,
        'tenant_id': tenantId,
        'nombre': 'Vestido Gala Seda $tenantNombre',
        'descripcion': 'Prenda elegante de temporada',
        'categoria_id': 1,
        'categoria_nombre': 'Vestidos',
        'precio_base': 250.0,
        'imagen_url': null,
        'genero': 'Femenino',
        'activo': true,
      }
    ],
    'variantes': [
      {
        'id': varianteId,
        'producto_id': productoId,
        'producto_nombre': 'Vestido Gala Seda $tenantNombre',
        'sku': sku,
        'talla_id': 2,
        'talla': 'M',
        'color_id': 3,
        'color': 'Negro',
        'codigo_hex': '#111111',
        'precio_base': 250.0,
        'precio_adicional': 20.0,
        'precio_vigente': 270.0,
        'imagen_url': null,
        'activo': true,
      }
    ],
    'inventario': [
      {
        'id': 500 + sucursalId,
        'sucursal_id': sucursalId,
        'variante_id': varianteId,
        'cantidad_disponible': stockDisponible,
        'cantidad_reservada': stockReservado,
        'cantidad_libre': stockDisponible - stockReservado,
        'stock_minimo': 3,
      }
    ],
    'clientes': [
      {
        'id': 77,
        'tenant_id': tenantId,
        'nombres': 'Camila',
        'apellidos': 'Rojas',
        'email': 'camila@cliente.bo',
        'telefono': '71020304',
      }
    ],
  };
}

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late Directory tempDir;
  late String dbFilePath;
  late OfflineRepository repo;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('fashionstore_sqlite_test_');
    dbFilePath = p.join(tempDir.path, 'test_offline.db');
    await LocalDatabase.instance.close();
    LocalDatabase.instance.configureForTesting(dbFilePath);
    repo = OfflineRepository(localDb: LocalDatabase.instance);
  });

  tearDown(() async {
    await LocalDatabase.instance.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'Fase 2 completa: SQLite relacional, aislamiento multi-tenant, ventas efectivo, reservas, persistencia tras cierre y conciliación',
    () async {
      const tenantA = '11111111-1111-1111-1111-111111111111';
      const tenantB = '22222222-2222-2222-2222-222222222222';

      // 1. Iniciar sesión con Empresa A y guardar paquete offline
      final purgoInicial = await repo.guardarSesionConAislamiento(
        usuarioId: 10,
        email: 'cajero@aurora.bo',
        nombreCompleto: 'Lucía Cajera',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-token-aurora',
        tenantId: tenantA,
        tenantNombre: 'Boutique Aurora S.R.L.',
        planNombre: 'Profesional',
        sucursalAsignadaId: 1,
      );
      expect(purgoInicial, isFalse);

      await repo.guardarPaqueteOffline(
        _crearPaqueteMock(
          tenantId: tenantA,
          tenantNombre: 'Aurora',
          sucursalId: 1,
          productoId: 101,
          varianteId: 1001,
          sku: 'AUR-VES-M-NEG',
          stockDisponible: 10,
          stockReservado: 0,
        ),
      );

      // 2. Búsqueda rápida en catálogo SQLite por SKU, talla y color
      final porSku = await repo.consultarCatalogoConStockLocal(busqueda: 'AUR-VES');
      expect(porSku.length, 1);
      expect(porSku.first.stockLibreEfectivo, 10);
      expect(porSku.first.precioVigente, 270.0);

      final porTallaColor = await repo.consultarCatalogoConStockLocal(
        talla: 'M',
        color: 'Negro',
      );
      expect(porTallaColor.length, 1);

      // 3. Regla 7.2: Bloquear pagos digitales/QR en modo offline
      expect(
        () => repo.registrarVentaOfflineContado(
          metodoPago: 'qr',
          items: const [OfflineDraftItem(varianteId: 1001, cantidad: 1)],
        ),
        throwsA(isA<OfflineDomainException>()),
      );

      // 4. Registrar venta offline al contado en efectivo (3 unidades)
      final t1 = DateTime.utc(2026, 11, 7, 15, 0, 0);
      final ventaLocal = await repo.registrarVentaOfflineContado(
        metodoPago: 'efectivo',
        fechaLocalOverride: t1,
        items: const [OfflineDraftItem(varianteId: 1001, cantidad: 3)],
      );
      expect(ventaLocal.total, 810.0);
      expect(ventaLocal.estadoSync, OfflineSyncStatus.pendiente);

      final stockTrasVenta = await repo.consultarCatalogoConStockLocal();
      expect(stockTrasVenta.first.stockLibreEfectivo, 7);

      // Regla 7.1: No permitir vender más que el stock libre efectivo (quedan 7, pedir 8 falla)
      expect(
        () => repo.registrarVentaOfflineContado(
          metodoPago: 'efectivo',
          items: const [OfflineDraftItem(varianteId: 1001, cantidad: 8)],
        ),
        throwsA(isA<OfflineDomainException>()),
      );

      // 5. Registrar reserva offline con cliente nuevo capturado sin conexión (2 unidades)
      final t2 = DateTime.utc(2026, 11, 7, 15, 5, 0);
      final reservaLocal = await repo.registrarReservaOffline(
        clienteNombres: 'Mariana',
        clienteApellidos: 'Flores',
        clienteTelefono: '75544332',
        fechaReserva: '2026-11-08',
        horarioAtencion: '16:30:00',
        observaciones: 'Cliente pasará mañana por la tarde',
        fechaLocalOverride: t2,
        items: const [OfflineDraftItem(varianteId: 1001, cantidad: 2)],
      );
      expect(reservaLocal.estadoSync, OfflineSyncStatus.pendiente);

      final stockTrasReserva = await repo.consultarCatalogoConStockLocal();
      expect(stockTrasReserva.first.stockLibreEfectivo, 5);

      // 6. Simular cierre total de la app y reapertura desde el archivo físico SQLite
      await LocalDatabase.instance.close();
      final repoReabierto = OfflineRepository(localDb: LocalDatabase.instance);
      final sesionRecuperada = await repoReabierto.obtenerSesionActiva();
      expect(sesionRecuperada, isNotNull);
      expect(sesionRecuperada!.tenantId, tenantA);
      expect(sesionRecuperada.datosDesactualizados, isFalse);

      final colaPendiente = await repoReabierto.obtenerColaPendienteOrdenada();
      expect(colaPendiente.length, 2);
      expect(colaPendiente[0].tipo, 'VENTA');
      expect(colaPendiente[0].operationId, ventaLocal.operationId);
      expect(colaPendiente[1].tipo, 'RESERVA');
      expect(colaPendiente[1].operationId, reservaLocal.operationId);

      // 7. Conciliar respuesta de /api/v1/sync/lote: VENTA confirmada y RESERVA en conflicto
      await repoReabierto.aplicarResultadosSincronizacionLote([
        {
          'operation_id': ventaLocal.operationId,
          'estado': 'CONFIRMADA',
          'entidad_id': 901,
          'numero_comprobante': 'POS-TEST901',
          'total_confirmado': 810.0,
        },
        {
          'operation_id': reservaLocal.operationId,
          'estado': 'EN_CONFLICTO',
          'motivo': 'Stock insuficiente al sincronizar en servidor',
          'detalles_conflicto': [
            {'variante_id': 1001, 'solicitado': 2, 'disponible_real': 0}
          ],
        },
      ]);

      final contadores = await repoReabierto.obtenerContadoresCola();
      expect(contadores[OfflineSyncStatus.pendiente], 0);
      expect(contadores[OfflineSyncStatus.sincronizada], 1);
      expect(contadores[OfflineSyncStatus.enConflicto], 1);

      // Al rechazarse la reserva por conflicto, sus 2 unidades comprometidas localmente se liberan (10 - 3 = 7)
      final stockPostSync = await repoReabierto.consultarCatalogoConStockLocal();
      expect(stockPostSync.first.stockLibreEfectivo, 7);

      // 8. Sección 6.1.3: Iniciar sesión con Empresa B purga al 100% los datos de Empresa A
      final purgoCambioTenant = await repoReabierto.guardarSesionConAislamiento(
        usuarioId: 99,
        email: 'cajero@urbanwear.bo',
        nombreCompleto: 'Carlos Urban',
        rol: 'cajero',
        userType: 'usuario',
        tokenJwt: 'jwt-token-urban',
        tenantId: tenantB,
        tenantNombre: 'Urban Wear Ltda.',
        planNombre: 'Basico',
        sucursalAsignadaId: 2,
      );
      expect(purgoCambioTenant, isTrue);

      final ventasVisiblesB = await repoReabierto.listarVentasLocales();
      final colaVisibleB = await repoReabierto.obtenerHistorialColaLocal();
      final clientesVisiblesB = await repoReabierto.buscarClientesLocales();
      expect(ventasVisiblesB, isEmpty);
      expect(colaVisibleB, isEmpty);
      expect(clientesVisiblesB, isEmpty);
    },
  );
}
