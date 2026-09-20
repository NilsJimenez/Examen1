import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter_tts/flutter_tts.dart';
import '../services/reportes_service.dart';
import '../services/admin_service.dart';

class ReportesScreen extends StatefulWidget {
  final String rol;
  const ReportesScreen({super.key, required this.rol});

  @override
  State<ReportesScreen> createState() => _ReportesScreenState();
}

class _ReportesScreenState extends State<ReportesScreen> {
  final ReportesService _reportesService = ReportesService();
  final AdminService _adminService = AdminService();
  final TextEditingController _promptController = TextEditingController();

  late stt.SpeechToText _speech;
  late FlutterTts _flutterTts;
  bool _isListening = false;
  bool _speechEnabled = false;
  bool _isPlayingTTS = false;

  bool _isLoading = true;
  Map<String, dynamic>? _dashboardData;
  List<dynamic> _sucursales = [];
  int? _selectedSucursal;

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();
    _flutterTts = FlutterTts();
    _initSpeech();
    _initTts();
    _initData();
  }

  @override
  void dispose() {
    _flutterTts.stop();
    _speech.stop();
    super.dispose();
  }

  void _initTts() {
    _flutterTts.setLanguage("es-ES");
    _flutterTts.setSpeechRate(0.5);
    _flutterTts.setVolume(1.0);
    _flutterTts.setPitch(1.0);
    _flutterTts.setCompletionHandler(() {
      if (mounted) setState(() => _isPlayingTTS = false);
    });
  }

  Future<void> _initSpeech() async {
    try {
      _speechEnabled = await _speech.initialize(
        onError: (val) {
          debugPrint('STT Error: ${val.errorMsg}');
          if (mounted) setState(() => _isListening = false);
        },
        onStatus: (val) {
          debugPrint('STT Status: $val');
          if (val == 'notListening' || val == 'done') {
            if (mounted) setState(() => _isListening = false);
          }
        },
      );
    } catch (e) {
      debugPrint('STT Init Exception: $e');
      _speechEnabled = false;
    }
    if (mounted) setState(() {});
  }

  void _listen() async {
    if (!_isListening) {
      if (!_speechEnabled) {
        await _initSpeech();
      }
      if (_speechEnabled) {
        setState(() => _isListening = true);
        _speech.listen(
          onResult: (val) {
            setState(() {
              _promptController.text = val.recognizedWords;
            });
          },
          localeId: 'es_ES',
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Micrófono no disponible o sin permisos')));
      }
    } else {
      setState(() => _isListening = false);
      _speech.stop();
    }
  }

  Future<void> _initData() async {
    setState(() => _isLoading = true);
    if (widget.rol.toLowerCase() == 'administrador') {
      _sucursales = await _adminService.getSucursales() ?? [];
    }
    await _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() => _isLoading = true);
    final data = await _reportesService.getDashboard(sucursalId: _selectedSucursal);
    if (mounted) {
      setState(() {
        _dashboardData = data;
        _isLoading = false;
      });
    }
  }

  Future<void> _askGenerativeAI() async {
    if (_promptController.text.trim().isEmpty) return;

    if (_isListening) {
      _speech.stop();
      setState(() => _isListening = false);
    }
    _flutterTts.stop();
    setState(() => _isPlayingTTS = false);

    setState(() => _isLoading = true);
    final sucursalesMap = _sucursales.map((s) => {'id': s['id'], 'nombre': s['nombre']}).toList();
    
    final data = await _reportesService.reporteGenerativo(_promptController.text.trim(), sucursalesMap);
    if (mounted) {
      setState(() {
        if (data != null) {
          _dashboardData = data;
          final resumenIa = data['resumen_ia'];
          if (resumenIa != null) {
            _speak(resumenIa);
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al generar reporte con IA')));
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _speak(String text) async {
    await _flutterTts.speak(text);
    setState(() => _isPlayingTTS = true);
  }

  @override
  Widget build(BuildContext context) {
    final kpis = _dashboardData?['kpis'];
    final ventasDia = _dashboardData?['ventas_por_dia'] as List<dynamic>? ?? [];
    final mensaje = _dashboardData?['mensaje'];
    final resumenIa = _dashboardData?['resumen_ia'];

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1F),
        title: const Text('Reportes e Indicadores', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.rol.toLowerCase() == 'administrador') ...[
                  const Text('Filtrar por Sucursal', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    value: _selectedSucursal,
                    dropdownColor: const Color(0xFF2A2A35),
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: const Color(0xFF1A1A1F),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    items: [
                      const DropdownMenuItem<int>(value: null, child: Text('Todas las Sucursales')),
                      ..._sucursales.map((s) => DropdownMenuItem<int>(
                        value: s['id'],
                        child: Text(s['nombre']),
                      )),
                    ],
                    onChanged: (val) {
                      setState(() => _selectedSucursal = val);
                      _loadDashboard();
                    },
                  ),
                  const SizedBox(height: 24),
                ],

                // Módulo Generativo IA
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A1F),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEAB308).withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.auto_awesome, color: Color(0xFFEAB308)),
                          SizedBox(width: 8),
                          Text('Asistente de Reportes IA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _promptController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Ej: "Muestra las ventas del mes pasado en sucursal Central"',
                          hintStyle: const TextStyle(color: Colors.white38),
                          filled: true,
                          fillColor: const Color(0xFF2A2A35),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          suffixIcon: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: Icon(_isListening ? Icons.mic : Icons.mic_none, color: _isListening ? Colors.redAccent : Colors.grey),
                                onPressed: _listen,
                              ),
                              IconButton(
                                icon: const Icon(Icons.send, color: Color(0xFFEAB308)),
                                onPressed: _askGenerativeAI,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                if (mensaje != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    color: Colors.redAccent.withValues(alpha: 0.1),
                    child: Text(mensaje, style: const TextStyle(color: Colors.redAccent)),
                  ),
                  const SizedBox(height: 24),
                ],

                if (resumenIa != null) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFF2A2A35), borderRadius: BorderRadius.circular(8)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('💡 Resumen Ejecutivo (IA)', style: TextStyle(color: Color(0xFFEAB308), fontWeight: FontWeight.bold)),
                            IconButton(
                              icon: Icon(_isPlayingTTS ? Icons.stop_circle_outlined : Icons.volume_up, color: const Color(0xFFEAB308)),
                              onPressed: () {
                                if (_isPlayingTTS) {
                                  _flutterTts.stop();
                                  setState(() => _isPlayingTTS = false);
                                } else {
                                  _speak(resumenIa);
                                }
                              },
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(resumenIa, style: const TextStyle(color: Colors.white70, height: 1.5)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // KPIs
                if (kpis != null) ...[
                  const Text('Indicadores Clave', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(child: _buildKpiCard('Total Vendido', 'Bs. ${kpis['total_vendido']}')),
                      const SizedBox(width: 12),
                      Expanded(child: _buildKpiCard('Cant. Ventas', '${kpis['cantidad_ventas']}')),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _buildKpiCard('Ticket Promedio', 'Bs. ${kpis['ticket_promedio'].toStringAsFixed(2)}')),
                      const SizedBox(width: 12),
                      Expanded(child: _buildKpiCard('Efectividad Reservas', '${kpis['reservas_concretadas_pct']}%')),
                    ],
                  ),
                  const SizedBox(height: 32),
                ],

                // Gráfico de Barras Simple
                if (ventasDia.isNotEmpty) ...[
                  const Text('Ventas por Día', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Container(
                    height: 200,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFF1A1A1F), borderRadius: BorderRadius.circular(12)),
                    child: _buildSimpleChart(ventasDia),
                  ),
                  const SizedBox(height: 24),
                ],

                // Botón Exportar PDF
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white10,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.picture_as_pdf, color: Colors.white),
                    label: const Text('Exportar PDF de Ventas', style: TextStyle(color: Colors.white)),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Abriendo enlace de descarga...')));
                      // Aquí se lanzaría el url launcher para la descarga real
                    },
                  ),
                ),
              ],
            ),
          ),
    );
  }

  Widget _buildKpiCard(String title, String value) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1F),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(color: Color(0xFFEAB308), fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildSimpleChart(List<dynamic> ventasDia) {
    double maxTotal = 0;
    for (var v in ventasDia) {
      if (v['total'] > maxTotal) maxTotal = v['total'].toDouble();
    }
    if (maxTotal == 0) maxTotal = 1;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: ventasDia.map((v) {
        final double heightPct = (v['total'] as num).toDouble() / maxTotal;
        return Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              width: 24,
              height: 120.0 * heightPct,
              decoration: const BoxDecoration(
                color: Color(0xFF8B5CF6), // Morado
                borderRadius: BorderRadius.vertical(top: Radius.circular(4)),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              v['fecha'].substring(5), // Muestra MM-DD
              style: const TextStyle(color: Colors.grey, fontSize: 10),
            )
          ],
        );
      }).toList(),
    );
  }
}
