import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../offline/offline_models.dart';
import '../../offline/offline_sync_provider.dart';
import '../../widgets/offline_status_banner.dart';
import 'pos_offline_screen.dart';
import 'reserva_offline_screen.dart';

/// Catálogo Local y Consulta de Stock por Sucursal sobre SQLite (Sección 6.2.1).
/// Permite filtrar instantáneamente sin conexión por nombre, SKU, categoría, talla o color.
class CatalogoOfflineScreen extends StatefulWidget {
  const CatalogoOfflineScreen({super.key});

  @override
  State<CatalogoOfflineScreen> createState() => _CatalogoOfflineScreenState();
}

class _CatalogoOfflineScreenState extends State<CatalogoOfflineScreen> {
  final TextEditingController _searchCtrl = TextEditingController();

  List<OfflineCategory> _categorias = [];
  List<OfflineVariantStock> _items = [];
  int? _categoriaSeleccionada;
  String? _tallaSeleccionada;
  bool _soloConStock = false;
  bool _cargando = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarDatos());
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _cargarDatos() async {
    if (!mounted) return;
    setState(() => _cargando = true);
    final provider = context.read<OfflineSyncProvider>();
    try {
      final cats = await provider.repository.obtenerCategoriasLocales();
      final items = await provider.repository.consultarCatalogoConStockLocal(
        categoriaId: _categoriaSeleccionada,
        busqueda: _searchCtrl.text,
        talla: _tallaSeleccionada,
        soloConStock: _soloConStock,
      );
      if (!mounted) return;
      setState(() {
        _categorias = cats;
        _items = items;
        _cargando = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _items = [];
        _cargando = false;
      });
    }
  }

  Color _parseColorHex(String hex) {
    try {
      final clean = hex.replaceAll('#', '').trim();
      if (clean.length == 6) {
        return Color(int.parse('FF$clean', radix: 16));
      }
    } catch (_) {}
    return const Color(0xFF8B5CF6);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OfflineSyncProvider>();
    final sucursales = provider.sucursales;
    final sucursalActiva = provider.sucursalActiva;

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text(
          'Catálogo y Stock Local (SQLite)',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            tooltip: 'Sincronizar catálogo con servidor',
            onPressed: provider.estaConectado && !provider.estaSincronizando
                ? () async {
                    await provider.sincronizarAhora();
                    await _cargarDatos();
                  }
                : null,
            icon: const Icon(Icons.sync, color: Color(0xFFEAB308)),
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(),
          Container(
            color: const Color(0xFF1A1A1F),
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              children: [
                if (sucursales.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2A2A35),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: sucursalActiva?.id,
                        dropdownColor: const Color(0xFF2A2A35),
                        isExpanded: true,
                        icon: const Icon(Icons.storefront, color: Color(0xFFEAB308)),
                        style: const TextStyle(color: Colors.white, fontSize: 13.5),
                        items: sucursales
                            .map(
                              (s) => DropdownMenuItem<int>(
                                value: s.id,
                                child: Text('Sucursal: ${s.nombre}'),
                              ),
                            )
                            .toList(),
                        onChanged: (nuevoId) async {
                          if (nuevoId != null) {
                            await provider.seleccionarSucursalActiva(nuevoId);
                            await _cargarDatos();
                          }
                        },
                      ),
                    ),
                  ),
                TextField(
                  controller: _searchCtrl,
                  onChanged: (_) => _cargarDatos(),
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Buscar por nombre, SKU, talla o color...',
                    hintStyle: const TextStyle(color: Colors.white54, fontSize: 13),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF8B5CF6)),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, color: Colors.grey, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              _cargarDatos();
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: const Color(0xFF2A2A35),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('Con stock'),
                        selected: _soloConStock,
                        selectedColor: const Color(0xFF10B981).withValues(alpha: 0.25),
                        checkmarkColor: const Color(0xFF10B981),
                        labelStyle: TextStyle(
                          color: _soloConStock ? const Color(0xFF10B981) : Colors.white70,
                          fontSize: 12,
                        ),
                        backgroundColor: const Color(0xFF2A2A35),
                        onSelected: (v) {
                          setState(() => _soloConStock = v);
                          _cargarDatos();
                        },
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: const Text('Todas'),
                        selected: _categoriaSeleccionada == null,
                        selectedColor: const Color(0xFF8B5CF6),
                        labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                        backgroundColor: const Color(0xFF2A2A35),
                        onSelected: (_) {
                          setState(() => _categoriaSeleccionada = null);
                          _cargarDatos();
                        },
                      ),
                      ..._categorias.map(
                        (cat) => Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(
                            label: Text(cat.nombre),
                            selected: _categoriaSeleccionada == cat.id,
                            selectedColor: const Color(0xFF8B5CF6),
                            labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                            backgroundColor: const Color(0xFF2A2A35),
                            onSelected: (sel) {
                              setState(() => _categoriaSeleccionada = sel ? cat.id : null);
                              _cargarDatos();
                            },
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      ...['XS', 'S', 'M', 'L', 'XL'].map(
                        (talla) => Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(
                            label: Text('T:$talla'),
                            selected: _tallaSeleccionada == talla,
                            selectedColor: const Color(0xFFEAB308),
                            labelStyle: TextStyle(
                              color: _tallaSeleccionada == talla ? Colors.black : Colors.white70,
                              fontWeight: FontWeight.bold,
                              fontSize: 11.5,
                            ),
                            backgroundColor: const Color(0xFF2A2A35),
                            onSelected: (sel) {
                              setState(() => _tallaSeleccionada = sel ? talla : null);
                              _cargarDatos();
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _cargando
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFFEAB308)),
                  )
                : _items.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.cloud_download_outlined,
                                size: 54,
                                color: Color(0xFFEAB308),
                              ),
                              const SizedBox(height: 14),
                              const Text(
                                'Catálogo local sin productos descargados',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Descarga el paquete offline desde el servidor para consultar prendas, precios y existencias en SQLite.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.grey, fontSize: 13),
                              ),
                              const SizedBox(height: 18),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFEAB308),
                                  foregroundColor: Colors.black,
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: provider.estaConectado && !provider.estaSincronizando
                                    ? () async {
                                        final ok = await provider.descargarCatalogo();
                                        await _cargarDatos();
                                        if (mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(ok
                                                  ? 'Catálogo descargado correctamente'
                                                  : (provider.ultimoError ?? 'Error al descargar el catálogo')),
                                              backgroundColor: ok ? const Color(0xFF10B981) : Colors.redAccent,
                                            ),
                                          );
                                        }
                                      }
                                    : null,
                                icon: provider.estaSincronizando
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                                      )
                                    : const Icon(Icons.download),
                                label: Text(provider.estaSincronizando ? 'Descargando...' : 'Descargar Catálogo Ahora'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _items.length,
                        itemBuilder: (context, idx) {
                          final item = _items[idx];
                          final libre = item.stockLibreEfectivo;
                          final sinStock = libre <= 0;
                          final colorStock = sinStock
                              ? Colors.redAccent
                              : (item.stockBajo
                                  ? const Color(0xFFF59E0B)
                                  : const Color(0xFF10B981));

                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1A1A1F),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.white10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: _parseColorHex(item.codigoHex)
                                            .withValues(alpha: 0.25),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: _parseColorHex(item.codigoHex),
                                          width: 1.5,
                                        ),
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        item.talla,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.productoNombre,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 15,
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            'SKU: ${item.sku} • Color: ${item.color} • ${item.categoriaNombre ?? "General"}',
                                            style: const TextStyle(
                                              color: Colors.white60,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          'Bs. ${item.precioVigente.toStringAsFixed(2)}',
                                          style: const TextStyle(
                                            color: Color(0xFFEAB308),
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: colorStock.withValues(alpha: 0.15),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            sinStock
                                                ? 'Agotado'
                                                : 'Disp: $libre uds.',
                                            style: TextStyle(
                                              color: colorStock,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                if (!sinStock) ...[
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          side: const BorderSide(
                                              color: Color(0xFF8B5CF6)),
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 6,
                                          ),
                                        ),
                                        onPressed: () async {
                                          await Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) =>
                                                  ReservaOfflineScreen(
                                                varianteInicial: item,
                                              ),
                                            ),
                                          );
                                          await _cargarDatos();
                                        },
                                        icon: const Icon(
                                          Icons.event_available,
                                          size: 15,
                                          color: Color(0xFFA78BFA),
                                        ),
                                        label: const Text(
                                          'Reservar',
                                          style: TextStyle(
                                            color: Color(0xFFA78BFA),
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor:
                                              const Color(0xFFEAB308),
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 6,
                                          ),
                                        ),
                                        onPressed: () async {
                                          await Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => PosOfflineScreen(
                                                varianteInicial: item,
                                              ),
                                            ),
                                          );
                                          await _cargarDatos();
                                        },
                                        icon: const Icon(
                                          Icons.payments_outlined,
                                          size: 15,
                                          color: Colors.black,
                                        ),
                                        label: const Text(
                                          'Vender Efectivo',
                                          style: TextStyle(
                                            color: Colors.black,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
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
