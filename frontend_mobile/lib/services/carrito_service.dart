import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class CarritoService {
  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<Map<String, dynamic>?> getCarrito() async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/carrito/'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<Map<String, dynamic>?> agregarItem(int varianteId, int cantidad) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/carrito/agregar'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'variante_id': varianteId,
          'cantidad': cantidad,
        }),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<Map<String, dynamic>?> actualizarItem(int itemId, int cantidad) async {
    try {
      final token = await _getToken();
      final response = await http.put(
        Uri.parse('${Constants.apiUrl}/carrito/item/$itemId'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'cantidad': cantidad}),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<Map<String, dynamic>?> eliminarItem(int itemId) async {
    try {
      final token = await _getToken();
      final response = await http.delete(
        Uri.parse('${Constants.apiUrl}/carrito/item/$itemId'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }
}
