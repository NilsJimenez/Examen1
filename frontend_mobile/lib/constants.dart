import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class Constants {
  // IP local de tu computadora en la red Wi-Fi (obtenida automáticamente)
  static const String defaultHost = '192.168.100.92';
  static String? _configuredHost;

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _configuredHost = prefs.getString('api_server_host') ?? defaultHost;
    } catch (_) {
      _configuredHost = defaultHost;
    }
  }

  static Future<void> setHost(String host) async {
    final cleanHost = host.trim()
        .replaceAll('http://', '')
        .replaceAll('https://', '')
        .split('/')[0]
        .split(':')[0];
    _configuredHost = cleanHost;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('api_server_host', cleanHost);
    } catch (_) {}
  }

  static String get host => _configuredHost ?? defaultHost;

  static String get apiUrl {
    if (kIsWeb) {
      return 'http://localhost:8000/api/v1'; // Para navegador Chrome
    } else {
      return 'http://$host:8000/api/v1'; // Para celular físico en red local
    }
  }
}
