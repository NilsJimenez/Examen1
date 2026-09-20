import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';

import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';
import 'package:flutter/services.dart';

class ARMirrorScreen extends StatefulWidget {
  final String? superiorUrl;
  final String? inferiorUrl;

  const ARMirrorScreen({Key? key, this.superiorUrl, this.inferiorUrl}) : super(key: key);

  @override
  _ARMirrorScreenState createState() => _ARMirrorScreenState();
}

class _ARMirrorScreenState extends State<ARMirrorScreen> {
  CameraController? _cameraController;
  final PoseDetector _poseDetector = PoseDetector(options: PoseDetectorOptions());
  bool _isDetecting = false;
  Pose? _currentPose;
  
  CameraDescription? _frontCamera;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      for (var camera in cameras) {
        if (camera.lensDirection == CameraLensDirection.front) {
          _frontCamera = camera;
          break;
        }
      }

      if (_frontCamera != null) {
        _cameraController = CameraController(
          _frontCamera!,
          ResolutionPreset.medium,
          enableAudio: false,
          imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
        );

        // El camera controller solicitará el permiso automáticamente en Android/iOS
        await _cameraController!.initialize();
        if (mounted) {
          setState(() {});
          _cameraController!.startImageStream((CameraImage image) {
            _processImage(image);
          });
        }
      }
    } catch (e) {
      print("Error inicializando cámara: $e");
    }
  }

  Future<void> _processImage(CameraImage image) async {
    if (_isDetecting) return;
    _isDetecting = true;

    try {
      final WriteBuffer allBytes = WriteBuffer();
      for (final Plane plane in image.planes) {
        allBytes.putUint8List(plane.bytes);
      }
      final bytes = allBytes.done().buffer.asUint8List();

      final Size imageSize = Size(image.width.toDouble(), image.height.toDouble());
      final cameraRotation = InputImageRotationValue.fromRawValue(_frontCamera!.sensorOrientation);

      final format = InputImageFormatValue.fromRawValue(image.format.raw);

      if (cameraRotation != null && format != null) {
        final metadata = InputImageMetadata(
          size: imageSize,
          rotation: cameraRotation,
          format: format,
          bytesPerRow: image.planes[0].bytesPerRow,
        );

        final inputImage = InputImage.fromBytes(bytes: bytes, metadata: metadata);
        final poses = await _poseDetector.processImage(inputImage);

        if (poses.isNotEmpty) {
          setState(() {
            _currentPose = poses.first;
          });
        }
      }
    } catch (e) {
      // Ignorar errores de procesamiento
    } finally {
      _isDetecting = false;
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _poseDetector.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.amber)),
      );
    }

    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text("Espejo Mágico AR", style: TextStyle(color: Colors.white)),
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Espejar camara
          Transform.scale(
            scaleX: -1,
            alignment: Alignment.center,
            child: CameraPreview(_cameraController!),
          ),
          
          if (_currentPose != null) 
            CustomPaint(
              painter: ARClothingPainter(
                pose: _currentPose!,
                imageSize: Size(_cameraController!.value.previewSize!.height, _cameraController!.value.previewSize!.width),
                superiorUrl: widget.superiorUrl,
                inferiorUrl: widget.inferiorUrl,
              ),
            ),
        ],
      ),
    );
  }
}

class ARClothingPainter extends CustomPainter {
  final Pose pose;
  final Size imageSize;
  final String? superiorUrl;
  final String? inferiorUrl;

  ARClothingPainter({
    required this.pose,
    required this.imageSize,
    this.superiorUrl,
    this.inferiorUrl,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final double scaleX = size.width / imageSize.width;
    final double scaleY = size.height / imageSize.height;

    final leftShoulder = pose.landmarks[PoseLandmarkType.leftShoulder];
    final rightShoulder = pose.landmarks[PoseLandmarkType.rightShoulder];
    final leftHip = pose.landmarks[PoseLandmarkType.leftHip];
    final rightHip = pose.landmarks[PoseLandmarkType.rightHip];

    if (leftShoulder != null && rightShoulder != null) {
      final lx = size.width - (leftShoulder.x * scaleX);
      final rx = size.width - (rightShoulder.x * scaleX);
      final midX = (lx + rx) / 2;
      final midY = (leftShoulder.y + rightShoulder.y) / 2 * scaleY;
      
      final width = (lx - rx).abs() * 2.2;
      
      if (superiorUrl != null) {
        final paint = Paint()
          ..color = Colors.blue.withOpacity(0.6)
          ..style = PaintingStyle.fill;
        canvas.drawRect(Rect.fromCenter(center: Offset(midX, midY + width*0.3), width: width, height: width), paint);
      }
    }

    if (leftHip != null && rightHip != null) {
      final lx = size.width - (leftHip.x * scaleX);
      final rx = size.width - (rightHip.x * scaleX);
      final midX = (lx + rx) / 2;
      final midY = (leftHip.y + rightHip.y) / 2 * scaleY;
      
      final width = (lx - rx).abs() * 2.5;

      if (inferiorUrl != null) {
        final paint = Paint()
          ..color = Colors.red.withOpacity(0.6)
          ..style = PaintingStyle.fill;
        canvas.drawRect(Rect.fromCenter(center: Offset(midX, midY + width*0.5), width: width, height: width*1.2), paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant ARClothingPainter oldDelegate) {
    return true; 
  }
}
