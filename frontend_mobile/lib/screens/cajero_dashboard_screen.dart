import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../offline/offline_models.dart';
import '../offline/offline_sync_provider.dart';
import '../widgets/offline_status_banner.dart';
import 'offline/catalogo_offline_screen.dart';
import 'offline/centro_sincronizacion_screen.dart';
import 'offline/pos_offline_screen.dart';
import 'offline/reserva_offline_screen.dart';
import 'venta_pos_screen.dart';
import 'notificaciones_screen.dart';
import '../services/push_notification_service.dart';

class CajeroDashboardScreen extends StatefulWidget {
  final String rol;
  const CajeroDashboardScreen({super.key, required this.rol});

  @override
  _CajeroDashboardScreenState createState() => _CajeroDashboardScreenState();
}

class _CajeroDashboardScreenState extends State<CajeroDashboardScreen> {
  bool _isLoading = false;
  List<LocalSaleRecord> _ventasLocales = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarResumenLocal());
  }

  Future<void> _cargarResumenLocal() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    final provider = context.read<OfflineSyncProvider>();
    try {
      await provider.recargarEstadoLocal();
      if (provider.sesion != null) {
        final ventas = await provider.repository.listarVentasLocales();
        if (mounted) {
          setState(() {
            _ventasLocales = ventas;
          });
        }
      }
    } catch (_) {
      // Si aún no hay sesión local en SQLite, se muestra vacío sin bloquear
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _abrirPantalla(Widget screen) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => screen),
    );
    await _cargarResumenLocal();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OfflineSyncProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        title: const Text(
          'Panel de Caja',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
        ),
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
            icon: const Icon(Icons.refresh, color: Colors.white70),
            tooltip: 'Actualizar resumen local',
            onPressed: _cargarResumenLocal,
          ),
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
                        _buildHeader(provider),
                        const SizedBox(height: 20),
                        _buildQuickActions(provider),
                        const SizedBox(height: 16),
                        _buildOfflineSecondaryActions(provider),
                        const SizedBox(height: 24),
                        _buildStatCards(provider),
                        const SizedBox(height: 28),
                        const Text(
                          'Últimas Transacciones en Dispositivo (SQLite)',
                          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 12),
                        _buildRecentTransactions(),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(OfflineSyncProvider provider) {
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
              child: const Row(
                children: [
                  Icon(Icons.point_of_sale, color: Color(0xFFEAB308), size: 14),
                  SizedBox(width: 6),
                  Text(
                    'Punto de Venta (POS)',
                    style: TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: (provider.estaConectado ? Colors.green : const Color(0xFFF59E0B))
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.circle,
                    color: provider.estaConectado ? Colors.green : const Color(0xFFF59E0B),
                    size: 10,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    provider.estaConectado ? 'Caja en Línea' : 'Caja Offline (SQLite)',
                    style: TextStyle(
                      color: provider.estaConectado ? Colors.green : const Color(0xFFF59E0B),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'Facturación y Cobros',
          style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        const Text(
          'Procesa ventas al contado en efectivo (con y sin internet), apartados de vestidor y sincronización con el servidor central.',
          style: TextStyle(color: Colors.grey, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildQuickActions(OfflineSyncProvider provider) {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () => _abrirPantalla(const PosOfflineScreen()),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFEAB308),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFEAB308).withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: const Column(
                children: [
                  Icon(Icons.payments_outlined, color: Colors.black, size: 30),
                  SizedBox(height: 8),
                  Text(
                    'POS Efectivo (SQLite)',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black, fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'Opera Online y Offline',
                    style: TextStyle(color: Colors.black87, fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: GestureDetector(
            onTap: () => _abrirPantalla(
              provider.estaConectado ? const VentaPosScreen() : const PosOfflineScreen(),
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Column(
                children: [
                  Icon(
                    provider.estaConectado ? Icons.point_of_sale : Icons.lock_clock,
                    color: Colors.white,
                    size: 30,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    provider.estaConectado ? 'Venta POS Online' : 'POS Modo Sin Red',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    provider.estaConectado ? 'Efectivo / QR / Tarjeta' : 'Solo Efectivo (Regla 7.2)',
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOfflineSecondaryActions(OfflineSyncProvider provider) {
    return Row(
      children: [
        Expanded(
          child: _buildMiniActionTile(
            icon: Icons.inventory_2_outlined,
            title: 'Catálogo Local',
            subtitle: 'Stock por sucursal',
            accent: const Color(0xFF10B981),
            onTap: () => _abrirPantalla(const CatalogoOfflineScreen()),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMiniActionTile(
            icon: Icons.bookmark_add_outlined,
            title: 'Nueva Reserva',
            subtitle: 'Apartar prendas',
            accent: const Color(0xFFA78BFA),
            onTap: () => _abrirPantalla(const ReservaOfflineScreen()),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMiniActionTile(
            icon: provider.conflictosCount > 0 ? Icons.warning_amber_rounded : Icons.sync,
            title: 'Cola Sync',
            subtitle: '${provider.pendientesCount} pend • ${provider.conflictosCount} conf',
            accent: provider.conflictosCount > 0 ? Colors.redAccent : const Color(0xFFF59E0B),
            onTap: () => _abrirPantalla(const CentroSincronizacionScreen()),
          ),
        ),
      ],
    );
  }

  Widget _buildMiniActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color accent,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A1F),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accent.withValues(alpha: 0.35)),
        ),
        child: Column(
          children: [
            Icon(icon, color: accent, size: 22),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.grey, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCards(OfflineSyncProvider provider) {
    final ventasValidas = _ventasLocales.where(
      (v) =>
          v.estadoSync != OfflineSyncStatus.enConflicto &&
          v.estadoSync != OfflineSyncStatus.rechazada,
    );
    final totalLocal = ventasValidas.fold<double>(0.0, (sum, v) => sum + v.total);

    return Row(
      children: [
        Expanded(
          child: _buildSingleCard(
            'Ventas en Caja Local',
            'Bs. ${totalLocal.toStringAsFixed(2)}',
            '${ventasValidas.length} ticket(s) registrados',
            Icons.payments,
            Colors.green,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _buildSingleCard(
            'Cola de Sincronización',
            '${provider.pendientesCount}',
            provider.conflictosCount > 0
                ? '${provider.conflictosCount} conflicto(s) por revisar'
                : '${provider.sincronizadasCount} sincronizada(s)',
            provider.conflictosCount > 0 ? Icons.warning_amber_rounded : Icons.cloud_sync,
            provider.conflictosCount > 0 ? Colors.redAccent : const Color(0xFFEAB308),
          ),
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
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.w500),
                ),
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
          Text(
            mainValue,
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildRecentTransactions() {
    final ultimas = _ventasLocales.take(5).toList();
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1F),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          if (ultimas.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24.0),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.receipt, color: Colors.grey, size: 40),
                    SizedBox(height: 12),
                    Text('No hay ventas locales registradas aún.', style: TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            )
          else
            ...ultimas.map((v) {
              final Color badgeColor;
              if (v.estadoSync == OfflineSyncStatus.sincronizada) {
                badgeColor = const Color(0xFF10B981);
              } else if (v.estadoSync == OfflineSyncStatus.pendiente) {
                badgeColor = const Color(0xFFEAB308);
              } else {
                badgeColor = Colors.redAccent;
              }
              final horaStr = DateFormat('dd/MM HH:mm').format(v.fechaLocal.toLocal());
              return ListTile(
                dense: true,
                leading: CircleAvatar(
                  backgroundColor: badgeColor.withValues(alpha: 0.15),
                  child: Icon(Icons.receipt_long, color: badgeColor, size: 18),
                ),
                title: Text(
                  v.numeroComprobante ?? 'Ticket Local • ${v.localId.substring(0, 8)}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                subtitle: Text(
                  '${v.clienteNombre ?? "Contado"} • $horaStr • ${v.estadoSync}',
                  style: const TextStyle(color: Colors.grey, fontSize: 11),
                ),
                trailing: Text(
                  'Bs. ${v.total.toStringAsFixed(2)}',
                  style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, fontSize: 13),
                ),
              );
            }),
          const Divider(color: Colors.white10, height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton.icon(
                  onPressed: () => _abrirPantalla(const CentroSincronizacionScreen()),
                  icon: const Icon(Icons.history, color: Color(0xFFEAB308), size: 16),
                  label: const Text(
                    'Abrir Cola e Historial de Sincronización',
                    style: TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold),
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
