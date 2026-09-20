import 'package:flutter/material.dart';
import 'package:model_viewer_plus/model_viewer_plus.dart';

class VestidorARScreen extends StatelessWidget {
  final String modeloArUrl;
  final String productName;

  const VestidorARScreen({
    super.key,
    required this.modeloArUrl,
    required this.productName,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Vestidor Virtual: $productName', style: const TextStyle(color: Colors.white, fontSize: 16)),
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // Visor 3D con soporte de AR nativo activado
          ModelViewer(
            backgroundColor: Colors.black,
            src: modeloArUrl,
            alt: "Modelo 3D de $productName",
            ar: true,
            arModes: const ['scene-viewer', 'webxr', 'quick-look'],
            autoRotate: true,
            cameraControls: true,
            arScale: ArScale.auto,
          ),
          
          Positioned(
            bottom: 40,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEAB308), width: 1),
              ),
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.view_in_ar, color: Color(0xFFEAB308), size: 32),
                  SizedBox(height: 8),
                  Text(
                    'Toca el botón de AR (cubo) abajo a la derecha para superponer la prenda usando tu cámara.',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
