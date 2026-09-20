class User {
  final String email;
  final String rol;
  final String token;

  User({required this.email, required this.rol, required this.token});

  factory User.fromJson(Map<String, dynamic> json, String token) {
    return User(
      email: json['email'] ?? '',
      rol: json['rol'] ?? 'cliente',
      token: token,
    );
  }
}
