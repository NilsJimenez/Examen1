import 'package:flutter/material.dart';
import 'venta_pos_screen.dart';

class CajeroDashboardScreen extends StatefulWidget {
  final String rol;
  const CajeroDashboardScreen({super.key, required this.rol});

  @override
  _CajeroDashboardScreenState createState() => _CajeroDashboardScreenState();
}

class _CajeroDashboardScreenState extends State<CajeroDashboardScreen> {
  // En un entorno real, cargaríamos los datos del día desde el backend
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        title: const Text('Panel de Caja', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeader(),
                  const SizedBox(height: 24),
                  _buildQuickActions(),
                  const SizedBox(height: 24),
                  _buildStatCards(),
                  const SizedBox(height: 32),
                  const Text('Últimas Transacciones', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  _buildRecentTransactions(),
                ],
              ),
            ),
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
              child: const Row(
                children: [
                  Icon(Icons.point_of_sale, color: Color(0xFFEAB308), size: 14),
                  SizedBox(width: 6),
                  Text('Punto de Venta (POS)', style: TextStyle(color: Color(0xFFEAB308), fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.circle, color: Colors.green, size: 10),
                  SizedBox(width: 6),
                  Text('Caja Abierta', style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
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
          'Procesa las reservas de vestidor y ventas directas en mostrador',
          style: TextStyle(color: Colors.grey, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildQuickActions() {
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Abriendo escáner de cámara...')));
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 20),
              decoration: BoxDecoration(
                color: const Color(0xFFEAB308),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: const Color(0xFFEAB308).withValues(alpha: 0.2), blurRadius: 10, offset: const Offset(0, 4))
                ]
              ),
              child: const Column(
                children: [
                  Icon(Icons.qr_code_scanner, color: Colors.black, size: 32),
                  SizedBox(height: 8),
                  Text('Escanear QR', style: TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.bold)),
                  Text('Cobrar Reserva', style: TextStyle(color: Colors.black54, fontSize: 11)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const VentaPosScreen()),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 20),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF8B5CF6).withValues(alpha: 0.2), blurRadius: 10, offset: const Offset(0, 4))
                ]
              ),
              child: const Column(
                children: [
                  Icon(Icons.point_of_sale, color: Colors.white, size: 32),
                  SizedBox(height: 8),
                  Text('Venta Manual', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  Text('Sin Reserva', style: TextStyle(color: Colors.white70, fontSize: 11)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatCards() {
    return Row(
      children: [
        Expanded(child: _buildSingleCard('Ingresos Hoy', 'Bs. 0.00', '0 transacciones', Icons.payments, Colors.green)),
        const SizedBox(width: 16),
        Expanded(child: _buildSingleCard('Tickets Abiertos', '0', 'En proceso de pago', Icons.receipt_long, const Color(0xFFEAB308))),
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
          Text(mainValue, style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildRecentTransactions() {
    // Placeholder para la vista de transacciones
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1F),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.all(24.0),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.receipt, color: Colors.grey, size: 40),
                  SizedBox(height: 12),
                  Text('No hay ventas registradas hoy.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ),
          const Divider(color: Colors.white10, height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                TextButton.icon(
                  onPressed: () {}, 
                  icon: const Icon(Icons.history, color: Color(0xFFEAB308), size: 16), 
                  label: const Text('Ver Historial Completo', style: TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold))
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
