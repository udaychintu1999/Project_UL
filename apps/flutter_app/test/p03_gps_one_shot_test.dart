import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/gps_location.dart';

class _StubSource implements OneTimeLocationProvider {
  int calls=0;
  bool denied=false;
  @override Future<OneTimeGpsFix> capture() async {
    calls++;
    if(denied)throw const GpsPermissionException('denied');
    return OneTimeGpsFix(17.385,78.487,250,DateTime.now().toUtc());
  }
}
class _StubApi implements GpsSelectionClient {
  int saves=0,revisions=0;
  bool boundaryRejected=false;
  @override Future<int> currentSettingsRevision() async {revisions++;return 3;}
  @override Future<Map<String,dynamic>> save(OneTimeGpsFix fix,int expectedRevision) async {
    saves++;
    expect(expectedRevision,3);
    if(boundaryRejected)throw const GpsSelectionApiException('gps_outside_supported_india_boundary');
    return {'settingsRevision':4,'location':{'name':'Approximate location in India','source':'gps_selected'},'discoveryEnabled':false};
  }
}
void main(){
  testWidgets('no GPS permission before button; first tap immediately saves after permission',(tester)async{
    final source=_StubSource(),api=_StubApi();
    int? revision;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SingleChildScrollView(child:OneTimeGpsPanel(
      provider:source,client:api,onSaved:(rev,_)=>revision=rev)))));
    await tester.pump();
    expect(source.calls,0);expect(api.saves,0);
    await tester.tap(find.byKey(const Key('p03-gps-capture')));
    await tester.pumpAndSettle();
    expect(source.calls,1);expect(api.saves,1);expect(api.revisions,1);expect(revision,4);
    expect(find.byKey(const Key('p03-gps-confirm')),findsNothing);
    expect(find.textContaining('saved privately'),findsOneWidget);
  });
  testWidgets('permission refusal offers manual fallback; no save',(tester)async{
    final source=_StubSource()..denied=true,api=_StubApi();
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:OneTimeGpsPanel(
      provider:source,client:api,onSaved:(_,__){}))));
    await tester.tap(find.byKey(const Key('p03-gps-capture')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Manual selection'),findsOneWidget);
    expect(api.saves,0);
  });
  testWidgets('rejected GPS remains unsaved',(tester)async{
    final source=_StubSource(),api=_StubApi()..boundaryRejected=true;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:OneTimeGpsPanel(
      provider:source,client:api,onSaved:(_,__){}))));
    await tester.tap(find.byKey(const Key('p03-gps-capture')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Outside the supported India boundary'),findsOneWidget);
  });
}
