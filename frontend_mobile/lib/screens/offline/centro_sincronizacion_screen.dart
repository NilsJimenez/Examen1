import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../offline/offline_models.dart';
import '../../offline/offline_sync_provider.dart';
import '../../widgets/offline_status_banner.dart';
import 'pos_offline_screen.dart';
import 'reserva_offline_screen.dart';

/// Centro de Cola de Sincronización e Historial de Conflictos (Secciones 6.2.4, 6.2.5, 6.3, 6.4 y RNF10).
/// Muestra estados PENDIENTE_SINCRONIZACION, SINCRONIZADA, EN_CONFLICTO y RECHAZADA,
/// permite disparar sincronización manual y resolver conflictos con trazabilidad.
class CentroSincronizacionScreen extends StatefulWidget {
  const CentroSincronizacionScreen({super.key});

  @override
  State<CentroSincronizacionScreen> createState() =>
      _CentroSincronizacionScreenState();
}

class _CentroSincronizacionScreenState
    extends State<CentroSincronizacionScreen> {
  String? _filtroEstado;
  List<SyncQueueItem> _operaciones = [];
  bool _cargando = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cargarCola());
  }

  Future<void> _cargarCola() async {
    if (!mounted) return;
    setState(() => _cargando = true);
    final provider = context.read<OfflineSyncProvider>();
    try {
      await provider.recargarEstadoLocal();
      final ops = await provider.repository.obtenerHistorialColaLocal(
        estado: _filtroEstado,
      );
      if (!mounted) return;
      setState(() {
        _operaciones = ops;
        _cargando = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _cargando = false);
    }
  }

  Color _colorEstado(String estado) {
    switch (estado) {
      case OfflineSyncStatus.sincronizada:
        return const Color(0xFF10B981);
      case OfflineSyncStatus.pendiente:
      case OfflineSyncStatus.sincronizando:
        return const Color(0xFFEAB308);
      case OfflineSyncStatus.enConflicto:
      case OfflineSyncStatus.rechazada:
        return Colors.redAccent;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OfflineSyncProvider>();
    final sesion = provider.sesion;

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text(
          'Cola de Sincronización y Conflictos',
          style: TextStyle(color: Colors.white, fontSize: 16.5, fontWeight: FontWeight.bold),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _cargarCola,
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineStatusBanner(mostrarAccesoCentroSync: false),
          Container(
            padding: const EdgeInsets.all(14),
            color: const Color(0xFF1A1A1F),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _ResumenMiniCard(
                      titulo: 'Pendientes',
                      valor: '${provider.pendientesCount}',
                      color: const Color(0xFFEAB308),
                    ),
                    const SizedBox(width: 8),
                    _ResumenMiniCard(
                      titulo: 'Sincronizadas',
                      valor: '${provider.sincronizadasCount}',
                      color: const Color(0xFF10B981),
                    ),
                    const SizedBox(width: 8),
                    _ResumenMiniCard(
                      titulo: 'Conflictos',
                      valor:
                          '${provider.conflictosCount + provider.rechazadasCount}',
                      color: Colors.redAccent,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    onPressed:
                        (!provider.estaConectado || provider.estaSincronizando)
                            ? null
                            : () async {
                                final rep = await provider.sincronizarAhora();
                                await _cargarCola();
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(rep.mensaje)),
                                );
                              },
                    icon: provider.estaSincronizando
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.cloud_upload, color: Colors.white),
                    label: Text(
                      provider.estaSincronizando
                          ? 'SINCRONIZANDO LOTE CON EL SERVIDOR...'
                          : (provider.estaConectado
                              ? 'SINCRONIZAR AHORA Y ACTUALIZAR STOCK'
                              : 'ESPERANDO CONEXIÓN A INTERNET...'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 12.5,
                      ),
                    ),
                  ),
                ),
                if (sesion != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Tenant: ${sesion.tenantNombre} (${sesion.planNombre}) • Última sync: '
                    '${sesion.ultimaSincronizacion != null ? DateFormat("dd/MM/yyyy HH:mm:ss").format(sesion.ultimaSincronizacion!.toLocal()) : "Nunca"}',
                    style: const TextStyle(color: Colors.white60, fontSize: 11),
                  ),
                ],
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _chipFiltro('Todas', null),
                      const SizedBox(width: 6),
                      _chipFiltro('Pendientes', OfflineSyncStatus.pendiente),
                      const SizedBox(width: 6),
                      _chipFiltro('En Conflicto', OfflineSyncStatus.enConflicto),
                      const SizedBox(width: 6),
                      _chipFiltro('Sincronizadas', OfflineSyncStatus.sincronizada),
                      const SizedBox(width: 6),
                      _chipFiltro('Rechazadas', OfflineSyncStatus.rechazada),
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
                : _operaciones.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(28.0),
                          child: Text(
                            'No hay operaciones registradas en la cola local para este filtro.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _operaciones.length,
                        itemBuilder: (context, idx) {
                          final op = _operaciones[idx];
                          final color = _colorEstado(op.estado);
                          final esConflictoORechazo =
                              op.estado == OfflineSyncStatus.enConflicto ||
                                  op.estado == OfflineSyncStatus.rechazada;
                          final itemsList =
                              (op.payload['items'] as List<dynamic>? ?? []);

                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1A1A1F),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: esConflictoORechazo
                                    ? Colors.redAccent.withValues(alpha: 0.6)
                                    : Colors.white10,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          op.tipo == 'VENTA'
                                              ? Icons.point_of_sale
                                              : Icons.event_available,
                                          color: const Color(0xFFEAB308),
                                          size: 18,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          op.tipo,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        op.estado,
                                        style: TextStyle(
                                          color: color,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 10.5,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'UUID: ${op.operationId}',
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  'Fecha local: ${DateFormat("dd/MM/yyyy HH:mm:ss").format(op.fechaLocal.toLocal())} • '
                                  'Prendas: ${itemsList.length} línea(s) • Intentos: ${op.intentos}',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                  ),
                                ),
                                if (op.referenciaServidor != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'Comprobante / Código oficial: ${op.referenciaServidor}',
                                    style: const TextStyle(
                                      color: Color(0xFF10B981),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12.5,
                                    ),
                                  ),
                                ],
                                if (op.motivoConflicto != null &&
                                    op.motivoConflicto!.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.redAccent
                                          .withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: Colors.redAccent
                                            .withValues(alpha: 0.4),
                                      ),
                                    ),
                                    child: Text(
                                      'Motivo: ${op.motivoConflicto}',
                                      style: const TextStyle(
                                        color: Color(0xFFFECACA),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                                if (esConflictoORechazo) ...[
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          side: const BorderSide(
                                              color: Colors.white38),
                                        ),
                                        onPressed: () async {
                                          await provider.descartarConflicto(
                                            op.operationId,
                                            nota:
                                                'Operación descartada tras revisión en Centro de Sincronización.',
                                          );
                                          await _cargarCola();
                                        },
                                        icon: const Icon(Icons.check,
                                            size: 15, color: Colors.white70),
                                        label: const Text(
                                          'Descartar Conflicto',
                                          style: TextStyle(
                                            color: Colors.white70,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor:
                                              const Color(0xFFEAB308),
                                        ),
                                        onPressed: () async {
                                          await provider.descartarConflicto(
                                            op.operationId,
                                            nota:
                                                'Reemplazada por nueva operación ajustada al stock disponible.',
                                          );
                                          if (!context.mounted) return;
                                          await Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => op.tipo == 'VENTA'
                                                  ? const PosOfflineScreen()
                                                  : const ReservaOfflineScreen(),
                                            ),
                                          );
                                          await _cargarCola();
                                        },
                                        icon: const Icon(Icons.edit_note,
                                            size: 16, color: Colors.black),
                                        label: Text(
                                          op.tipo == 'VENTA'
                                              ? 'Registrar Venta Ajustada'
                                              : 'Registrar Reserva Ajustada',
                                          style: const TextStyle(
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

  Widget _chipFiltro(String label, String? valor) {
    final sel = _filtroEstado == valor;
    return ChoiceChip(
      label: Text(label),
      selected: sel,
      selectedColor: const Color(0xFF8B5CF6),
      backgroundColor: const Color(0xFF2A2A35),
      labelStyle: const TextStyle(color: Colors.white, fontSize: 11.5),
      onSelected: (_) {
        setState(() => _filtroEstado = valor);
        _cargarCola();
      },
    );
  }
}

class _ResumenMiniCard extends StatelessWidget {
  final String titulo;
  final String valor;
  final Color color;

  const _ResumenMiniCard({
    required this.titulo,
    required this.valor,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2A35),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Column(
          children: [
            Text(
              valor,
              style: TextStyle(
                color: color,
                fontSize: 20,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              titulo,
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
