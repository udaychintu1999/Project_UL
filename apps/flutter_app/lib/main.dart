import 'package:flutter/material.dart';
import 'diagnostics_service.dart';

void main() {
  const baseUrl = String.fromEnvironment('ULUV_API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');
  const devToken = String.fromEnvironment('ULUV_DEV_TOKEN', defaultValue: '');
  runApp(UluvApp(service: HttpDiagnosticsService(baseUrl: baseUrl, devToken: devToken)));
}

class UluvApp extends StatelessWidget {
  const UluvApp({super.key, required this.service});
  final DiagnosticsService service;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'U_luv Diagnostics',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFF2757E)), useMaterial3: true),
      home: DiagnosticsHome(service: service),
    );
  }
}

class DiagnosticsHome extends StatefulWidget {
  const DiagnosticsHome({super.key, required this.service});
  final DiagnosticsService service;
  @override
  State<DiagnosticsHome> createState() => _DiagnosticsHomeState();
}

class _DiagnosticsHomeState extends State<DiagnosticsHome> {
  bool busy = false;
  String status = 'Not checked';
  bool? healthy;

  Future<void> runCheck(Future<DiagnosticsReport> Function() operation) async {
    if (busy) return;
    setState(() {busy = true;status = 'Checking...';healthy = null;});
    try {
      final result = await operation();
      if (!mounted) return;
      setState(() {status = result.message; healthy = result.ok;});
    } catch (error) {
      if (!mounted) return;
      setState(() {status = 'Unexpected error: $error';healthy = false;});
    } finally {
      if (mounted) setState(() {busy = false;});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('U_luv · P00 Diagnostics')),
      body: SafeArea(child: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 540),
        child: Padding(padding: const EdgeInsets.all(24), child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.favorite_outline, size: 50),
            const SizedBox(height: 12),
            const Text('Algorithm-Free Connections', textAlign: TextAlign.center, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            const SizedBox(height: 18),
            if (healthy != null) Icon(healthy! ? Icons.check_circle_outline : Icons.error_outline, key: const Key('health-indicator')),
            Semantics(liveRegion: true, child: Text(status, key: const Key('diagnostic-status'),textAlign: TextAlign.center, style: const TextStyle(fontSize: 15))),
            const SizedBox(height: 20),
            FilledButton(onPressed: busy ? null : () => runCheck(widget.service.checkReadiness), child: const Text('Check server')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: busy ? null : () => runCheck(widget.service.verifyDatabase), child: const Text('Test database')),
            if(busy) const Padding(padding: EdgeInsets.only(top: 20), child: CircularProgressIndicator()),
            const SizedBox(height: 10),
            const Text('Local-only diagnostic screen. Authentication, profiles and paid features come in later phases.',textAlign: TextAlign.center),
          ],
        )),
      ))),
    );
  }
}
