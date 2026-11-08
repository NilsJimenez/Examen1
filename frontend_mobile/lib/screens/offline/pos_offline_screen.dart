import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../offline/offline_models.dart';
import '../../offline/offline_sync_provider.dart';
import '../../widgets/offline_status_banner.dart';

class _CartLine {
  final OfflineVariantStock variante;
  int cantidad;

  _CartLine({required this.variante, this.cantidad = 1});

  double get subtotal => variante.precioVigente * cantidad;
}

/// Punto de Venta Offline-First al Contado en Efectivo (Secciones 6.2.2, 6.3 y Regla 7.2).
/// Valida stock contra SQLite local, bloquea métodos digitales sin conexión y encola
/// operaciones idempotentes con UUIDv4.
class PosOfflineScreen extends StatefulWidget {
  final OfflineVariantStock? varianteInicial;

  const PosOfflineScreen({super.key, this.varianteInicial});

  @override
  State<PosOfflineScreen> createState() => _PosOfflineScreenState();
}

class _PosOfflineScreenState extends State<PosOfflineScreen> {
  final TextEditingController _searchCtrl = TextEditingController();

  List<OfflineVariantStock> _catalogo = [];
  List<OfflineCustomer> _clientes = [];
  OfflineCustomer? _clienteSeleccionado;
  final List<_CartLine> _carrito = [];
  bool _cargando = true;
  bool _procesandoVenta = false;

