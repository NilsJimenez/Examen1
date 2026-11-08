import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import '../offline/offline_models.dart';
import '../offline/offline_sync_provider.dart';
import '../services/reserva_service.dart';
import '../widgets/offline_status_banner.dart';
import 'inventario_screen.dart';
import 'offline/catalogo_offline_screen.dart';
import 'offline/centro_sincronizacion_screen.dart';
import 'offline/reserva_offline_screen.dart';
import 'qr_scanner_screen.dart';
import 'reportes_screen.dart';
import 'alertas_screen.dart';
import 'notificaciones_screen.dart';
import '../services/push_notification_service.dart';

class EncargadoDashboardScreen extends StatefulWidget {
  final String rol;
  const EncargadoDashboardScreen({super.key, required this.rol});

  @override
  _EncargadoDashboardScreenState createState() => _EncargadoDashboardScreenState();
}

class _EncargadoDashboardScreenState extends State<EncargadoDashboardScreen> {
  bool _isLoading = true;
  List<dynamic> _sucursales = [];
  int? _selectedSucursalId;
  int _activeTabIndex = 2; // Default to 'Reservas en Probadores' as in the design
  List<dynamic> _reservas = [];
  List<LocalReservationRecord> _reservasLocales = [];
  bool _isLoadingReservas = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final offlineProv = context.read<OfflineSyncProvider>();
    await offlineProv.recargarEstadoLocal();

    List<dynamic> sucursales = [];
    if (offlineProv.estaConectado) {
      sucursales = await ReservaService().getSucursales();
    }
    if (sucursales.isEmpty && offlineProv.sucursales.isNotEmpty) {
      sucursales = offlineProv.sucursales
          .map((s) => {'id': s.id, 'nombre': s.nombre})
          .toList();
    }

