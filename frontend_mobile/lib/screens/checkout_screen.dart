import 'package:flutter/material.dart';
import '../services/venta_service.dart';
import 'home_screen.dart';

class CheckoutScreen extends StatefulWidget {
  final double subtotal;
  final String rol;
  const CheckoutScreen({super.key, required this.subtotal, required this.rol});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _metodoEntrega = 'retiro_tienda';
  final TextEditingController _direccionController = TextEditingController();
  final VentaService _ventaService = VentaService();
  bool _isProcessing = false;

  double get _costoEnvio => _metodoEntrega == 'delivery' ? 30.0 : 0.0;
  double get _total => widget.subtotal + _costoEnvio;

  Future<void> _abrirPasarelaLibelula() async {
    if (_metodoEntrega == 'delivery' && _direccionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor, ingresa una dirección de envío.')));
      return;
    }

    setState(() => _isProcessing = true);

    // 1. Crear Orden
    final orden = await _ventaService.checkout(_metodoEntrega, _direccionController.text.trim());
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (orden == null || orden['venta_id'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al crear la orden. Verifica stock.')));
      return;
    }

    final int ventaId = orden['venta_id'];
    final double totalAPagar = orden['total'] is int ? (orden['total'] as int).toDouble() : orden['total'];

    // 2. Abrir Pasarela Mock
    _showLibelulaGateway(ventaId, totalAPagar);
  }

  void _showLibelulaGateway(int ventaId, double totalAPagar) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: _LibelulaGatewayWidget(
          ventaId: ventaId,
          total: totalAPagar,
          onPagoExitoso: (comprobante) {
            Navigator.pop(ctx);
            _showSuccessDialog(comprobante);
          },
        ),
      ),
    );
  }

  void _showSuccessDialog(String comprobante) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('¡Compra Exitosa!', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 60),
            const SizedBox(height: 16),
            const Text('Tu pago ha sido aprobado y el pedido fue registrado.', style: TextStyle(color: Colors.white), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text('Comprobante:\n$comprobante', style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold), textAlign: TextAlign.center),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308)),
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).popUntil((route) => route.isFirst);
              },
              child: const Text('Volver al Inicio', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
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
        title: const Text('Checkout', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isProcessing
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Color(0xFFEAB308)),
                  SizedBox(height: 16),
                  Text('Procesando pago seguro...', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Método de Entrega', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  ListTile(
                    tileColor: const Color(0xFF1A1A1F),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    title: const Text('Retiro en Tienda', style: TextStyle(color: Colors.white)),
                    subtitle: const Text('Gratis - Listo en 2 horas', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    leading: Radio<String>(
                      value: 'retiro_tienda',
                      groupValue: _metodoEntrega,
                      activeColor: const Color(0xFFEAB308),
                      onChanged: (val) => setState(() => _metodoEntrega = val!),
                    ),
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    tileColor: const Color(0xFF1A1A1F),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    title: const Text('Delivery a Domicilio', style: TextStyle(color: Colors.white)),
                    subtitle: const Text('Costo: Bs 30.00 - Entrega hoy', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    leading: Radio<String>(
                      value: 'delivery',
                      groupValue: _metodoEntrega,
                      activeColor: const Color(0xFFEAB308),
                      onChanged: (val) => setState(() => _metodoEntrega = val!),
                    ),
                  ),
                  if (_metodoEntrega == 'delivery') ...[
                    const SizedBox(height: 16),
                    TextField(
                      controller: _direccionController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Dirección de envío completa',
                        labelStyle: const TextStyle(color: Colors.grey),
                        filled: true,
                        fillColor: const Color(0xFF1A1A1F),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                      maxLines: 2,
                    )
                  ],
                  const SizedBox(height: 32),
                  const Text('Resumen de Pago', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A1F),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Subtotal', style: TextStyle(color: Colors.grey)),
                            Text('Bs ${widget.subtotal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Costo de Envío', style: TextStyle(color: Colors.grey)),
                            Text('Bs ${_costoEnvio.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white)),
                          ],
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: Divider(color: Colors.white24),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Total a Pagar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                            Text('Bs ${_total.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold, fontSize: 20)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
      bottomNavigationBar: _isProcessing
          ? null
          : Container(
              padding: const EdgeInsets.all(24),
              color: const Color(0xFF1A1A1F),
              child: SafeArea(
                child: SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEAB308),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                    ),
                    onPressed: _abrirPasarelaLibelula,
                    child: Text('Pagar Bs ${_total.toStringAsFixed(2)}', style: const TextStyle(color: Colors.black, fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
            ),
    );
  }
}

class _LibelulaGatewayWidget extends StatefulWidget {
  final int ventaId;
  final double total;
  final Function(String comprobante) onPagoExitoso;

  const _LibelulaGatewayWidget({
    required this.ventaId,
    required this.total,
    required this.onPagoExitoso,
  });

  @override
  State<_LibelulaGatewayWidget> createState() => _LibelulaGatewayWidgetState();
}

class _LibelulaGatewayWidgetState extends State<_LibelulaGatewayWidget> {
  String _metodoPago = 'tarjeta';
  bool _isProcessing = false;
  final VentaService _ventaService = VentaService();

  Future<void> _simularPago() async {
    setState(() => _isProcessing = true);
    // Simular tiempo de pasarela
    await Future.delayed(const Duration(seconds: 2));

    final pago = await _ventaService.pagarVenta(widget.ventaId, _metodoPago, widget.total);
    if (!mounted) return;

    setState(() => _isProcessing = false);

    if (pago != null && pago['numero_comprobante'] != null) {
      widget.onPagoExitoso(pago['numero_comprobante']);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pago rechazado por la pasarela.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Libélula Checkout', style: TextStyle(color: Colors.blueAccent, fontSize: 20, fontWeight: FontWeight.bold)),
              IconButton(icon: const Icon(Icons.close, color: Colors.grey), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 16),
          Text('Total a pagar: Bs ${widget.total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _metodoPago = 'tarjeta'),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _metodoPago == 'tarjeta' ? Colors.blue.withAlpha(25) : Colors.grey.withAlpha(25),
                      border: Border.all(color: _metodoPago == 'tarjeta' ? Colors.blue : Colors.transparent),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.credit_card, color: Colors.blue),
                        SizedBox(height: 8),
                        Text('Tarjeta', style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _metodoPago = 'qr'),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _metodoPago == 'qr' ? Colors.blue.withAlpha(25) : Colors.grey.withAlpha(25),
                      border: Border.all(color: _metodoPago == 'qr' ? Colors.blue : Colors.transparent),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.qr_code, color: Colors.blue),
                        SizedBox(height: 8),
                        Text('QR Simple', style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 24),
          if (_metodoPago == 'tarjeta') ...[
            TextField(
              decoration: InputDecoration(
                labelText: 'Número de Tarjeta',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                prefixIcon: const Icon(Icons.credit_card),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      labelText: 'MM/AA',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      labelText: 'CVV',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    obscureText: true,
                  ),
                ),
              ],
            ),
          ] else ...[
            Center(
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    color: Colors.black,
                    child: const Icon(Icons.qr_code_2, size: 150, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  const Text('Escanea con tu App Bancaria', style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blueAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: _isProcessing ? null : _simularPago,
              child: _isProcessing
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Confirmar Pago', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          )
        ],
      ),
    );
  }
}
