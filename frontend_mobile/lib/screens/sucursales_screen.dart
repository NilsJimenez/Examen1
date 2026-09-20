import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class SucursalesScreen extends StatefulWidget {
  const SucursalesScreen({super.key});

  @override
  _SucursalesScreenState createState() => _SucursalesScreenState();
}

class _SucursalesScreenState extends State<SucursalesScreen> {
  final AdminService _adminService = AdminService();
  List<dynamic> _sucursales = [];
  List<dynamic> _ciudades = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final sucs = await _adminService.getSucursales();
    final ciuds = await _adminService.getCiudades();
    setState(() {
      _sucursales = sucs;
      _ciudades = ciuds;
      _isLoading = false;
    });
  }

  void _showSucursalDialog() {
    final nombreController = TextEditingController();
    final direccionController = TextEditingController();
    final telefonoController = TextEditingController();
    final horariosController = TextEditingController(); // Solo interfaz
    int? selectedCiudadId = _ciudades.isNotEmpty ? _ciudades.first['id'] : null;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1A1A1F),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text(
                'Agregar Sucursal',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildTextField(nombreController, 'Nombre de Sucursal (Ej. Central)'),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<int>(
                      value: selectedCiudadId,
                      dropdownColor: const Color(0xFF2A2A35),
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Ciudad',
                        labelStyle: TextStyle(color: Colors.grey),
                        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                        focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFEAB308))),
                      ),
                      items: _ciudades.map<DropdownMenuItem<int>>((c) {
                        return DropdownMenuItem<int>(
                          value: c['id'],
                          child: Text('${c['nombre']} - ${c['pais']}'),
                        );
                      }).toList(),
                      onChanged: (val) => setStateDialog(() => selectedCiudadId = val),
                    ),
                    const SizedBox(height: 10),
                    _buildTextField(direccionController, 'Dirección completa'),
                    const SizedBox(height: 10),
                    _buildTextField(telefonoController, 'Teléfono de contacto', isPhone: true),
                    const SizedBox(height: 10),
                    _buildTextField(horariosController, 'Horarios (Ej. L-V 09:00 - 18:00)'),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
                  onPressed: () async {
                    if (nombreController.text.isEmpty || direccionController.text.isEmpty || selectedCiudadId == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Nombre y Dirección son obligatorios'), backgroundColor: Colors.redAccent),
                      );
                      return;
                    }

                    Navigator.pop(context);
                    setState(() => _isLoading = true);
                    
                    final data = {
                      'nombre': nombreController.text.trim(),
                      'ciudad_id': selectedCiudadId,
                      'direccion': direccionController.text.trim(),
                      'telefono': telefonoController.text.trim(),
                    };

                    final success = await _adminService.createSucursal(data);
                    
                    if (success) {
                      _loadData();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Sucursal registrada correctamente'), backgroundColor: Colors.green),
                      );
                    } else {
                      setState(() => _isLoading = false);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Error: La dirección o nombre ya existen o hay datos inválidos'), backgroundColor: Colors.redAccent),
                      );
                    }
                  },
                  child: const Text('Guardar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  void _showAddCiudadDialog() {
    final nombreController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Nueva Ciudad', style: TextStyle(color: Colors.white)),
        content: _buildTextField(nombreController, 'Nombre de la ciudad'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF8B5CF6)),
            onPressed: () async {
              if (nombreController.text.isEmpty) return;
              Navigator.pop(context);
              setState(() => _isLoading = true);
              final ok = await _adminService.createCiudad({'nombre': nombreController.text.trim()});
              if (ok) _loadData();
              else {
                setState(() => _isLoading = false);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al crear ciudad'), backgroundColor: Colors.red));
              }
            },
            child: const Text('Crear', style: TextStyle(color: Colors.white)),
          ),
        ],
      )
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, {bool isPhone = false}) {
    return TextField(
      controller: controller,
      keyboardType: isPhone ? TextInputType.phone : TextInputType.text,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.grey, fontSize: 13),
        enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
        focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFFEAB308))),
      ),
    );
  }

  void _confirmDelete(int id, String nombre) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Desactivar Sucursal', style: TextStyle(color: Colors.white)),
        content: Text('¿Estás seguro de que deseas desactivar $nombre?', style: const TextStyle(color: Colors.grey)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              final error = await _adminService.deleteSucursal(id);
              if (error == null) {
                _loadData();
              } else {
                setState(() => _isLoading = false);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error), backgroundColor: Colors.redAccent));
              }
            },
            child: const Text('Desactivar', style: TextStyle(color: Colors.white)),
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
        title: const Text('Gestión de Sucursales', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.location_city, color: Color(0xFF8B5CF6)),
            tooltip: 'Agregar Ciudad',
            onPressed: _showAddCiudadDialog,
          )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : RefreshIndicator(
              color: const Color(0xFFEAB308),
              backgroundColor: const Color(0xFF1A1A1F),
              onRefresh: _loadData,
              child: _sucursales.isEmpty
                  ? ListView(children: const [SizedBox(height: 100), Center(child: Text('No hay sucursales registradas.', style: TextStyle(color: Colors.grey)))])
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _sucursales.length,
                      itemBuilder: (context, index) {
                        final s = _sucursales[index];
                        final isActive = s['activo'] == true;
                        
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
                                        s['nombre'],
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
                                            isActive ? 'Operativa' : 'Cerrada',
                                            style: TextStyle(color: isActive ? Colors.green : Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                _buildInfoRow(Icons.location_on_outlined, '${s['direccion']} (${s['ciudad']?['nombre'] ?? ''})'),
                                const SizedBox(height: 6),
                                _buildInfoRow(Icons.phone_outlined, s['telefono'] ?? 'N/A'),
                                const SizedBox(height: 16),
                                const Divider(color: Color(0xFF2A2A35), height: 1),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    if (isActive)
                                      TextButton.icon(
                                        onPressed: () => _confirmDelete(s['id'], s['nombre']),
                                        icon: const Icon(Icons.block, color: Colors.redAccent, size: 18),
                                        label: const Text('Dar de baja', style: TextStyle(color: Colors.redAccent)),
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
        backgroundColor: const Color(0xFFEAB308),
        onPressed: _ciudades.isEmpty 
          ? () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Primero debes agregar una Ciudad (ícono de edificio arriba)'), backgroundColor: Colors.orange));
            }
          : _showSucursalDialog,
        icon: const Icon(Icons.add_business, color: Colors.black),
        label: const Text('Agregar Sucursal', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
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
