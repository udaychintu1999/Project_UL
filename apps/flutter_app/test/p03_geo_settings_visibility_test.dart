import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/geo_settings_panel.dart';

// Tests the actual Settings tile, not only a source regex. A fake API models
// a real server-authoritative DynamoDB read after successful PUT.
Future<void> eventually(WidgetTester tester, Finder finder) async {
  for(var i=0;i<65;i++){
    await tester.pump(const Duration(milliseconds:100));
    if(finder.evaluate().isNotEmpty)return;
    await tester.runAsync(() async {await Future<void>.delayed(const Duration(milliseconds:10));});
  }
  expect(finder,findsWidgets,reason:'Location view did not become ready');
}

void main(){
  testWidgets('saved location is visible before expansion and survives remount', (tester) async{
    final dir=await Directory.systemTemp.createTemp('p03-settings-summary-');
    var readCount=0;
    Future<Map<String,dynamic>> read() async {
      readCount++;
      return {'settingsRevision':8,'location':{'source':'manual_geonames',
        'name':'Hyderabad, Telangana, India'}};
    }
    Widget page()=>MaterialApp(home:Scaffold(body:SingleChildScrollView(child:
      UluvGeoSettingsPanel(baseUrl:'http://127.0.0.1:3000',access:() async=>'test',
        testReadLocation:read,testCacheDirectory:() async=>dir,
        testHideDiscoveryPreferences:true))));
    try{
      await tester.pumpWidget(page());
      await eventually(tester,find.text('Saved location: Hyderabad, Telangana, India'));
      expect(find.byKey(const Key('p03-1b-india-selector')),findsNothing,
        reason:'Manual picker must not auto-mount or load while collapsed');
      expect(readCount,greaterThan(0));
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.pumpWidget(page());
      await eventually(tester,find.text('Saved location: Hyderabad, Telangana, India'));
    }finally{await dir.delete(recursive:true);}
  });

  testWidgets('choose place hides list; successful save closes settings; reopen shows server value', (tester) async{
    final dir=await Directory.systemTemp.createTemp('p03-settings-save-');
    final pack=await File('test/fixtures/p03-nicobar-638.json').readAsBytes();
    var label='';var revision=0;var saves=0;
    Future<Map<String,dynamic>> read() async=>{
      'settingsRevision':revision,
      'location':label.isEmpty?null:{'source':'manual_geonames','name':label},
    };
    Future<Uint8List> get(String path) async {
      if(path=='/v1/me/geo/location')return Uint8List.fromList(utf8.encode(jsonEncode(await read())));
      if(path=='/v1/geo/india/packs/01/638')return pack;
      throw StateError('CDN deliberately unavailable');
    }
    Future<Map<String,dynamic>> save(Map<String,dynamic> body) async{
      expect(body['expectedRevision'],revision);
      expect(body['geonameId'],isA<String>());
      saves++;revision++;
      label='Saved Nicobar Place, Andaman and Nicobar Islands, India';
      return {'settingsRevision':revision,'location':{
        'name':label,'source':'manual_geonames'}};
    }
    Widget page()=>MaterialApp(home:Scaffold(body:SingleChildScrollView(child:
      UluvGeoSettingsPanel(baseUrl:'http://127.0.0.1:3000',access:() async=>'test',
        testReadLocation:read,testGet:get,testCacheDirectory:() async=>dir,
        testSaveManual:save,testHideDiscoveryPreferences:true))));
    try{
      await tester.pumpWidget(page());
      await eventually(tester,find.text('No saved location yet'));
      await tester.tap(find.text('Location & discovery preferences'));
      await eventually(tester,find.byKey(const Key('p03-1b-state-null')));
      await tester.tap(find.byKey(const Key('p03-1b-state-null')));
      await tester.pump(const Duration(milliseconds:250));
      await tester.tap(find.text('Union Territory of Andaman and Nicobar Islands').last);
      await tester.pump();
      await eventually(tester,find.byKey(const Key('p03-1b-district-01-null')));
      await tester.ensureVisible(find.byKey(const Key('p03-1b-district-01-null')));
      await tester.tap(find.byKey(const Key('p03-1b-district-01-null')));
      await tester.pump(const Duration(milliseconds:250));
      await tester.tap(find.text('Nicobar').last);
      await eventually(tester,find.byKey(const Key('p03-1b-place-1252774'))); // sample fixture id, see also fallback finder
      await tester.ensureVisible(find.byKey(const Key('p03-1b-place-1252774')));
      await tester.tap(find.byKey(const Key('p03-1b-place-1252774')));
      await eventually(tester,find.byKey(const Key('p03-selected-place-summary')));
      expect(find.byKey(const Key('p03-1b-results-scroll')),findsNothing);
      await tester.ensureVisible(find.byKey(const Key('p03-1b-save')));
      await tester.tap(find.byKey(const Key('p03-1b-save')));
      await eventually(tester,find.text('Saved location: Saved Nicobar Place, Andaman and Nicobar Islands, India'));
      expect(saves,1);
      // After animation collapses, the child remains Offstage for efficiency.
      await tester.pump(const Duration(milliseconds:500));
      expect(find.byKey(const Key('p03-selected-place-summary')),findsNothing);
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.pumpWidget(page());
      await eventually(tester,find.text('Saved location: Saved Nicobar Place, Andaman and Nicobar Islands, India'));
    }finally{await dir.delete(recursive:true);}
  });
}
