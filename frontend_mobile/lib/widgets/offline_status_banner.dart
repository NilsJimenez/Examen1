import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../offline/offline_sync_provider.dart';
import '../screens/offline/centro_sincronizacion_screen.dart';

/// Banner reactivo de estado de red y sincronización (Desafío III).
/// En pantallas generales opera de manera automática y silenciosa en segundo plano:
/// se oculta automáticamente cuando todo está conectado y al día,
/// mostrándose únicamente cuando se pierde la conexión o hay sincronización activa.
class OfflineStatusBanner extends StatelessWidget {
  final bool mostrarAccesoCentroSync;

  const OfflineStatusBanner({
    super.key,
    this.mostrarAccesoCentroSync = true,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<OfflineSyncProvider>(
      builder: (context, provider, _) {
        if (!provider.inicializado && provider.sesion == null) {
          return const SizedBox.shrink();
        }

        final state = provider.bannerState;
        final estaOffline = state == OfflineBannerState.sinConexion;
        final estaSincronizando = state == OfflineBannerState.sincronizando;
        final tieneConflictos = provider.conflictosCount > 0;
        final tienePendientes = provider.pendientesCount > 0;
        final tieneErrorReal = provider.ultimoError != null &&
            provider.ultimoError!.isNotEmpty &&
            !provider.ultimoError!.contains('No hay sesión') &&
            provider.estaConectado;

        // =====================================================================
        // MODO AUTOMÁTICO EN PANTALLAS PRINCIPALES (HOME, CATÁLOGO, DASHBOARDS)
        // Se oculta completamente cuando la conexión está normal y no hay alertas
        // =====================================================================
        if (mostrarAccesoCentroSync) {
          if (!estaOffline && !estaSincronizando && !tieneConflictos && !tieneErrorReal) {
            return const SizedBox.shrink();
          }

          // Indicador sutil de sincronización automática en segundo plano
          if (estaSincronizando) {
            return Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
              color: const Color(0xFF4F46E5),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Sincronizando datos automáticamente...',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            );
          }

          // Notificación discreta de modo sin conexión
          if (estaOffline) {
            return Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              color: const Color(0xFFD97706),
              child: Row(
                children: [
                  const Icon(Icons.wifi_off_rounded, color: Colors.white, size: 14),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      provider.modoOfflineSimulado
                          ? 'Modo sin conexión (Simulado) • Operando en local'
                          : 'Modo sin conexión • Operando desde almacenamiento local',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (tienePendientes)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black26,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${provider.pendientesCount} pendiente(s)',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            );
          }

          // Notificación de conflictos pendientes
          if (tieneConflictos) {
            return Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              color: Colors.red.shade900,
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 14),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${provider.conflictosCount} conflicto(s) de sincronización detectado(s)',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CentroSincronizacionScreen(),
                        ),
                      );
                    },
                    child: const Text(
                      'Resolver ➔',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          // Error crítico del negocio (ej. cuenta suspendida)
          if (tieneErrorReal) {
            return Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              color: Colors.red.shade900,
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.white, size: 14),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      provider.ultimoError!,
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                    ),
                  ),
                ],
              ),
            );
          }

          return const SizedBox.shrink();
        }

        // =====================================================================
        // MODO DETALLADO PARA EL CENTRO DE SINCRONIZACIÓN (mostrarAccesoCentroSync == false)
        // =====================================================================
        final Color bgColor;
        final Color accentColor;
        final IconData icon;
        final String estadoTexto;

        switch (state) {
          case OfflineBannerState.sincronizando:
            bgColor = const Color(0xFF231942);
            accentColor = const Color(0xFFA78BFA);
            icon = Icons.sync;
            estadoTexto = 'SINCRONIZANDO CON EL SERVIDOR...';
            break;
          case OfflineBannerState.sinConexion:
            bgColor = const Color(0xFF2B1D0E);
            accentColor = const Color(0xFFF59E0B);
            icon = Icons.cloud_off;
            estadoTexto = provider.modoOfflineSimulado
                ? 'SIN CONEXIÓN (SIMULADO) • OPERANDO EN SQLITE'
                : 'SIN CONEXIÓN • OPERANDO EN SQLITE LOCAL';
            break;
          case OfflineBannerState.conectado:
            bgColor = const Color(0xFF0F291E);
            accentColor = const Color(0xFF10B981);
            icon = Icons.cloud_done;
            estadoTexto = 'CONECTADO • SINCRONIZACIÓN AUTOMÁTICA ACTIVA';
            break;
        }

        final sesion = provider.sesion;
        final ultimaSyncStr = sesion?.ultimaSincronizacion != null
            ? DateFormat('dd/MM HH:mm').format(sesion!.ultimaSincronizacion!.toLocal())
            : 'Pendiente';

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: bgColor,
                border: Border(
                  bottom: BorderSide(
                    color: accentColor.withValues(alpha: 0.35),
                    width: 1,
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (state == OfflineBannerState.sincronizando)
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: accentColor,
                          ),
                        )
                      else
                        Icon(icon, color: accentColor, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              estadoTexto,
                              style: TextStyle(
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                            ),
                            if (sesion != null)
                              Text(
                                '${sesion.tenantNombre} • Sucursal: ${provider.sucursalActiva?.nombre ?? "Sin asignar"} • Sync: $ultimaSyncStr',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 10.5,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),
                      Tooltip(
                        message: provider.modoOfflineSimulado
                            ? 'Restaurar conexión de red'
                            : 'Simular corte de internet (Modo Offline)',
                        child: InkWell(
                          borderRadius: BorderRadius.circular(8),
                          onTap: () => provider.alternarModoOfflineSimulado(
                            !provider.modoOfflineSimulado,
                          ),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black26,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.white24),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  provider.modoOfflineSimulado
                                      ? Icons.wifi_off
                                      : Icons.wifi,
                                  size: 13,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  provider.modoOfflineSimulado ? 'Off' : 'On',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (tienePendientes || tieneConflictos) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _BadgePill(
                          icon: Icons.schedule,
                          label: '${provider.pendientesCount} pendiente(s)',
                          color: const Color(0xFFEAB308),
                        ),
                        if (tieneConflictos)
                          _BadgePill(
                            icon: Icons.warning_amber_rounded,
                            label: '${provider.conflictosCount} en conflicto',
                            color: Colors.redAccent,
                          ),
                        if (provider.estaConectado &&
                            tienePendientes &&
                            !provider.estaSincronizando)
                          InkWell(
                            onTap: () => provider.sincronizarAhora(),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF8B5CF6),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.sync, color: Colors.white, size: 12),
                                  SizedBox(width: 4),
                                  Text(
                                    'Sincronizar ahora',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _BadgePill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _BadgePill({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black26,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10.5,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
