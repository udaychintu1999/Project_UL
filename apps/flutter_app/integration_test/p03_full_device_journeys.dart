/// P03-1/P03-2 full *isolated-device* journeys.
/// Real Flutter widgets, Android taps/scrolling, and dart:io HTTP client/server.
/// The server is a fixture on the test app's OWN loopback interface, NOT
/// production Fastify, CloudFront, any owner's account, or native GPS.
/// Existing Fastify + DynamoDB Local gates test the real backend separately.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/account_navigation.dart';
import 'package:uluv/features/geo/discovery_location_gate.dart';
import 'package:uluv/features/geo/geo_settings_panel.dart';

import 'p03_fixture_nicobar_bytes.dart';

const _token = 'p03-isolated-local-fixture-token';
const _name = 'Yat-kirāna, Nicobar, Andaman and Nicobar Islands, India';
const _version = 'IN-52fd741e8c61b53a';

/// A deliberately narrow owner-token-guarded HTTP fixture. It exercises the
/// actual production GET/PUT transport, server revision response, fallback,
/// and re-read. It does NOT claim to emulate Fastify auth/device proofs.
class _OwnerGeoFixture {
  _OwnerGeoFixture._(this.server) {
    requests = _serve();
  }

  final HttpServer server;
  late final Future<void> requests;
  String? savedName;
  int revision = 0;
  int saves = 0;
  int locationReads = 0;
  int packReads = 0;
  int deniedRequests = 0;
  int gpsRequests = 0;
  int canonicalFailures = 0;
  bool failLocationRead = false;
  bool rejectNextSaveWithConflict = false;
  bool rejectNextSaveWithCooldown = false;
  String? failure;

  String get origin => 'http://127.0.0.1:${server.port}';

  static Future<_OwnerGeoFixture> open() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    return _OwnerGeoFixture._(server);
  }

  Future<void> close() async {
    await server.close(force: true);
    await requests;
  }

  Future<void> _serve() async {
    await for (final request in server) {
      try {
        await _handle(request);
      } catch (error) {
        failure ??= 'Unexpected fixture handler failure: ${error.runtimeType}';
        try {
          request.response.statusCode = HttpStatus.internalServerError;
          await request.response.close();
        } catch (_) {/* Already closed: preserve the first error. */}
      }
    }
  }

  Future<void> _json(HttpRequest request, int status, Object content) async {
    request.response.statusCode = status;
    request.response.headers.contentType = ContentType.json;
    request.response.write(jsonEncode(content));
    await request.response.close();
  }

  Future<void> _handle(HttpRequest request) async {
    if (request.headers.value(HttpHeaders.authorizationHeader) != 'Bearer $_token') {
      deniedRequests++;
      await _json(request, HttpStatus.unauthorized, {'code':'unauthorized'});
      return;
    }
    final path = request.uri.path;
    if (request.method == 'GET' && path == '/v1/me/geo/location') {
      locationReads++;
      if (failLocationRead) {
        await _json(request, HttpStatus.serviceUnavailable, {'code':'unavailable'});
      } else {
        await _json(request, HttpStatus.ok, {
          'settingsRevision':revision,
          'localityRevision':revision,
          'location':savedName == null ? null : {
            'source':'manual_geonames', 'name':savedName,
          },
          'discoveryEnabled':false,
        });
      }
    } else if (request.method == 'GET' && path == '/v1/geo/india/delivery') {
      // Deterministically simulate a CDN configuration outage. The production
      // picker must still show the SHA-pinned bundled states and use an
      // authenticated, SHA-checked pack fallback from the same local origin.
      canonicalFailures++;
      await _json(request, HttpStatus.serviceUnavailable, {'code':'offline_fixture'});
    } else if (request.method == 'GET' && path == '/v1/geo/india/packs/01/638') {
      packReads++;
      request.response.statusCode = HttpStatus.ok;
      request.response.headers.contentType = ContentType.json;
      request.response.add(p03DeviceNicobarPack());
      await request.response.close();
    } else if (request.method == 'PUT' && path == '/v1/me/geo/manual') {
      final bytes = <int>[];
      await for (final chunk in request) {
        bytes.addAll(chunk);
        if (bytes.length > 8192) {
          await _json(request, HttpStatus.requestEntityTooLarge, {'code':'oversize'});
          return;
        }
      }
      final data = jsonDecode(utf8.decode(bytes));
      if (data is! Map ||
          data.length != 5 ||
          data['geonameId'] != '1252774' ||
          data['stateCode'] != '01' ||
          data['districtCode'] != '638' ||
          data['catalogueVersion'] != _version ||
          data.containsKey('lat') || data.containsKey('lng')) {
        await _json(request, HttpStatus.badRequest, {'code':'invalid_selection'});
        return;
      }
      if (rejectNextSaveWithCooldown) {
        rejectNextSaveWithCooldown = false;
        await _json(request, HttpStatus.tooManyRequests, {'code':'cooldown'});
        return;
      }
      if (rejectNextSaveWithConflict || data['expectedRevision'] != revision) {
        rejectNextSaveWithConflict = false;
        await _json(request, HttpStatus.conflict, {'code':'revision_conflict'});
        return;
      }
      revision++;
      saves++;
      savedName = _name;
      await _json(request, HttpStatus.ok, {
        'settingsRevision':revision,
        'location':{'name':savedName,'source':'manual_geonames'},
        'discoveryEnabled':false,
      });
    } else if (path == '/v1/me/geo/gps') {
      gpsRequests++;
      await _json(request, HttpStatus.forbidden, {'code':'native_gps_not_part_of_fixture'});
    } else {
      await _json(request, HttpStatus.notFound, {'code':'not_found'});
    }
  }

  Future<int> unauthenticatedReadStatus() async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(Uri.parse('$origin/v1/me/geo/location'));
      final response = await request.close();
      final status = response.statusCode;
      await response.drain<void>();
      return status;
    } finally {
      client.close(force:true);
    }
  }
}