    if (!mounted) return;
    setState(() {
      _sucursales = sucursales;
      if (_sucursales.isNotEmpty) {
        _selectedSucursalId =
            offlineProv.sucursalActiva?.id ?? _sucursales.first['id'];
      }
      _isLoading = false;
    });
    if (_selectedSucursalId != null) {
      _fetchReservas();
    }
  }

  Future<void> _fetchReservas() async {
    if (_selectedSucursalId == null) return;
    setState(() => _isLoadingReservas = true);
    final offlineProv = context.read<OfflineSyncProvider>();
    List<dynamic> res = [];
    if (offlineProv.estaConectado) {
      res = await ReservaService().getReservasSucursal(_selectedSucursalId!);
    }
    List<LocalReservationRecord> locales = [];
    if (offlineProv.sesion != null) {
      final todasLocales = await offlineProv.repository.listarReservasLocales();
      locales = todasLocales
          .where((r) => r.sucursalId == _selectedSucursalId)
          .toList();
    }
    if (!mounted) return;
    setState(() {
      _reservas = res;
      _reservasLocales = locales;
      _isLoadingReservas = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        title: const Text('Panel de Sucursal', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          ValueListenableBuilder<int>(
            valueListenable: PushNotificationService.instance.unreadCountNotifier,
            builder: (context, unreadCount, child) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                    tooltip: 'Bandeja de Notificaciones',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const NotificacionesScreen()),
                      );
                    },
                  ),
                  if (unreadCount > 0)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xFFEF4444),
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          unreadCount > 9 ? '9+' : '$unreadCount',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadData,
          )
        ],
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildHeader(),
                        const SizedBox(height: 16),
                        _buildOfflineActionsRow(),
                        const SizedBox(height: 24),
                        _buildStatCards(),
                        const SizedBox(height: 32),
                        _buildTabs(),
                        const SizedBox(height: 16),
                        _buildActiveTabContent(),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildOfflineActionsRow() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        ActionChip(
          backgroundColor: const Color(0xFF1A1A1F),
          side: const BorderSide(color: Color(0xFF10B981)),
          avatar: const Icon(Icons.inventory_2_outlined, size: 16, color: Color(0xFF10B981)),
          label: const Text('Stock Local SQLite', style: TextStyle(color: Colors.white, fontSize: 12)),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CatalogoOfflineScreen()),
            ).then((_) => _loadData());
          },
        ),
        ActionChip(
          backgroundColor: const Color(0xFF1A1A1F),
          side: const BorderSide(color: Color(0xFFA78BFA)),
          avatar: const Icon(Icons.bookmark_add_outlined, size: 16, color: Color(0xFFA78BFA)),
          label: const Text('Nueva Reserva Offline', style: TextStyle(color: Colors.white, fontSize: 12)),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ReservaOfflineScreen()),
            ).then((_) => _fetchReservas());
          },
        ),
        ActionChip(
          backgroundColor: const Color(0xFF1A1A1F),
          side: const BorderSide(color: Color(0xFFF59E0B)),
          avatar: const Icon(Icons.sync_alt, size: 16, color: Color(0xFFF59E0B)),
          label: const Text('Cola / Conflictos', style: TextStyle(color: Colors.white, fontSize: 12)),
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CentroSincronizacionScreen()),
            ).then((_) => _fetchReservas());
          },
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF2A2A35),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEAB308).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.store, color: Color(0xFFEAB308), size: 14),
                  const SizedBox(width: 6),
                  const Text('Operaciones en Tienda Física', style: TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            const Icon(Icons.access_time, color: Colors.grey, size: 14),
            const SizedBox(width: 4),
            const Text('En Tiempo Real', style: TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'Panel de Gestión de Sucursal',
          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        const Text(
          'Atención de reservas para vestidores, validación rápida de pases QR y control del inventario local',
          style: TextStyle(color: Colors.grey, fontSize: 13),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1F),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white12),
          ),
          child: Row(
            children: [
              const Icon(Icons.location_on, color: Color(0xFFEAB308), size: 20),
              const SizedBox(width: 10),
              const Text('Sucursal:', style: TextStyle(color: Colors.grey, fontSize: 14)),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int>(
                    dropdownColor: const Color(0xFF2A2A35),
                    icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white),
                    value: _selectedSucursalId,
                    isExpanded: true,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    items: _sucursales.map<DropdownMenuItem<int>>((s) {
                      return DropdownMenuItem<int>(
                        value: s['id'],
                        child: Text(s['nombre']),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedSucursalId = val);
                        _fetchReservas();
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildStatCards() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildSingleCard('Por Atender', '0', 'En espera de preparación', Icons.access_time_filled, const Color(0xFFEAB308))),
            const SizedBox(width: 16),
            Expanded(child: _buildSingleCard('Listas en Probador', '1', 'Vestidor listo para cliente', Icons.door_front_door, const Color(0xFF8B5CF6))),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: _buildSingleCard('Existencias Físicas', '1631', '69 variantes registradas', Icons.checkroom, const Color(0xFFEAB308))),
            const SizedBox(width: 16),
            Expanded(child: _buildSingleCard('Alertas de Stock', '0', 'Nivel de inventario óptimo', Icons.check_circle, Colors.green)),
          ],
        ),
      ],
    );
  }

  Widget _buildSingleCard(String title, String mainValue, String subtitle, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1F),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(title, style: const TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.w500)),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 16),
              )
            ],
          ),
          const SizedBox(height: 12),
          Text(mainValue, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    final tabs = [
      {'title': 'Reportes & BI', 'icon': Icons.pie_chart, 'badge': null},
      {'title': 'Alertas Stock (IA)', 'icon': Icons.warning_amber_rounded, 'badge': '0'},
      {'title': 'Reservas en Probadores', 'icon': Icons.calendar_today, 'badge': '1'},
      {'title': 'Check-in Instantáneo QR', 'icon': Icons.qr_code_scanner, 'badge': null},
      {'title': 'Inventario & Kárdex Local', 'icon': Icons.inventory, 'badge': '69'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(tabs.length, (index) {
          final isActive = _activeTabIndex == index;
          final tab = tabs[index];
            return GestureDetector(
              onTap: () {
                final title = tab['title'].toString();
                if (title.contains('Inventario')) {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const InventarioScreen()));
                } else if (title.contains('Check-in')) {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const QRScannerScreen())).then((_) => _fetchReservas());
                } else if (title.contains('Reportes')) {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => ReportesScreen(rol: widget.rol)));
                } else if (title.contains('Alertas')) {
                  Navigator.push(context, MaterialPageRoute(builder: (context) => const AlertasScreen()));
                } else {
                  setState(() => _activeTabIndex = index);
                }
              },
              child: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isActive ? Colors.transparent : const Color(0xFF1A1A1F),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: isActive ? const Color(0xFFEAB308) : Colors.transparent),
              ),
              child: Row(
                children: [
                  Icon(tab['icon'] as IconData, color: isActive ? const Color(0xFFEAB308) : Colors.grey, size: 16),
                  const SizedBox(width: 8),
                  Text(tab['title'] as String, style: TextStyle(color: isActive ? const Color(0xFFEAB308) : Colors.grey, fontSize: 13, fontWeight: isActive ? FontWeight.bold : FontWeight.normal)),
                  if (tab['badge'] != null) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isActive ? const Color(0xFFEAB308).withValues(alpha: 0.2) : const Color(0xFF2A2A35),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(tab['badge'] as String, style: TextStyle(color: isActive ? const Color(0xFFEAB308) : Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    )
                  ]
                ],
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildActiveTabContent() {
    // Para simplificar, mostraremos el contenido de la pestaña 2 (Reservas) que es la que se ve en la imagen
    if (_activeTabIndex != 2) {
      return Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A1F),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Text('Módulo en construcción', style: TextStyle(color: Colors.grey)),
      );
    }

    String sucursalNombre = _sucursales.firstWhere((s) => s['id'] == _selectedSucursalId, orElse: () => {'nombre': 'Seleccionada'})['nombre'];

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1F),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.calendar_today, color: Color(0xFFEAB308), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text('Agenda de Probadores: $sucursalNombre', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text('Prendas apartadas que los clientes probarán antes de pagar en caja', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${_reservas.length} reserva(s) programada(s)', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: _fetchReservas,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white24),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.refresh, color: Colors.white, size: 14),
                              SizedBox(width: 6),
                              Text('Actualizar', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      )
                    ],
                  )
                ],
              ),
            ),
            const Divider(color: Colors.white10, height: 1),
            if (_isLoadingReservas)
              const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator(color: Color(0xFFEAB308))))
            else if (_reservas.isEmpty && _reservasLocales.isEmpty)
              const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('No hay reservas pendientes o preparadas.', style: TextStyle(color: Colors.grey))))
            else ...[
              ..._reservasLocales
                  .where((rl) => rl.estadoSync == OfflineSyncStatus.pendiente || rl.estadoSync == OfflineSyncStatus.enConflicto)
                  .map((rl) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
                        child: Row(
                          children: [
                            Container(
                              width: 46,
                              height: 46,
                              decoration: BoxDecoration(
                                color: const Color(0xFF2B1D0E),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.cloud_off, color: Color(0xFFF59E0B), size: 20),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${rl.clienteNombres} ${rl.clienteApellidos ?? ""}'.trim(),
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    'Cita: ${rl.fechaReserva} (${rl.horarioAtencion}) • ${rl.estadoSync}',
                                    style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11.5),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )),
              ..._reservas.map((r) {
                final esPreparada = r['estado'] == 'preparada';
                final itemsText = (r['items'] as List).map((i) => '${i['cantidad']}x ${i['producto']} (T: ${i['talla']})').join('\n');

                return Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Row(
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2A2A35),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(esPreparada ? Icons.check_circle : Icons.person, color: esPreparada ? Colors.green : Colors.grey),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r['cliente'] ?? 'Cliente Desconocido', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('Cita: ${r['fecha']} a las ${r['hora']}', style: const TextStyle(color: Color(0xFF8B5CF6), fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(itemsText, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                          ],
                        ),
                      ),
                      InkWell(
                        onTap: () async {
                          if (esPreparada) {
                            final ok = await ReservaService().atenderReserva(r['id']);
                            if (ok) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reserva marcada como Atendida')));
                              _fetchReservas();
                            }
                          } else {
                            final ok = await ReservaService().prepararReserva(r['id']);
                            if (ok) {
                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Prendas preparadas. Cliente notificado.')));
                              _fetchReservas();
                            }
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: esPreparada ? Colors.green : const Color(0xFFEAB308),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(esPreparada ? 'Marcar Atendida' : 'Preparar Prendas', style: TextStyle(color: esPreparada ? Colors.white : Colors.black, fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      )
                    ],
                  ),
                );
              }).toList(),
            ],
          ],
        ),
      );
  }
}
