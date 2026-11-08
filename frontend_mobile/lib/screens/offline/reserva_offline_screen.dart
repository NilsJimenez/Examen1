import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../offline/offline_models.dart';
import '../../offline/offline_sync_provider.dart';
import '../../widgets/offline_status_banner.dart';

class _ReservaItemLine {
  final OfflineVariantStock variante;
  int cantidad;

  _ReservaItemLine({required this.variante, this.cantidad = 1});
}

/// Registro de Reservas en Modo Offline sobre SQLite (Sección 6.2.3 y 7.1).
/// Permite asociar cliente existente del tenant o capturar un nuevo cliente mínimo sin red.
class ReservaOfflineScreen extends StatefulWidget {
  final OfflineVariantStock? varianteInicial;

  const ReservaOfflineScreen({super.key, this.varianteInicial});

  @override
  State<ReservaOfflineScreen> createState() => _ReservaOfflineScreenState();
}

class _ReservaOfflineScreenState extends State<ReservaOfflineScreen> {
  final TextEditingController _nombresCtrl = TextEditingController();
  final TextEditingController _apellidosCtrl = TextEditingController();
  final TextEditingController _telefonoCtrl = TextEditingController();
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _obsCtrl = TextEditingController();

  List<OfflineVariantStock> _catalogo = [];
  List<OfflineCustomer> _clientesLocal = [];
  OfflineCustomer? _clienteExistente;
  bool _usarClienteNuevoOffline = false;

