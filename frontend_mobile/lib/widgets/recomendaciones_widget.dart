import 'package:flutter/material.dart';
import '../services/recomendaciones_service.dart';
import '../screens/producto_detalle_screen.dart';

class RecomendacionesWidget extends StatefulWidget {
  const RecomendacionesWidget({super.key});

  @override
  State<RecomendacionesWidget> createState() => _RecomendacionesWidgetState();
}

class _RecomendacionesWidgetState extends State<RecomendacionesWidget> {
  final RecomendacionesService _recomendacionesService = RecomendacionesService();
  List<dynamic> _recomendaciones = [];
  bool _isLoading = true;
  bool _isFallback = false;

  @override
  void initState() {
    super.initState();
    _loadRecomendaciones();
  }

  Future<void> _loadRecomendaciones() async {
    final data = await _recomendacionesService.getRecomendaciones();
    if (mounted) {
      setState(() {
        if (data != null) {
          _recomendaciones = data['recomendaciones'] ?? [];
          _isFallback = data['fallback_aplicado'] ?? false;
        }
        _isLoading = false;
      });
    }
  }

  void _onRecomendacionTapped(dynamic rec) async {
    // Registrar clic
    await _recomendacionesService.registrarClic(rec['id'], rec['producto_id']);
    
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ProductoDetalleScreen(productoId: rec['producto_id']),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: Padding(
        padding: EdgeInsets.all(24.0),
        child: CircularProgressIndicator(color: Color(0xFFEAB308)),
      ));
    }
    
    if (_recomendaciones.isEmpty) {
      return const SizedBox.shrink(); // No mostrar nada si no hay
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, color: Color(0xFFEAB308), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _isFallback ? 'Destacados de la Temporada' : 'Recomendado para ti (IA)',
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 280,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _recomendaciones.length,
            itemBuilder: (context, index) {
              final rec = _recomendaciones[index];
              final prod = rec['producto'];
              
              if (prod == null) {
                return const SizedBox.shrink();
              }

              final imageUrl = prod['imagen_url'] ?? 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';
              
              return GestureDetector(
                onTap: () => _onRecomendacionTapped(rec),
                child: Container(
                  width: 180,
                  margin: const EdgeInsets.only(right: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A1F),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                        child: Image.network(
                          imageUrl,
                          height: 170,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => Container(
                            height: 170,
                            width: double.infinity,
                            color: Colors.grey[900],
                            child: const Icon(Icons.broken_image, color: Colors.grey, size: 50),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(prod['nombre'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 4),
                            Text(
                              rec['motivo'] ?? '',
                              style: const TextStyle(color: Color(0xFFEAB308), fontSize: 10),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
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
    );
  }
}
