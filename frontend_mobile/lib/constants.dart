import 'package:flutter/foundation.dart';

class Constants {
  // kIsWeb detecta automáticamente si estamos en Chrome o en un Celular
  static String get apiUrl {
    if (kIsWeb) {
      return 'http://localhost:8000/api/v1'; // Para Chrome
    } else {
      return 'http://10.0.2.2:8000/api/v1'; // Para Emulador Android
    }
  }
}
