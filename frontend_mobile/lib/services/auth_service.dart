import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../models/user.dart';

class AuthService {
  static const String _tokenKey = 'jwt_token';
  static const String _roleKey = 'user_role';

  Future<bool> login(String email, String password) async {
    try {
      print('Enviando request a: ${Constants.apiUrl}/auth/login');
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/auth/login'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      print('Status code: ${response.statusCode}');
      print('Body: ${response.body}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['access_token'];
        final role = data['role'] ?? 'cliente'; 
        final nombreCompleto = data['nombre_completo'] ?? 'Usuario';
        final emailUser = data['email'] ?? '';
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        await prefs.setString(_roleKey, role); 
        await prefs.setString('nombre_completo', nombreCompleto);
        await prefs.setString('user_email', emailUser);
        
        return true;
      }
      return false;
    } catch (e) {
      print('Error en login: $e');
      return false;
    }
  }

  Future<bool> registerCliente({
    required String nombres,
    required String apellidos,
    required String telefono,
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/auth/register-cliente'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'nombres': nombres,
          'apellidos': apellidos,
          'telefono': telefono,
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        return true; // Registro exitoso
      } else {
        print('Error de registro: ${response.body}');
        return false;
      }
    } catch (e) {
      print('Error Exception en registro: $e');
      return false;
    }
  }

  Future<bool> forgotPassword(String email) async {
    try {
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/auth/forgot-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> resetPassword(String email, String newPassword) async {
    try {
      final response = await http.post(
        Uri.parse('${Constants.apiUrl}/auth/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'new_password': newPassword,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_roleKey);
  }

  Future<void> _fetchAndSaveProfile(String token) async {
    try {
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/usuarios/me'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('nombre_completo', data['nombres'] ?? '');
        await prefs.setString(_roleKey, data['rol'] ?? 'cliente');
      }
    } catch (e) {
      print('Error al obtener perfil: $e');
    }
  }

  Future<bool> checkSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    if (token == null) return false;
    
    try {
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/usuarios/me'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 401) {
        await logout();
        return false;
      }
      return true;
    } catch (_) {
      // offline assumption
      return true;
    }
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

}
