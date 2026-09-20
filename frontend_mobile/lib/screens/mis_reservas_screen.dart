import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/reserva_service.dart';

class MisReservasScreen extends StatefulWidget {
  const MisReservasScreen({super.key});

  @override
  _MisReservasScreenState createState() => _MisReservasScreenState();
}

class _MisReservasScreenState extends State<MisReservasScreen> {
  List<dynamic> _reservas = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadReservas();
  }

  Future<void> _loadReservas() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token');
    try {
      final response = await http.get(
        Uri.parse('${Constants.apiUrl}/reservas/mis-reservas'),
        headers: {
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        }
      );
      if (response.statusCode == 200) {
        setState(() {
          _reservas = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  void _showQRDialog(String codigoReserva) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Código QR de Check-in', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Muestra este código al encargado en tienda.', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 13)),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: QrImageView(
                data: codigoReserva,
                version: QrVersions.auto,
                size: 200.0,
              ),
            ),
            const SizedBox(height: 16),
            Text(codigoReserva, style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, fontSize: 18, letterSpacing: 2)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cerrar', style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        title: const Text('Mis Reservas', style: TextStyle(color: Colors.white, fontFamily: 'Serif')),
        backgroundColor: const Color(0xFF1A1A1F),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
        : _reservas.isEmpty 
          ? const Center(child: Text('No tienes reservas activas.', style: TextStyle(color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _reservas.length,
              itemBuilder: (ctx, i) {
                final res = _reservas[i];
                final fecha = res['fecha'] ?? '';
                final hora = res['hora'] ?? '';
                final estado = (res['estado'] ?? '').toString().toUpperCase();
                
                Color c = Colors.grey;
                if (estado == 'PENDIENTE') c = const Color(0xFFEAB308);
                if (estado == 'COMPLETADA') c = Colors.green;
                if (estado == 'CANCELADA') c = Colors.red;

                return Card(
                  color: const Color(0xFF1A1A1F),
                  margin: const EdgeInsets.only(bottom: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(res['codigo_reserva'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: c.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(4)),
                              child: Text(estado, style: TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.bold)),
                            )
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text('Sucursal: ${res['sucursal']}', style: const TextStyle(color: Colors.grey)),
                        Text('Cita: $fecha a las $hora', style: const TextStyle(color: Colors.grey)),
                        const SizedBox(height: 12),
                        const Text('Prendas:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        if (res['items'] != null)
                          ...((res['items'] as List).map((d) {
                            return Text('- ${d['cantidad']}x ${d['producto']} (T: ${d['talla']}, C: ${d['color']})', style: const TextStyle(color: Colors.grey, fontSize: 13));
                          })).toList(),
                        if (estado == 'PENDIENTE' || estado == 'CONFIRMADA' || estado == 'PREPARADA') ...[
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFEAB308),
                                foregroundColor: Colors.black,
                              ),
                              icon: const Icon(Icons.qr_code),
                              label: const Text('Mostrar Código QR para Check-in', style: TextStyle(fontWeight: FontWeight.bold)),
                              onPressed: () {
                                _showQRDialog(res['codigo_reserva']);
                              },
                            ),
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.redAccent,
                                side: const BorderSide(color: Colors.redAccent),
                              ),
                              onPressed: () async {
                                final confirm = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    backgroundColor: const Color(0xFF1A1A1F),
                                    title: const Text('¿Cancelar Reserva?', style: TextStyle(color: Colors.white)),
                                    content: const Text('Esta acción no se puede deshacer y el stock será liberado.', style: TextStyle(color: Colors.grey)),
                                    actions: [
                                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Atrás', style: TextStyle(color: Colors.grey))),
                                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sí, Cancelar', style: TextStyle(color: Colors.redAccent))),
                                    ],
                                  )
                                );
                                if (confirm == true) {
                                  final success = await ReservaService().cancelarReserva(res['id']);
                                  if (success && mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reserva cancelada correctamente. Stock liberado.')));
                                    _loadReservas();
                                  } else if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo cancelar la reserva.')));
                                  }
                                }
                              },
                              child: const Text('Cancelar Reserva'),
                            ),
                          )
                        ]
                      ],
                    ),
                  )
                );
              },
            ),
    );
  }
}
