import 'package:flutter/material.dart';
import '../services/catalogo_service.dart';
import '../services/bolsa_service.dart';
import '../services/carrito_service.dart';
import 'ar_mirror_screen.dart';
import 'bolsa_pruebas_screen.dart';
import 'carrito_screen.dart';

class ProductoDetalleScreen extends StatefulWidget {
  final int productoId;
  const ProductoDetalleScreen({super.key, required this.productoId});

  @override
  _ProductoDetalleScreenState createState() => _ProductoDetalleScreenState();
}

class _ProductoDetalleScreenState extends State<ProductoDetalleScreen> {
  final CatalogoService _service = CatalogoService();
  bool _isLoading = true;
  Map<String, dynamic>? _producto;

  // Selecciones del usuario
  String? _selectedTalla;
  String? _selectedColorHex;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final data = await _service.getProductoDetalle(widget.productoId);
    setState(() {
      _producto = data;
      _isLoading = false;
    });
  }

  int? _getVarianteIdSeleccionada() {
    if (_producto == null || _selectedTalla == null || _selectedColorHex == null) return null;
    final variantes = _producto!['variantes'] as List<dynamic>? ?? [];
    for (var v in variantes) {
      if (v['talla']['nombre'] == _selectedTalla && v['color']['codigo_hex'] == _selectedColorHex) {
        return v['id'];
      }
    }
    return null;
  }

  void _verificarStock() async {
    final varId = _getVarianteIdSeleccionada();
    if (varId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor selecciona talla y color primero.')));
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1F),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return FutureBuilder<Map<String, dynamic>?>(
          future: _service.getStockVariante(varId),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 300,
                child: Center(child: CircularProgressIndicator(color: Color(0xFFEAB308))),
              );
            }

            final data = snapshot.data;
            if (data == null || data['stock_por_sucursal'] == null) {
              return const SizedBox(
                height: 300,
                child: Center(child: Text('Error al cargar inventario', style: TextStyle(color: Colors.white))),
              );
            }

            final sucursales = data['stock_por_sucursal'] as List<dynamic>;
            if (sucursales.isEmpty) {
              return const SizedBox(
                height: 300,
                child: Center(child: Text('Variante sin inventario en ninguna sucursal.', style: TextStyle(color: Colors.grey))),
              );
            }

            // Ordenar para mostrar las que tienen stock primero
            sucursales.sort((a, b) => (b['stock_libre'] as int).compareTo(a['stock_libre'] as int));

            return Container(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Disponibilidad por Sucursal', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.builder(
                      itemCount: sucursales.length,
                      itemBuilder: (context, index) {
                        final s = sucursales[index];
                        final libre = s['stock_libre'] as int;
                        final estado = s['estado'];
                        Color estadoColor = Colors.grey;
                        if (estado == 'disponible') estadoColor = Colors.green;
                        if (estado == 'ultimas_unidades') estadoColor = Colors.orange;
                        if (estado == 'agotado') estadoColor = Colors.red;

                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.store, color: Colors.white70),
                          title: Text(s['sucursal_nombre'], style: const TextStyle(color: Colors.white)),
                          subtitle: Text(estado.toString().toUpperCase(), style: TextStyle(color: estadoColor, fontSize: 10, fontWeight: FontWeight.bold)),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('$libre uds.', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                              const Text('Libres', style: TextStyle(color: Colors.grey, fontSize: 10)),
                            ],
                          ),
                        );
                      },
                    ),
                  )
                ],
              ),
            );
          },
        );
      },
    );
  }

  String? _getImagenMostrada() {
    if (_producto == null) return null;
    
    // Si hay un color seleccionado, intentar buscar si esa variante tiene imagen propia
    if (_selectedColorHex != null) {
      final variantes = _producto!['variantes'] as List<dynamic>? ?? [];
      for (var v in variantes) {
        if (v['color']['codigo_hex'] == _selectedColorHex && v['imagen_url'] != null && v['imagen_url'].toString().isNotEmpty) {
          return v['imagen_url'];
        }
      }
    }
    
    // Fallback a la imagen general del producto
    return _producto!['imagen_url'];
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0D0D10),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFEAB308))),
      );
    }

    if (_producto == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0D0D10),
        appBar: AppBar(title: const Text('Producto No Encontrado')),
        body: const Center(child: Text('Error al cargar detalle', style: TextStyle(color: Colors.white))),
      );
    }

    final variantes = _producto!['variantes'] as List<dynamic>? ?? [];
    
    // Extraer tallas y colores únicos de las variantes
    final tallas = variantes.map((v) => v['talla']['nombre']).toSet().toList();
    final colores = variantes.map((v) => v['color']['codigo_hex']).toSet().toList();
    
    final imagenMostrada = _getImagenMostrada();

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 400.0,
            floating: false,
            pinned: true,
            backgroundColor: const Color(0xFF1A1A1F),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined, color: Colors.white),
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const CarritoScreen()));
                },
              ),
              IconButton(
                icon: const Icon(Icons.shopping_bag_outlined, color: Colors.white),
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const BolsaPruebasScreen()));
                },
              ),
              if (true) // Botón AR siempre activo para el Espejo 2D
                Container(
                  margin: const EdgeInsets.all(8.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A1F).withOpacity(0.7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.view_in_ar, color: Color(0xFF8B5CF6)),
                    onPressed: () async {
                      final varId = _getVarianteIdSeleccionada();
                      if (varId == null) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor selecciona una talla y color para probar.')));
                        return;
                      }
                      // Registrar sesion AR
                      await _service.registerArSession(varId);
                      
                      // Inferir si es prenda inferior
                        final nombre = _producto!['nombre'].toString().toLowerCase();
                        final catNombre = _producto!['categoria'] != null ? _producto!['categoria']['nombre'].toString().toLowerCase() : '';
                        final esInferior = nombre.contains('pantal') || nombre.contains('short') || nombre.contains('falda') || nombre.contains('jean') || catNombre.contains('pantal') || catNombre.contains('short') || catNombre.contains('falda') || catNombre.contains('jean');
                        
                        String imgUrl = imagenMostrada ?? _producto!['imagen_url'];
                        
                        // Abrir espejo
                        if (mounted) {
                          Navigator.push(context, MaterialPageRoute(
                            builder: (context) => ARMirrorScreen(
                              superiorUrl: esInferior ? null : imgUrl,
                              inferiorUrl: esInferior ? imgUrl : null,
                            )
                          ));
                        }
                    },
                  ),
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: imagenMostrada != null
                  ? Image.network(
                      imagenMostrada, 
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Container(
                        color: const Color(0xFF2A2A35), 
                        child: const Icon(Icons.broken_image, size: 100, color: Colors.grey)
                      ),
                    )
                  : Container(color: const Color(0xFF2A2A35), child: const Icon(Icons.image, size: 100, color: Colors.grey)),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _producto!['categoria']?['nombre']?.toUpperCase() ?? 'CAT',
                        style: const TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                      ),
                      Text(
                        'Bs. ${_producto!['precio_base']}',
                        style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _producto!['nombre'] ?? '',
                    style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold, fontFamily: 'Serif'),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _producto!['descripcion'] ?? 'Sin descripción detallada.',
                    style: const TextStyle(color: Colors.grey, fontSize: 15, height: 1.5),
                  ),
                  const SizedBox(height: 32),
                  
                  // Tallas
                  const Text('1. Selecciona Talla', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    children: tallas.map((talla) {
                      final isSelected = _selectedTalla == talla;
                      return GestureDetector(
                        onTap: () => setState(() {
                          _selectedTalla = talla.toString();
                          _selectedColorHex = null; // Resetear color al cambiar talla
                        }),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFEAB308) : Colors.transparent,
                            border: Border.all(color: isSelected ? const Color(0xFFEAB308) : Colors.white24),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            talla.toString(), 
                            style: TextStyle(
                              color: isSelected ? Colors.black : Colors.white, 
                              fontWeight: FontWeight.bold
                            )
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  
                  const SizedBox(height: 32),
                  
                  // Colores
                  const Text('2. Selecciona Color', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    children: colores.map((hexStr) {
                      Color color = Colors.grey;
                      try {
                        String cleanHex = hexStr.toString().replaceAll('#', '');
                        if (cleanHex.length == 6) cleanHex = 'FF$cleanHex';
                        color = Color(int.parse(cleanHex, radix: 16));
                      } catch (_) {}
                      
                      // Verificar si esta combinación (Talla + Color) existe
                      bool exists = false;
                      if (_selectedTalla != null) {
                        exists = variantes.any((v) => v['talla']['nombre'] == _selectedTalla && v['color']['codigo_hex'] == hexStr);
                      } else {
                        exists = true; // Si no hay talla seleccionada, mostramos todos los colores
                      }

                      final isSelected = _selectedColorHex == hexStr;

                      return GestureDetector(
                        onTap: exists ? () => setState(() => _selectedColorHex = hexStr.toString()) : null,
                        child: Opacity(
                          opacity: exists ? 1.0 : 0.2,
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isSelected ? const Color(0xFFEAB308) : Colors.white38, 
                                width: isSelected ? 3 : 2
                              ),
                            ),
                            child: isSelected ? const Icon(Icons.check, color: Colors.white, size: 20) : null,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  
                  const SizedBox(height: 40),
                ],
              ),
            ),
          )
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFF1A1A1F),
          border: Border(top: BorderSide(color: Colors.white10)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.white38),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _verificarStock,
                icon: const Icon(Icons.location_on, color: Colors.white),
                label: const Text('Consultar Disponibilidad por Sucursal', style: TextStyle(color: Colors.white, fontSize: 14)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEAB308),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                ),
                onPressed: () async {
                  final varId = _getVarianteIdSeleccionada();
                  if (varId == null) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Selecciona una talla y color.')));
                    return;
                  }
                  final carrito = CarritoService();
                  final res = await carrito.agregarItem(varId, 1);
                  if (mounted) {
                    if (res != null && res['carrito_id'] != null) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Agregado al Carrito.')));
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al agregar al carrito. Verifica el stock.')));
                    }
                  }
                },
                icon: const Icon(Icons.shopping_cart, color: Colors.black),
                label: const Text('Agregar al Carrito', style: TextStyle(color: Colors.black, fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFEAB308)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                ),
                onPressed: () async {
                  final varId = _getVarianteIdSeleccionada();
                  if (varId == null) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Selecciona una talla y color.')));
                    return;
                  }
                  final bolsa = BolsaService();
                  await bolsa.addItem({
                    'variante_id': varId,
                    'cantidad': 1,
                    'nombre': _producto!['nombre'],
                    'imagen': _producto!['imagen_url']
                  });
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Agregado a la Bolsa de Pruebas.')));
                  }
                },
                icon: const Icon(Icons.shopping_bag, color: Color(0xFFEAB308)),
                label: const Text('Agregar a Bolsa de Pruebas', style: TextStyle(color: Color(0xFFEAB308), fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
