import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';

class CatalogoService {
  Future<List<dynamic>> getProductos({
    int? categoriaId,
    int? tallaId,
    int? colorId,
    int? coleccionId,
    double? precioMin,
    double? precioMax,
    String? search,
  }) async {
    try {
      final uri = Uri.parse('${Constants.apiUrl}/productos/').replace(queryParameters: {
        if (categoriaId != null) 'categoria_id': categoriaId.toString(),
        if (tallaId != null) 'talla_id': tallaId.toString(),
        if (colorId != null) 'color_id': colorId.toString(),
        if (coleccionId != null) 'coleccion_id': coleccionId.toString(),
        if (precioMin != null) 'precio_min': precioMin.toString(),
        if (precioMax != null) 'precio_max': precioMax.toString(),
        if (search != null && search.isNotEmpty) 'search': search,
      });

      final response = await http.get(uri);
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>?> getProductoDetalle(int id) async {
    try {
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/$id'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<List<dynamic>> getCategorias() async {
    try {
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/meta/categorias'));
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (_) { return []; }
  }

  Future<Map<String, dynamic>?> getStockVariante(int varianteId) async {
    try {
      final response = await http.get(Uri.parse('${Constants.apiUrl}/inventario/stock/$varianteId'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (_) { return null; }
  }

  Future<bool> registerArSession(int varianteId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('jwt_token');
      
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/productos/vestidor-virtual/sesion'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'variante_id': varianteId,
          'dispositivo': 'Mobile App (Flutter)'
        })
      );
      return response.statusCode == 201;
    } catch (_) { return false; }
  }
}
