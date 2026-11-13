import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/main.dart';
import 'package:uluv/diagnostics_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Real Flutter -> Fastify -> DynamoDB Local roundtrip', (tester) async {
    const baseUrl = String.fromEnvironment('ULUV_API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
    const token = String.fromEnvironment('ULUV_DEV_TOKEN', defaultValue: '');
    await tester.pumpWidget(UluvApp(service: HttpDiagnosticsService(baseUrl: baseUrl, devToken: token)));
    await tester.tap(find.text('Check server'));
    await tester.pumpAndSettle(const Duration(milliseconds: 200));
    expect(find.text('API and DynamoDB Local ready'), findsOneWidget);
    await tester.tap(find.text('Test database'));
    await tester.pumpAndSettle(const Duration(milliseconds: 200));
    expect(find.text('Database Put/Get/Query/Delete succeeded'), findsOneWidget);
  });
}
