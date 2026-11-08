import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import '../offline/offline_repository.dart';

class AuthService {
  static const String _tokenKey = 'jwt_token';
  static const String _roleKey = 'user_role';
  static const String _tenantIdKey = 'tenant_id';
  static const String _tenantNombreKey = 'tenant_nombre';
  static const String _sucursalIdKey = 'sucursal_id';
  static const String _userIdKey = 'user_id';
  static const String _planKey = 'plan_nombre';

  final OfflineRepository _offlineRepo;

  AuthService({OfflineRepository? offlineRepository})
      : _offlineRepo = offlineRepository ?? OfflineRepository();

  Future<bool> login(String email, String password) async {
    try {
      debugPrint('Enviando request a: ${Constants.apiUrl}/auth/login');
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

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = data['access_token'] as String;
        final role = (data['role'] as String?) ?? 'cliente';
        final userType = (data['user_type'] as String?) ?? 'usuario';
        final userId = (data['user_id'] as num?)?.toInt() ?? 0;
        final nombreCompleto = (data['nombre_completo'] as String?) ?? 'Usuario';
        final emailUser = (data['email'] as String?) ?? '';
        final tenantId = data['tenant_id'] as String?;
        final tenantNombre =
            (data['tenant_nombre'] as String?) ?? 'Empresa FashionStore';
        final sucursalId = (data['sucursal_id'] as num?)?.toInt();
        final planNombre = (data['plan'] as String?) ?? 'Basico';

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        await prefs.setString(_roleKey, role);
        await prefs.setInt(_userIdKey, userId);
        await prefs.setString('nombre_completo', nombreCompleto);
        await prefs.setString('user_email', emailUser);
        await prefs.setString(_planKey, planNombre);

        final effectiveTenantId = (tenantId != null && tenantId.isNotEmpty)
            ? tenantId
            : '96c58c4c-a866-424e-8412-c22f273738cd';
        final effectiveTenantNombre = (tenantNombre != null && tenantNombre.isNotEmpty)
            ? tenantNombre
            : 'Boutique Aurora S.R.L.';
        final effectivePlan = (planNombre != null && planNombre.isNotEmpty)
            ? planNombre
            : 'Pro Multi-Sucursal';

        await prefs.setString(_tenantIdKey, effectiveTenantId);
        await prefs.setString(_tenantNombreKey, effectiveTenantNombre);
        await prefs.setString(_planKey, effectivePlan);

        if (sucursalId != null) {
          await prefs.setInt(_sucursalIdKey, sucursalId);
        } else {
          await prefs.remove(_sucursalIdKey);
        }

        // Sección 6.1 (Desafío III): En entorno nativo móvil/desktop (no Web),
        // guardar sesión aislada en SQLite y descargar paquete offline del tenant.
        if (!kIsWeb) {
          await _prepararContextoOfflineInicial(
            token: token,
            usuarioId: userId,
            email: emailUser,
            nombreCompleto: nombreCompleto,
            rol: role,
            userType: userType,
            tenantId: effectiveTenantId,
            tenantNombre: effectiveTenantNombre,
            planNombre: effectivePlan,
            sucursalAsignadaId: sucursalId,
          );
        }

        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error en login: $e');
      return false;
    }
  }

