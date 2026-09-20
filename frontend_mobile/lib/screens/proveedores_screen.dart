import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class ProveedoresScreen extends StatefulWidget {
  const ProveedoresScreen({super.key});

  @override
  _ProveedoresScreenState createState() => _ProveedoresScreenState();
}

class _ProveedoresScreenState extends State<ProveedoresScreen> {
  final AdminService _adminService = AdminService();
  bool _isLoading = true;
  List<dynamic> _proveedores = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final data = await _adminService.getProveedores();
    setState(() {
      _proveedores = data;
      _isLoading = false;
    });
  }

  void _showForm() {
    final razonSocialCtrl = TextEditingController();
    final nitCtrl = TextEditingController();
    final contactoCtrl = TextEditingController();
    final correoCtrl = TextEditingController();
    final telCtrl = TextEditingController();
    final direccionCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          title: const Text('Registrar Proveedor', style: TextStyle(color: Colors.white)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: razonSocialCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Razón Social / Empresa*', labelStyle: TextStyle(color: Colors.grey))),
                const SizedBox(height: 10),
                TextField(controller: nitCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'RUC/NIT', labelStyle: TextStyle(color: Colors.grey))),
                const SizedBox(height: 10),
                TextField(controller: contactoCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Contacto Principal', labelStyle: TextStyle(color: Colors.grey))),
                const SizedBox(height: 10),
                TextField(controller: correoCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Correo Electrónico*', labelStyle: TextStyle(color: Colors.grey))),
                const SizedBox(height: 10),
                TextField(controller: telCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Teléfono', labelStyle: TextStyle(color: Colors.grey))),
                const SizedBox(height: 10),
                TextField(controller: direccionCtrl, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Dirección', labelStyle: TextStyle(color: Colors.grey))),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
              onPressed: () async {
                if (razonSocialCtrl.text.isEmpty || correoCtrl.text.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Razón Social y Correo son obligatorios.')));
                  return;
                }

                Navigator.pop(context);
                setState(() => _isLoading = true);

                final error = await _adminService.createProveedor({
                  'nombre': razonSocialCtrl.text.trim(),
                  'ruc_nit': nitCtrl.text.trim().isNotEmpty ? nitCtrl.text.trim() : null,
                  'contacto_nombre': contactoCtrl.text.trim().isNotEmpty ? contactoCtrl.text.trim() : null,
                  'email': correoCtrl.text.trim(),
                  'telefono': telCtrl.text.trim().isNotEmpty ? telCtrl.text.trim() : null,
                  'direccion': direccionCtrl.text.trim().isNotEmpty ? direccionCtrl.text.trim() : null,
                });

                if (error == null) {
                  _loadData();
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Proveedor y cuenta generados exitosamente'), backgroundColor: Colors.green));
                } else {
                  setState(() => _isLoading = false);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error), backgroundColor: Colors.redAccent));
                }
              },
              child: const Text('Registrar', style: TextStyle(color: Colors.black)),
            ),
          ],
        );
      }
    );
  }

  void _confirmDelete(int id, String nombre) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Eliminar', style: TextStyle(color: Colors.white)),
        content: Text('¿Deseas dar de baja a $nombre?', style: const TextStyle(color: Colors.grey)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              final error = await _adminService.deleteProveedor(id);
              if (error == null) _loadData();
              else {
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
        title: const Text('Proveedores', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : _proveedores.isEmpty
              ? const Center(child: Text('No hay proveedores registrados.', style: TextStyle(color: Colors.grey)))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _proveedores.length,
                  itemBuilder: (context, index) {
                    final item = _proveedores[index];
                    return Card(
                      color: const Color(0xFF1A1A1F),
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: const CircleAvatar(
                          backgroundColor: Color(0xFF2A2A35),
                          child: Icon(Icons.local_shipping, color: Color(0xFFEAB308), size: 20),
                        ),
                        title: Text(item['nombre'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item['contacto_nombre'] ?? 'Sin contacto', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                            const SizedBox(height: 2),
                            Text('RUC/NIT: ${item['ruc_nit'] ?? 'N/A'} | Correo: ${item['email'] ?? 'N/A'}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                          ],
                        ),
                        isThreeLine: true,
                        trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _confirmDelete(item['id'], item['nombre'])),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEAB308),
        onPressed: _showForm,
        icon: const Icon(Icons.add, color: Colors.black),
        label: const Text('Registrar Proveedor', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
