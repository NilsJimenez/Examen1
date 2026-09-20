import 'package:flutter/material.dart';
import '../services/lookbook_service.dart';
import '../services/carrito_service.dart';
import 'producto_detalle_screen.dart';
import 'ar_mirror_screen.dart';

class LookbookScreen extends StatefulWidget {
  const LookbookScreen({super.key});

  @override
  _LookbookScreenState createState() => _LookbookScreenState();
}

class _LookbookScreenState extends State<LookbookScreen> {
  final LookbookService _lookbookService = LookbookService();
  final CarritoService _carritoService = CarritoService();

  List<dynamic> _sucursales = [];
  bool _isLoadingForm = true;
  bool _isGenerating = false;

  // Form
  String _ocasion = 'Casual';
  final List<String> _ocasiones = ['Casual', 'Trabajo', 'Fiesta', 'Deporte', 'Viaje', 'Formal'];
  
  double _presupuesto = 1000.0;
  String? _talla;
  final List<String> _tallas = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  
  int? _sucursalId;
  String? _genero = 'Unisex';
  final List<String> _generos = ['Hombre', 'Mujer', 'Unisex'];

  // Results
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _loadSucursales();
  }

  Future<void> _loadSucursales() async {
    final sucs = await _lookbookService.getSucursales();
    if (mounted) {
      setState(() {
        _sucursales = sucs;
        _isLoadingForm = false;
      });
    }
  }

  Future<void> _generarLookbook() async {
    setState(() {
      _isGenerating = true;
      _result = null;
    });

    final payload = {
      'ocasion': _ocasion,
      'presupuesto_max': _presupuesto,
      if (_talla != null) 'talla_preferida': _talla,
      if (_sucursalId != null) 'sucursal_id': _sucursalId,
      if (_genero != null) 'genero': _genero,
    };

    final data = await _lookbookService.generarLookbook(payload);
    
    if (mounted) {
      setState(() {
        _isGenerating = false;
        if (data != null) {
          _result = data;
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Error al generar el Lookbook. Es posible que no haya stock o presupuesto insuficiente.'), backgroundColor: Colors.redAccent),
          );
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        title: const Text('Arma tu Outfit con IA', style: TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoadingForm
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : _result == null
              ? _buildForm()
              : _buildResults(),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF8B5CF6).withOpacity(0.5))),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, color: Color(0xFF8B5CF6), size: 30),
                const SizedBox(width: 16),
                const Expanded(child: Text('Cuéntanos qué buscas y nuestro estilista de IA creará el look perfecto para ti en base a nuestro inventario actual.', style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5))),
              ],
            ),
          ),
          const SizedBox(height: 30),

          _buildLabel('Ocasión o Estilo'),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _ocasiones.map((o) {
              final isSelected = _ocasion == o;
              return ChoiceChip(
                label: Text(o),
                selected: isSelected,
                selectedColor: const Color(0xFFEAB308),
                backgroundColor: const Color(0xFF1A1A1F),
                labelStyle: TextStyle(color: isSelected ? Colors.black : Colors.white, fontWeight: FontWeight.bold),
                onSelected: (val) {
                  if (val) setState(() => _ocasion = o);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          _buildLabel('Presupuesto Máximo: Bs. ${_presupuesto.toStringAsFixed(0)}'),
          Slider(
            value: _presupuesto,
            min: 100,
            max: 5000,
            divisions: 49,
            activeColor: const Color(0xFFEAB308),
            inactiveColor: Colors.white24,
            onChanged: (val) => setState(() => _presupuesto = val),
          ),
          const SizedBox(height: 24),

          _buildLabel('Tu Talla Preferida (Opcional)'),
          _buildDropdown(_tallas, _talla, (v) => setState(() => _talla = v), 'Cualquier Talla'),
          const SizedBox(height: 24),

          _buildLabel('Género (Opcional)'),
          _buildDropdown(_generos, _genero, (v) => setState(() => _genero = v), 'Cualquier Género'),
          const SizedBox(height: 24),

          _buildLabel('Filtrar por Sucursal (Opcional)'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(8)),
            child: DropdownButton<int?>(
              value: _sucursalId,
              hint: const Text('Buscar en todas las sucursales', style: TextStyle(color: Colors.grey)),
              isExpanded: true,
              dropdownColor: const Color(0xFF1A1A1F),
              underline: const SizedBox(),
              style: const TextStyle(color: Colors.white),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('Buscar en todas las sucursales')),
                ..._sucursales.map((s) => DropdownMenuItem<int?>(
                  value: s['id'],
                  child: Text(s['nombre']),
                )),
              ],
              onChanged: (v) => setState(() => _sucursalId = v),
            ),
          ),
          const SizedBox(height: 40),

          SizedBox(
            width: double.infinity,
            height: 55,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))
              ),
              onPressed: _isGenerating ? null : _generarLookbook,
              child: _isGenerating
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('GENERAR OUTFIT MÁGICO', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15, letterSpacing: 1.2)),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(text, style: const TextStyle(color: Color(0xFF8B5CF6), fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1)),
    );
  }

  Widget _buildDropdown(List<String> items, String? value, Function(String?) onChanged, String hint) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(8)),
      child: DropdownButton<String>(
        value: value,
        hint: Text(hint, style: const TextStyle(color: Colors.grey)),
        isExpanded: true,
        dropdownColor: const Color(0xFF1A1A1F),
        underline: const SizedBox(),
        style: const TextStyle(color: Colors.white),
        items: [
          DropdownMenuItem<String>(value: null, child: Text(hint)),
          ...items.map((i) => DropdownMenuItem<String>(value: i, child: Text(i))),
        ],
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildResults() {
    final justificacion = _result!['justificacion'] ?? '';
    final total = _result!['total_bs'] ?? 0.0;
    final mensaje = _result!['mensaje'];
    final List outfits = _result!['outfits'] ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tu Lookbook Generado', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.refresh, color: Color(0xFFEAB308)), onPressed: () => setState(() => _result = null)),
            ],
          ),
          const SizedBox(height: 16),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.camera_alt, color: Colors.white),
              label: const Text('Probar en Espejo AR', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEAB308),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))
              ),
              onPressed: () {
                String? supUrl;
                String? infUrl;
                try {
                  final List outfits = _result!['outfits'] ?? [];
                  if (outfits.isNotEmpty) {
                    for (var prenda in outfits[0]) {
                      if (prenda['rol'].toString().toLowerCase() == 'superior') {
                        supUrl = prenda['producto']['imagen_url'];
                      }
                      if (prenda['rol'].toString().toLowerCase() == 'inferior') {
                        infUrl = prenda['producto']['imagen_url'];
                      }
                    }
                  }
                } catch (e) {}
                
                Navigator.push(context, MaterialPageRoute(builder: (_) => ARMirrorScreen(superiorUrl: supUrl, inferiorUrl: infUrl)));
              },
            ),
          ),
          const SizedBox(height: 16),
          
          if (mensaje != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.orange.withOpacity(0.15), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.orange.withOpacity(0.5))),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
                  const SizedBox(width: 12),
                  Expanded(child: Text(mensaje, style: const TextStyle(color: Colors.orange, fontSize: 13))),
                ],
              ),
            ),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF8B5CF6).withOpacity(0.5))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.auto_awesome, color: Color(0xFF8B5CF6), size: 18),
                    SizedBox(width: 8),
                    Text('Nota del Estilista (IA)', style: TextStyle(color: Color(0xFF8B5CF6), fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 10),
                Text(justificacion, style: const TextStyle(color: Colors.white70, height: 1.5, fontSize: 13)),
              ],
            ),
          ),
          const SizedBox(height: 24),

          ...outfits.asMap().entries.map((entry) {
            final idx = entry.key;
            final List prendas = entry.value;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: const Color(0xFFEAB308).withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                  child: Text('CONJUNTO OPCIÓN ${idx + 1}', style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, letterSpacing: 1.2, fontSize: 12)),
                ),
                const SizedBox(height: 12),
                ...prendas.map((p) => _buildPrendaCard(p)).toList(),
                const SizedBox(height: 24),
              ],
            );
          }).toList(),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEAB308).withOpacity(0.5))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total Estimado:', style: TextStyle(color: Colors.white, fontSize: 16)),
                Text('Bs. ${total.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFEAB308), fontSize: 22, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildPrendaCard(dynamic prendaItem) {
    final prod = prendaItem['producto'];
    final rol = prendaItem['rol'];
    final img = prod['imagen_url'] ?? 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200';
    
    return GestureDetector(
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => ProductoDetalleScreen(productoId: prod['id'])));
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.white10)),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(img, width: 75, height: 75, fit: BoxFit.cover, errorBuilder: (c,e,s) => Container(width:75,height:75,color:Colors.grey[800])),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(rol.toUpperCase(), style: const TextStyle(color: Color(0xFF8B5CF6), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
                  const SizedBox(height: 4),
                  Text(prod['nombre'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 6),
                  Text('Bs. ${prod['precio_base']}', style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.checkroom, color: Colors.white70, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}
