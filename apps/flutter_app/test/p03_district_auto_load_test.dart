import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/india_location.dart';

Future<void> eventually(WidgetTester tester,Finder finder) async {
  for(var i=0;i<60;i++){
    await tester.pump(const Duration(milliseconds:100));
    if(finder.evaluate().isNotEmpty)return;
    await tester.runAsync(() async { await Future<void>.delayed(const Duration(milliseconds:10)); });
  }
  expect(finder,findsWidgets,reason:'Automatic district load did not resolve');
}

void main(){
  testWidgets('selecting district automatically loads a verified real S3 pack via API fallback',(tester) async{
    final dir=Directory.systemTemp.createTempSync('p03-auto-district-');
    final sample=File('test/fixtures/p03-nicobar-638.json').readAsBytesSync();
    final fetched=<String>[];
    Future<Uint8List> get(String path) async {
      fetched.add(path);
      if(path=='/v1/me/geo/location')return Uint8List.fromList(utf8.encode(jsonEncode({
        'settingsRevision':0,'location':null,'gpsAvailable':true,'discoveryEnabled':false,
      })));
      if(path=='/v1/geo/india/packs/01/638')return sample;
      throw StateError('Simulated CDN unavailable');
    }
    try{
      await tester.pumpWidget(MaterialApp(home:Scaffold(body:SingleChildScrollView(child:
        IndiaLocationPanel(baseUrl:'http://127.0.0.1:3000',access:() async=>'test',
          testGet:get,testCacheDirectory:() async=>dir)))));
      await eventually(tester,find.textContaining('Location catalogue connection is unavailable'));
      await tester.tap(find.byKey(const Key('p03-1b-state-null')));
      await tester.pump(const Duration(milliseconds:250)); // bounded dropdown animation
      await tester.tap(find.text('Union Territory of Andaman and Nicobar Islands').last);
      await tester.pump();
      await eventually(tester,find.byKey(const Key('p03-1b-district-01-null')));
      await tester.ensureVisible(find.byKey(const Key('p03-1b-district-01-null')));
      await tester.tap(find.byKey(const Key('p03-1b-district-01-null')));
      await tester.pump(const Duration(milliseconds:250)); // bounded dropdown animation
      await tester.tap(find.text('Nicobar').last);
      await tester.pump();
      await eventually(tester,find.byKey(const Key('p03-1b-search')));
      expect(fetched,contains('/v1/geo/india/packs/01/638'));
      expect(find.byKey(const Key('p03-1b-download')),findsNothing);
      expect(find.textContaining('District ready'),findsWidgets);
      expect(find.byKey(const Key('p03-1b-save')),findsOneWidget);
    }finally{dir.deleteSync(recursive:true);}
  }, timeout: const Timeout(Duration(seconds: 75)));
}
