import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class BolsaService {
  static const String _key = 'bolsa_pruebas';

  Future<List<Map<String, dynamic>>> getItems() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_key);
    if (data == null) return [];
    final List<dynamic> decoded = jsonDecode(data);
    return decoded.map((e) => e as Map<String, dynamic>).toList();
  }

  Future<void> addItem(Map<String, dynamic> item) async {
    final items = await getItems();
    // Item format: { 'variante_id': 1, 'cantidad': 1, 'nombre': '...', 'talla': '...', 'color': '...', 'imagen': '...' }
    final existingIndex = items.indexWhere((e) => e['variante_id'] == item['variante_id']);
    if (existingIndex >= 0) {
      items[existingIndex]['cantidad'] = (items[existingIndex]['cantidad'] as int) + (item['cantidad'] as int);
    } else {
      items.add(item);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(items));
  }

  Future<void> removeItem(int varianteId) async {
    final items = await getItems();
    items.removeWhere((e) => e['variante_id'] == varianteId);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(items));
  }

  Future<void> clearBolsa() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
