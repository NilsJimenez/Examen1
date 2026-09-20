import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class UsuariosScreen extends StatefulWidget {
  const UsuariosScreen({super.key});

  @override
  _UsuariosScreenState createState() => _UsuariosScreenState();
}

class _UsuariosScreenState extends State<UsuariosScreen> {
  final AdminService _adminService = AdminService();
  List<dynamic> _usuarios = [];
  List<dynamic> _roles = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final usuarios = await _adminService.getUsuarios();
    final roles = await _adminService.getRoles();
    setState(() {
      _usuarios = usuarios;
      _roles = roles;
      _isLoading = false;
    });
  }

  void _showUserDialog({Map<String, dynamic>? usuario}) {
    final isEditing = usuario != null;
    final nombresController = TextEditingController(text: isEditing ? usuario['nombres'] : '');
    final apellidosController = TextEditingController(text: isEditing ? usuario['apellidos'] : '');
    final emailController = TextEditingController(text: isEditing ? usuario['email'] : '');
    final passwordController = TextEditingController(); // Siempre vacío por seguridad
    int? selectedRolId = isEditing ? usuario['rol_id'] : (_roles.isNotEmpty ? _roles.first['id'] : null);

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1A1A1F),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Text(
                isEditing ? 'Editar Cuenta' : 'Nueva Cuenta',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildTextField(nombresController, 'Nombres'),
                    const SizedBox(height: 10),
                    _buildTextField(apellidosController, 'Apellidos'),
                    const SizedBox(height: 10),
                    _buildTextField(emailController, 'Correo Electrónico', isEmail: true),
                    const SizedBox(height: 10),
                    _buildTextField(passwordController, isEditing ? 'Nueva Contraseña (Opcional)' : 'Contraseña', isPassword: true),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<int>(
                      value: selectedRolId,
                      dropdownColor: const Color(0xFF2A2A35),
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Rol',
                        labelStyle: TextStyle(color: Colors.grey),
                        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                        focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF8B5CF6))),
                      ),
                      items: _roles.map<DropdownMenuItem<int>>((rol) {
                        return DropdownMenuItem<int>(
                          value: rol['id'],
                          child: Text(rol['nombre'].toString().toUpperCase()),
                        );
                      }).toList(),
                      onChanged: (val) => setStateDialog(() => selectedRolId = val),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF8B5CF6)),
                  onPressed: () async {
                    if (nombresController.text.isEmpty || emailController.text.isEmpty || selectedRolId == null) return;
                    if (!isEditing && passwordController.text.isEmpty) return; // Pass obligatoria al crear

                    Navigator.pop(context);
                    setState(() => _isLoading = true);
                    
                    final data = {
                      'nombres': nombresController.text.trim(),
                      'apellidos': apellidosController.text.trim(),
                      'email': emailController.text.trim(),
                      'rol_id': selectedRolId,
                      if (passwordController.text.isNotEmpty) 'password': passwordController.text,
                    };

                    bool success;
                    if (isEditing) {
                      success = await _adminService.updateUsuario(usuario['id'], data);
                    } else {
                      success = await _adminService.createUsuario(data);
                    }
                    
                    if (success) {
                      _loadData();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(isEditing ? 'Cuenta actualizada' : 'Cuenta creada'), backgroundColor: Colors.green),
                      );
                    } else {
                      setState(() => _isLoading = false);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Error al guardar'), backgroundColor: Colors.redAccent),
                      );
                    }
                  },
                  child: const Text('Guardar', style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, {bool isPassword = false, bool isEmail = false}) {
    return TextField(
      controller: controller,
      obscureText: isPassword,
      keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.text,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.grey),
        enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
        focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF8B5CF6))),
      ),
    );
  }

  void _confirmDelete(int id, String nombre) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Eliminar Cuenta', style: TextStyle(color: Colors.white)),
        content: Text('¿Eliminar a $nombre?', style: const TextStyle(color: Colors.grey)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              final error = await _adminService.deleteUsuario(id);
              if (error == null) {
                _loadData();
              } else {
                setState(() => _isLoading = false);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error), backgroundColor: Colors.redAccent));
              }
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        title: const Text('Personal Interno de Tienda', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6)))
          : RefreshIndicator(
              color: const Color(0xFF8B5CF6),
              backgroundColor: const Color(0xFF1A1A1F),
              onRefresh: _loadData,
              child: _usuarios.isEmpty
                  ? ListView(children: const [SizedBox(height: 100), Center(child: Text('No hay cuentas registradas.', style: TextStyle(color: Colors.grey)))])
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _usuarios.length,
                      itemBuilder: (context, index) {
                        final u = _usuarios[index];
                        final rolNombre = u['rol'] is String ? u['rol'] : (u['rol']?['nombre'] ?? 'Sin rol');
                        final isActive = u['activo'] == true;
                        
                        return Card(
                          color: const Color(0xFF1A1A1F),
                          margin: const EdgeInsets.only(bottom: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: Color(0xFF2A2A35), width: 1),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${u['nombres']} ${u['apellidos']}',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: isActive ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(color: isActive ? Colors.green : Colors.red),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(isActive ? Icons.check : Icons.close, color: isActive ? Colors.green : Colors.red, size: 14),
                                          const SizedBox(width: 4),
                                          Text(
                                            isActive ? 'Activo' : 'Inactivo',
                                            style: TextStyle(color: isActive ? Colors.green : Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                _buildInfoRow(Icons.email_outlined, u['email'] ?? 'Sin correo'),
                                const SizedBox(height: 6),
                                _buildInfoRow(Icons.badge_outlined, rolNombre.toString().toUpperCase(), color: const Color(0xFFA78BFA)),
                                const SizedBox(height: 6),
                                _buildInfoRow(Icons.phone_outlined, u['telefono'] ?? 'N/A'),
                                const SizedBox(height: 16),
                                const Divider(color: Color(0xFF2A2A35), height: 1),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    TextButton.icon(
                                      onPressed: () => _showUserDialog(usuario: u),
                                      icon: const Icon(Icons.edit, color: Colors.grey, size: 18),
                                      label: const Text('Editar', style: TextStyle(color: Colors.grey)),
                                    ),
                                    TextButton.icon(
                                      onPressed: () => _confirmDelete(u['id'], u['nombres']),
                                      icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                      label: const Text('Eliminar', style: TextStyle(color: Colors.redAccent)),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEAB308), // Amarillo del botón web
        onPressed: () => _showUserDialog(),
        icon: const Icon(Icons.person_add, color: Colors.black),
        label: const Text('Registrar Empleado', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text, {Color color = Colors.grey}) {
    return Row(
      children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: TextStyle(color: color, fontSize: 13)),
        ),
      ],
    );
  }
}
