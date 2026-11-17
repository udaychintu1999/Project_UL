import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/india_location.dart';

// The catalogue endpoint is deliberately unavailable, while the account
// settings endpoint works. These must NOT share a failure condition.
Future<Uint8List> savedLocationApi(String path) async {
  if(path == '/v1/me/geo/location') {
    return Uint8List.fromList(utf8.encode(jsonEncode({
      'settingsRevision': 6,
      'location': {'name':'Approximate location in India','source':'gps_selected'},
      'gpsAvailable':true,
      'discoveryEnabled':false,
    })));
  }
  throw StateError('Simulated GeoNames/CDN service outage');
}

Widget app(Directory cache) => MaterialApp(home:Scaffold(body:SingleChildScrollView(child:
  IndiaLocationPanel(
    baseUrl:'http://127.0.0.1:3000',
    access:() async=>'test-access',
    testGet:savedLocationApi,
    testCacheDirectory:() async=>cache,
  ),
)));

/// No pumpAndSettle: loading screens intentionally use indeterminate progress
/// indicators that cannot settle while a test's async file operations run.
Future<void> pumpUntil(WidgetTester tester,Finder finder) async {
  for(var i=0;i<35;i++) {
    await tester.pump(const Duration(milliseconds:100));
    if(finder.evaluate().isNotEmpty)return;
    await tester.runAsync(() async { await Future<void>.delayed(const Duration(milliseconds:10)); });
  }
  expect(finder,findsWidgets,reason:'Async bootstrap did not finish in bounded pumps');
}

void main() {
  testWidgets('manual selector survives CDN failure and account location survives reopening',(tester) async {
    final cache=await Directory.systemTemp.createTemp('p03-recovery-widget-');
    try {
      await tester.pumpWidget(app(cache));
      await pumpUntil(tester,find.byKey(const Key('p03-1b-selected-location')));
      expect(find.byKey(const Key('p03-manual-location-heading')),findsOneWidget);
      expect(find.byKey(const Key('p03-1b-state-null')),findsOneWidget);
      expect(find.textContaining('Approximate location in India'),findsOneWidget);
      await tester.pumpWidget(const MaterialApp(home:Scaffold(body:SizedBox())));
      await tester.pump();
      await tester.pumpWidget(app(cache));
      await pumpUntil(tester,find.byKey(const Key('p03-1b-selected-location')));
      expect(find.byKey(const Key('p03-1b-state-null')),findsOneWidget);
      expect(find.textContaining('Approximate location in India'),findsOneWidget);
    }finally{await cache.delete(recursive:true);}
  });
}
