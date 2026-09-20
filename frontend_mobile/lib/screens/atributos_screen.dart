import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class AtributosScreen extends StatefulWidget {
  const AtributosScreen({super.key});

  @override
  _AtributosScreenState createState() => _AtributosScreenState();
}

class _AtributosScreenState extends State<AtributosScreen> with SingleTickerProviderStateMixin {
  final AdminService _adminService = AdminService();
  late TabController _tabController;
  
  bool _isLoading = true;
  List<dynamic> _categorias = [];
  List<dynamic> _tallas = [];
  List<dynamic> _colores = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) setState(() {});
    });
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    final cats = await _adminService.getCategorias();
    final tallas = await _adminService.getTallas();
    final colores = await _adminService.getColores();

    setState(() {
      _categorias = cats;
      _tallas = tallas;
      _colores = colores;
      _isLoading = false;
    });
  }

  void _showFormDialog({Map<String, dynamic>? item}) {
    final bool isEdit = item != null;
    final int index = _tabController.index;
    
    String title = '';
    if (index == 0) title = isEdit ? 'Editar Categoría' : 'Nueva Categoría';
    if (index == 1) title = isEdit ? 'Editar Talla' : 'Nueva Talla';
    if (index == 2) title = isEdit ? 'Editar Color' : 'Nuevo Color';

    final nombreCtrl = TextEditingController(text: isEdit ? item['nombre'] : '');
    final extraCtrl = TextEditingController(
      text: isEdit ? (index == 0 ? item['descripcion'] : index == 1 ? item['guia_medidas'] : item['codigo_hex']) : ''
    );

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          title: Text(title, style: const TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nombreCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Nombre', labelStyle: TextStyle(color: Colors.grey)),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: extraCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: index == 0 ? 'Descripción (Opcional)' : index == 1 ? 'Guía de Medidas (Opcional)' : 'Código Hexadecimal',
                  labelStyle: const TextStyle(color: Colors.grey)
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
              onPressed: () async {
                final nombre = nombreCtrl.text.trim();
                final extra = extraCtrl.text.trim();
                if (nombre.isEmpty) return;

                Navigator.pop(context);
                setState(() => _isLoading = true);

                bool success = false;
                try {
                  if (index == 0) {
                    final data = {'nombre': nombre, 'descripcion': extra.isNotEmpty ? extra : null};
                    success = isEdit ? await _adminService.updateCategoria(item['id'], data) : await _adminService.createCategoria(data);
                  } else if (index == 1) {
                    final data = {'nombre': nombre, 'guia_medidas': extra.isNotEmpty ? extra : null};
                    success = isEdit ? await _adminService.updateTalla(item['id'], data) : await _adminService.createTalla(data);
                  } else if (index == 2) {
                    if (extra.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Código Hex es requerido para Colores.')));
                      setState(() => _isLoading = false);
                      return;
                    }
                    final data = {'nombre': nombre, 'codigo_hex': extra};
                    success = isEdit ? await _adminService.updateColor(item['id'], data) : await _adminService.createColor(data);
                  }

                  if (success) {
                    _loadAllData();
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guardado exitosamente'), backgroundColor: Colors.green));
                  } else {
                    setState(() => _isLoading = false);
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al guardar. Verifica que el nombre no esté duplicado.'), backgroundColor: Colors.redAccent));
                  }
                } catch (e) {
                  setState(() => _isLoading = false);
                }
              },
              child: const Text('Guardar', style: TextStyle(color: Colors.black)),
            ),
          ],
        );
      }
    );
  }

  void _confirmDelete(int id, String nombre) {
    final int index = _tabController.index;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Eliminar', style: TextStyle(color: Colors.white)),
        content: Text('¿Deseas eliminar "$nombre"?\nEsta acción será rechazada si ya está asociado a un producto.', style: const TextStyle(color: Colors.grey)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);

              String? error;
              if (index == 0) error = await _adminService.deleteCategoria(id);
              if (index == 1) error = await _adminService.deleteTalla(id);
              if (index == 2) error = await _adminService.deleteColor(id);

              if (error == null) {
                _loadAllData();
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
        title: const Text('Atributos del Catálogo', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
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
            Tab(text: 'Categorías'),
            Tab(text: 'Tallas'),
            Tab(text: 'Colores'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : TabBarView(
              controller: _tabController,
              children: [
                _buildList(_categorias, 'descripcion'),
                _buildList(_tallas, 'guia_medidas'),
                _buildList(_colores, 'codigo_hex', isColor: true),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEAB308),
        onPressed: () => _showFormDialog(),
        icon: const Icon(Icons.add, color: Colors.black),
        label: Text('Nuevo(a) ${_tabController.index == 0 ? 'Categoría' : _tabController.index == 1 ? 'Talla' : 'Color'}', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildList(List<dynamic> items, String subtitleKey, {bool isColor = false}) {
    if (items.isEmpty) {
      return const Center(child: Text('No hay elementos registrados.', style: TextStyle(color: Colors.grey)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return Card(
          color: const Color(0xFF1A1A1F),
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: isColor 
              ? Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: Color(int.parse((item[subtitleKey] ?? '#000000').replaceAll('#', '0xFF'))),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24)
                  ),
                )
              : CircleAvatar(
                  backgroundColor: const Color(0xFF2A2A35),
                  child: Text(item['nombre'].substring(0, 1).toUpperCase(), style: const TextStyle(color: Colors.white)),
                ),
            title: Text(item['nombre'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            subtitle: Text(item[subtitleKey] ?? 'Sin detalles', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(icon: const Icon(Icons.edit, color: Color(0xFFEAB308)), onPressed: () => _showFormDialog(item: item)),
                IconButton(icon: const Icon(Icons.delete, color: Colors.redAccent), onPressed: () => _confirmDelete(item['id'], item['nombre'])),
              ],
            ),
          ),
        );
      },
    );
  }
}
