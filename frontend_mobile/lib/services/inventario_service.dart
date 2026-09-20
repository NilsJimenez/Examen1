import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'package:shared_preferences/shared_preferences.dart';

class InventarioService {
  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<List<dynamic>> getSucursales() async {
    try {
      final response = await http.get(Uri.parse('${Constants.apiUrl}/sucursales/'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return [];
    } catch (_) { return []; }
  }

  Future<Map<String, dynamic>?> getInventarioSucursal(int sucursalId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/inventario/sucursal/$sucursalId'),
        headers: headers
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<List<dynamic>> getMovimientos(int sucursalId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/inventario/movimientos?sucursal_id=$sucursalId'),
        headers: headers
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return [];
    } catch (_) { return []; }
  }

  Future<bool> registrarMovimiento({
    required int varianteId,
    required int sucursalId,
    required String tipoMovimiento,
    required int cantidad,
    String? observaciones,
  }) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/inventario/movimiento'),
        headers: headers,
        body: jsonEncode({
          'variante_id': varianteId,
          'sucursal_id': sucursalId,
          'tipo_movimiento': tipoMovimiento,
          'cantidad': cantidad,
          if (observaciones != null) 'observaciones': observaciones,
        })
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // Helper to fetch variants for the dropdown
  Future<List<dynamic>> searchVariantes() async {
    try {
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/'));
      if (response.statusCode == 200) {
        final List<dynamic> productos = jsonDecode(response.body);
        List<dynamic> allVariantes = [];
        for (var p in productos) {
          if (p['variantes'] != null) {
            for (var v in p['variantes']) {
              v['producto_nombre'] = p['nombre']; // inject to display
              allVariantes.add(v);
            }
          }
        }
        return allVariantes;
      }
      return [];
    } catch (_) { return []; }
  }
}
