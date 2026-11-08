import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:frontend_mobile/models/push_notification_model.dart';
import 'package:frontend_mobile/services/push_notification_service.dart';
import 'package:frontend_mobile/screens/notificaciones_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Push Notifications & Mobile Inbox Tests', () {
    test('1. Serialización y deserialización de PushNotificationModel', () {
      final now = DateTime.now();
      final model = PushNotificationModel(
        id: 101,
        title: '¡Nueva Oferta en Vestidos!',
        body: '30% de descuento en colección primavera.',
        category: 'promo',
        targetRole: 'CLIENTE',
        reference: 'promo_101',
        timestamp: now,
        isRead: false,
      );

      final json = model.toJson();
      expect(json['id'], 101);
      expect(json['title'], '¡Nueva Oferta en Vestidos!');
      expect(json['category'], 'promo');
      expect(json['isRead'], false);

      final decoded = PushNotificationModel.fromJson(json);
      expect(decoded.id, 101);
      expect(decoded.title, model.title);
      expect(decoded.body, model.body);
      expect(decoded.category, 'promo');
      expect(decoded.targetRole, 'CLIENTE');
      expect(decoded.isRead, false);
    });

    test('2. Gestión de estado reactivo y conteo de no leídas', () async {
      final service = PushNotificationService.instance;
      await service.clearAll();

      expect(service.notificationsNotifier.value.length, 0);
      expect(service.unreadCountNotifier.value, 0);

      // Simular llegada de 3 notificaciones de diferentes apartados
      final notif1 = PushNotificationModel(
        id: 1,
        title: 'Nueva Venta POS',
        body: 'Venta presencial de Bs. 350 registrada en Calacoto.',
        category: 'venta',
        timestamp: DateTime.now(),
      );

      final notif2 = PushNotificationModel(
        id: 2,
        title: 'Prendas Listas en Vestidor VIP',
        body: 'Tu reserva #RES-442 está lista para prueba.',
        category: 'reserva',
        timestamp: DateTime.now(),
      );

      final notif3 = PushNotificationModel(
        id: 3,
        title: 'Alerta de Stock Mínimo',
        body: 'Blazer Ejecutivo Hombre cuenta con solo 2 unidades.',
        category: 'stock',
        timestamp: DateTime.now(),
      );

      final list = [notif1, notif2, notif3];
      service.notificationsNotifier.value = list;
      service.unreadCountNotifier.value = 3;

      expect(service.unreadCountNotifier.value, 3);

      // Marcar una como leída
      await service.markAsRead(2);
      expect(notif2.isRead, true);
      expect(service.unreadCountNotifier.value, 2);

      // Marcar todas como leídas
      await service.markAllAsRead();
      expect(service.unreadCountNotifier.value, 0);
      expect(service.notificationsNotifier.value.every((n) => n.isRead), true);

      // Limpiar historial
      await service.clearAll();
      expect(service.notificationsNotifier.value.length, 0);
      expect(service.unreadCountNotifier.value, 0);
    });

    test('3. Categorías soportadas cubren todos los apartados requeridos', () {
      final categorias = ['venta', 'reserva', 'stock', 'promo', 'sync', 'saas', 'general'];
      for (final cat in categorias) {
        final m = PushNotificationModel(
          id: 50,
          title: 'Aviso $cat',
          body: 'Detalle de prueba para $cat',
          category: cat,
          timestamp: DateTime.now(),
        );
        expect(m.category, cat);
      }
    });

    testWidgets('4. Renderizado visual de NotificacionesScreen idéntico al diseño', (tester) async {
      final service = PushNotificationService.instance;
      service.notificationsNotifier.value = [
        PushNotificationModel(
          id: 1,
          title: 'Última oportunidad para postularte',
          body: 'Desarrollador React en Pampa Software (100% de afinidad) recibe postulaciones hasta hoy a las 22:59.',
          category: 'promo',
          timestamp: DateTime(2026, 11, 6, 3, 4),
          isRead: false,
        ),
        PushNotificationModel(
          id: 2,
          title: 'Prenda lista en vestidor',
          body: 'Tu reserva en sucursal Central ya está lista.',
          category: 'reserva',
          timestamp: DateTime(2026, 11, 3, 3, 4),
          isRead: true,
        ),
      ];
      service.unreadCountNotifier.value = 1;

      await tester.pumpWidget(
        const MaterialApp(
          home: NotificacionesScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Verificar Título Notificaciones
      expect(find.text('Notificaciones'), findsOneWidget);

      // Verificar Pills de Filtro "Todas (2)" y "No leídas (1)"
      expect(find.text('Todas (2)'), findsOneWidget);
      expect(find.text('No leídas (1)'), findsOneWidget);

      // Verificar items en pantalla
      expect(find.text('Última oportunidad para postularte'), findsOneWidget);
      expect(find.text('Prenda lista en vestidor'), findsOneWidget);

      // Verificar formato de fecha dd/MM/yyyy HH:mm
      expect(find.text('06/11/2026 03:04'), findsOneWidget);
      expect(find.text('03/11/2026 03:04'), findsOneWidget);

      // Tocar en "No leídas (1)" para filtrar
      await tester.tap(find.text('No leídas (1)'));
      await tester.pumpAndSettle();

      // Debe mostrar solo la no leída
      expect(find.text('Última oportunidad para postularte'), findsOneWidget);
      expect(find.text('Prenda lista en vestidor'), findsNothing);
    });
  });
}