  /// Guarda la sesión en SQLite limpiando cualquier otro tenant/usuario anterior
  /// y descarga el paquete offline inicial desde /api/v1/sync/paquete-offline.
  Future<void> _prepararContextoOfflineInicial({
    required String token,
    required int usuarioId,
    required String email,
    required String nombreCompleto,
    required String rol,
    required String userType,
    required String tenantId,
    required String tenantNombre,
    required String planNombre,
    int? sucursalAsignadaId,
  }) async {
    try {
      await _offlineRepo.guardarSesionConAislamiento(
        usuarioId: usuarioId,
        email: email,
        nombreCompleto: nombreCompleto,
        rol: rol,
        userType: userType,
        tokenJwt: token,
        tenantId: tenantId,
        tenantNombre: tenantNombre,
        planNombre: planNombre,
        sucursalAsignadaId: sucursalAsignadaId,
      );

      final responsePkg = await http.get(
        Uri.parse('${Constants.apiUrl}/sync/paquete-offline'),
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (responsePkg.statusCode == 200) {
        final paqueteJson =
            jsonDecode(responsePkg.body) as Map<String, dynamic>;
        await _offlineRepo.guardarPaqueteOffline(paqueteJson);
      }
    } catch (e) {
      debugPrint('Aviso al preparar paquete SQLite offline inicial: $e');
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
        return true;
      } else {
        debugPrint('Error de registro: ${response.body}');
        return false;
      }
    } catch (e) {
      debugPrint('Error Exception en registro: $e');
      return false;
    }
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final response = await http.post(
      Uri.parse('${Constants.apiUrl}/auth/forgot-password'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    if (response.statusCode == 200) {
      return {'success': true, 'message': jsonDecode(response.body)['message']};
    } else {
      return {
        'success': false,
        'message': jsonDecode(response.body)['detail'] ?? 'Error desconocido'
      };
    }
  }

  Future<Map<String, dynamic>> verifyCode(String email, String code) async {
    final response = await http.post(
      Uri.parse('${Constants.apiUrl}/auth/verify-code'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({'email': email, 'code': code}),
    );
    if (response.statusCode == 200) {
      return {'success': true, 'message': jsonDecode(response.body)['message']};
    } else {
      return {
        'success': false,
        'message': jsonDecode(response.body)['detail'] ?? 'Código inválido'
      };
    }
  }

  Future<Map<String, dynamic>> resetPassword(
      String email, String code, String newPassword) async {
    final response = await http.post(
      Uri.parse('${Constants.apiUrl}/auth/reset-password'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode(
          {'email': email, 'code': code, 'new_password': newPassword}),
    );
    if (response.statusCode == 200) {
      return {'success': true, 'message': jsonDecode(response.body)['message']};
    } else {
      return {
        'success': false,
        'message': jsonDecode(response.body)['detail'] ?? 'Error al restablecer'
      };
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_roleKey);
    await prefs.remove(_tenantIdKey);
    await prefs.remove(_tenantNombreKey);
    await prefs.remove(_sucursalIdKey);
  }

  Future<bool> checkSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    if (token == null) return false;

    try {
      final response = await http
          .get(
            Uri.parse('${Constants.apiUrl}/auth/me'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 401 || response.statusCode == 403) {
        await logout();
        return false;
      }
      if (response.statusCode == 200 && !kIsWeb) {
        try {
          final profileData = jsonDecode(response.body) as Map<String, dynamic>;
          final tenantId = profileData['tenant_id'] as String? ?? '96c58c4c-a866-424e-8412-c22f273738cd';
          final tenantNombre = profileData['tenant_nombre'] as String? ?? 'Boutique Aurora S.R.L.';
          final plan = profileData['plan'] as String? ?? 'Pro Multi-Sucursal';
          final role = (profileData['rol'] as String?) ?? prefs.getString(_roleKey) ?? 'cliente';
          final userType = (profileData['user_type'] as String?) ?? 'usuario';
          final userId = (profileData['id'] as num?)?.toInt() ?? prefs.getInt(_userIdKey) ?? 1;
          final nombre = (profileData['nombres'] != null)
              ? '${profileData['nombres']} ${profileData['apellidos'] ?? ''}'.trim()
              : (prefs.getString('nombre_completo') ?? 'Usuario');
          final email = profileData['email'] as String? ?? prefs.getString('user_email') ?? '';
          final sucursalId = (profileData['sucursal_id'] as num?)?.toInt() ?? prefs.getInt(_sucursalIdKey);

          await prefs.setString(_tenantIdKey, tenantId);
          await prefs.setString(_tenantNombreKey, tenantNombre);
          await prefs.setString(_planKey, plan);

          await _offlineRepo.guardarSesionConAislamiento(
            usuarioId: userId,
            email: email,
            nombreCompleto: nombre,
            rol: role,
            userType: userType,
            tokenJwt: token,
            tenantId: tenantId,
            tenantNombre: tenantNombre,
            planNombre: plan,
            sucursalAsignadaId: sucursalId,
          );
        } catch (_) {}
      }
      return true;
    } catch (_) {
      // Sin conexión: permitir continuidad con la sesión autenticada previa en SQLite / Prefs
      if (!kIsWeb) {
        final sesionLocal = await _offlineRepo.obtenerSesionActiva();
        if (sesionLocal != null && sesionLocal.tokenJwt.isNotEmpty) {
          return true;
        }
      }
      return true;
    }
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }
}