class _PrivateShell extends StatefulWidget {
  const _PrivateShell({required this.api, this.complete = true});
  final _OwnerGeoFixture api;
  final bool complete;
  @override State<_PrivateShell> createState() => _PrivateShellState();
}

class _PrivateShellState extends State<_PrivateShell> {
  int index = 0;
  int epoch = 0;
  Future<String> _access() async => _token;
  void _saved(String _) => setState(() => epoch++);

  Widget _gate(String mode, int pageIndex) => DiscoveryLocationGate(
    key: Key('p03-device-gate-$mode'),
    mode:mode, active:widget.complete && index == pageIndex,
    refreshEpoch:epoch, baseUrl:widget.api.origin,
    access:_access, onLocationSaved:_saved,
  );

  @override Widget build(BuildContext context) => AccountNavigation(
    selectedIndex:index, profileComplete:widget.complete,
    onSelect:(value) => setState(() => index=value),
    onBack:() => setState(() => index=0),
    home:const Text('Finish guided profile setup'),
    dating:_gate('dating',0),
    friendship:_gate('friendship',1),
    localFeed:_gate('local-feed',2),
    connects:const Text('Connections are not public in P03-2'),
    settings:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      if(widget.complete)const Text('Saved profile and edit controls'),
      UluvGeoSettingsPanel(
        baseUrl:widget.api.origin,access:_access,refreshEpoch:epoch,
        showDiscoveryPreferences:false,onLocationSaved:_saved,
      ),
    ]),
  );
}

/// Do not pumpAndSettle on a page with an indeterminate network loader.
/// Real HTTP/filesystem work is allowed to flush explicitly, and every wait
/// has a hard upper bound. A missed tap must fail, not be treated as success.
Future<void> _until(WidgetTester tester, Finder target, String description) async {
  for (var n=0; n<240; n++) {
    await tester.pump(const Duration(milliseconds:100));
    if (target.evaluate().isNotEmpty) return;
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds:50));
    });
  }
  expect(target,findsWidgets,reason:'Timed out waiting for $description (bounded wait)');
}

Future<void> _tapVisible(WidgetTester tester, Finder target) async {
  await tester.ensureVisible(target);
  await tester.pump(const Duration(milliseconds:300));
  await tester.tap(target);
  await tester.pump();
}

