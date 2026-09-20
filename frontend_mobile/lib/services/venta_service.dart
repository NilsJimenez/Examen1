import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class VentaService {
  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<List<dynamic>?> getMisCompras() async {
    try {
      final token = await _getToken();
      if (token == null) return null;
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/ventas/mis-compras'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> checkout(String metodoEntrega, String? direccionEnvio) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/ventas/checkout'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'metodo_entrega': metodoEntrega,
          if (direccionEnvio != null && direccionEnvio.isNotEmpty) 'direccion_envio': direccionEnvio,
        }),
      );
      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<Map<String, dynamic>?> pagarVenta(int ventaId, String metodoPago, double monto) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/ventas/pagar/$ventaId'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'metodo_pago': metodoPago,
          'monto': monto,
        }),
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<Map<String, dynamic>?> ventaPos({
    required int sucursalId,
    required String metodoPago,
    required List<Map<String, dynamic>> items,
    int? clienteId,
  }) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/ventas/pos'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'sucursal_id': sucursalId,
          'metodo_pago': metodoPago,
          'items': items,
          if (clienteId != null) 'cliente_id': clienteId,
        }),
      );
      if (response.statusCode == 201) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }
}
