with open('frontend_mobile/lib/services/auth_service.dart', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """  Future<bool> forgotPassword(String email) async {
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
  }"""

content = content.replace(old_block, "")

with open('frontend_mobile/lib/services/auth_service.dart', 'w', encoding='utf-8') as f:
    f.write(content)