Future<void> _waitForSaveEnabled(WidgetTester tester) async {
  final button=find.byKey(const Key('p03-1b-save'));
  for(var n=0;n<80;n++) {
    await tester.pump(const Duration(milliseconds:100));
    if(button.evaluate().isNotEmpty &&
       tester.widget<FilledButton>(button).onPressed!=null) return;
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds:50));
    });
  }
  fail('Manual save button never became enabled after network response');
}

Future<void> _selectAndSaveNicobar(WidgetTester tester) async {
  await _until(tester,find.byKey(const Key('p03-1b-state-null')),'manual state dropdown');
  await _tapVisible(tester,find.byKey(const Key('p03-1b-state-null')));
  await _tapVisible(tester,find.text('Union Territory of Andaman and Nicobar Islands').last);
  await _until(tester,find.byKey(const Key('p03-1b-district-01-null')),'district dropdown');
  await _tapVisible(tester,find.byKey(const Key('p03-1b-district-01-null')));
  await _tapVisible(tester,find.text('Nicobar').last);
  await _until(tester,find.byKey(const Key('p03-1b-place-1252774')),'verified place result');
  await _tapVisible(tester,find.byKey(const Key('p03-1b-place-1252774')));
  await _until(tester,find.byKey(const Key('p03-selected-place-summary')),'selected summary');
  expect(find.byKey(const Key('p03-1b-results-scroll')),findsNothing);
  await _waitForSaveEnabled(tester);
  await _tapVisible(tester,find.byKey(const Key('p03-1b-save')));
}

