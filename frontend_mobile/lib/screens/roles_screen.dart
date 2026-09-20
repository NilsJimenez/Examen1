import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key});

  @override
  _RolesScreenState createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  final AdminService _adminService = AdminService();
  List<dynamic> _roles = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRoles();
  }

  Future<void> _loadRoles() async {
    setState(() => _isLoading = true);
    final roles = await _adminService.getRoles();
    setState(() {
      _roles = roles;
      _isLoading = false;
    });
  }

  void _showRoleDialog({int? id, String? currentName}) {
    final controller = TextEditingController(text: currentName ?? '');
    final isEditing = id != null;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            isEditing ? 'Editar Rol' : 'Nuevo Rol',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          content: TextField(
            controller: controller,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'Nombre del Rol',
              labelStyle: const TextStyle(color: Colors.grey),
              enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
              focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF8B5CF6))),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () async {
                if (controller.text.trim().isEmpty) return;
                
                Navigator.pop(context); // Cerrar diálogo
                setState(() => _isLoading = true);
                
                bool success;
                if (isEditing) {
                  success = await _adminService.updateRole(id, controller.text.trim());
                } else {
                  success = await _adminService.createRole(controller.text.trim());
                }
                
                if (success) {
                  _loadRoles();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(isEditing ? 'Rol actualizado' : 'Rol creado'),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else {
                  setState(() => _isLoading = false);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Error al guardar el rol'),
                      backgroundColor: Colors.redAccent,
                    ),
                  );
                }
              },
              child: const Text('Guardar', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  void _confirmDelete(int id, String nombre) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Eliminar Rol', style: TextStyle(color: Colors.white)),
          content: Text(
            '¿Estás seguro que deseas eliminar el rol "$nombre"?\nNo podrás hacerlo si tiene usuarios asociados.',
            style: const TextStyle(color: Colors.grey),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () async {
                Navigator.pop(context);
                setState(() => _isLoading = true);
                
                final error = await _adminService.deleteRole(id);
                
                if (error == null) {
                  _loadRoles();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Rol eliminado'), backgroundColor: Colors.green),
                  );
                } else {
                  setState(() => _isLoading = false);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(error), backgroundColor: Colors.redAccent),
                  );
                }
              },
              child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        title: const Text('Gestión de Roles', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
              onRefresh: _loadRoles,
              child: _roles.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 100),
                        Center(
                          child: Text('No hay roles disponibles.', style: TextStyle(color: Colors.grey)),
                        )
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _roles.length,
                      itemBuilder: (context, index) {
                        final rol = _roles[index];
                        final isBasic = rol['nombre'].toLowerCase() == 'administrador' || 
                                        rol['nombre'].toLowerCase() == 'cliente';
                        
                        return Card(
                          color: const Color(0xFF1A1A1F),
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: const Color(0xFF2A2A35),
                              child: Icon(
                                Icons.admin_panel_settings,
                                color: isBasic ? Colors.amber : const Color(0xFFA78BFA),
                              ),
                            ),
                            title: Text(
                              rol['nombre'].toString().toUpperCase(),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                            subtitle: Text(
                              isBasic ? 'Rol de Sistema (Protegido)' : 'Rol Personalizado',
                              style: const TextStyle(color: Colors.grey, fontSize: 12),
                            ),
                            trailing: isBasic ? null : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.edit, color: Colors.grey, size: 20),
                                  onPressed: () => _showRoleDialog(id: rol['id'], currentName: rol['nombre']),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                  onPressed: () => _confirmDelete(rol['id'], rol['nombre']),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF8B5CF6),
        onPressed: () => _showRoleDialog(),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Rol', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
