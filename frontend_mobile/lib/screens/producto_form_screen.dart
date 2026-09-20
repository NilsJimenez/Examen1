import 'package:flutter/material.dart';
import '../services/admin_service.dart';

class ProductoFormScreen extends StatefulWidget {
  final Map<String, dynamic>? producto;
  const ProductoFormScreen({super.key, this.producto});

  @override
  _ProductoFormScreenState createState() => _ProductoFormScreenState();
}

class _ProductoFormScreenState extends State<ProductoFormScreen> {
  final AdminService _adminService = AdminService();
  bool _isLoading = true;
  bool _isSaving = false;

  bool get _isEditing => widget.producto != null;

  List<dynamic> _categorias = [];
  List<dynamic> _proveedores = [];
  List<dynamic> _colecciones = [];
  List<dynamic> _tallas = [];
  List<dynamic> _colores = [];
  
  final _nombreCtrl = TextEditingController();
  final _skuCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _precioCtrl = TextEditingController();
  final _imagenCtrl = TextEditingController();
  final _modeloArCtrl = TextEditingController();

  int? _selectedCategoria;
  int? _selectedProveedor;
  int? _selectedColeccion;

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      _nombreCtrl.text = widget.producto!['nombre'] ?? '';
      _descCtrl.text = widget.producto!['descripcion'] ?? '';
      _precioCtrl.text = widget.producto!['precio_base']?.toString() ?? '';
      _imagenCtrl.text = widget.producto!['imagen_url'] ?? '';
      _modeloArCtrl.text = widget.producto!['modelo_ar_url'] ?? '';
    }
    _loadDependencies();
  }

  Future<void> _loadDependencies() async {
    final cats = await _adminService.getCategorias();
    final provs = await _adminService.getProveedores();
    final cols = await _adminService.getColecciones();
    final tallas = await _adminService.getTallas();
    final colores = await _adminService.getColores();

    setState(() {
      _categorias = cats;
      _proveedores = provs;
      _colecciones = cols;
      _tallas = tallas;
      _colores = colores;
      
      if (_isEditing) {
        // Asignar los seleccionados existentes asegurando que existan en las listas
        if (widget.producto!['categoria'] != null) {
          _selectedCategoria = widget.producto!['categoria']['id'];
        }
        // Proveedor y Colección no siempre vienen detallados en el listado básico, 
        // pero asignamos sus IDs si existen.
        _selectedProveedor = widget.producto!['proveedor_id'] ?? (_proveedores.isNotEmpty ? _proveedores.first['id'] : null);
        _selectedColeccion = widget.producto!['coleccion_id'];
      } else {
        if (_categorias.isNotEmpty) _selectedCategoria = _categorias.first['id'];
        if (_proveedores.isNotEmpty) _selectedProveedor = _proveedores.first['id'];
        if (_colecciones.isNotEmpty) _selectedColeccion = _colecciones.first['id'];
      }
      
      _isLoading = false;
    });
  }

  Future<void> _saveProducto() async {
    if (_nombreCtrl.text.isEmpty || _precioCtrl.text.isEmpty || (!_isEditing && _skuCtrl.text.isEmpty) || _selectedCategoria == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor, completa los campos requeridos.'), backgroundColor: Colors.redAccent));
      return;
    }

    if (!_isEditing && (_tallas.isEmpty || _colores.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error: No existen Tallas o Colores en el sistema. (Precondición no cumplida)'), backgroundColor: Colors.redAccent));
      return;
    }

    final double? precio = double.tryParse(_precioCtrl.text);
    if (precio == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('El precio debe ser un número válido.'), backgroundColor: Colors.redAccent));
      return;
    }

    final modeloUrl = _modeloArCtrl.text.trim().toLowerCase();
    if (modeloUrl.isNotEmpty && !modeloUrl.endsWith('.glb') && !modeloUrl.endsWith('.usdz')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error: El archivo de modelo 3D debe ser formato *.GLB o *.USDZ válido.'), backgroundColor: Colors.redAccent));
      return;
    }

    setState(() => _isSaving = true);

    bool success = false;

    if (_isEditing) {
      final data = {
        'nombre': _nombreCtrl.text.trim(),
        'descripcion': _descCtrl.text.trim(),
        'categoria_id': _selectedCategoria,
        'precio_base': precio,
        'imagen_url': _imagenCtrl.text.trim().isNotEmpty ? _imagenCtrl.text.trim() : null,
        'modelo_ar_url': _modeloArCtrl.text.trim().isNotEmpty ? _modeloArCtrl.text.trim() : null,
      };
      success = await _adminService.updateProducto(widget.producto!['id'], data);
    } else {
      final data = {
        'nombre': _nombreCtrl.text.trim(),
        'descripcion': _descCtrl.text.trim(),
        'categoria_id': _selectedCategoria,
        'proveedor_id': _selectedProveedor,
        'coleccion_id': _selectedColeccion,
        'precio_base': precio,
        'imagen_url': _imagenCtrl.text.trim().isNotEmpty ? _imagenCtrl.text.trim() : null,
        'modelo_ar_url': _modeloArCtrl.text.trim().isNotEmpty ? _modeloArCtrl.text.trim() : null,
        'variantes': [
          {
            'talla_id': _tallas.first['id'],
            'color_id': _colores.first['id'],
            'sku': _skuCtrl.text.trim(),
            'precio_adicional': 0.0,
            'stock_inicial': 0
          }
        ]
      };
      success = await _adminService.createProducto(data);
    }
    
    setState(() => _isSaving = false);

    if (success) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_isEditing ? 'Prenda actualizada correctamente' : 'Prenda registrada con éxito'), backgroundColor: Colors.green));
      Navigator.pop(context, true); 
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error al guardar la prenda.'), backgroundColor: Colors.redAccent));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D10),
      appBar: AppBar(
        title: Text(_isEditing ? 'Editar Producto' : 'Nuevo Producto', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1A1A1F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          _isSaving 
            ? const Center(child: Padding(padding: EdgeInsets.only(right: 20), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Color(0xFFEAB308), strokeWidth: 2))))
            : IconButton(
                icon: const Icon(Icons.check, color: Color(0xFFEAB308)),
                onPressed: _saveProducto,
              ),
        ],
      ),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFFEAB308)))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionTitle('INFORMACIÓN BÁSICA'),
                _buildTextField(_nombreCtrl, 'Nombre del Producto', Icons.checkroom),
                if (!_isEditing) _buildTextField(_skuCtrl, 'Código SKU', Icons.qr_code),
                _buildTextField(_descCtrl, 'Descripción', Icons.description, maxLines: 3),
                _buildTextField(_precioCtrl, 'Precio Base (Bs.)', Icons.attach_money, isNumber: true),
                
                const SizedBox(height: 24),
                _buildSectionTitle('CLASIFICACIÓN'),
                _buildDropdown('Categoría', _categorias, _selectedCategoria, (v) => setState(() => _selectedCategoria = v)),
                if (!_isEditing) _buildDropdown('Proveedor', _proveedores, _selectedProveedor, (v) => setState(() => _selectedProveedor = v)),
                if (!_isEditing) _buildDropdown('Colección (Opcional)', _colecciones, _selectedColeccion, (v) => setState(() => _selectedColeccion = v), allowClear: true),

                const SizedBox(height: 24),
                _buildSectionTitle('MULTIMEDIA Y REALIDAD AUMENTADA (AR)'),
                _buildFilePickerSimulator(_imagenCtrl, 'URL Fotografía Principal (JPG/PNG)', Icons.image),
                _buildFilePickerSimulator(_modeloArCtrl, 'URL Modelo 3D AR (*.glb / *.usdz)', Icons.view_in_ar, isAr: true),

                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEAB308), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                    onPressed: _isSaving ? null : _saveProducto,
                    child: Text(_isEditing ? 'GUARDAR CAMBIOS' : 'GUARDAR PRODUCTO', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                )
              ],
            ),
          ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Text(
        title,
        style: const TextStyle(color: Color(0xFF8B5CF6), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.5),
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon, {bool isNumber = false, int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: controller,
        keyboardType: isNumber ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
        maxLines: maxLines,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Colors.grey, fontSize: 14),
          prefixIcon: maxLines == 1 ? Icon(icon, color: Colors.grey) : null,
          filled: true,
          fillColor: const Color(0xFF1A1A1F),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
        ),
      ),
    );
  }

  Widget _buildDropdown(String label, List<dynamic> items, int? selectedValue, Function(int?) onChanged, {bool allowClear = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<int>(
        value: selectedValue,
        dropdownColor: const Color(0xFF2A2A35),
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Colors.grey),
          filled: true,
          fillColor: const Color(0xFF1A1A1F),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
        ),
        items: [
          if (allowClear) const DropdownMenuItem<int>(value: null, child: Text('Ninguno', style: TextStyle(color: Colors.grey))),
          ...items.map<DropdownMenuItem<int>>((i) => DropdownMenuItem<int>(value: i['id'], child: Text(i['nombre'])))
        ],
        onChanged: onChanged,
      ),
    );
  }

  Widget _buildFilePickerSimulator(TextEditingController controller, String hint, IconData icon, {bool isAr = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(color: Colors.grey, fontSize: 13),
                prefixIcon: Icon(icon, color: isAr ? const Color(0xFF8B5CF6) : Colors.grey),
                filled: true,
                fillColor: const Color(0xFF1A1A1F),
                border: const OutlineInputBorder(borderRadius: BorderRadius.horizontal(left: Radius.circular(8)), borderSide: BorderSide.none),
              ),
            ),
          ),
          InkWell(
            onTap: () {
              // Simulador de Explorador de Archivos
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Simulando apertura de explorador de archivos...'), backgroundColor: Colors.orange));
              if (isAr) controller.text = 'https://assets.fashionstore.com/models/new_model.glb';
              else controller.text = 'https://assets.fashionstore.com/img/new_pic.jpg';
            },
            child: Container(
              height: 56, // Match TextField height approximately
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFF2A2A35),
                borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
                border: Border.all(color: const Color(0xFF1A1A1F)),
              ),
              child: const Icon(Icons.folder_open, color: Colors.white),
            ),
          )
        ],
      ),
    );
  }
}