void registerP03FullDeviceJourneys() {

  testWidgets('Android full journey: private manual save -> 5 tabs -> Settings -> widget remount / server re-read', (tester) async {
    final api=(await tester.runAsync(_OwnerGeoFixture.open))!;
    try {
      final status=(await tester.runAsync(api.unauthenticatedReadStatus))!;
      expect(status,HttpStatus.unauthorized);
      expect(api.deniedRequests,1);
      await tester.pumpWidget(MaterialApp(home:_PrivateShell(api:api)));
      await _until(tester,find.byKey(const Key('p03-location-required')),'missing-location gate');
      expect(find.byType(NavigationDestination),findsNWidgets(5));
      expect(find.text('Home'),findsNothing);
      expect(api.gpsRequests,0);
      await _tapVisible(tester,find.byKey(const Key('p03-discovery-manual')));
      await _until(tester,find.text('Choose your location'),'manual sheet');
      await _selectAndSaveNicobar(tester);
      await _until(tester,find.byKey(const Key('p03-discovery-saved-label')),'saved Dating label');
      expect(find.byKey(const Key('p03-location-required')),findsNothing);
      expect(api.saves,1);
      expect(api.packReads,greaterThanOrEqualTo(1));
      expect(api.canonicalFailures,greaterThanOrEqualTo(1));
      expect(api.gpsRequests,0);
      expect(api.failure,isNull);

      await _tapVisible(tester,find.byKey(const Key('p03-tab-friendship')));
      await _until(tester,find.byKey(const Key('p03-discovery-saved-label')),'Friendship saved location');
      expect(find.byKey(const Key('p03-location-required')),findsNothing);
      await _tapVisible(tester,find.byKey(const Key('p03-tab-local-feed-activities')));
      await _until(tester,find.byKey(const Key('p03-discovery-saved-label')),'Local Feed location');
      expect(find.byKey(const Key('p03-location-required')),findsNothing);
      await _tapVisible(tester,find.byKey(const Key('p02-tab-settings')));
      await _until(tester,find.text(_name),'saved account location in Settings');
      expect(find.text('Saved profile and edit controls'),findsOneWidget);
      expect(find.text('Location & discovery'),findsOneWidget);

      // A real widget-tree unmount/reopen, followed by fresh authenticated GET.
      // Android OS force-stop + relaunch is a separate, documented manual gate.
      final previousReads=api.locationReads;
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.pump();
      await tester.pumpWidget(MaterialApp(home:_PrivateShell(api:api)));
      await _until(tester,find.byKey(const Key('p03-discovery-saved-label')),'reopened account');
      expect(api.locationReads,greaterThan(previousReads));
      expect(find.byKey(const Key('p03-location-required')),findsNothing);
      expect(api.saves,1,reason:'reopen must never submit a duplicate save');
      expect(api.gpsRequests,0);
      expect(api.failure,isNull);
    } finally {
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.runAsync(api.close);
    }
  }, timeout: const Timeout(Duration(seconds: 180)));


  testWidgets('Android manual save errors: 409 revision and 429 cooldown never fake success, then retry succeeds', (tester) async {
    final api=(await tester.runAsync(_OwnerGeoFixture.open))!;
    api.rejectNextSaveWithConflict=true;
    try {
      await tester.pumpWidget(MaterialApp(home:_PrivateShell(api:api)));
      await _until(tester,find.byKey(const Key('p03-location-required')),'initial manual gate');
      await _tapVisible(tester,find.byKey(const Key('p03-discovery-manual')));
      await _selectAndSaveNicobar(tester);
      await _until(tester,find.textContaining('Settings changed elsewhere'),'409 retry message');
      expect(api.saves,0);
      expect(find.byKey(const Key('p03-discovery-saved-label')),findsNothing);

      api.rejectNextSaveWithCooldown=true;
      await _waitForSaveEnabled(tester);
      await _tapVisible(tester,find.byKey(const Key('p03-1b-save')));
      await _until(tester,find.textContaining('Wait 15 seconds'),'429 cooldown message');
      expect(api.saves,0);
      expect(find.byKey(const Key('p03-discovery-saved-label')),findsNothing);

      await _waitForSaveEnabled(tester);
      await _tapVisible(tester,find.byKey(const Key('p03-1b-save')));
      await _until(tester,find.byKey(const Key('p03-discovery-saved-label')),'successful retry');
      expect(api.saves,1);
      expect(api.gpsRequests,0);
      expect(api.failure,isNull);
    } finally {
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.runAsync(api.close);
    }
  }, timeout: const Timeout(Duration(seconds: 180)));

  testWidgets('Android outage: never infer missing location from failed GET; retry reads saved value', (tester) async {
    final api=(await tester.runAsync(_OwnerGeoFixture.open))!;
    api.savedName=_name;
    api.revision=7;
    api.failLocationRead=true;
    try {
      await tester.pumpWidget(MaterialApp(home:Scaffold(body:DiscoveryLocationGate(
        mode:'dating',active:true,refreshEpoch:0,
        baseUrl:api.origin,access:() async=>_token,onLocationSaved:(_){},
      ))));
      await _until(tester,find.byKey(const Key('p03-discovery-location-error')),'failure view');
      expect(find.byKey(const Key('p03-location-required')),findsNothing);
      expect(find.byKey(const Key('p03-discovery-manual')),findsNothing);
      api.failLocationRead=false;
      await _tapVisible(tester,find.byKey(const Key('p03-discovery-location-retry')));
      await _until(tester,find.byKey(const Key('p03-discovery-saved-label')),'recovered saved label');
      expect(find.text(_name),findsOneWidget);
      expect(find.byKey(const Key('p03-discovery-location-error')),findsNothing);
      expect(api.gpsRequests,0);
      expect(api.failure,isNull);
    } finally {
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.runAsync(api.close);
    }
  }, timeout: const Timeout(Duration(seconds: 90)));

  testWidgets('Android incomplete profile: 2 tabs, no discovery actions or manual picker', (tester) async {
    final api=(await tester.runAsync(_OwnerGeoFixture.open))!;
    try {
      await tester.pumpWidget(MaterialApp(home:_PrivateShell(api:api,complete:false)));
      await tester.pump();
      expect(find.byType(NavigationDestination),findsNWidgets(2));
      expect(find.text('Finish guided profile setup'),findsOneWidget);
      expect(find.byKey(const Key('p03-tab-local-feed-activities')),findsNothing);
      expect(find.byKey(const Key('p03-location-required')),findsNothing);
      await _tapVisible(tester,find.byKey(const Key('p02-tab-settings')));
      await _until(tester,find.text('Location & discovery'),'limited Settings');
      expect(find.byKey(const Key('p03-1b-india-selector')),findsNothing);
      expect(api.gpsRequests,0);
      expect(api.saves,0);
    } finally {
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.runAsync(api.close);
    }
  }, timeout: const Timeout(Duration(seconds: 90)));
}
