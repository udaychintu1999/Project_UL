/// P03 physical-device UI acceptance with **synthetic** location API/provider.
/// Exercises actual Android render/touch/scroll; never requests native GPS,
/// network, account credentials or modifies the normal installed U_luv app.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:uluv/features/auth/account_navigation.dart';
import 'package:uluv/features/geo/discovery_location_gate.dart';
import 'package:uluv/features/geo/gps_location.dart';
import 'p03_full_device_journeys.dart';

class _Gps implements OneTimeLocationProvider {
  int calls=0;
  @override Future<OneTimeGpsFix> capture() async {
    calls++;return OneTimeGpsFix(17.385,78.4867,15,DateTime.now().toUtc());
  }
}
class _GpsApi implements GpsSelectionClient {
  int revisions=0,saves=0;
  @override Future<int> currentSettingsRevision() async {revisions++;return 3;}
  @override Future<Map<String,dynamic>> save(OneTimeGpsFix fix,int revision) async {
    saves++;expect(revision,3);
    return {'settingsRevision':4,'location':{'name':'Approximate location in India',
      'source':'gps_selected'},'discoveryEnabled':false};
  }
}
Future<void> _settleBounded(WidgetTester tester) async {
  for(var i=0;i<60;i++){
    await tester.pump(const Duration(milliseconds:100));
    if(!tester.binding.hasScheduledFrame)return;
  }
  fail('P03 animation/loading did not stabilize in 6 seconds');
}
void main(){
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('real Android navigation: Dating first, Local Feed third, Settings fifth', (tester)async{
    var index=0;
    await tester.pumpWidget(MaterialApp(home:StatefulBuilder(builder:(context,set)=>
      AccountNavigation(selectedIndex:index,profileComplete:true,
        onSelect:(value)=>set(()=>index=value),onBack:()=>set(()=>index=0),
        home:const Text('setup'),settings:const Text('Profile and Settings'),
        dating:const Text('Dating future view'),friendship:const Text('Friendship future view'),
        localFeed:const Text('Local Feed and Activities future view'),
        connects:const Text('Connects future view')))));
    await tester.pump();
    expect(find.byType(NavigationDestination),findsNWidgets(5));
    expect(find.text('Home'),findsNothing);
    expect(index,0);
    await tester.tap(find.byKey(const Key('p03-tab-local-feed-activities')));
    await _settleBounded(tester);
    expect(index,2);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await _settleBounded(tester);
    expect(index,4);
  });
  testWidgets('real Android: before onboarding only Dating/setup and Settings', (tester)async{
    var index=0;
    await tester.pumpWidget(MaterialApp(home:StatefulBuilder(builder:(context,set)=>
      AccountNavigation(selectedIndex:index,profileComplete:false,
        onSelect:(value)=>set(()=>index=value),onBack:()=>set(()=>index=0),
        home:const Text('Profile setup form'),settings:const Text('Account Security')))));
    await tester.pump();
    expect(find.byType(NavigationDestination),findsNWidgets(2));
    expect(find.byKey(const Key('p03-tab-local-feed-activities')),findsNothing);
    await tester.tap(find.byKey(const Key('p02-tab-settings')));
    await _settleBounded(tester);
    expect(index,1);
  });
  testWidgets('real Android: location gate stays private; GPS only after a tap, one save', (tester)async{
    var reads=0;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SingleChildScrollView(child:
      DiscoveryLocationGate(mode:'dating',active:true,refreshEpoch:0,
        baseUrl:'http://127.0.0.1:3000',access:()async=>'fake',
        testReadLocation:()async{reads++;return {'settingsRevision':0,'location':null};},
        onLocationSaved:(_){},)))));
    await tester.pump();await _settleBounded(tester);
    expect(reads,1);
    expect(find.byKey(const Key('p03-location-required')),findsOneWidget);
    expect(find.byKey(const Key('p03-discovery-manual')),findsOneWidget);
    // The separate production GPS widget is tested with fake native/provider
    // to prove that initial render does not touch location and one tap saves.
    final provider=_Gps(),api=_GpsApi();
    String? saved;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:OneTimeGpsPanel(
      provider:provider,client:api,onSaved:(_,label)=>saved=label))));
    await tester.pump();
    expect(provider.calls,0);expect(api.saves,0);
    await tester.tap(find.byKey(const Key('p03-gps-capture')));
    await _settleBounded(tester);
    expect(provider.calls,1);expect(api.revisions,1);expect(api.saves,1);
    expect(saved,'Approximate location in India');
  });
  // Extended device journeys exercise the real picker and authenticated HTTP
  // transport using an isolated localhost fixture (no owner credentials).
  registerP03FullDeviceJourneys();
}
