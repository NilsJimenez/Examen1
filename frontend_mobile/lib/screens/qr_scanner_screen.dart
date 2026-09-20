import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/reserva_service.dart';

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({super.key});

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  final MobileScannerController _scannerController = MobileScannerController();
  final TextEditingController _codeController = TextEditingController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _scannerController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _processCode(String codigo) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    
    _scannerController.stop();

    try {
      final reserva = await ReservaService().checkinQR(codigo);
      if (reserva != null && reserva['valido'] == true) {
        if (!mounted) return;
        _showCheckinSuccess(reserva);
      } else {
        if (!mounted) return;
        _showErrorDialog('Código inválido o reserva no encontrada.');
      }
    } catch (e) {
      if (!mounted) return;
      _showErrorDialog('Ocurrió un error al verificar la reserva.');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF2A2A35),
        title: const Text('Error', style: TextStyle(color: Colors.red)),
        content: Text(message, style: const TextStyle(color: Colors.white)),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _scannerController.start();
            },
            child: const Text('Intentar de nuevo', style: TextStyle(color: Color(0xFFEAB308))),
          )
        ],
      ),
    );
  }

  void _showCheckinSuccess(Map<String, dynamic> reserva) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF2A2A35),
        title: const Text('Reserva Encontrada', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cliente: ${reserva['cliente']}', style: const TextStyle(color: Colors.white)),
            const SizedBox(height: 8),
            Text('Estado actual: ${reserva['estado'].toString().toUpperCase()}', style: const TextStyle(color: Colors.yellow)),
            const SizedBox(height: 8),
            const Text('Prendas:', style: TextStyle(color: Colors.grey)),
            ...((reserva['items'] as List).map((i) => Text('- ${i['cantidad']}x ${i['producto']} (T: ${i['talla']})', style: const TextStyle(color: Colors.white70)))),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _isProcessing = true);
              final ok = await ReservaService().atenderReserva(reserva['reserva_id']);
              if (!mounted) return;
              if (ok) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Check-in realizado correctamente. Reserva Atendida.')));
                Navigator.pop(context, true); // Regresar e indicar éxito
              } else {
                _showErrorDialog('No se pudo marcar como atendida.');
              }
            },
            child: const Text('Marcar Atendida', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
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
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Escáner QR - Check-in', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          Expanded(
            flex: 3,
            child: Stack(
              children: [
                MobileScanner(
                  controller: _scannerController,
                  onDetect: (capture) {
                    final List<Barcode> barcodes = capture.barcodes;
                    if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
                      _processCode(barcodes.first.rawValue!);
                    }
                  },
                ),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFEAB308).withOpacity(0.5), width: 4),
                  ),
                  margin: const EdgeInsets.all(40),
                ),
                if (_isProcessing)
                  const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
              ],
            ),
          ),
          Expanded(
            flex: 1,
            child: Container(
              padding: const EdgeInsets.all(24),
              color: const Color(0xFF1A1A1F),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('O ingresa el código manualmente', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _codeController,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Ej. RES-A1B2C3',
                            hintStyle: const TextStyle(color: Colors.white38),
                            filled: true,
                            fillColor: const Color(0xFF2A2A35),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEAB308),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        ),
                        onPressed: () {
                          if (_codeController.text.isNotEmpty) {
                            _processCode(_codeController.text.trim());
                          }
                        },
                        child: const Icon(Icons.search, color: Colors.black),
                      )
                    ],
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
