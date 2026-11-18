/// P03-1 runtime widget regressions, including out-of-order server responses.
/// No network/API, permissions or actual device location in these tests.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/discovery_location_gate.dart';
import 'package:uluv/features/geo/geo_settings_panel.dart';
import 'package:uluv/features/geo/gps_location.dart';

class _SlowGpsSource implements OneTimeLocationProvider {
  int calls=0;
  final pending=Completer<OneTimeGpsFix>();
  @override Future<OneTimeGpsFix> capture(){calls++;return pending.future;}
}
class _CountingGpsApi implements GpsSelectionClient {
  int revisions=0,saves=0;
  @override Future<int> currentSettingsRevision()async{revisions++;return 5;}
  @override Future<Map<String,dynamic>> save(OneTimeGpsFix fix,int revision)async{
    saves++;expect(revision,5);
    return {'settingsRevision':6,'location':{'name':'Approximate location in India','source':'gps_selected'}};
  }
}
void main(){
  testWidgets('failure is retriable: no location is falsely shown as saved', (tester)async{
    var reads=0;
    Future<Map<String,dynamic>> server()async{
      reads++;
      if(reads==1)throw const FormatException('simulated API offline');
      return {'settingsRevision':2,'location':{'name':'Verified Saved Town','source':'manual_geonames'}};
    }
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:DiscoveryLocationGate(
      mode:'dating',active:true,refreshEpoch:0,baseUrl:'http://127.0.0.1:3000',
      access:()async=>'test-only',onLocationSaved:(_){},testReadLocation:server,
    ))));
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(reads,1);
    expect(find.byKey(const Key('p03-discovery-location-error')),findsOneWidget);
    expect(find.byKey(const Key('p03-discovery-location-retry')),findsOneWidget);
    expect(find.byKey(const Key('p03-location-required')),findsNothing,
      reason:'outage is not proof that user has no saved location');
    await tester.tap(find.byKey(const Key('p03-discovery-location-retry')));
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(reads,2);
    expect(find.text('Verified Saved Town'),findsOneWidget);
    expect(find.byKey(const Key('p03-discovery-location-error')),findsNothing);
  });

  testWidgets('late first GET cannot overwrite a newer Settings location read', (tester)async{
    final first=Completer<Map<String,dynamic>>();
    final second=Completer<Map<String,dynamic>>();
    var calls=0;
    Future<Map<String,dynamic>> fetch(){calls++;return calls==1?first.future:second.future;}
    Widget screen(int epoch)=>MaterialApp(home:Scaffold(body:DiscoveryLocationGate(
      mode:'dating',active:true,refreshEpoch:epoch,baseUrl:'http://127.0.0.1:3000',
      access:()async=>'test-only',onLocationSaved:(_){},testReadLocation:fetch,
    )));
    await tester.pumpWidget(screen(0));await tester.pump();
    expect(calls,1);
    await tester.pumpWidget(screen(1));await tester.pump();
    expect(calls,2);
    second.complete({'settingsRevision':3,'location':{'name':'Newest Save','source':'gps_selected'}});
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(find.text('Newest Save'),findsOneWidget);
    first.complete({'settingsRevision':1,'location':null});
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(find.text('Newest Save'),findsOneWidget);
    expect(find.byKey(const Key('p03-location-required')),findsNothing);
  });

  testWidgets('GPS duplicate taps are ignored while capture is running', (tester)async{
    final source=_SlowGpsSource(),api=_CountingGpsApi();
    var saved=0;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:OneTimeGpsPanel(
      provider:source,client:api,onSaved:(_,__)=>saved++,
    ))));
    await tester.tap(find.byKey(const Key('p03-gps-capture')));
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(source.calls,1);expect(api.revisions,1);
    expect(tester.widget<OutlinedButton>(find.byKey(const Key('p03-gps-capture'))).onPressed,isNull);
    expect(api.saves,0);
    source.pending.complete(OneTimeGpsFix(17.385,78.4867,20,DateTime.now().toUtc()));
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(api.saves,1);expect(saved,1);
    expect(find.byKey(const Key('p03-gps-confirm')),findsNothing);
  });

  testWidgets('collapsed Settings does not initialize place downloader or show endless loader', (tester)async{
    var reads=0;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SingleChildScrollView(child:
      UluvGeoSettingsPanel(baseUrl:'http://127.0.0.1:3000',access:()async=>'test-only',
        testReadLocation:()async{reads++;return {'settingsRevision':1,
          'location':{'name':'Previously Saved Village','source':'manual_geonames'}};},
        testHideDiscoveryPreferences:true,
      )))));
    await tester.pump();await tester.pump(const Duration(milliseconds:100));
    expect(reads,1);
    expect(find.text('Previously Saved Village'),findsOneWidget);
    expect(find.byKey(const Key('p03-1b-india-selector')),findsNothing);
    expect(find.byType(LinearProgressIndicator),findsNothing);
  });
}
