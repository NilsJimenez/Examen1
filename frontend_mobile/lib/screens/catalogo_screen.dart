import 'package:flutter/material.dart';
import '../services/catalogo_service.dart';
import 'producto_detalle_screen.dart';

class CatalogoScreen extends StatefulWidget {
  const CatalogoScreen({super.key});

  @override
  _CatalogoScreenState createState() => _CatalogoScreenState();
}

class _CatalogoScreenState extends State<CatalogoScreen> {
  final CatalogoService _service = CatalogoService();
  
  bool _isLoading = true;
  List<dynamic> _productos = [];
  List<dynamic> _categorias = [];
  
  // Filters
  String _searchQuery = '';
  int? _selectedCategoria;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final cats = await _service.getCategorias();
    final prods = await _service.getProductos(
      search: _searchQuery,
      categoriaId: _selectedCategoria,
    );
    setState(() {
      _categorias = cats;
      _productos = prods;
      _isLoading = false;
    });
  }

  void _onSearchChanged(String value) {
    _searchQuery = value;
    _loadData(); // Podría optimizarse con un debouncer
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        title: const Text('Catálogo Oficial', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list, color: Colors.white),
            onPressed: () {
              // Muestra modal de filtros avanzados (Talla, Color, Precio)
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Filtros avanzados en desarrollo')));
            },
          )
        ],
      ),
      body: Column(
        children: [
          // Buscador
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              onChanged: _onSearchChanged,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Buscar prendas, estilos...',
                hintStyle: const TextStyle(color: Colors.grey),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                filled: true,
                fillColor: const Color(0xFF1A1A1F),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          
          // Categorías Horizontales
          if (_categorias.isNotEmpty)
            SizedBox(
              height: 40,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _categorias.length + 1,
                itemBuilder: (context, index) {
                  final isAll = index == 0;
                  final isSelected = isAll ? _selectedCategoria == null : _selectedCategoria == _categorias[index - 1]['id'];
                  
                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedCategoria = isAll ? null : _categorias[index - 1]['id'];
                      });
                      _loadData();
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFEAB308) : const Color(0xFF1A1A1F),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: isSelected ? const Color(0xFFEAB308) : Colors.white24),
                      ),
                      child: Center(
                        child: Text(
                          isAll ? 'Todas' : _categorias[index - 1]['nombre'],
                          style: TextStyle(
                            color: isSelected ? Colors.black : Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          
          const SizedBox(height: 16),
          
          // Grid de Productos
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
                : _productos.isEmpty
                    ? const Center(child: Text('No se encontraron prendas.', style: TextStyle(color: Colors.grey)))
                    : GridView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.65,
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                        ),
                        itemCount: _productos.length,
                        itemBuilder: (context, index) {
                          final prod = _productos[index];
                          return GestureDetector(
                            onTap: () {
                              Navigator.push(context, MaterialPageRoute(builder: (context) => ProductoDetalleScreen(productoId: prod['id'])));
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFF1A1A1F),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: ClipRRect(
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                                      child: prod['imagen_url'] != null
                                          ? Image.network(prod['imagen_url'], fit: BoxFit.cover, width: double.infinity)
                                          : Container(color: const Color(0xFF2A2A35), child: const Icon(Icons.image, color: Colors.grey, size: 40)),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(12.0),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          prod['categoria']?['nombre']?.toUpperCase() ?? 'CAT',
                                          style: const TextStyle(color: Color(0xFFEAB308), fontSize: 10, fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          prod['nombre'] ?? 'Prenda',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          'Bs. ${prod['precio_base']}',
                                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                  )
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