  DateTime _fechaCita = DateTime.now().add(const Duration(hours: 2));
  TimeOfDay _horaCita = const TimeOfDay(hour: 16, minute: 0);
  final List<_ReservaItemLine> _prendas = [];
  bool _cargando = true;
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    if (widget.varianteInicial != null &&
        widget.varianteInicial!.stockLibreEfectivo > 0) {
      _prendas.add(_ReservaItemLine(variante: widget.varianteInicial!, cantidad: 1));
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarDatosLocales());
  }

  @override
  void dispose() {
    _nombresCtrl.dispose();
    _apellidosCtrl.dispose();
    _telefonoCtrl.dispose();
    _emailCtrl.dispose();
    _obsCtrl.dispose();
    super.dispose();
  }

  Future<void> _cargarDatosLocales() async {
    if (!mounted) return;
    setState(() => _cargando = true);
    final provider = context.read<OfflineSyncProvider>();
    try {
      final cat = await provider.repository
          .consultarCatalogoConStockLocal(soloConStock: true);
      final clis = await provider.repository.buscarClientesLocales();
      if (!mounted) return;
      setState(() {
        _catalogo = cat;
        _clientesLocal = clis.where((c) => c.servidorId != null).toList();
        if (_clientesLocal.isEmpty) {
          _usarClienteNuevoOffline = true;
        } else {
          _clienteExistente = _clientesLocal.first;
        }
        _cargando = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _cargando = false);
    }
  }

  void _agregarPrenda(OfflineVariantStock v) {
    final idx =
        _prendas.indexWhere((e) => e.variante.varianteId == v.varianteId);
    if (idx >= 0) {
      if (_prendas[idx].cantidad >= v.stockLibreEfectivo) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Stock libre máximo disponible para ${v.sku}: ${v.stockLibreEfectivo} uds.',
            ),
          ),
        );
        return;
      }
      setState(() => _prendas[idx].cantidad += 1);
    } else {
      setState(() => _prendas.add(_ReservaItemLine(variante: v, cantidad: 1)));
    }
  }

  Future<void> _guardarReservaOffline() async {
    if (_prendas.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seleccione al menos una prenda para reservar.')),
      );
      return;
    }

    if (!_usarClienteNuevoOffline && _clienteExistente == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seleccione un cliente o registre uno nuevo.')),
      );
      return;
    }

    if (_usarClienteNuevoOffline && _nombresCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingrese al menos el nombre del cliente.')),
      );
      return;
    }

    setState(() => _guardando = true);
    final provider = context.read<OfflineSyncProvider>();

    try {
      final fechaStr = DateFormat('yyyy-MM-dd').format(_fechaCita);
      final horaStr =
          '${_horaCita.hour.toString().padLeft(2, "0")}:${_horaCita.minute.toString().padLeft(2, "0")}:00';

      final reserva = await provider.registrarReserva(
        items: _prendas
            .map(
              (p) => OfflineDraftItem(
                varianteId: p.variante.varianteId,
                cantidad: p.cantidad,
              ),
            )
            .toList(),
        clienteServidorId:
            _usarClienteNuevoOffline ? null : _clienteExistente?.servidorId,
        clienteNombres:
            _usarClienteNuevoOffline ? _nombresCtrl.text.trim() : null,
        clienteApellidos:
            _usarClienteNuevoOffline ? _apellidosCtrl.text.trim() : null,
        clienteTelefono:
            _usarClienteNuevoOffline ? _telefonoCtrl.text.trim() : null,
        clienteEmail: _usarClienteNuevoOffline ? _emailCtrl.text.trim() : null,
        fechaReserva: fechaStr,
        horarioAtencion: horaStr,
        observaciones: _obsCtrl.text.trim(),
      );

      if (!mounted) return;
      setState(() {
        _prendas.clear();
        _obsCtrl.clear();
        _guardando = false;
      });
      await _cargarDatosLocales();
      if (!mounted) return;

      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1A1A1F),
          title: const Text(
            'Reserva Guardada en SQLite',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Cliente: ${reserva.clienteNombres} ${reserva.clienteApellidos ?? ""}',
                style: const TextStyle(
                  color: Color(0xFFEAB308),
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Cita: ${reserva.fechaReserva} a las ${reserva.horarioAtencion}',
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
              Text(
                'UUID Operación: ${reserva.operationId.substring(0, 13)}...',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const SizedBox(height: 10),
              Text(
                provider.estaConectado
                    ? 'Sincronizando automáticamente con el servidor...'
                    : 'Estado: PENDIENTE_SINCRONIZACION. El stock local quedó apartado y se enviará al recuperar red.',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Entendido', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    } on OfflineDomainException catch (e) {
      if (!mounted) return;
      setState(() => _guardando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.redAccent, content: Text(e.message)),
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
          'Registrar Reserva Offline',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(),
          Expanded(
            child: _cargando
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFFEAB308)),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 1. Cliente
                        Container(
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
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    '1. ASOCIAR CLIENTE',
                                    style: TextStyle(
                                      color: Color(0xFFEAB308),
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  if (_clientesLocal.isNotEmpty)
                                    TextButton(
                                      onPressed: () => setState(
                                        () => _usarClienteNuevoOffline =
                                            !_usarClienteNuevoOffline,
                                      ),
                                      child: Text(
                                        _usarClienteNuevoOffline
                                            ? 'Elegir de lista local'
                                            : '+ Nuevo cliente rápido',
                                        style: const TextStyle(
                                          color: Color(0xFFA78BFA),
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              if (!_usarClienteNuevoOffline &&
                                  _clientesLocal.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF2A2A35),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<OfflineCustomer>(
                                      value: _clienteExistente,
                                      dropdownColor: const Color(0xFF2A2A35),
                                      isExpanded: true,
                                      items: _clientesLocal
                                          .map(
                                            (c) => DropdownMenuItem(
                                              value: c,
                                              child: Text(
                                                '${c.nombreCompleto} (${c.email ?? c.telefono ?? ""})',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 13,
                                                ),
                                              ),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (val) => setState(
                                          () => _clienteExistente = val),
                                    ),
                                  ),
                                )
                              else ...[
                                _inputField(_nombresCtrl, 'Nombres del cliente *'),
                                const SizedBox(height: 8),
                                _inputField(_apellidosCtrl, 'Apellidos'),
                                const SizedBox(height: 8),
                                _inputField(_telefonoCtrl, 'Teléfono / Celular'),
                                const SizedBox(height: 8),
                                _inputField(
                                    _emailCtrl, 'Correo electrónico (opcional)'),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),

                        // 2. Fecha y hora de reserva
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1A1A1F),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                '2. FECHA Y HORARIO DE ATENCIÓN',
                                style: TextStyle(
                                  color: Color(0xFFEAB308),
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(
                                            color: Colors.white24),
                                      ),
                                      onPressed: () async {
                                        final picked = await showDatePicker(
                                          context: context,
                                          initialDate: _fechaCita,
                                          firstDate: DateTime.now(),
                                          lastDate: DateTime.now()
                                              .add(const Duration(days: 30)),
                                        );
                                        if (picked != null) {
                                          setState(() => _fechaCita = picked);
                                        }
                                      },
                                      icon: const Icon(Icons.calendar_today,
                                          size: 16, color: Colors.white),
                                      label: Text(
                                        DateFormat('dd/MM/yyyy')
                                            .format(_fechaCita),
                                        style: const TextStyle(
                                            color: Colors.white),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(
                                            color: Colors.white24),
                                      ),
                                      onPressed: () async {
                                        final picked = await showTimePicker(
                                          context: context,
                                          initialTime: _horaCita,
                                        );
                                        if (picked != null) {
                                          setState(() => _horaCita = picked);
                                        }
                                      },
                                      icon: const Icon(Icons.access_time,
                                          size: 16, color: Colors.white),
                                      label: Text(
                                        _horaCita.format(context),
                                        style: const TextStyle(
                                            color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              _inputField(
                                  _obsCtrl, 'Observaciones / Vestidor preferido'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),

                        // 3. Selección de prendas del catálogo SQLite
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1A1A1F),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                '3. PRENDAS A APARTAR (STOCK SQLITE)',
                                style: TextStyle(
                                  color: Color(0xFFEAB308),
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              if (_prendas.isNotEmpty) ...[
                                ..._prendas.asMap().entries.map((entry) {
                                  final idx = entry.key;
                                  final item = entry.value;
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    dense: true,
                                    title: Text(
                                      '${item.variante.productoNombre} (${item.variante.talla} • ${item.variante.color})',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold),
                                    ),
                                    subtitle: Text(
                                      'SKU: ${item.variante.sku} • Cantidad: ${item.cantidad}',
                                      style: const TextStyle(
                                          color: Colors.white70),
                                    ),
                                    trailing: IconButton(
                                      icon: const Icon(Icons.delete_outline,
                                          color: Colors.redAccent),
                                      onPressed: () =>
                                          setState(() => _prendas.removeAt(idx)),
                                    ),
                                  );
                                }),
                                const Divider(color: Colors.white12),
                              ],
                              const Text(
                                'Toque una variante disponible para agregarla:',
                                style: TextStyle(
                                    color: Colors.white60, fontSize: 12),
                              ),
                              const SizedBox(height: 6),
                              ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxHeight: 220),
                                child: ListView.builder(
                                  shrinkWrap: true,
                                  itemCount: _catalogo.length,
                                  itemBuilder: (context, i) {
                                    final v = _catalogo[i];
                                    return ListTile(
                                      dense: true,
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(
                                        '${v.productoNombre} (${v.talla}/${v.color})',
                                        style: const TextStyle(
                                            color: Colors.white, fontSize: 13),
                                      ),
                                      subtitle: Text(
                                        'SKU: ${v.sku} • Disp: ${v.stockLibreEfectivo}',
                                        style: const TextStyle(
                                            color: Colors.grey, fontSize: 11),
                                      ),
                                      trailing: OutlinedButton(
                                        style: OutlinedButton.styleFrom(
                                          side: const BorderSide(
                                              color: Color(0xFF8B5CF6)),
                                        ),
                                        onPressed: () => _agregarPrenda(v),
                                        child: const Text(
                                          '+ Apartar',
                                          style: TextStyle(
                                            color: Color(0xFFA78BFA),
                                            fontSize: 11.5,
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF8B5CF6),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            onPressed:
                                _guardando ? null : _guardarReservaOffline,
                            icon: const Icon(Icons.save_alt,
                                color: Colors.white),
                            label: Text(
                              _guardando
                                  ? 'GUARDANDO...'
                                  : 'GUARDAR RESERVA (${_prendas.length} PRENDA(S))',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
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

  Widget _inputField(TextEditingController ctrl, String label) {
    return TextField(
      controller: ctrl,
      style: const TextStyle(color: Colors.white, fontSize: 13.5),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Colors.white60, fontSize: 12.5),
        filled: true,
        fillColor: const Color(0xFF2A2A35),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}
