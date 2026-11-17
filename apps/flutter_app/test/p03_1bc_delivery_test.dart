import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/geo/geo_catalogue_delivery.dart';

void main() {
  final api=Uri.parse('http://127.0.0.1:3100/');
  final sha=List.filled(64,'a').join();
  Map<String,dynamic> local()=>{
    'schemaVersion':1,'provider':'local','catalogueVersion':'IN-0123456789abcdef',
    'rootUrl':'/v1/geo/india/catalogue/IN-0123456789abcdef/',
    'manifestPath':'manifest.json','manifestSha256':sha,
    'requiresAuthorization':true,
  };

  test('local delivery resolves only manifest-relative public paths', () {
    final d=GeoCatalogueDelivery.parse(local(),apiOrigin:api);
    expect(d.requiresAuthorization,isTrue);
    expect(d.manifestUri.toString(),
      'http://127.0.0.1:3100/v1/geo/india/catalogue/IN-0123456789abcdef/manifest.json');
    expect(d.packUri('states/40/districts/686.json').path,
      '/v1/geo/india/catalogue/IN-0123456789abcdef/states/40/districts/686.json');
    expect(() => d.packUri('server/00.json'),throwsFormatException);
    expect(() => d.packUri('../server/00.json'),throwsFormatException);
    expect(() => d.packUri('https://other.example/steal'),throwsFormatException);
  });
  test('future public CDN delivery changes only resolver, never cache identities', () {
    final cloud={...local(),'provider':'s3_cloudfront',
      'rootUrl':'https://example.invalid/geo/india/v1/',
      'requiresAuthorization':false};
    final d=GeoCatalogueDelivery.parse(cloud,apiOrigin:api);
    expect(d.requiresAuthorization,isFalse);
    expect(d.packUri('states/40/unmapped.json').toString(),
      'https://example.invalid/geo/india/v1/states/40/unmapped.json');
    expect(d.version,'IN-0123456789abcdef');
    expect(d.manifestSha256,sha);
    expect(()=>GeoCatalogueDelivery.parse({...cloud,'rootUrl':'http://example.invalid/x/'},apiOrigin:api),throwsFormatException);
    expect(()=>GeoCatalogueDelivery.parse({...cloud,'requiresAuthorization':true},apiOrigin:api),throwsFormatException);
  });
  test('the local provider cannot point to a foreign host', () {
    expect(()=>GeoCatalogueDelivery.parse({...local(),'rootUrl':'https://elsewhere.invalid/a/'},apiOrigin:api),throwsFormatException);
    expect(()=>GeoCatalogueDelivery.parse({...local(),'rootUrl':'/v1/geo/india/catalogue/IN-0123456789abcdef/../'},apiOrigin:api),throwsFormatException);
    expect(()=>GeoCatalogueDelivery.parse({...local(),'manifestSha256':'invalid'},apiOrigin:api),throwsFormatException);
  });
}
