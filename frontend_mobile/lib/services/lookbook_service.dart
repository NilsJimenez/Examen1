import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class LookbookService {
  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<Map<String, dynamic>?> generarLookbook(Map<String, dynamic> payload) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/lookbook/generar'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (e) {
      print('Error al generar lookbook: $e');
      return null;
    }
  }

  Future<List<dynamic>> getSucursales() async {
    try {
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/sucursales/'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return [];
    } catch (e) {
      print('Error al cargar sucursales: $e');
      return [];
    }
  }
}
