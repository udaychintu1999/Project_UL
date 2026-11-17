import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/geo_pack_cache.dart';
import 'package:uluv/features/geo/india_location.dart';

const version='IN-52fd741e8c61b53a';
Uint8List pack({String state='40',String district='686',List<Map<String,dynamic>>? places}) =>
  Uint8List.fromList(utf8.encode(jsonEncode({
    'schemaVersion':1,'catalogueVersion':version,'country':'IN',
    'stateCode':state,'districtCode':district,
    'places':places??[{'id':'1252948','name':'Warangal','asciiName':'Warangal',
      'aliases':['వరంగల్'],'lat':18.0,'lng':79.58}]
  })));
Map<String,dynamic> metadata(Uint8List bytes) => {'bytes':bytes.length,'sha256':sha256.convert(bytes).toString()};

void main(){
  test('GeoNames parser preserves Unicode and detects wrong provenance',(){
    final bytes=pack();
    expect(parseVerifiedGeoPackForTest(bytes,version:version,state:'40',district:'686',count:1).single['name'],'Warangal');
    expect(()=>parseVerifiedGeoPackForTest(bytes,version:version,state:'02',district:'686',count:1),throwsFormatException);
    expect(()=>parseVerifiedGeoPackForTest(bytes,version:'IN-0000000000000000',state:'40',district:'686',count:1),throwsFormatException);
  });
  test('GeoNames parser rejects duplicate IDs and invalid coordinates',(){
    final row={'id':'1252948','name':'Warangal','asciiName':'Warangal','aliases':[], 'lat':18.0,'lng':79.58};
    final duplicate=pack(places:[row,row]);
    expect(()=>parseVerifiedGeoPackForTest(duplicate,version:version,state:'40',district:'686',count:2),throwsFormatException);
    final invalid=pack(places:[{...row,'lat':91.0}]);
    expect(()=>parseVerifiedGeoPackForTest(invalid,version:version,state:'40',district:'686',count:1),throwsFormatException);
  });
  test('Atomic replacement never destroys old cache after SHA mismatch, schema failure or precommit crash',() async {
    final dir=await Directory.systemTemp.createTemp('uluv-geo-cache-test');
    try {
      final target=File('${dir.path}/pack.json');
      final previous=pack();
      await target.writeAsBytes(previous);
      final updated=pack(places:[{'id':'42','name':'Another','asciiName':'Another','aliases':[], 'lat':18.2,'lng':79.5}]);
      final expected=metadata(updated);
      Future<void> verify(Uint8List bytes) async {
        parseVerifiedGeoPackForTest(bytes,version:version,state:'40',district:'686',count:1);
      }
      await expectLater(atomicActivateGeoPack(destination:target,plainJson:updated,
          manifestPack:{...expected,'sha256':List.filled(64,'0').join()},validateJson:verify),throwsFormatException);
      expect(await target.readAsBytes(),previous);
      final invalidSchema=Uint8List.fromList(utf8.encode('{"bad":true}'));
      await expectLater(atomicActivateGeoPack(destination:target,plainJson:invalidSchema,
          manifestPack:metadata(invalidSchema),validateJson:verify),throwsFormatException);
      expect(await target.readAsBytes(),previous);
      await expectLater(atomicActivateGeoPack(destination:target,plainJson:updated,
          manifestPack:expected,validateJson:verify,
          beforeCommitForTesting:() async=>throw StateError('simulated crash')),throwsStateError);
      expect(await target.readAsBytes(),previous);
      await atomicActivateGeoPack(destination:target,plainJson:updated,manifestPack:expected,validateJson:verify);
      expect(await target.readAsBytes(),updated);
    } finally { await dir.delete(recursive:true); }
  });
}
