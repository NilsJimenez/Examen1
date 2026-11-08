import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../offline/offline_models.dart';
import '../offline/offline_sync_provider.dart';
import '../services/catalogo_service.dart';
import '../services/reserva_service.dart';
import '../services/venta_service.dart';
import '../widgets/offline_status_banner.dart';
import 'offline/pos_offline_screen.dart';

class VentaPosScreen extends StatefulWidget {
  const VentaPosScreen({super.key});

  @override
  State<VentaPosScreen> createState() => _VentaPosScreenState();
}

class _VentaPosScreenState extends State<VentaPosScreen> {
  final CatalogoService _catalogoService = CatalogoService();
  final ReservaService _reservaService = ReservaService();
  final VentaService _ventaService = VentaService();

  List<dynamic> _sucursales = [];
  int? _sucursalId;

  List<dynamic> _productos = [];
  int? _productoId;
  List<dynamic> _variantes = [];
  Map<String, dynamic>? _selectedVariante;

  List<Map<String, dynamic>> _ticket = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final sucursales = await _reservaService.getSucursales();
    final productos = await _catalogoService.getProductos();
    
    if (mounted) {
      setState(() {
        _sucursales = sucursales;
        if (_sucursales.isNotEmpty) _sucursalId = _sucursales.first['id'];
        _productos = productos;
        _isLoading = false;
      });
    }
  }

  Future<void> _onProductoChanged(int pId) async {
    setState(() {
      _productoId = pId;
      _selectedVariante = null;
      _variantes = [];
    });
    final detail = await _catalogoService.getProductoDetalle(pId);
    if (mounted && detail != null) {
      setState(() {
        _variantes = detail['variantes'] ?? [];
      });
    }
  }

  void _agregarAlTicket() {
    if (_selectedVariante == null) return;
    
    final prod = _productos.firstWhere((p) => p['id'] == _productoId, orElse: () => null);
    if (prod == null) return;

    final basePrice = double.tryParse(prod['precio_base'].toString()) ?? 0.0;
    final addPrice = double.tryParse(_selectedVariante!['precio_adicional'].toString()) ?? 0.0;
    final unitPrice = basePrice + addPrice;

    final existingIdx = _ticket.indexWhere((i) => i['variante_id'] == _selectedVariante!['id']);
    if (existingIdx >= 0) {
      setState(() {
        _ticket[existingIdx]['cantidad'] += 1;
      });
    } else {
      setState(() {
        _ticket.add({
          'variante_id': _selectedVariante!['id'],
          'producto_nombre': prod['nombre'],
          'talla': _selectedVariante!['talla']['nombre'] ?? '',
          'color': _selectedVariante!['color']['nombre'] ?? '',
          'cantidad': 1,
          'precio_unitario': unitPrice,
        });
      });
    }
    setState(() {
      _productoId = null;
      _selectedVariante = null;
      _variantes = [];
    });
  }

  void _eliminarDelTicket(int index) {
    setState(() {
      _ticket.removeAt(index);
    });
  }

  double get _subtotal {
    return _ticket.fold(0.0, (sum, item) => sum + (item['precio_unitario'] * item['cantidad']));
  }

  Future<void> _cobrarTicket() async {
    if (_sucursalId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Selecciona una sucursal.')));
      return;
    }
    if (_ticket.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('El ticket está vacío.')));
      return;
    }

    // Modal de cobrar con bloqueo estricto de pagos digitales sin conexión (Sección 6.3 y Regla 7.2)
    final offlineProv = context.read<OfflineSyncProvider>();
    final enLinea = offlineProv.estaConectado;
    String metodoPago = 'efectivo';
    
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setStateSB) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1A1A1F),
              title: const Text('Cobrar Ticket', style: TextStyle(color: Colors.white)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Total a cobrar: Bs ${_subtotal.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFEAB308), fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  if (!enLinea)
                    Container(
                      padding: const EdgeInsets.all(10),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2B1D0E),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.45)),
                      ),
                      child: const Text(
                        'Modo Sin Conexión (Regla 7.2): Solo se permite Efectivo. Tarjeta y QR requieren confirmación bancaria en línea.',
                        style: TextStyle(color: Color(0xFFFDE68A), fontSize: 11.5),
                      ),
                    ),
                  RadioListTile<String>(
                    title: const Text('Efectivo', style: TextStyle(color: Colors.white)),
                    value: 'efectivo',
                    groupValue: metodoPago,
                    activeColor: const Color(0xFFEAB308),
                    onChanged: (val) => setStateSB(() => metodoPago = val!),
                  ),
                  RadioListTile<String>(
                    title: Text('Tarjeta de Crédito/Débito', style: TextStyle(color: enLinea ? Colors.white : Colors.white38)),
                    subtitle: enLinea ? null : const Text('Bloqueado sin conexión', style: TextStyle(color: Colors.redAccent, fontSize: 11)),
                    value: 'tarjeta',
                    groupValue: metodoPago,
                    activeColor: const Color(0xFFEAB308),
                    onChanged: enLinea ? (val) => setStateSB(() => metodoPago = val!) : null,
                  ),
                  RadioListTile<String>(
                    title: Text('QR Transferencia', style: TextStyle(color: enLinea ? Colors.white : Colors.white38)),
                    subtitle: enLinea ? null : const Text('Bloqueado sin conexión', style: TextStyle(color: Colors.redAccent, fontSize: 11)),
                    value: 'qr',
                    groupValue: metodoPago,
                    activeColor: const Color(0xFFEAB308),
                    onChanged: enLinea ? (val) => setStateSB(() => metodoPago = val!) : null,
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar', style: TextStyle(color: Colors.grey))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
                  onPressed: () => Navigator.pop(ctx, metodoPago),
                  child: const Text('Confirmar Pago', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          }
        );
      }
    );

    if (result != null) {
      setState(() => _isLoading = true);

      if (!enLinea) {
        try {
          final draftItems = _ticket
              .map((i) => OfflineDraftItem(
                    varianteId: i['variante_id'] as int,
                    cantidad: i['cantidad'] as int,
                    precioUnitario: (i['precio_unitario'] as num).toDouble(),
                  ))
              .toList();
          final ventaLocal = await offlineProv.registrarVentaContado(
            sucursalId: _sucursalId,
            items: draftItems,
          );
          if (!mounted) return;
          setState(() => _isLoading = false);
          _mostrarRecibo('LOCAL-${ventaLocal.localId.substring(0, 8)} (En cola SQLite)');
        } catch (e) {
          if (!mounted) return;
          setState(() => _isLoading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error offline: $e')),
          );
        }
        return;
      }

      final reqItems = _ticket.map((i) => {
        'variante_id': i['variante_id'],
        'cantidad': i['cantidad'],
        'precio_unitario': i['precio_unitario']
      }).toList();

      final res = await _ventaService.ventaPos(
        sucursalId: _sucursalId!,
        metodoPago: result,
        items: reqItems,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      if (res != null && res['numero_comprobante'] != null) {
        _mostrarRecibo(res['numero_comprobante']);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al procesar la venta. Verifique stock.')));
      }
    }
  }

  void _mostrarRecibo(String comprobante) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        title: const Text('Recibo Generado', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_outline, color: Colors.green, size: 60),
            const SizedBox(height: 16),
            Text('Comprobante: $comprobante', style: const TextStyle(color: Colors.black54, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            const Text('La venta presencial se registró correctamente y el inventario fue descontado.', textAlign: TextAlign.center),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.black),
              onPressed: () {
                Navigator.pop(ctx);
                setState(() {
                  _ticket.clear();
                });
              },
              child: const Text('Nueva Venta', style: TextStyle(color: Colors.white)),
            ),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Venta POS', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(),
          Consumer<OfflineSyncProvider>(
            builder: (context, prov, _) {
              if (prov.estaConectado) return const SizedBox.shrink();
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                color: const Color(0xFF1F1633),
                child: Row(
                  children: [
                    const Icon(Icons.storage_rounded, color: Color(0xFFEAB308), size: 16),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Sin internet: use el POS SQLite para buscar productos locales al instante.',
                        style: TextStyle(color: Colors.white70, fontSize: 11.5),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(builder: (_) => const PosOfflineScreen()),
                        );
                      },
                      child: const Text(
                        'Abrir POS Offline',
                        style: TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
                : Column(
                    children: [
              Container(
                padding: const EdgeInsets.all(16),
                color: const Color(0xFF1A1A1F),
                child: Column(
                  children: [
                    DropdownButtonFormField<int>(
                      value: _sucursalId,
                      dropdownColor: const Color(0xFF2A2A35),
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Sucursal',
                        labelStyle: const TextStyle(color: Colors.grey),
                        filled: true,
                        fillColor: const Color(0xFF2A2A35),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      ),
                      items: _sucursales.map<DropdownMenuItem<int>>((s) {
                        return DropdownMenuItem<int>(
                          value: s['id'],
                          child: Text(s['nombre']),
                        );
                      }).toList(),
                      onChanged: (val) => setState(() => _sucursalId = val),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      value: _productoId,
                      dropdownColor: const Color(0xFF2A2A35),
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Seleccionar Producto',
                        labelStyle: const TextStyle(color: Colors.grey),
                        filled: true,
                        fillColor: const Color(0xFF2A2A35),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      ),
                      items: _productos.map<DropdownMenuItem<int>>((p) {
                        return DropdownMenuItem<int>(
                          value: p['id'],
                          child: Text(p['nombre']),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) _onProductoChanged(val);
                      },
                    ),
                    if (_variantes.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<Map<String, dynamic>>(
                        value: _selectedVariante,
                        dropdownColor: const Color(0xFF2A2A35),
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: 'Seleccionar Talla/Color',
                          labelStyle: const TextStyle(color: Colors.grey),
                          filled: true,
                          fillColor: const Color(0xFF2A2A35),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                        ),
                        items: _variantes.map<DropdownMenuItem<Map<String, dynamic>>>((v) {
                          return DropdownMenuItem<Map<String, dynamic>>(
                            value: v,
                            child: Text('Talla: ${v['talla']['nombre']} - Color: ${v['color']['nombre']}'),
                          );
                        }).toList(),
                        onChanged: (val) => setState(() => _selectedVariante = val),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
                          onPressed: _agregarAlTicket,
                          icon: const Icon(Icons.add, color: Colors.black),
                          label: const Text('Agregar a Ticket', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                        ),
                      )
                    ]
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: _ticket.length,
                  itemBuilder: (context, index) {
                    final item = _ticket[index];
                    return ListTile(
                      title: Text('${item['producto_nombre']}', style: const TextStyle(color: Colors.white)),
                      subtitle: Text('Talla: ${item['talla']} - Color: ${item['color']} | Bs ${item['precio_unitario']}', style: const TextStyle(color: Colors.grey)),
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFF2A2A35),
                        child: Text('${item['cantidad']}', style: const TextStyle(color: Colors.white)),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red),
                        onPressed: () => _eliminarDelTicket(index),
                      ),
                    );
                  },
                ),
              ),
                    ],
                  ),
          ),
        ],
      ),
      bottomNavigationBar: _ticket.isEmpty
        ? null
        : Container(
            padding: const EdgeInsets.all(24),
            color: const Color(0xFF1A1A1F),
            child: SafeArea(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total a Cobrar', style: TextStyle(color: Colors.grey)),
                      Text('Bs ${_subtotal.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFEAB308), fontSize: 24, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEAB308),
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _cobrarTicket,
                    child: const Text('COBRAR', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ],
              ),
            ),
          ),
    );
  }
}
