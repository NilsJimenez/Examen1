import 'package:flutter/material.dart';
import '../services/inventario_service.dart';

class InventarioScreen extends StatefulWidget {
  const InventarioScreen({super.key});

  @override
  _InventarioScreenState createState() => _InventarioScreenState();
}

class _InventarioScreenState extends State<InventarioScreen> with SingleTickerProviderStateMixin {
  final InventarioService _service = InventarioService();
  
  List<dynamic> _sucursales = [];
  int? _selectedSucursalId;
  
  bool _isLoading = true;
  Map<String, dynamic>? _inventarioData;
  List<dynamic> _movimientos = [];
  List<dynamic> _todasVariantes = [];

  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final sucursales = await _service.getSucursales();
    final variantes = await _service.searchVariantes();
    if (mounted) {
      setState(() {
        _sucursales = sucursales;
        _todasVariantes = variantes;
        if (_sucursales.isNotEmpty) {
          _selectedSucursalId = _sucursales[0]['id'];
        }
      });
      if (_selectedSucursalId != null) {
        await _loadSucursalData();
      } else {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _loadSucursalData() async {
    if (_selectedSucursalId == null) return;
    setState(() => _isLoading = true);
    
    final inv = await _service.getInventarioSucursal(_selectedSucursalId!);
    final movs = await _service.getMovimientos(_selectedSucursalId!);
    
    if (mounted) {
      setState(() {
        _inventarioData = inv;
        _movimientos = movs;
        _isLoading = false;
      });
    }
  }

  void _showNuevoMovimientoModal() {
    if (_selectedSucursalId == null) return;

    int? varId;
    String tipo = 'ingreso';
    final qtyController = TextEditingController();
    final obsController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1A1A1F),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 24, right: 24, top: 24
          ),
          child: StatefulBuilder(
            builder: (BuildContext context, StateSetter setModalState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Registrar Movimiento', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  
                  // Tipo de movimiento
                  DropdownButtonFormField<String>(
                    value: tipo,
                    dropdownColor: const Color(0xFF2A2A35),
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Tipo de Movimiento',
                      labelStyle: TextStyle(color: Colors.grey),
                      enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'ingreso', child: Text('Ingreso (+)')),
                      DropdownMenuItem(value: 'venta', child: Text('Venta (-)')),
                      DropdownMenuItem(value: 'devolucion', child: Text('Devolución (+)')),
                      DropdownMenuItem(value: 'ajuste', child: Text('Ajuste (+/-)')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => tipo = val);
                    },
                  ),
                  const SizedBox(height: 16),

                  // Variante
                  DropdownButtonFormField<int>(
                    value: varId,
                    dropdownColor: const Color(0xFF2A2A35),
                    style: const TextStyle(color: Colors.white),
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Prenda / Variante',
                      labelStyle: TextStyle(color: Colors.grey),
                      enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                    ),
                    items: _todasVariantes.map((v) {
                      final title = '${v['sku']} - ${v['producto_nombre']} (T: ${v['talla']['nombre']}, C: ${v['color']['codigo_hex']})';
                      return DropdownMenuItem<int>(
                        value: v['id'],
                        child: Text(title, overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setModalState(() => varId = val);
                    },
                  ),
                  const SizedBox(height: 16),

                  // Cantidad
                  TextField(
                    controller: qtyController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Cantidad',
                      labelStyle: TextStyle(color: Colors.grey),
                      enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Observaciones
                  TextField(
                    controller: obsController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Observaciones (Opcional)',
                      labelStyle: TextStyle(color: Colors.grey),
                      enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                    ),
                  ),
                  const SizedBox(height: 32),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEAB308),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: () async {
                        if (varId == null || qtyController.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Variante y cantidad son requeridos.')));
                          return;
                        }
                        final qty = int.tryParse(qtyController.text);
                        if (qty == null) return;

                        final success = await _service.registrarMovimiento(
                          varianteId: varId!,
                          sucursalId: _selectedSucursalId!,
                          tipoMovimiento: tipo,
                          cantidad: qty,
                          observaciones: obsController.text,
                        );

                        if (mounted) {
                          Navigator.pop(context); // Close modal
                          if (success) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Movimiento registrado con éxito.')));
                            _loadSucursalData(); // Reload
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error. Verifica el stock disponible para salidas.')));
                          }
                        }
                      },
                      child: const Text('Guardar Movimiento', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              );
            }
          ),
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Control de Inventario', style: TextStyle(color: Colors.white, fontFamily: 'Serif')),
        iconTheme: const IconThemeData(color: Colors.white),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFEAB308),
          labelColor: const Color(0xFFEAB308),
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(text: 'Existencias Físicas'),
            Tab(text: 'Kárdex (Historial)'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Header: Selector de sucursal
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF1A1A1F),
            child: Row(
              children: [
                const Icon(Icons.store, color: Colors.grey),
                const SizedBox(width: 16),
                Expanded(
                  child: DropdownButton<int>(
                    value: _selectedSucursalId,
                    isExpanded: true,
                    dropdownColor: const Color(0xFF2A2A35),
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    underline: const SizedBox(),
                    items: _sucursales.map((s) => DropdownMenuItem<int>(
                      value: s['id'],
                      child: Text(s['nombre']),
                    )).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() { _selectedSucursalId = val; });
                        _loadSucursalData();
                      }
                    },
                  ),
                ),
              ],
            ),
          ),

          // Body: Tabs
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildExistenciasTab(),
                      _buildKardexTab(),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNuevoMovimientoModal,
        backgroundColor: const Color(0xFF8B5CF6),
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Nuevo Movimiento', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildExistenciasTab() {
    if (_inventarioData == null || _inventarioData!['items'] == null) {
      return const Center(child: Text('Sin datos de inventario', style: TextStyle(color: Colors.grey)));
    }
    final items = _inventarioData!['items'] as List<dynamic>;
    if (items.isEmpty) {
      return const Center(child: Text('No hay existencias registradas', style: TextStyle(color: Colors.grey)));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (ctx, i) {
        final item = items[i];
        final sku = item['sku'];
        final prod = item['producto'];
        final talla = item['talla'];
        final color = item['color'];
        final disp = item['cantidad_disponible'];
        final res = item['cantidad_reservada'];
        final libre = disp - res;

        return Card(
          color: const Color(0xFF1A1A1F),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Colors.white10)),
          child: ListTile(
            title: Text('$prod', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            subtitle: Text('SKU: $sku\nTalla: $talla | Color: $color\nReservados: $res', style: const TextStyle(color: Colors.grey)),
            isThreeLine: true,
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('$libre', style: TextStyle(color: libre > 0 ? Colors.green : Colors.red, fontSize: 20, fontWeight: FontWeight.bold)),
                const Text('Libres', style: TextStyle(color: Colors.grey, fontSize: 10)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildKardexTab() {
    if (_movimientos.isEmpty) {
      return const Center(child: Text('No hay movimientos registrados', style: TextStyle(color: Colors.grey)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _movimientos.length,
      itemBuilder: (ctx, i) {
        final m = _movimientos[i];
        final tipo = m['tipo_movimiento'].toString().toUpperCase();
        final qty = m['cantidad'];
        final fecha = m['fecha_movimiento'].toString().split('T').first;
        final obs = m['observaciones'] ?? '';

        Color c = Colors.grey;
        if (tipo == 'INGRESO' || tipo == 'DEVOLUCION') c = Colors.green;
        if (tipo == 'VENTA' || tipo == 'AJUSTE') c = Colors.orange;

        return Card(
          color: const Color(0xFF1A1A1F),
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          child: ListTile(
            leading: Icon(Icons.compare_arrows, color: c),
            title: Text('$tipo | Cant: $qty', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            subtitle: Text('VarID: ${m['variante_id']} | Fecha: $fecha\n$obs', style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ),
        );
      },
    );
  }
}
