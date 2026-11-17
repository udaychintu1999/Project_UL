/// Public GeoNames asset location contract, independently of the private API.
/// P03 ships ONLY local Fastify delivery; P17 may return HTTPS CloudFront URLs
/// from the trusted API without changes to picker, checksum or cache keys.
class GeoCatalogueDelivery {
  const GeoCatalogueDelivery._({required this.provider,required this.version,
    required this.rootUrl,required this.manifestSha256,required this.requiresAuthorization});

  final String provider;
  final String version;
  final Uri rootUrl;
  final String manifestSha256;
  final bool requiresAuthorization;

  static final _versionPattern=RegExp(r'^IN-[a-f0-9]{16}$');
  static final _shaPattern=RegExp(r'^[a-f0-9]{64}$');
  static final _packPattern=RegExp(r'^(?:states/[0-9]{1,4}/districts/[0-9]{1,6}\.json|states/[0-9]{1,4}/unmapped\.json|country-unmapped\.json)$');

  factory GeoCatalogueDelivery.parse(Map<String,dynamic> data,{required Uri apiOrigin}) {
    final provider=data['provider'],version=data['catalogueVersion'];
    final root=data['rootUrl'],sha=data['manifestSha256'];
    final auth=data['requiresAuthorization'];
    if(data['schemaVersion']!=1 || provider is! String ||
        (provider!='local' && provider!='s3_cloudfront') ||
        version is! String || !_versionPattern.hasMatch(version) ||
        root is! String || sha is! String || !_shaPattern.hasMatch(sha) ||
        data['manifestPath']!='manifest.json' || auth is! bool ||
        (provider=='local' && !auth) || (provider=='s3_cloudfront' && auth)) {
      throw const FormatException('Untrusted GeoNames delivery configuration');
    }
    final input=Uri.parse(root);
    late final Uri base;
    if(provider=='local') {
      final expected='/v1/geo/india/catalogue/$version/';
      if(input.hasScheme || input.hasAuthority || input.path!=expected ||
          input.query.isNotEmpty || input.fragment.isNotEmpty || input.userInfo.isNotEmpty) {
        throw const FormatException('Unsafe local catalogue path');
      }
      base=apiOrigin.resolveUri(input);
    } else {
      // CloudFront URL must be returned from the authenticated bootstrap API.
      // No custom hostname, CloudFront URL or AWS SDK is baked into the app.
      if(input.scheme!='https' || !input.hasAuthority || input.host.isEmpty ||
          input.userInfo.isNotEmpty || input.query.isNotEmpty ||
          input.fragment.isNotEmpty || !input.path.endsWith('/') ||
          !RegExp(r'^/geo/india/v[1-9][0-9]*/$').hasMatch(input.path)) {
        throw const FormatException('Unsafe future public catalogue origin');
      }
      base=input;
    }
    return GeoCatalogueDelivery._(provider:provider,version:version,rootUrl:base,
      manifestSha256:sha,requiresAuthorization:auth);
  }
  Uri get manifestUri=>rootUrl.resolve('manifest.json');
  Uri packUri(String manifestRelativePath) {
    if(!_packPattern.hasMatch(manifestRelativePath)) {
      throw const FormatException('Invalid GeoNames manifest pack path');
    }
    return rootUrl.resolve(manifestRelativePath);
  }
}
