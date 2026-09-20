import 'package:flutter/material.dart';
import '../services/bolsa_service.dart';
import '../services/reserva_service.dart';
import 'package:intl/intl.dart';

class BolsaPruebasScreen extends StatefulWidget {
  const BolsaPruebasScreen({super.key});

  @override
  _BolsaPruebasScreenState createState() => _BolsaPruebasScreenState();
}

class _BolsaPruebasScreenState extends State<BolsaPruebasScreen> {
  final _bolsaService = BolsaService();
  final _reservaService = ReservaService();

  List<Map<String, dynamic>> _items = [];
  List<dynamic> _sucursales = [];
  int? _selectedSucursalId;
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final items = await _bolsaService.getItems();
    final sucs = await _reservaService.getSucursales();
    if (mounted) {
      setState(() {
        _items = items;
        _sucursales = sucs;
        if (_sucursales.isNotEmpty) {
          _selectedSucursalId = _sucursales[0]['id'];
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFEAB308),
              onPrimary: Colors.black,
              surface: Color(0xFF1A1A1F),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFFEAB308),
              onPrimary: Colors.black,
              surface: Color(0xFF1A1A1F),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _selectedTime = picked);
  }

  Future<void> _confirmarReserva() async {
    if (_items.isEmpty) return;
    if (_selectedSucursalId == null || _selectedDate == null || _selectedTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Completa todos los campos (Sucursal, Fecha y Hora).')));
      return;
    }

    setState(() => _isSubmitting = true);

    final fechaStr = DateFormat('yyyy-MM-dd').format(_selectedDate!);
    final horaStr = '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}:00';

    final reserveItems = _items.map((i) => {
      'variante_id': i['variante_id'],
      'cantidad': i['cantidad'],
    }).toList();

    final resp = await _reservaService.crearReserva(
      sucursalId: _selectedSucursalId!,
      fechaReserva: fechaStr,
      horarioAtencion: horaStr,
      items: reserveItems,
    );

    setState(() => _isSubmitting = false);

    if (resp != null) {
      await _bolsaService.clearBolsa();
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1A1A1F),
            title: const Text('Reserva Confirmada', style: TextStyle(color: Color(0xFFEAB308))),
            content: Text('Tu código de reserva es:\n${resp['codigo_reserva']}\n\nTe esperamos el $fechaStr a las $horaStr.', style: const TextStyle(color: Colors.white)),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context); // volver al detalle
                },
                child: const Text('OK', style: TextStyle(color: Color(0xFFEAB308))),
              )
            ],
          )
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al reservar. Puede que no haya stock en esa sucursal.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0D0D10),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFEAB308))),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        title: const Text('Bolsa de Pruebas', style: TextStyle(color: Colors.white, fontFamily: 'Serif')),
        backgroundColor: const Color(0xFF1A1A1F),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _items.isEmpty
          ? const Center(child: Text('Tu bolsa está vacía.', style: TextStyle(color: Colors.grey, fontSize: 16)))
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    itemBuilder: (ctx, i) {
                      final item = _items[i];
                      return Card(
                        color: const Color(0xFF1A1A1F),
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: item['imagen'] != null 
                              ? Image.network(item['imagen'], width: 50, height: 50, fit: BoxFit.cover)
                              : const Icon(Icons.image, color: Colors.grey),
                          title: Text(item['nombre'], style: const TextStyle(color: Colors.white)),
                          subtitle: Text('Talla: ${item['talla']} | Color: ${item['color']}\nCantidad: ${item['cantidad']}', style: const TextStyle(color: Colors.grey)),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete, color: Colors.red),
                            onPressed: () async {
                              await _bolsaService.removeItem(item['variante_id']);
                              _loadData();
                            },
                          ),
                          isThreeLine: true,
                        ),
                      );
                    },
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: const BoxDecoration(
                    color: Color(0xFF1A1A1F),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Detalles de la Reserva', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<int>(
                        value: _selectedSucursalId,
                        dropdownColor: const Color(0xFF2A2A35),
                        style: const TextStyle(color: Colors.white),
                        decoration: const InputDecoration(
                          labelText: 'Selecciona Sucursal',
                          labelStyle: TextStyle(color: Colors.grey),
                          enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                        ),
                        items: _sucursales.map((s) => DropdownMenuItem<int>(
                          value: s['id'],
                          child: Text(s['nombre']),
                        )).toList(),
                        onChanged: (val) => setState(() => _selectedSucursalId = val),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.grey)),
                              onPressed: _selectDate,
                              icon: const Icon(Icons.calendar_today, size: 18),
                              label: Text(_selectedDate == null ? 'Fecha' : DateFormat('dd/MM/yyyy').format(_selectedDate!)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.grey)),
                              onPressed: _selectTime,
                              icon: const Icon(Icons.access_time, size: 18),
                              label: Text(_selectedTime == null ? 'Hora' : _selectedTime!.format(context)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFEAB308),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: _isSubmitting ? null : _confirmarReserva,
                          child: _isSubmitting 
                              ? const CircularProgressIndicator(color: Colors.black)
                              : const Text('Confirmar Reserva para Pruebas', style: TextStyle(color: Colors.black, fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                )
              ],
            ),
    );
  }
}
