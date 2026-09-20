import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class TemporadasScreen extends StatefulWidget {
  const TemporadasScreen({super.key});

  @override
  _TemporadasScreenState createState() => _TemporadasScreenState();
}

class _TemporadasScreenState extends State<TemporadasScreen> with SingleTickerProviderStateMixin {
  final AdminService _adminService = AdminService();
  late TabController _tabController;
  
  bool _isLoading = true;
  List<dynamic> _temporadas = [];
  List<dynamic> _colecciones = [];
  List<dynamic> _productos = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) setState(() {});
    });
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    final temp = await _adminService.getTemporadas();
    final col = await _adminService.getColecciones();
    final prod = await _adminService.getProductos();

    setState(() {
      _temporadas = temp;
      _colecciones = col;
      _productos = prod;
      _isLoading = false;
    });
  }

  void _showTemporadaForm() {
    final nombreCtrl = TextEditingController();
    final tipoCtrl = TextEditingController(text: 'Primavera-Verano');
    DateTime? fechaInicio;
    DateTime? fechaFin;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1A1A1F),
              title: const Text('Nueva Temporada', style: TextStyle(color: Colors.white)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nombreCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Nombre (Ej: SS-2027)', labelStyle: TextStyle(color: Colors.grey)),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: tipoCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Tipo', labelStyle: TextStyle(color: Colors.grey)),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(fechaInicio == null ? 'Inicio: Seleccionar' : 'Inicio: ${fechaInicio!.toLocal().toString().split(' ')[0]}', style: const TextStyle(color: Colors.white70)),
                      IconButton(
                        icon: const Icon(Icons.calendar_today, color: Color(0xFFEAB308)),
                        onPressed: () async {
                          final date = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2000), lastDate: DateTime(2100));
                          if (date != null) setDialogState(() => fechaInicio = date);
                        },
                      )
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(fechaFin == null ? 'Fin: Seleccionar' : 'Fin: ${fechaFin!.toLocal().toString().split(' ')[0]}', style: const TextStyle(color: Colors.white70)),
                      IconButton(
                        icon: const Icon(Icons.calendar_today, color: Color(0xFFEAB308)),
                        onPressed: () async {
                          final date = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2000), lastDate: DateTime(2100));
                          if (date != null) setDialogState(() => fechaFin = date);
                        },
                      )
                    ],
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
                  onPressed: () async {
                    if (nombreCtrl.text.isEmpty || fechaInicio == null || fechaFin == null) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Todos los campos y fechas son obligatorios.')));
                      return;
                    }
                    Navigator.pop(context);
                    setState(() => _isLoading = true);
                    
                    final success = await _adminService.createTemporada({
                      'nombre': nombreCtrl.text.trim(),
                      'tipo': tipoCtrl.text.trim(),
                      'fecha_inicio': fechaInicio!.toIso8601String().split('T')[0],
                      'fecha_fin': fechaFin!.toIso8601String().split('T')[0],
                    });

                    if (success) {
                      _loadAllData();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Temporada creada exitosamente'), backgroundColor: Colors.green));
                    } else {
                      setState(() => _isLoading = false);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error. Verifica que la fecha fin no sea anterior a inicio (CU-08).'), backgroundColor: Colors.redAccent));
                    }
                  },
                  child: const Text('Guardar', style: TextStyle(color: Colors.black)),
                ),
              ],
            );
          }
        );
      }
    );
  }

  void _showColeccionForm() {
    if (_temporadas.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Debes crear al menos una Temporada primero.'), backgroundColor: Colors.orange));
      return;
    }

    final nombreCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    int? selectedTemporada = _temporadas.first['id'];

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1A1A1F),
              title: const Text('Nueva Colección', style: TextStyle(color: Colors.white)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nombreCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Nombre Colección', labelStyle: TextStyle(color: Colors.grey)),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: descCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Descripción', labelStyle: TextStyle(color: Colors.grey)),
                  ),
                  const SizedBox(height: 20),
                  DropdownButtonFormField<int>(
                    value: selectedTemporada,
                    dropdownColor: const Color(0xFF2A2A35),
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Temporada', labelStyle: TextStyle(color: Colors.grey)),
                    items: _temporadas.map<DropdownMenuItem<int>>((t) => DropdownMenuItem(value: t['id'], child: Text(t['nombre']))).toList(),
                    onChanged: (v) => setDialogState(() => selectedTemporada = v),
                  )
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
                  onPressed: () async {
                    if (nombreCtrl.text.isEmpty || selectedTemporada == null) return;

                    Navigator.pop(context);
                    setState(() => _isLoading = true);
                    
                    final success = await _adminService.createColeccion({
                      'nombre': nombreCtrl.text.trim(),
                      'descripcion': descCtrl.text.trim(),
                      'temporada_id': selectedTemporada,
                    });

                    if (success) {
                      _loadAllData();
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Colección creada. Ahora puedes asignarle prendas.'), backgroundColor: Colors.green));
                    } else {
                      setState(() => _isLoading = false);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al crear colección.'), backgroundColor: Colors.redAccent));
                    }
                  },
                  child: const Text('Guardar', style: TextStyle(color: Colors.black)),
                ),
              ],
            );
          }
        );
      }
    );
  }

  void _showAsignacionDialog(int coleccionId, String coleccionNombre) {
    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1A1A1F),
              title: Text('Asignar Prendas a $coleccionNombre', style: const TextStyle(color: Colors.white, fontSize: 16)),
              content: SizedBox(
                width: double.maxFinite,
                height: 400,
                child: _productos.isEmpty
                  ? const Center(child: Text('No hay productos en el catálogo', style: TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      itemCount: _productos.length,
                      itemBuilder: (context, index) {
                        final p = _productos[index];
                        // Verificamos si este producto pertenece a la colección actual
                        // Si p['coleccion'] es nulo, significa que no tiene coleccion.
                        // Si p['coleccion'] no es nulo, verificamos si su id coincide con la actual.
                        final belongsToCurrent = (p['coleccion'] != null && p['coleccion']['id'] == coleccionId);

                        return CheckboxListTile(
                          activeColor: const Color(0xFFEAB308),
                          checkColor: Colors.black,
                          title: Text(p['nombre'], style: const TextStyle(color: Colors.white, fontSize: 14)),
                          subtitle: Text(p['categoria'] != null ? p['categoria']['nombre'] : '', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                          value: belongsToCurrent,
                          onChanged: (bool? value) async {
                            if (value == null) return;
                            
                            // Guardamos localmente para refrescar la UI rápido
                            setDialogState(() {
                              if (value) {
                                p['coleccion'] = {'id': coleccionId}; // Asignado
                              } else {
                                p['coleccion'] = null; // Desasignado
                              }
                            });

                            // Actualizamos en backend en background
                            if (value) {
                              await _adminService.addProductoToColeccion(p['id'], coleccionId);
                            } else {
                              await _adminService.removeProductoFromColeccion(p['id']);
                            }
                          },
                        );
                      },
                    ),
              ),
              actions: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
                  onPressed: () {
                    Navigator.pop(context);
                    _loadAllData(); // Recargamos para estar sincronizados
                  },
                  child: const Text('Cerrar y Publicar', style: TextStyle(color: Colors.black)),
                ),
              ],
            );
          }
        );
      }
    );
  }

  void _confirmDelete(int id, bool isTemporada) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Eliminar', style: TextStyle(color: Colors.white)),
        content: const Text('¿Deseas eliminar este registro?', style: TextStyle(color: Colors.grey)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              final error = isTemporada ? await _adminService.deleteTemporada(id) : await _adminService.deleteColeccion(id);
              if (error == null) _loadAllData();
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
        title: const Text('Temporadas y Colecciones', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFEAB308),
          labelColor: const Color(0xFFEAB308),
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: 'Temporadas'),
            Tab(text: 'Colecciones'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTemporadasList(),
                _buildColeccionesList(),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEAB308),
        onPressed: () => _tabController.index == 0 ? _showTemporadaForm() : _showColeccionForm(),
        icon: const Icon(Icons.add, color: Colors.black),
        label: Text(_tabController.index == 0 ? 'Nueva Temporada' : 'Nueva Colección', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildTemporadasList() {
    if (_temporadas.isEmpty) return const Center(child: Text('No hay temporadas registradas.', style: TextStyle(color: Colors.grey)));
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _temporadas.length,
      itemBuilder: (context, index) {
        final item = _temporadas[index];
        return Card(
          color: const Color(0xFF1A1A1F),
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            title: Text(item['nombre'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            subtitle: Text('${item['fecha_inicio']} hasta ${item['fecha_fin']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _confirmDelete(item['id'], true)),
          ),
        );
      },
    );
  }

  Widget _buildColeccionesList() {
    if (_colecciones.isEmpty) return const Center(child: Text('No hay colecciones registradas.', style: TextStyle(color: Colors.grey)));
    
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _colecciones.length,
      itemBuilder: (context, index) {
        final item = _colecciones[index];
        return Card(
          color: const Color(0xFF1A1A1F),
          margin: const EdgeInsets.only(bottom: 12),
          child: Column(
            children: [
              ListTile(
                title: Text(item['nombre'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                subtitle: Text(item['descripcion'] ?? 'Colección de prendas', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _confirmDelete(item['id'], false)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2A2A35)),
                      icon: const Icon(Icons.checklist, color: Color(0xFFEAB308), size: 16),
                      label: const Text('Asignar Prendas', style: TextStyle(color: Colors.white, fontSize: 12)),
                      onPressed: () => _showAsignacionDialog(item['id'], item['nombre']),
                    )
                  ],
                ),
              )
            ],
          ),
        );
      },
    );
  }
}
