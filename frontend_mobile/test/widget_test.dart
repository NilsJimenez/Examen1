import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:frontend_mobile/main.dart';
import 'package:frontend_mobile/offline/offline_sync_provider.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  testWidgets('FashionStoreApp smoke test', (WidgetTester tester) async {
    final provider = OfflineSyncProvider();

    await tester.pumpWidget(
      ChangeNotifierProvider<OfflineSyncProvider>.value(
        value: provider,
        child: const FashionStoreApp(),
      ),
    );
    await tester.pump();

    expect(find.byType(FashionStoreApp), findsOneWidget);
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