  @override
  void initState() {
    super.initState();
    if (widget.varianteInicial != null &&
        widget.varianteInicial!.stockLibreEfectivo > 0) {
      _carrito.add(_CartLine(variante: widget.varianteInicial!, cantidad: 1));
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarCatalogoYClientes());
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _cargarCatalogoYClientes() async {
    if (!mounted) return;
    setState(() => _cargando = true);
    final provider = context.read<OfflineSyncProvider>();
    try {
      final items = await provider.repository.consultarCatalogoConStockLocal(
        busqueda: _searchCtrl.text,
        soloConStock: true,
      );
      final clis = await provider.repository.buscarClientesLocales();
      if (!mounted) return;
      setState(() {
        _catalogo = items;
        _clientes = clis;
        _cargando = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _cargando = false);
    }
  }

  void _agregarVariante(OfflineVariantStock v) {
    final idx =
        _carrito.indexWhere((line) => line.variante.varianteId == v.varianteId);
    if (idx >= 0) {
      if (_carrito[idx].cantidad >= v.stockLibreEfectivo) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Límite de stock local alcanzado (${v.stockLibreEfectivo} uds. disponibles para ${v.sku}).',
            ),
          ),
        );
        return;
      }
      setState(() => _carrito[idx].cantidad += 1);
    } else {
      if (v.stockLibreEfectivo <= 0) return;
      setState(() => _carrito.add(_CartLine(variante: v, cantidad: 1)));
    }
  }

  double get _totalTicket =>
      _carrito.fold(0.0, (acc, line) => acc + line.subtotal);

  Future<void> _confirmarCobroEfectivo() async {
    if (_carrito.isEmpty) return;

    final provider = context.read<OfflineSyncProvider>();
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final enLinea = provider.estaConectado;
        return AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          title: const Text(
            'Confirmar Cobro en Caja',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Total a cobrar: Bs. ${_totalTicket.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Color(0xFFEAB308),
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'MÉTODO DE PAGO:',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              // Efectivo habilitado siempre (Regla 7.2)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF10B981)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.payments, color: Color(0xFF10B981), size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Efectivo al Contado (Habilitado)',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Icon(Icons.check_circle, color: Color(0xFF10B981), size: 18),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Bloqueo explícito de pagos digitales sin red (Sección 6.3 y Regla 7.2)
              Opacity(
                opacity: 0.5,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock_outline,
                          color: Colors.redAccent, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          enLinea
                              ? 'QR / Tarjeta (Use módulo POS Online para pasarela)'
                              : 'QR / Tarjeta Bloqueados Sin Conexión (Regla 7.2)',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 11.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                enLinea
                    ? 'Se registrará en SQLite y se sincronizará de inmediato con el servidor.'
                    : 'Sin internet: se guardará en SQLite con estado PENDIENTE_SINCRONIZACION y se enviará automáticamente al volver la red.',
                style: const TextStyle(color: Colors.white60, fontSize: 11.5),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEAB308),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              icon: const Icon(Icons.check, color: Colors.black, size: 18),
              label: const Text(
                'Cobrar Efectivo',
                style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );

    if (confirmar != true) return;

    setState(() => _procesandoVenta = true);
    try {
      final draftItems = _carrito
          .map(
            (l) => OfflineDraftItem(
              varianteId: l.variante.varianteId,
              cantidad: l.cantidad,
              precioUnitario: l.variante.precioVigente,
            ),
          )
          .toList();

      final ventaLocal = await provider.registrarVentaContado(
        items: draftItems,
        clienteServidorId: _clienteSeleccionado?.servidorId,
        clienteNombre: _clienteSeleccionado?.nombreCompleto,
      );

      if (!mounted) return;
      setState(() {
        _carrito.clear();
        _clienteSeleccionado = null;
        _procesandoVenta = false;
      });
      await _cargarCatalogoYClientes();
      if (!mounted) return;

      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          title: const Row(
            children: [
              Icon(Icons.receipt_long, color: Color(0xFF10B981)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Venta Registrada en SQLite',
                  style: TextStyle(color: Colors.white, fontSize: 17),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Total cobrado (Efectivo): Bs. ${ventaLocal.total.toStringAsFixed(2)}',
                style: const TextStyle(
                  color: Color(0xFFEAB308),
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'ID Operación (UUID): ${ventaLocal.operationId.substring(0, 13)}...',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              Text(
                'Fecha local: ${DateFormat("dd/MM/yyyy HH:mm:ss").format(ventaLocal.fechaLocal.toLocal())}',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF2A2A35),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  provider.estaConectado
                      ? 'Estado: Enviando a sincronización automática con el servidor...'
                      : 'Estado: PENDIENTE_SINCRONIZACION (resguardada en cola local SQLite).',
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Aceptar', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    } on OfflineDomainException catch (e) {
      if (!mounted) return;
      setState(() => _procesandoVenta = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.redAccent, content: Text(e.message)),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _procesandoVenta = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.redAccent,
          content: Text('Error al registrar venta local: $e'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text(
          'POS Offline (Contado Efectivo)',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(),
          Container(
            color: const Color(0xFF1A1A1F),
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                if (_clientes.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2A2A35),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<OfflineCustomer?>(
                        value: _clienteSeleccionado,
                        dropdownColor: const Color(0xFF2A2A35),
                        isExpanded: true,
                        hint: const Text(
                          'Cliente opcional (Mostrador / Sin nombre)',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        items: [
                          const DropdownMenuItem<OfflineCustomer?>(
                            value: null,
                            child: Text(
                              'Cliente en Tienda (Contado sin registro)',
                              style: TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                          ),
                          ..._clientes.map(
                            (c) => DropdownMenuItem<OfflineCustomer?>(
                              value: c,
                              child: Text(
                                '${c.nombreCompleto} (${c.email ?? c.telefono ?? "Local"})',
                                style: const TextStyle(color: Colors.white, fontSize: 13),
                              ),
                            ),
                          ),
                        ],
                        onChanged: (val) => setState(() => _clienteSeleccionado = val),
                      ),
                    ),
                  ),
                TextField(
                  controller: _searchCtrl,
                  onChanged: (_) => _cargarCatalogoYClientes(),
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Agregar prenda por nombre, SKU, talla o color...',
                    hintStyle: const TextStyle(color: Colors.white54, fontSize: 13),
                    prefixIcon: const Icon(Icons.qr_code, color: Color(0xFFEAB308)),
                    filled: true,
                    fillColor: const Color(0xFF2A2A35),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Lista compacta del catálogo con stock para agregar con un toque
          Expanded(
            flex: 5,
            child: _cargando
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFFEAB308)),
                  )
                : _catalogo.isEmpty
                    ? const Center(
                        child: Text(
                          'No hay prendas con stock libre en la sucursal activa.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        itemCount: _catalogo.length,
                        itemBuilder: (context, idx) {
                          final v = _catalogo[idx];
                          return Card(
                            color: const Color(0xFF1A1A1F),
                            margin: const EdgeInsets.only(bottom: 6),
                            child: ListTile(
                              dense: true,
                              title: Text(
                                '${v.productoNombre} (${v.talla} • ${v.color})',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                'SKU: ${v.sku} • Stock libre: ${v.stockLibreEfectivo}',
                                style: const TextStyle(color: Colors.white60, fontSize: 11.5),
                              ),
                              trailing: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF8B5CF6),
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                ),
                                onPressed: () => _agregarVariante(v),
                                child: Text(
                                  '+ Bs. ${v.precioVigente.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          // Ticket actual
          Container(
            decoration: const BoxDecoration(
              color: Color(0xFF18181E),
              border: Border(top: BorderSide(color: Colors.white12)),
            ),
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'TICKET ACTUAL (${_carrito.length} línea(s))',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Row(
                        children: [
                          Icon(Icons.payments, color: Color(0xFF10B981), size: 14),
                          SizedBox(width: 4),
                          Text(
                            'SOLO EFECTIVO OFFLINE',
                            style: TextStyle(
                              color: Color(0xFF10B981),
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  if (_carrito.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 135),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: _carrito.length,
                        itemBuilder: (context, idx) {
                          final line = _carrito[idx];
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 3),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${line.variante.productoNombre} (${line.variante.talla}/${line.variante.color})',
                                    style: const TextStyle(
                                        color: Colors.white, fontSize: 12.5),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                IconButton(
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(Icons.remove_circle_outline,
                                      color: Colors.white70, size: 18),
                                  onPressed: () {
                                    setState(() {
                                      if (line.cantidad > 1) {
                                        line.cantidad -= 1;
                                      } else {
                                        _carrito.removeAt(idx);
                                      }
                                    });
                                  },
                                ),
                                Text(
                                  '${line.cantidad}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                IconButton(
                                  visualDensity: VisualDensity.compact,
                                  icon: const Icon(Icons.add_circle_outline,
                                      color: Color(0xFFEAB308), size: 18),
                                  onPressed: () => _agregarVariante(line.variante),
                                ),
                                SizedBox(
                                  width: 72,
                                  child: Text(
                                    'Bs. ${line.subtotal.toStringAsFixed(0)}',
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(
                                      color: Color(0xFFEAB308),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Total Contado',
                            style: TextStyle(color: Colors.grey, fontSize: 11.5),
                          ),
                          Text(
                            'Bs. ${_totalTicket.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: Color(0xFFEAB308),
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEAB308),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 22,
                            vertical: 13,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: (_carrito.isEmpty || _procesandoVenta)
                            ? null
                            : _confirmarCobroEfectivo,
                        icon: _procesandoVenta
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.black,
                                ),
                              )
                            : const Icon(Icons.point_of_sale, color: Colors.black),
                        label: const Text(
                          'COBRAR EFECTIVO',
                          style: TextStyle(
                            color: Colors.black,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
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
