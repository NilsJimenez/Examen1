import 'package:flutter/material.dart';
import '../models/push_notification_model.dart';
import '../services/push_notification_service.dart';

class NotificacionesScreen extends StatefulWidget {
  const NotificacionesScreen({super.key});

  @override
  State<NotificacionesScreen> createState() => _NotificacionesScreenState();
}

class _NotificacionesScreenState extends State<NotificacionesScreen> {
  // 'TODAS', 'NO_LEIDAS', 'venta', 'reserva', 'stock', 'promo', 'sync'
  String _filtroActivo = 'TODAS';

  @override
  Widget build(BuildContext context) {
    final pushService = PushNotificationService.instance;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A), size: 24),
          tooltip: 'Atrás',
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Notificaciones',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.bold,
            fontSize: 20,
            letterSpacing: -0.3,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline, color: Color(0xFF0F172A), size: 23),
            tooltip: 'Ayuda',
            onPressed: () => _mostrarAyuda(),
          ),
          IconButton(
            icon: const Icon(Icons.tune, color: Color(0xFF0F172A), size: 23),
            tooltip: 'Filtrar por sección',
            onPressed: () => _mostrarFiltroCategorias(),
          ),
          IconButton(
            icon: const Icon(Icons.done_all, color: Color(0xFF0F172A), size: 24),
            tooltip: 'Marcar todas como leídas',
            onPressed: () => _marcarTodasLeidas(),
          ),
        ],
      ),
      body: ValueListenableBuilder<List<PushNotificationModel>>(
        valueListenable: pushService.notificationsNotifier,
        builder: (context, notificaciones, _) {
          final todasCount = notificaciones.length;
          final noLeidasCount = notificaciones.where((n) => !n.isRead).length;

          // Filtrar lista según el chip seleccionado
          final listaFiltrada = _aplicarFiltro(notificaciones);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Barra de Chips / Pills de Filtro (Igual a la imagen)
              _buildFilterChipsRow(todasCount, noLeidasCount),

              const SizedBox(height: 4),

              // 2. Lista de Notificaciones
              Expanded(
                child: listaFiltrada.isEmpty
                    ? _buildEmptyState()
                    : ListView.separated(
                        padding: EdgeInsets.zero,
                        itemCount: listaFiltrada.length,
                        separatorBuilder: (_, __) => const Divider(
                          height: 1,
                          thickness: 1,
                          color: Color(0xFFF1F5F9),
                          indent: 74,
                        ),
                        itemBuilder: (context, index) {
                          final item = listaFiltrada[index];
                          return _buildNotificationItem(item);
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  // =========================================================================
  // 1. FILAS DE CHIPS / PILLS DE FILTRO (IDÉNTICO A LA CAPTURA)
  // =========================================================================
  Widget _buildFilterChipsRow(int todasCount, int noLeidasCount) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // Chip: Todas (X)
          _buildPillButton(
            label: 'Todas ($todasCount)',
            isSelected: _filtroActivo == 'TODAS',
            onTap: () => setState(() => _filtroActivo = 'TODAS'),
          ),
          const SizedBox(width: 8),

          // Chip: No leídas (Y)
          _buildPillButton(
            label: 'No leídas ($noLeidasCount)',
            isSelected: _filtroActivo == 'NO_LEIDAS',
            onTap: () => setState(() => _filtroActivo = 'NO_LEIDAS'),
          ),

          // Chips adicionales por categoría si están activados
          if (_filtroActivo != 'TODAS' && _filtroActivo != 'NO_LEIDAS') ...[
            const SizedBox(width: 8),
            _buildPillButton(
              label: _obtenerNombreCategoria(_filtroActivo),
              isSelected: true,
              onTap: () => setState(() => _filtroActivo = 'TODAS'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPillButton({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7.5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEDE9FE) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFFDDD6FE) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isSelected) ...[
              const Icon(Icons.check, size: 16, color: Color(0xFF1E293B)),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: isSelected ? const Color(0xFF1E293B) : const Color(0xFF475569),
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // 2. ELEMENTO DE LA LISTA (IDÉNTICO A LA CAPTURA)
  // =========================================================================
  Widget _buildNotificationItem(PushNotificationModel item) {
    return Dismissible(
      key: Key('notif_${item.id}_${item.timestamp.millisecondsSinceEpoch}'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: const Color(0xFFFEE2E2),
        child: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
      ),
      onDismissed: (_) {
        final pushService = PushNotificationService.instance;
        final list = List<PushNotificationModel>.from(pushService.notificationsNotifier.value);
        list.removeWhere((n) => n.id == item.id);
        pushService.notificationsNotifier.value = list;
        pushService.unreadCountNotifier.value = list.where((n) => !n.isRead).length;
      },
      child: InkWell(
        onTap: () async {
          if (!item.isRead) {
            await PushNotificationService.instance.markAsRead(item.id);
          }
          if (mounted) {
            _mostrarDetalleNotificacion(item);
          }
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icono Campanita Circular con fondo suave (Estilo Imagen 2)
              Container(
                width: 46,
                height: 46,
                decoration: const BoxDecoration(
                  color: Color(0xFFE0E7FF), // Azul / lavanda suave
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.notifications,
                  color: Color(0xFF2563EB), // Azul vibrante
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),

              // Contenido: Título, Cuerpo, Fecha
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Título en negrita
                    Text(
                      item.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14.5,
                        color: Color(0xFF0F172A),
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 3),

                    // Mensaje / Descripción
                    Text(
                      item.body,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF334155),
                        height: 1.35,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 5),

                    // Fecha exacta estilo dd/MM/yyyy HH:mm
                    Text(
                      _formatearFechaExacta(item.timestamp),
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // Punto azul indicador de NO LEÍDA a la derecha (Igual a la imagen)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: item.isRead ? Colors.transparent : const Color(0xFF2563EB),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // =========================================================================
  // 3. ESTADO VACÍO
  // =========================================================================
  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.notifications_none_rounded,
                size: 38,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'No tienes notificaciones',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _filtroActivo == 'NO_LEIDAS'
                  ? 'Estás al día con todas tus notificaciones.'
                  : 'Las novedades de tus pedidos, vestidores, stock y avisos de la tienda aparecerán aquí.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // 4. ACCIONES Y MODALES
  // =========================================================================
  void _marcarTodasLeidas() async {
    await PushNotificationService.instance.markAllAsRead();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Todas las notificaciones marcadas como leídas'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _mostrarAyuda() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.help_outline, color: Color(0xFF2563EB)),
                SizedBox(width: 10),
                Text(
                  'Centro de Notificaciones',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              '• Recibe avisos en tiempo real cuando tus prendas estén listas en vestidores, se confirme una compra o se publiquen promociones exclusivas.\n'
              '• El punto azul indica que la notificación aún no ha sido leída.\n'
              '• Puedes deslizar cualquier notificación hacia la izquierda para eliminarla de tu bandeja.',
              style: TextStyle(fontSize: 13.5, color: Color(0xFF475569), height: 1.5),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Entendido', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _mostrarFiltroCategorias() {
    final opciones = [
      {'key': 'TODAS', 'label': 'Todas las categorías', 'icon': Icons.all_inclusive},
      {'key': 'reserva', 'label': 'Reservas & Vestidores', 'icon': Icons.calendar_today},
      {'key': 'venta', 'label': 'Ventas & Pagos', 'icon': Icons.receipt_long},
      {'key': 'stock', 'label': 'Control de Stock', 'icon': Icons.inventory_2},
      {'key': 'promo', 'label': 'Promociones & Catálogo', 'icon': Icons.local_offer},
      {'key': 'sync', 'label': 'Sincronización Offline', 'icon': Icons.sync},
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(
                  'Filtrar Notificaciones',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
              ),
              const Divider(height: 1),
              ...opciones.map((op) {
                final isSelected = _filtroActivo == op['key'];
                return ListTile(
                  leading: Icon(op['icon'] as IconData, color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF64748B)),
                  title: Text(
                    op['label'] as String,
                    style: TextStyle(
                      color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF0F172A),
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  trailing: isSelected ? const Icon(Icons.check, color: Color(0xFF2563EB)) : null,
                  onTap: () {
                    setState(() => _filtroActivo = op['key'] as String);
                    Navigator.pop(ctx);
                  },
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  void _mostrarDetalleNotificacion(PushNotificationModel item) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEDE9FE),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.category.toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFF6D28D9),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  _formatearFechaExacta(item.timestamp),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              item.title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              item.body,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF334155),
                height: 1.45,
              ),
            ),
            if (item.reference != null && item.reference!.isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.tag, size: 16, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Text(
                      'Referencia: ${item.reference}',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cerrar', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // 5. MÉTODOS DE FILTRO Y FORMATO
  // =========================================================================
  List<PushNotificationModel> _aplicarFiltro(List<PushNotificationModel> lista) {
    if (_filtroActivo == 'TODAS') return lista;
    if (_filtroActivo == 'NO_LEIDAS') return lista.where((n) => !n.isRead).toList();
    return lista.where((n) => n.category.toLowerCase() == _filtroActivo.toLowerCase()).toList();
  }

  String _obtenerNombreCategoria(String cat) {
    switch (cat.toLowerCase()) {
      case 'venta':
        return 'Ventas';
      case 'reserva':
        return 'Reservas';
      case 'stock':
        return 'Stock';
      case 'promo':
        return 'Promos';
      case 'sync':
        return 'Sincronización';
      default:
        return cat;
    }
  }

  String _formatearFechaExacta(DateTime dt) {
    final dia = dt.day.toString().padLeft(2, '0');
    final mes = dt.month.toString().padLeft(2, '0');
    final anio = dt.year.toString();
    final hora = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$dia/$mes/$anio $hora:$min';
  }
}
