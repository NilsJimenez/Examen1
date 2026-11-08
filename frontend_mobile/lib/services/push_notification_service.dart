import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../models/push_notification_model.dart';

class PushNotificationService {
  PushNotificationService._internal();
  static final PushNotificationService instance = PushNotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();

  Timer? _pollingTimer;
  bool _initialized = false;
  String _deviceId = '';

  // Clave global para mostrar banners in-app flotantes sobre cualquier pantalla
  final GlobalKey<ScaffoldMessengerState> messengerKey = GlobalKey<ScaffoldMessengerState>();

  // Notificadores reactivos para la UI (Bandeja y Badge de campana)
  final ValueNotifier<List<PushNotificationModel>> notificationsNotifier =
      ValueNotifier<List<PushNotificationModel>>([]);
  final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);

  // Callback opcional para disparar eventos en la UI
  void Function(PushNotificationModel)? onInAppNotificationReceived;

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
    await _loadSavedNotifications();

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
          debugPrint('[Push] Notificación tocada en bandeja del celular: ${response.payload}');
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

  Future<void> _loadSavedNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final String? raw = prefs.getString('push_notifications_history');
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(raw);
        final list = decoded.map((e) => PushNotificationModel.fromJson(e)).toList();
        notificationsNotifier.value = list;
        _updateUnreadCount();
      }
    } catch (e) {
      debugPrint('[Push] Error cargando historial local: $e');
    }
  }

  Future<void> _saveNotifications() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = notificationsNotifier.value.map((e) => e.toJson()).toList();
      await prefs.setString('push_notifications_history', jsonEncode(list));
    } catch (e) {
      debugPrint('[Push] Error guardando historial local: $e');
    }
  }

  void _updateUnreadCount() {
    unreadCountNotifier.value =
        notificationsNotifier.value.where((n) => !n.isRead).length;
  }

  void _startRealtimeListener() {
    _pollingTimer?.cancel();
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
          final String? referencia = item['referencia']?.toString();

          final notif = PushNotificationModel(
            id: id,
            title: titulo,
            body: cuerpo,
            category: categoria,
            targetRole: rol,
            reference: referencia,
            timestamp: DateTime.now(),
            isRead: false,
          );

          await _addNotification(notif);
        }
      }
    } catch (e) {
      // Silenciar errores de red temporales para no interrumpir el polling
    }
  }

  Future<void> _addNotification(PushNotificationModel notif) async {
    // 1. Agregar a la lista local (más reciente primero, máximo 60 en memoria)
    final actuales = List<PushNotificationModel>.from(notificationsNotifier.value);
    actuales.insert(0, notif);
    if (actuales.length > 60) {
      actuales.removeLast();
    }
    notificationsNotifier.value = actuales;
    _updateUnreadCount();
    await _saveNotifications();

    // 2. Disparar notificación nativa en la barra de estado del sistema operativo
    await showNativeOsNotification(
      id: notif.id,
      title: notif.title,
      body: notif.body,
      payload: notif.category,
    );

    // 3. Disparar banner flotante in-app si la app está en primer plano
    _showInAppBanner(notif);

    // 4. Invocar callback de escucha si existe
    onInAppNotificationReceived?.call(notif);
  }

  void _showInAppBanner(PushNotificationModel notif) {
    if (messengerKey.currentState == null) return;

    final IconData icon = _getCategoryIcon(notif.category);
    final Color catColor = _getCategoryColor(notif.category);

    messengerKey.currentState?.showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF1E1E24),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: catColor.withValues(alpha: 0.6), width: 1.2),
        ),
        duration: const Duration(seconds: 4),
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: catColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: catColor, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        notif.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          fontSize: 13,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: catColor.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          notif.category.toUpperCase(),
                          style: TextStyle(
                            color: catColor,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notif.body,
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String cat) {
    switch (cat.toLowerCase()) {
      case 'venta':
        return Icons.receipt_long;
      case 'reserva':
        return Icons.calendar_today;
      case 'stock':
        return Icons.warning_amber_rounded;
      case 'promo':
        return Icons.local_offer;
      case 'sync':
        return Icons.sync;
      case 'saas':
        return Icons.workspace_premium;
      default:
        return Icons.notifications;
    }
  }

  Color _getCategoryColor(String cat) {
    switch (cat.toLowerCase()) {
      case 'venta':
        return const Color(0xFF10B981); // Verde
      case 'reserva':
        return const Color(0xFF3B82F6); // Azul
      case 'stock':
        return const Color(0xFFEF4444); // Rojo
      case 'promo':
        return const Color(0xFFEAB308); // Amarillo/Oro
      case 'sync':
        return const Color(0xFFA855F7); // Púrpura
      case 'saas':
        return const Color(0xFFF97316); // Naranja
      default:
        return const Color(0xFFEAB308);
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

    try {
      await _notificationsPlugin.show(
        id,
        title,
        body,
        platformDetails,
        payload: payload,
      );
    } catch (e) {
      debugPrint('[Push] Aviso notificación nativa: $e');
    }
  }

  // =========================================================================
  // GESTIÓN DE ESTADO (BANDEJA DE ENTRADA)
  // =========================================================================

  Future<void> markAsRead(int id) async {
    final actuales = List<PushNotificationModel>.from(notificationsNotifier.value);
    for (final n in actuales) {
      if (n.id == id) {
        n.isRead = true;
        break;
      }
    }
    notificationsNotifier.value = actuales;
    _updateUnreadCount();
    await _saveNotifications();
  }

  Future<void> markAllAsRead() async {
    final actuales = List<PushNotificationModel>.from(notificationsNotifier.value);
    for (final n in actuales) {
      n.isRead = true;
    }
    notificationsNotifier.value = actuales;
    _updateUnreadCount();
    await _saveNotifications();
  }

  Future<void> clearAll() async {
    notificationsNotifier.value = [];
    unreadCountNotifier.value = 0;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('push_notifications_history');
  }
}
