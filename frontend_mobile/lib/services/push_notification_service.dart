import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class PushNotificationService {
  PushNotificationService._internal();
  static final PushNotificationService instance = PushNotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  Timer? _pollingTimer;
  bool _initialized = false;
  String _deviceId = '';

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'fashionstore_push_high',
    'FashionStore Notificaciones Push',
    description:
        'Notificaciones en tiempo real de reservas, compras, catálogo, stock y suscripciones SaaS',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
    showBadge: true,
  );

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    await _initDeviceId();

    if (!kIsWeb) {
      const AndroidInitializationSettings androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      const DarwinInitializationSettings iosSettings =
          DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const InitializationSettings initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _notificationsPlugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          debugPrint('Notificación tocada en bandeja del celular: ${response.payload}');
        },
      );

      final androidPlugin = _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(_channel);
        await androidPlugin.requestNotificationsPermission();
      }
    }

    // Iniciar escucha en tiempo real del backend cada 3 segundos
    _startRealtimeListener();
  }

  Future<void> _initDeviceId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      String? savedId = prefs.getString('push_device_id');
      if (savedId == null || savedId.isEmpty) {
        final rand = Random().nextInt(900000) + 100000;
        savedId = 'mobile_${DateTime.now().millisecondsSinceEpoch}_$rand';
        await prefs.setString('push_device_id', savedId);
      }
      _deviceId = savedId;
    } catch (_) {
      _deviceId = 'mobile_fallback_${Random().nextInt(99999)}';
    }
  }

  void _startRealtimeListener() {
    _pollingTimer?.cancel();
    // Primera consulta inmediata y luego cada 3 segundos
    _checkPendingNotifications();
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _checkPendingNotifications();
    });
  }

  Future<void> _checkPendingNotifications() async {
    if (_deviceId.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final rol = prefs.getString('user_role') ?? 'TODOS';
      final uri = Uri.parse(
        '${Constants.apiUrl}/notificaciones/pendientes?device_id=$_deviceId&rol=$rol',
      );
      final response = await http.get(uri).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        final List<dynamic> lista = data['notificaciones'] ?? [];
        for (final item in lista) {
          final int id = item['id'] is int
              ? item['id']
              : Random().nextInt(100000);
          final String titulo = item['titulo']?.toString() ?? 'FashionStore';
          final String cuerpo = item['cuerpo']?.toString() ?? '';
          final String categoria = item['categoria']?.toString() ?? 'general';

          await showNativeOsNotification(
            id: id,
            title: titulo,
            body: cuerpo,
            payload: categoria,
          );
        }
      }
    } catch (e) {
      // Silenciar errores de red temporales para no interrumpir el ciclo
    }
  }

  /// Dispara la notificación nativa en el panel general del sistema operativo del celular (estilo WhatsApp)
  Future<void> showNativeOsNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (kIsWeb) return;

    final AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      _channel.id,
      _channel.name,
      channelDescription: _channel.description,
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      ticker: 'FashionStore Notificación',
      styleInformation: BigTextStyleInformation(
        body,
        contentTitle: title,
        summaryText: 'FashionStore SaaS',
      ),
      category: AndroidNotificationCategory.message,
      visibility: NotificationVisibility.public,
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final NotificationDetails platformDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notificationsPlugin.show(
      id,
      title,
      body,
      platformDetails,
      payload: payload,
    );
  }
}
