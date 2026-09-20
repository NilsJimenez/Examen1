import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'auth_service.dart';

class AdminService {
  final AuthService _authService = AuthService();

  Future<Map<String, String>> _getHeaders() async {
    final token = await _authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<List<dynamic>> getRoles() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/admin/roles'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        print('Error obteniendo roles: ${response.statusCode} - ${response.body}');
        return [];
      }
    } catch (e) {
      print('Excepción obteniendo roles: $e');
      return [];
    }
  }

  Future<bool> createRole(String nombre) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/admin/roles'),
        headers: headers,
        body: jsonEncode({'nombre': nombre}),
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateRole(int id, String nombre) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('${Constants.apiUrl}/admin/roles/$id'),
        headers: headers,
        body: jsonEncode({'nombre': nombre}),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<String?> deleteRole(int id) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('${Constants.apiUrl}/admin/roles/$id'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return null;
      } else {
        final data = jsonDecode(response.body);
        return data['detail'] ?? 'Error al eliminar el rol';
      }
    } catch (e) {
      return 'Error de conexión';
    }
  }

  Future<List<dynamic>> getUsuarios() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/admin/usuarios'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createUsuario(Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/admin/usuarios'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateUsuario(int id, Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('${Constants.apiUrl}/admin/usuarios/$id'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<String?> deleteUsuario(int id) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('${Constants.apiUrl}/admin/usuarios/$id'),
        headers: headers,
      );
      if (response.statusCode == 200) return null;
      return jsonDecode(response.body)['detail'] ?? 'Error al eliminar';
    } catch (e) {
      return 'Error de conexión';
    }
  }

  // ================= CIUDADES Y SUCURSALES =================
  Future<List<dynamic>> getCiudades() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/admin/ciudades'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createCiudad(Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/admin/ciudades'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }

  Future<List<dynamic>> getSucursales() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/admin/sucursales'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createSucursal(Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/admin/sucursales'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }

  Future<String?> deleteSucursal(int id) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(Uri.parse('${Constants.apiUrl}/admin/sucursales/$id'), headers: headers);
      if (response.statusCode == 200) return null;
      return jsonDecode(response.body)['detail'] ?? 'Error al desactivar';
    } catch (e) {
      return 'Error de conexión';
    }
  }

  // ================= PRODUCTOS Y CATÁLOGO =================
  Future<List<dynamic>> getProductos() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<List<dynamic>> getCategorias() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/categorias'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createCategoria(Map<String, dynamic> data) async => await _postRequest('/admin/categorias', data);
  Future<bool> updateCategoria(int id, Map<String, dynamic> data) async => await _putRequest('/admin/categorias/$id', data);
  Future<String?> deleteCategoria(int id) async => await _deleteRequestWithDetail('/admin/categorias/$id');

  Future<List<dynamic>> getTallas() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/tallas'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createTalla(Map<String, dynamic> data) async => await _postRequest('/admin/tallas', data);
  Future<bool> updateTalla(int id, Map<String, dynamic> data) async => await _putRequest('/admin/tallas/$id', data);
  Future<String?> deleteTalla(int id) async => await _deleteRequestWithDetail('/admin/tallas/$id');

  Future<List<dynamic>> getColores() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/productos/colores'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createColor(Map<String, dynamic> data) async => await _postRequest('/admin/colores', data);
  Future<bool> updateColor(int id, Map<String, dynamic> data) async => await _putRequest('/admin/colores/$id', data);
  Future<String?> deleteColor(int id) async => await _deleteRequestWithDetail('/admin/colores/$id');

  // Helpers internos para reducir código
  Future<bool> _postRequest(String path, Map<String, dynamic> data) async {
    try {
      final response = await http.post(Uri.parse('${Constants.apiUrl}$path'), headers: await _getHeaders(), body: jsonEncode(data));
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (_) { return false; }
  }
  
  Future<String?> _postRequestWithDetail(String path, Map<String, dynamic> data) async {
    try {
      final response = await http.post(Uri.parse('${Constants.apiUrl}$path'), headers: await _getHeaders(), body: jsonEncode(data));
      if (response.statusCode == 200 || response.statusCode == 201) return null; // Exito
      return jsonDecode(response.body)['detail'] ?? 'Error de servidor';
    } catch (_) { return 'Error de conexión'; }
  }
  Future<bool> _putRequest(String path, Map<String, dynamic> data) async {
    try {
      final response = await http.put(Uri.parse('${Constants.apiUrl}$path'), headers: await _getHeaders(), body: jsonEncode(data));
      return response.statusCode == 200;
    } catch (_) { return false; }
  }
  Future<String?> _deleteRequestWithDetail(String path) async {
    try {
      final response = await http.delete(Uri.parse('${Constants.apiUrl}$path'), headers: await _getHeaders());
      if (response.statusCode == 200) return null;
      return jsonDecode(response.body)['detail'] ?? 'Error de servidor';
    } catch (_) { return 'Error de conexión'; }
  }

  Future<List<dynamic>> getProveedores() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/admin/proveedores'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<String?> createProveedor(Map<String, dynamic> data) async => await _postRequestWithDetail('/admin/proveedores', data);
  Future<String?> deleteProveedor(int id) async => await _deleteRequestWithDetail('/admin/proveedores/$id');

  Future<List<dynamic>> getTemporadas() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/admin/temporadas'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createTemporada(Map<String, dynamic> data) async => await _postRequest('/admin/temporadas', data);
  Future<String?> deleteTemporada(int id) async => await _deleteRequestWithDetail('/admin/temporadas/$id');

  Future<List<dynamic>> getColecciones() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('${Constants.apiUrl}/admin/colecciones'), headers: headers);
      if (response.statusCode == 200) return jsonDecode(response.body);
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createColeccion(Map<String, dynamic> data) async => await _postRequest('/admin/colecciones', data);
  Future<String?> deleteColeccion(int id) async => await _deleteRequestWithDetail('/admin/colecciones/$id');

  // Funciones específicas para colecciones
  Future<bool> addProductoToColeccion(int productoId, int coleccionId) async {
    return await updateProducto(productoId, {'coleccion_id': coleccionId});
  }
  Future<bool> removeProductoFromColeccion(int productoId) async {
    return await updateProducto(productoId, {'coleccion_id': null});
  }

  Future<bool> createProducto(Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/admin/productos'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateProducto(int id, Map<String, dynamic> data) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('${Constants.apiUrl}/admin/productos/$id'),
        headers: headers,
        body: jsonEncode(data),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<String?> deleteProducto(int id) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(Uri.parse('${Constants.apiUrl}/admin/productos/$id'), headers: headers);
      if (response.statusCode == 200) return null;
      return jsonDecode(response.body)['detail'] ?? 'Error al desactivar prenda';
    } catch (e) {
      return 'Error de conexión';
    }
  }
}
