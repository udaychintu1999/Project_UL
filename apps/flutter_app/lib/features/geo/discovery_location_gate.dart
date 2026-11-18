import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import 'gps_location.dart';
import 'india_location.dart';

/// P03 pre-discovery shell. This widget NEVER publishes a person or reads a
/// public feed. It only checks the private owner location and offers explicit
/// one-time GPS or manual selection when that location is absent.
class DiscoveryLocationGate extends StatefulWidget {
  const DiscoveryLocationGate({super.key, required this.mode,
    required this.baseUrl, required this.access, required this.active,
    required this.refreshEpoch, required this.onLocationSaved,
    @visibleForTesting this.testReadLocation});

  final String mode;
  final String baseUrl;
  final Future<String> Function() access;
  final bool active;
  final int refreshEpoch;
  final ValueChanged<String> onLocationSaved;
  final Future<Map<String, dynamic>> Function()? testReadLocation;

  @override
  State<DiscoveryLocationGate> createState() => _DiscoveryLocationGateState();
}

class _DiscoveryLocationGateState extends State<DiscoveryLocationGate> {
  bool loading = false;
  bool checked = false;
  String? locationName;
  String? error;
  int epoch = 0;

  @override
  void initState() {
    super.initState();
    if (widget.active) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.active) _read();
      });
    }
  }

  @override
  void didUpdateWidget(covariant DiscoveryLocationGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && (!oldWidget.active ||
        oldWidget.refreshEpoch != widget.refreshEpoch)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.active) _read();
      });
    }
  }

  Uri _uri() {
    final base = Uri.parse(widget.baseUrl);
    final local = base.scheme == 'http' &&
        {'localhost', '127.0.0.1', '10.0.2.2', '::1'}.contains(base.host);
    if ((!local && base.scheme != 'https') ||
        base.userInfo.isNotEmpty || base.query.isNotEmpty ||
        base.fragment.isNotEmpty ||
        (base.path.isNotEmpty && base.path != '/') ||
        (local && !base.hasPort)) {
      throw const FormatException('Unsafe location API origin');
    }
    return base.replace(path: '/v1/me/geo/location', query: null, fragment: null);
  }

  Future<Map<String, dynamic>> _fetch() async {
    if (widget.testReadLocation != null) return widget.testReadLocation!();
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final request = await client.getUrl(_uri()).timeout(const Duration(seconds: 10));
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer ${await widget.access()}');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      final reply = await request.close().timeout(const Duration(seconds: 12));
      if (reply.statusCode != 200) throw const HttpException('Location read failed');
      final bytes = <int>[];
      await for (final chunk in reply.timeout(const Duration(seconds: 12))) {
        bytes.addAll(chunk);
        if (bytes.length > 12000) throw const FormatException('Oversized location reply');
      }
      final decoded = jsonDecode(utf8.decode(bytes));
      if (decoded is! Map<String, dynamic>) throw const FormatException('Invalid location reply');
      return decoded;
    } finally {
      client.close(force: true);
    }
  }

  Future<void> _read() async {
    final current = ++epoch;
    if (mounted) setState(() { loading = true; error = null; });
    try {
      final data = await _fetch();
      if (data['settingsRevision'] is! int ||
          (data['location'] != null && data['location'] is! Map)) {
        throw const FormatException('Invalid location status');
      }
      final loc = data['location'];
      final name = loc is Map ? loc['name'] : null;
      if (name != null && (name is! String || name.trim().isEmpty)) {
        throw const FormatException('Invalid location label');
      }
      if (mounted && current == epoch) {
        setState(() { locationName = name as String?; checked = true; error = null; });
      }
    } catch (_) {
      if (mounted && current == epoch) {
        // Preserve a previously verified label on temporary API failure.
        setState(() => error = 'Could not check your saved location. Retry.');
      }
    } finally {
      if (mounted && current == epoch) setState(() => loading = false);
    }
  }

  void _saved(String name) {
    ++epoch; // A late GET must never overwrite the authoritative save ACK.
    if (!mounted) return;
    setState(() { locationName = name; checked = true; loading = false; error = null; });
    widget.onLocationSaved(name);
  }

  Future<void> _openManual() async {
    await showModalBottomSheet<void>(
      context: context, isScrollControlled: true, useSafeArea: true,
      builder: (sheetContext) => FractionallySizedBox(
        heightFactor: 0.92,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text('Choose your location',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              IconButton(key: const Key('p03-manual-close'),
                onPressed: () => Navigator.of(sheetContext).pop(),
                icon: const Icon(Icons.close)),
            ]),
            IndiaLocationPanel(
              baseUrl: widget.baseUrl, access: widget.access,
              showGps: false, compact: true,
              onLocationSaved: (name) {
                _saved(name);
                Navigator.of(sheetContext).pop();
              },
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return const SizedBox.shrink();
    return Column(
      key: Key('p03-discovery-gate-${widget.mode}'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (loading && !checked) const LinearProgressIndicator(),
        if (error != null) ...[
          Text(error!, key: const Key('p03-discovery-location-error')),
          TextButton(key: const Key('p03-discovery-location-retry'),
            onPressed: loading ? null : _read, child: const Text('Retry')),
        ],
        if (checked && locationName == null && !loading) ...[
          const Icon(Icons.location_on_outlined, size: 42),
          const SizedBox(height: 10),
          const Text('We need your location to get started.',
            key: Key('p03-location-required'),
            style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Choose an approximate location once. Your exact GPS fix is never saved.'),
          const SizedBox(height: 12),
          OneTimeGpsPanel(
            compact: true,
            provider: AndroidOneTimeGpsProvider(),
            client: HttpGpsSelectionClient(baseUrl: widget.baseUrl, access: widget.access),
            onSaved: (_, name) => _saved(name),
          ),
          OutlinedButton.icon(
            key: const Key('p03-discovery-manual'),
            onPressed: _openManual,
            icon: const Icon(Icons.map_outlined),
            label: const Text('Manual selection'),
          ),
        ],
        if (locationName != null) ...[
          ListTile(
            leading: const Icon(Icons.place_outlined),
            title: const Text('Your selected location'),
            subtitle: Text(locationName!, key: const Key('p03-discovery-saved-label')),
          ),
          const SizedBox(height: 16),
          const Text('This tab will receive its discovery features in the next P03 phases. '
              'No profiles or posts are published by this setup screen.'),
        ],
      ],
    );
  }
}
