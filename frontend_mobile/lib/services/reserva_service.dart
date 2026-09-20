import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class ReservaService {
  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<Map<String, dynamic>?> crearReserva({
    required int sucursalId,
    required String fechaReserva,
    required String horarioAtencion,
    required List<Map<String, dynamic>> items,
  }) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/reservas/'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'sucursal_id': sucursalId,
          'fecha_reserva': fechaReserva,
          'horario_atencion': horarioAtencion,
          'items': items,
        })
      );
      if (response.statusCode == 201 || response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) {
      return null;
    }
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

  Future<bool> cancelarReserva(int reservaId) async {
    try {
      final token = await _getToken();
      final response = await http.patch(
        Uri.parse('${Constants.apiUrl}/reservas/$reservaId/cancelar'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      return response.statusCode == 200;
    } catch (_) { return false; }
  }

  Future<List<dynamic>> getReservasSucursal(int sucursalId) async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/reservas/sucursal/$sucursalId'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return [];
    } catch (_) { return []; }
  }

  Future<bool> prepararReserva(int reservaId) async {
    try {
      final token = await _getToken();
      final response = await http.patch(
        Uri.parse('${Constants.apiUrl}/reservas/$reservaId/preparar'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      return response.statusCode == 200;
    } catch (_) { return false; }
  }

  Future<bool> atenderReserva(int reservaId) async {
    try {
      final token = await _getToken();
      final response = await http.patch(
        Uri.parse('${Constants.apiUrl}/reservas/$reservaId/atender'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      return response.statusCode == 200;
    } catch (_) { return false; }
  }

  Future<Map<String, dynamic>?> checkinQR(String codigo) async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/reservas/qr/$codigo'),
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
