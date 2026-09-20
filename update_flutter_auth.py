import re

with open('frontend_mobile/lib/services/auth_service.dart', 'r', encoding='utf-8') as f:
    content = f.read()

new_methods = """
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    final response = await http.post(
      Uri.parse('${Constants.apiUrl}/auth/forgot-password'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    if (response.statusCode == 200) {
      return {'success': true, 'message': jsonDecode(response.body)['message']};
    } else {
      return {'success': false, 'message': jsonDecode(response.body)['detail'] ?? 'Error desconocido'};
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
      return {'success': false, 'message': jsonDecode(response.body)['detail'] ?? 'Código inválido'};
    }
  }

  Future<Map<String, dynamic>> resetPassword(String email, String code, String newPassword) async {
    final response = await http.post(
      Uri.parse('${Constants.apiUrl}/auth/reset-password'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({'email': email, 'code': code, 'new_password': newPassword}),
    );
    if (response.statusCode == 200) {
      return {'success': true, 'message': jsonDecode(response.body)['message']};
    } else {
      return {'success': false, 'message': jsonDecode(response.body)['detail'] ?? 'Error al restablecer'};
    }
  }

  Future<void> logout() async {
"""

content = content.replace("  Future<void> logout() async {", new_methods)

with open('frontend_mobile/lib/services/auth_service.dart', 'w', encoding='utf-8') as f:
    f.write(content)
