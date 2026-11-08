import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'constants.dart';
import 'offline/offline_sync_provider.dart';
import 'screens/login_screen.dart';
import 'services/push_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Constants.init();
  await PushNotificationService.instance.init();
  runApp(
    ChangeNotifierProvider(
      create: (_) => OfflineSyncProvider()..inicializar(),
      child: const FashionStoreApp(),
    ),
  );
}

class FashionStoreApp extends StatelessWidget {
  const FashionStoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FashionStore Mobile',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: PushNotificationService.instance.messengerKey,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF8B5CF6),
        scaffoldBackgroundColor: const Color(0xFF131316),
        fontFamily: 'Roboto',
      ),
      home: LoginScreen(),
    );
  }
}
