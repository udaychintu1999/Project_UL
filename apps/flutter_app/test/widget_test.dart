import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/main.dart';
import 'package:uluv/diagnostics_service.dart';

class StaticService implements DiagnosticsService {
  @override
  Future<DiagnosticsReport> checkReadiness() async => const DiagnosticsReport(ok:true,message:'Ready');
  @override
  Future<DiagnosticsReport> verifyDatabase() async => const DiagnosticsReport(ok:true,message:'DB Ready');
}

void main() {
  testWidgets('U_luv P00 diagnostics app renders without tapping', (tester) async {
    await tester.pumpWidget(UluvApp(service: StaticService()));
    expect(find.text('U_luv · P00 Diagnostics'), findsOneWidget);
    expect(find.text('Check server'), findsOneWidget);
    expect(find.text('Test database'), findsOneWidget);
  });
}
