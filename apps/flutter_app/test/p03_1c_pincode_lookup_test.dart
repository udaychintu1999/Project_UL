import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/pincode_lookup.dart';

class _StubPin implements PincodeLookupClient {
  int searches=0;
  String? error;
  @override Future<PincodeLookupResponse> search(String pin) async {
    searches++;
    if(error!=null)throw PincodeLookupException(error!);
    return PincodeLookupResponse.fromJson({
      'pin':pin,'totalOffices':2,'truncated':false,'requiresManualPlaceConfirmation':true,'discoveryEnabled':false,
      'offices':[
        {'office':'Hyderabad H.O','district':'Hyderabad','state':'Telangana','officeType':'H.O','delivery':'Delivery'},
        {'office':'Koti S.O','district':'Hyderabad','state':'Telangana','officeType':'S.O','delivery':'Delivery'},
      ]
    });
  }
}

void main() {
  testWidgets('six digits required; explicit search shows multiple areas without auto-saving',(tester)async{
    final stub=_StubPin();
    String? chosen;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SingleChildScrollView(
      child:PincodeLookupPanel(client:stub,onAreaChosen:(state,district,office)=>chosen='$state/$district/$office')))));
    await tester.pumpAndSettle();
    final search=find.byKey(const Key('p03-1c-search-pin'));
    expect(tester.widget<FilledButton>(search).onPressed,isNull);
    await tester.enterText(find.byKey(const Key('p03-1c-pin-input')),'500001');
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(search).onPressed,isNotNull);
    expect(stub.searches,0);
    await tester.tap(search);
    await tester.pumpAndSettle();
    expect(stub.searches,1);
    expect(find.text('Hyderabad H.O'),findsOneWidget);
    expect(find.text('Koti S.O'),findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('p03-1c-office-1')));
    await tester.tap(find.byKey(const Key('p03-1c-office-1')));
    expect(chosen,'Telangana/Hyderabad/Koti S.O');
  });
  testWidgets('unavailable directory explains fallback instead of false success',(tester)async{
    final stub=_StubPin()..error='india_pincode_catalogue_unavailable';
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:SingleChildScrollView(
      child:PincodeLookupPanel(client:stub,onAreaChosen:(_,__,___){})))));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('p03-1c-pin-input')),'500001');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('p03-1c-search-pin')));
    await tester.pumpAndSettle();
    expect(find.textContaining('Postal directory is not installed'),findsOneWidget);
    expect(find.byKey(const Key('p03-1c-office-0')),findsNothing);
  });
  test('strict postal response prohibits fake geographic save',(){
    expect(()=>PincodeLookupResponse.fromJson({
      'pin':'500001','totalOffices':1,'truncated':false,'requiresManualPlaceConfirmation':false,
      'discoveryEnabled':false,'offices':[{'office':'A','district':'B','state':'C','officeType':'','delivery':''}]
    }),throwsFormatException);
  });
}
