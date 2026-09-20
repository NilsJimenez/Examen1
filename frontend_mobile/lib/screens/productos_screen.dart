import 'package:flutter/material.dart';
import '../services/admin_service.dart';
import 'producto_form_screen.dart';

class ProductosScreen extends StatefulWidget {
  const ProductosScreen({super.key});

  @override
  _ProductosScreenState createState() => _ProductosScreenState();
}

class _ProductosScreenState extends State<ProductosScreen> {
  final AdminService _adminService = AdminService();
  List<dynamic> _productos = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final productos = await _adminService.getProductos();
    setState(() {
      _productos = productos;
      _isLoading = false;
    });
  }

  void _confirmDelete(int id, String nombre) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Desactivar Prenda', style: TextStyle(color: Colors.white)),
        content: Text('¿Deseas dar de baja "$nombre" del catálogo maestro?', style: const TextStyle(color: Colors.grey)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              final error = await _adminService.deleteProducto(id);
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
        title: const Text('Catálogo Global (Prendas)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : RefreshIndicator(
              color: const Color(0xFFEAB308),
              backgroundColor: const Color(0xFF1A1A1F),
              onRefresh: _loadData,
              child: _productos.isEmpty
                  ? ListView(children: const [SizedBox(height: 100), Center(child: Text('No hay prendas en el catálogo.', style: TextStyle(color: Colors.grey)))])
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _productos.length,
                      itemBuilder: (context, index) {
                        final p = _productos[index];
                        final isActive = p['activo'] == true;
                        
                        return Card(
                          color: const Color(0xFF1A1A1F),
                          margin: const EdgeInsets.only(bottom: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: Color(0xFF2A2A35), width: 1),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Imagen de la prenda
                              ClipRRect(
                                borderRadius: const BorderRadius.only(topLeft: Radius.circular(12), bottomLeft: Radius.circular(12)),
                                child: p['imagen_url'] != null && p['imagen_url'].toString().startsWith('http')
                                  ? Image.network(p['imagen_url'], width: 100, height: 120, fit: BoxFit.cover)
                                  : Container(width: 100, height: 120, color: const Color(0xFF2A2A35), child: const Icon(Icons.image_not_supported, color: Colors.grey)),
                              ),
                              // Detalles
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.all(12.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        p['nombre'] ?? 'Sin nombre',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                        maxLines: 1, overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        p['categoria'] != null ? p['categoria']['nombre'] : 'Sin Categoría',
                                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text('Bs. ${p['precio_base']}', style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, fontSize: 14)),
                                          if (p['modelo_ar_url'] != null && p['modelo_ar_url'].toString().isNotEmpty)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(color: const Color(0xFF8B5CF6), borderRadius: BorderRadius.circular(8)),
                                              child: const Text('AR 3D', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          if (isActive) ...[
                                            InkWell(
                                              onTap: () async {
                                                final result = await Navigator.push(context, MaterialPageRoute(builder: (context) => ProductoFormScreen(producto: p)));
                                                if (result == true) _loadData();
                                              },
                                              child: const Text('Editar', style: TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold)),
                                            ),
                                            const SizedBox(width: 16),
                                            InkWell(
                                              onTap: () => _confirmDelete(p['id'], p['nombre']),
                                              child: const Text('Dar de baja', style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                                            ),
                                          ] else
                                            const Text('Inactiva', style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold))
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFFEAB308),
        onPressed: () async {
          final result = await Navigator.push(context, MaterialPageRoute(builder: (context) => const ProductoFormScreen()));
          if (result == true) {
            _loadData();
          }
        },
        icon: const Icon(Icons.add, color: Colors.black),
        label: const Text('Nuevo Producto', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
