import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/main.dart';
import 'package:uluv/diagnostics_service.dart';

class FakeService implements DiagnosticsService {
  @override
  Future<DiagnosticsReport> checkReadiness() async => const DiagnosticsReport(ok:true,message:'API and DB ready');
  @override
  Future<DiagnosticsReport> verifyDatabase() async => const DiagnosticsReport(ok:false,message:'Database not reachable');
}
class DeferredService implements DiagnosticsService {
  final completer = Completer<DiagnosticsReport>();
  int requests = 0;
  @override
  Future<DiagnosticsReport> checkReadiness() async =>
      const DiagnosticsReport(ok: true, message: 'Ready');
  @override
  Future<DiagnosticsReport> verifyDatabase() {
    requests++;
    return completer.future;
  }
}

void main() {
  testWidgets('Ready state responds to tap',(tester) async {
    await tester.pumpWidget(UluvApp(service:FakeService()));
    expect(find.text('Not checked'),findsOneWidget);
    await tester.tap(find.text('Check server'));
    await tester.pumpAndSettle();
    expect(find.text('API and DB ready'),findsOneWidget);
  });
  testWidgets('Failure is shown and retry remains accessible',(tester) async {
    await tester.pumpWidget(UluvApp(service:FakeService()));
    await tester.tap(find.text('Test database'));
    await tester.pumpAndSettle();
    expect(find.text('Database not reachable'),findsOneWidget);
    expect(find.byType(OutlinedButton),findsOneWidget);
  });
  testWidgets('Database button prevents duplicate in-flight requests', (tester) async {
    final service = DeferredService();
    await tester.pumpWidget(UluvApp(service: service));
    await tester.tap(find.text('Test database'));
    await tester.pump();
    expect(service.requests, 1);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final button = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
    expect(button.onPressed, isNull);
    service.completer.complete(
      const DiagnosticsReport(ok: false, message: 'Service temporarily unavailable'),
    );
    await tester.pumpAndSettle();
    expect(find.text('Service temporarily unavailable'), findsOneWidget);
    expect(tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed, isNotNull);
  });
}
