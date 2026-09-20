import 'package:flutter/material.dart';
import '../services/carrito_service.dart';
import 'checkout_screen.dart';

class CarritoScreen extends StatefulWidget {
  const CarritoScreen({super.key});

  @override
  State<CarritoScreen> createState() => _CarritoScreenState();
}

class _CarritoScreenState extends State<CarritoScreen> {
  final CarritoService _carritoService = CarritoService();
  Map<String, dynamic>? _carrito;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCarrito();
  }

  Future<void> _loadCarrito() async {
    setState(() => _isLoading = true);
    final data = await _carritoService.getCarrito();
    if (mounted) {
      setState(() {
        _carrito = data;
        _isLoading = false;
      });
    }
  }

  Future<void> _actualizarCantidad(int itemId, int cantidad) async {
    if (cantidad < 1) return;
    setState(() => _isLoading = true);
    final updated = await _carritoService.actualizarItem(itemId, cantidad);
    if (mounted) {
      if (updated != null) {
        setState(() => _carrito = updated);
      }
      setState(() => _isLoading = false);
    }
  }

  Future<void> _eliminarItem(int itemId) async {
    setState(() => _isLoading = true);
    final updated = await _carritoService.eliminarItem(itemId);
    if (mounted) {
      if (updated != null) {
        setState(() => _carrito = updated);
      }
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _carrito?['items'] as List<dynamic>? ?? [];
    final subtotal = _carrito?['subtotal'] ?? 0.0;

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Mi Carrito', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading && _carrito == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : items.isEmpty
              ? const Center(child: Text('Tu carrito está vacío.', style: TextStyle(color: Colors.grey, fontSize: 16)))
              : Column(
                  children: [
                    if (_isLoading)
                      const LinearProgressIndicator(color: Color(0xFFEAB308), backgroundColor: Colors.transparent),
                    Expanded(
                      child: ListView.builder(
                        itemCount: items.length,
                        itemBuilder: (context, index) {
                          final item = items[index];
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1A1A1F),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 60,
                                  height: 60,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2A2A35),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.image, color: Colors.grey),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item['producto_nombre'] ?? 'Producto', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                      Text('Talla: ${item['talla']} | Color: ${item['color']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                                      const SizedBox(height: 4),
                                      Text('Bs ${item['precio_unitario']}', style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ),
                                Column(
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                      onPressed: () => _eliminarItem(item['item_id']),
                                    ),
                                    Row(
                                      children: [
                                        InkWell(
                                          onTap: () => _actualizarCantidad(item['item_id'], item['cantidad'] - 1),
                                          child: Container(
                                            padding: const EdgeInsets.all(4),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF2A2A35),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Icon(Icons.remove, color: Colors.white, size: 16),
                                          ),
                                        ),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 8.0),
                                          child: Text('${item['cantidad']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                        ),
                                        InkWell(
                                          onTap: () => _actualizarCantidad(item['item_id'], item['cantidad'] + 1),
                                          child: Container(
                                            padding: const EdgeInsets.all(4),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF2A2A35),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Icon(Icons.add, color: Colors.white, size: 16),
                                          ),
                                        ),
                                      ],
                                    )
                                  ],
                                )
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1A1A1F),
                        borderRadius: BorderRadius.only(topLeft: Radius.circular(24), topRight: Radius.circular(24)),
                      ),
                      child: SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Subtotal', style: TextStyle(color: Colors.grey, fontSize: 16)),
                                Text('Bs $subtotal', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              height: 50,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFEAB308),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                                ),
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => CheckoutScreen(subtotal: subtotal.toDouble(), rol: 'cliente')),
                                  ).then((_) => _loadCarrito());
                                },
                                child: const Text('Proceder al Pago', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
