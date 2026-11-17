import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'geo_pack_cache.dart';
import 'geo_catalogue_delivery.dart';
import 'gps_location.dart';

/// Server GeoNames data is public. A user's selected place is private and is
/// never written to the district cache or logged. GPS is one-shot; Fastify
/// validates the bundled, checksum-verified India polygon before saving.
class IndiaLocationPanel extends StatefulWidget {
  const IndiaLocationPanel({super.key, required this.baseUrl, required this.access,
    @visibleForTesting this.testGet, @visibleForTesting this.testCacheDirectory,
    this.onLocationSaved, @visibleForTesting this.testSaveManual});
  final String baseUrl;
  final Future<String> Function() access;
  /// Test-only API transport. Production always uses authenticated HTTP.
  final Future<Uint8List> Function(String path)? testGet;
  /// File-backed isolation for widget tests; never used by production.
  final Future<Directory> Function()? testCacheDirectory;
  /// Receives only the server-confirmed label, never a raw GPS fix.
  final ValueChanged<String>? onLocationSaved;
  /// Test-only transport for verifying save behavior. Production uses PUT.
  final Future<Map<String,dynamic>> Function(Map<String,dynamic> body)? testSaveManual;
  @override
  State<IndiaLocationPanel> createState() => _IndiaLocationPanelState();
}

class _IndiaLocationPanelState extends State<IndiaLocationPanel> {
  Map<String, dynamic>? manifest;
  GeoCatalogueDelivery? publicDelivery;
  List<Map<String, dynamic>> places = const [];
  List<Map<String, dynamic>> visible = const [];
  String? stateCode, districtCode;
  Map<String, dynamic>? selectedPlace;
  String? selectedLocationName;
  String? selectedLocationSource;
  String accountStatus = '';
  bool accountLoaded = false;
  int revision = 0;
  bool busy = false, downloading = false, canceled = false, offline = true, initializing = false;
  String status = '';
  String? districtFailure;
  bool currentDistrictVerified=false;
  String searchText = '';
  bool showPlaceResults = true;
  final TextEditingController _placeSearchController = TextEditingController();
  HttpClient? activeClient;
  int searchGeneration = 0;
  int transferBytes = 0, expectedBytes = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _init(); });
  }
  @override
  void dispose() {
    activeClient?.close(force: true);
    _placeSearchController.dispose();
    super.dispose();
  }

  Uri _endpoint(String path) {
    final base = Uri.parse(widget.baseUrl);
    // Existing U_luv app runs local USB/AVD API. Reject remote HTTP and
    // credential/query-bearing origins. Production must be HTTPS.
    final local = base.scheme == 'http' &&
      {'127.0.0.1', 'localhost', '10.0.2.2', '::1'}.contains(base.host);
    if ((!local && base.scheme != 'https') || (local && !base.hasPort) ||
        base.userInfo.isNotEmpty || base.query.isNotEmpty || base.fragment.isNotEmpty) {
      throw const FormatException('Unsafe API endpoint');
    }
    return base.replace(path: path, query: null, fragment: null);
  }

  Future<Uint8List> _get(String path, {int maxBytes = 2000000, String? cdnFailureCode}) =>
      widget.testGet?.call(path) ??
      _downloadBytes(_endpoint(path), authenticated:true, maxBytes:maxBytes,
        cdnFailureCode:cdnFailureCode);

  // All catalogue downloads use this origin-independent transport; never send
  // an owner access token to a future public CloudFront origin.
  Future<Uint8List> _downloadBytes(Uri url,
      {required bool authenticated, int maxBytes = 2000000, String? cdnFailureCode}) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    activeClient = client;
    try {
      final request = await client.getUrl(url).timeout(const Duration(seconds: 10));
      request.followRedirects = false; // never forward private tokens to redirects
      if (authenticated) {
        final token = await widget.access();
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      // Only a fixed failure code is relayed to Fastify during authenticated
      // district fallback. Never send bearer tokens to CloudFront.
      if(authenticated && cdnFailureCode!=null &&
          RegExp(r'^(no_delivery|network|timeout|sha_mismatch|other|http_(400|401|403|404|408|429|500|502|503|504))$').hasMatch(cdnFailureCode)) {
        request.headers.set('X-ULUV-Geo-CDN-Failure',cdnFailureCode);
      }
      final response = await request.close().timeout(const Duration(seconds: 16));
      if (response.statusCode != 200) {
        final trace=response.headers.value('X-ULUV-Geo-Request-Id');
        final requestId=trace!=null && RegExp(r'^[a-zA-Z0-9_-]{1,80}$').hasMatch(trace) ?
          ' (API request $trace)' : '';
        throw HttpException('Location service ${response.statusCode}$requestId');
      }
      final chunks = BytesBuilder(copy: false);
      transferBytes = 0;
      await for (final part in response.timeout(const Duration(seconds: 22))) {
        if (canceled) throw const _Cancelled();
        transferBytes += part.length;
        if (transferBytes > maxBytes) throw const FormatException('Location pack too large');
        chunks.add(part);
        if (mounted && downloading) setState(() {});
      }
      if (canceled) throw const _Cancelled();
      return chunks.takeBytes(); // HTTP transparent gzip/br decoding happens before SHA-256.
    } finally {
      if (identical(activeClient, client)) activeClient = null;
      client.close(force: true);
    }
  }

  Future<Directory> _cacheDir() async {
    if (widget.testCacheDirectory != null) return widget.testCacheDirectory!();
    final support = await getApplicationSupportDirectory();
    final dir = Directory('${support.path}/uluv_geo/india');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }
  String _safeCode(String? input) =>
      input != null && RegExp(r'^\d{1,6}$').hasMatch(input) ? input : 'unmapped';
  File _packPath(Directory root, String version, String state, String district) =>
    File('${root.path}/${version}_${_safeCode(state)}_${_safeCode(district)}.json');

  /// Account location is authoritative in DynamoDB. Always load it independently
  /// of CloudFront, because a CDN outage must never hide a saved user selection.
  Future<void> _loadSavedLocation() async {
    try {
      final details=await _get('/v1/me/geo/location',maxBytes:12000);
      final row=Map<String,dynamic>.from(jsonDecode(utf8.decode(details)) as Map);
      final rev=row['settingsRevision'];
      final loc=row['location'];
      if(rev is! int || rev<0 || (loc!=null && loc is! Map)) {
        throw const FormatException('Invalid saved location response');
      }
      final name=loc is Map ? loc['name'] : null;
      final source=loc is Map ? loc['source'] : null;
      if(name!=null && (name is! String || name.isEmpty)) {
        throw const FormatException('Invalid saved location name');
      }
      if(mounted)setState((){
        revision=rev;
        selectedLocationName=name as String?;
        selectedLocationSource=source is String ? source : null;
        accountLoaded=true;
        accountStatus='';
      });
    } catch (error) {
      if(mounted)setState((){
        accountLoaded=false;
        accountStatus='Saved location could not be refreshed from your account: '
          '${_safeLoadReason(error)}. Check the API terminal and retry.';
      });
    }
  }

  static const _bundledManifestSha256 =
    '97d83d80f2e1b487109e01e7a37e8fb8fb88daf607cf090568144f5969f43887';

  /// A small, checksum-pinned 175 KB index of *names and pack metadata*.
  /// Enables manual State/District browsing even on first run during a CDN
  /// outage; there are no place records or private account data in this asset.
  Future<Map<String,dynamic>> _bundledManualCatalogue() async {
    final asset=await rootBundle.load('assets/geo/india-manifest.json');
    final bytes=asset.buffer.asUint8List(asset.offsetInBytes,asset.lengthInBytes);
    if(sha256.convert(bytes).toString()!=_bundledManifestSha256){
      throw const FormatException('Bundled India manifest checksum mismatch');
    }
    return Map<String,dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
  }

  void _assertValidManifest(Map<String,dynamic> data){
    if(data['schemaVersion']!=1 || data['country']!='IN' ||
       data['states'] is! List || data['catalogueVersion'] is! String ||
       !RegExp(r'^IN-[a-f0-9]{16}$').hasMatch(data['catalogueVersion'] as String)){
      throw const FormatException('Invalid GeoNames manifest');
    }
  }

  Future<void> _init() async {
    if(busy || initializing)return;
    setState(() {initializing=true;status='';});
    try {
      // Make manual State/District controls available immediately, even if
      // authentication or CloudFront is temporarily unavailable.
      final bundled=await _bundledManualCatalogue();
      _assertValidManifest(bundled);
      if(mounted)setState(()=>manifest=bundled);
    }catch(_){
      if(mounted)setState(()=>status='Bundled manual location choices could not be loaded. Reinstall the app.');
    }
    // Never gate DynamoDB settings retrieval on GeoNames catalogue readiness.
    await _loadSavedLocation();
    if(!mounted)return;
    try {
      final dir=await _cacheDir();
      Map<String,dynamic> data;
      try {
        final configBytes=await _get('/v1/geo/india/delivery',maxBytes:8192);
        final descriptor=GeoCatalogueDelivery.parse(
          Map<String,dynamic>.from(jsonDecode(utf8.decode(configBytes)) as Map),
          apiOrigin:_endpoint('/'));
        final bytes=await _downloadBytes(descriptor.manifestUri,
          authenticated:descriptor.requiresAuthorization,maxBytes:1000000);
        if(sha256.convert(bytes).toString()!=descriptor.manifestSha256){
          throw const FormatException('Catalogue manifest does not match authoritative API checksum');
        }
        data=Map<String,dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
        _assertValidManifest(data);
        if(data['catalogueVersion']!=descriptor.version){
          throw const FormatException('Catalogue and delivery version mismatch');
        }
        // Keep a previously downloaded, verified pack until its replacement is valid.
        final previous=File('${dir.path}/manifest.json');
        if(await previous.exists()){
          try{
            final earlierBytes=await previous.readAsBytes();
            final earlier=jsonDecode(utf8.decode(earlierBytes)) as Map;
            final oldVersion=earlier['catalogueVersion'];
            if(oldVersion is String && RegExp(r'^IN-[a-f0-9]{16}$').hasMatch(oldVersion)){
              final history=File('${dir.path}/manifest_$oldVersion.json');
              if(!await history.exists())await history.writeAsBytes(earlierBytes,flush:true);
            }
          }catch(_){/* Never trust a malformed older manifest. */}
        }
        final version=data['catalogueVersion'] as String;
        final historical=File('${dir.path}/manifest_$version.json');
        if(!await historical.exists())await historical.writeAsBytes(bytes,flush:true);
        final pending=File('${dir.path}/manifest.pending');
        await pending.writeAsBytes(bytes,flush:true);
        await pending.rename('${dir.path}/manifest.json');
        publicDelivery=descriptor;
        offline=false;
        if(mounted)setState(()=>status='');
      }catch(_){
        // Manual selector remains visible if the CDN or API bootstrap is down.
        // No untrusted network data is used and offline saves stay disabled.
        data=await _bundledManualCatalogue();
        _assertValidManifest(data);
        publicDelivery=null;
        offline=true;
        if(mounted)setState(()=>status=
          'Manual State/District selection is available. Location catalogue connection is unavailable; '+
          'previously downloaded districts can be searched, but new downloads and saves require the '+
          'API/CloudFront catalogue. Check ULUV_GEO_PUBLIC_BASE_URL and the pinned manifest SHA-256 on Fastify, then reload.');
      }
      if(mounted)setState(()=>manifest=data);
    }catch(_){
      if(mounted)setState(()=>status='Location catalogue connection is unavailable. Manual State/District choices remain visible where possible. Check device storage, API/CloudFront configuration and retry.');
    }finally{if(mounted)setState(()=>initializing=false);}
  }

  List<Map<String,dynamic>> get states {
    final list=(manifest?['states'] as List? ?? const [])
      .whereType<Map>().map((e) => Map<String,dynamic>.from(e)).toList();
    final missing=manifest?['countryUnmapped'];
    if(missing is Map) list.add({
      'code':'unresolved','name':'Unresolved state (GeoNames)',
      'districts':[<String,dynamic>{...Map<String,dynamic>.from(missing),'code':'unmapped'}],'unmapped':null,
    });
    return list;
  }
  Map<String,dynamic>? get selectedState {
    for (final item in states) { if (item['code']==stateCode) return item; }
    return null;
  }
  List<Map<String,dynamic>> get districts {
    final state=selectedState;
    if (state==null) return const [];
    final list=(state['districts'] as List? ?? const [])
        .whereType<Map>().map((e)=>Map<String,dynamic>.from(e)).toList();
    if (state['unmapped'] is Map) list.add(Map<String,dynamic>.from(state['unmapped'] as Map));
    return list;
  }
  Map<String,dynamic>? get selectedDistrict {
    for (final item in districts) { if (item['code']==districtCode) return item; }
    return null;
  }

  /// Called automatically as soon as a district is chosen. The UI does not
  /// expose a separate download/load step. All downloaded bytes are checked
  /// against the immutable public release manifest before use or caching.
  Future<void> _loadDistrict() async {
    if (busy || downloading || manifest==null || stateCode==null || districtCode==null) return;
    final meta=selectedDistrict;
    if(meta==null)return;
    final version=manifest!['catalogueVersion'] as String;
    if(!RegExp(r'^IN-[a-f0-9]{16}$').hasMatch(version))return;
    final state=stateCode!, district=districtCode!;
    final requested=++searchGeneration;
    setState(() {busy=true;downloading=true;canceled=false;transferBytes=0;
      districtFailure=null;expectedBytes=meta['bytes'] as int? ?? 0;
      places=const [];visible=const [];selectedPlace=null;currentDistrictVerified=false;
      status='Loading places in ${meta['name']}…';});
    try {
      final cache=await _cacheDir();
      final current=_packPath(cache,version,state,district);
      Uint8List bytes=Uint8List(0);
      bool fromCached=false, fromApi=false;
      if(await current.exists()){
        final existing=await current.readAsBytes();
        if(_matches(existing,meta)){
          bytes=existing;fromCached=true;
        }
      }
      if(bytes.isEmpty){
        // The direct CDN route is the normal path, but some device networks
        // block/rewrite responses. The authenticated Fastify route is a
        // checksum-verified fallback; it NEVER serves arbitrary untrusted data.
        String? cdnFailure;
        String? cdnFailureCode=publicDelivery==null?'no_delivery':null;
        if(publicDelivery!=null){
          try{
            final descriptor=publicDelivery!;
            final candidate=await _downloadBytes(descriptor.packUri(meta['path'] as String),
              authenticated:descriptor.requiresAuthorization,maxBytes:2000000);
            if(!_matches(candidate,meta)){
              throw const FormatException('CDN pack checksum/size mismatch');
            }
            bytes=candidate;
          }catch(e){
            if(canceled)throw const _Cancelled();
            cdnFailure=_safeLoadReason(e);
            cdnFailureCode=_clientCdnFailureCode(e);
          }
        }
        if(bytes.isEmpty){
          try{
            final candidate=await _get('/v1/geo/india/packs/$state/$district',
              maxBytes:2000000,cdnFailureCode:cdnFailureCode);
            if(!_matches(candidate,meta)){
              throw const FormatException('API pack checksum/size mismatch');
            }
            bytes=candidate;fromApi=true;
          }catch(e){
            if(canceled)throw const _Cancelled();
            final apiReason=_safeLoadReason(e);
            final networkReason=cdnFailure==null?'':'; direct catalogue: $cdnFailure';
            throw _DistrictLoadFailure(
              'District data unavailable ($apiReason$networkReason). Check the CloudFront JSON upload, '+
              'ULUV_GEO_PUBLIC_BASE_URL and ULUV_GEO_CANONICAL_MANIFEST_SHA256 on Fastify.');
          }
        }
      }
      // Verify the complete JSON schema off the UI isolate before activation.
      final parsed=await compute(_parseVerifiedPack,{
        'bytes':bytes,'version':version,'state':state=='unresolved'?null:state,
        'district':district=='unmapped'?null:district,'count':meta['count']});
      if(canceled || requested!=searchGeneration)throw const _Cancelled();
      if(!fromCached){
        await atomicActivateGeoPack(
          destination:current,plainJson:bytes,manifestPack:meta,
          validateJson:(candidate) async {
            await compute(_parseVerifiedPack,{
              'bytes':candidate,'version':version,'state':state=='unresolved'?null:state,
              'district':district=='unmapped'?null:district,'count':meta['count'],
            });
          },isCancelled:()=>canceled || requested!=searchGeneration,
        );
      }
      if(mounted && requested==searchGeneration)setState((){
        places=parsed;visible=parsed.take(60).toList();searchText='';showPlaceResults=true;
        _placeSearchController.clear();currentDistrictVerified=true;
        if(fromApi)offline=false; // API verified the same immutable release.
        status=fromCached?'District ready from verified cache — choose a village or town.':
          'District ready — choose a village or town.';
        districtFailure=null;
      });
    }on _Cancelled{
      if(mounted)setState(()=>status='District loading cancelled. Previous verified cache is preserved.');
    }catch(e){
      final previous=!canceled?await _loadOldCompatibleDistrict():null;
      if(mounted && requested==searchGeneration)setState((){
        if(previous!=null){
          places=previous;visible=previous.take(60).toList();currentDistrictVerified=false;
          status='Using an older verified district for search. Saving requires the latest catalogue.';
          districtFailure=null;
        }else{
          final reason=e is _DistrictLoadFailure?e.message:_safeLoadReason(e);
          districtFailure=reason;
          status='Could not load ${meta['name']}: $reason';
        }
      });
    }finally{
      if(mounted)setState((){busy=false;downloading=false;});
    }
  }

  String _clientCdnFailureCode(Object error) {
    if(error is FormatException && (error.message.contains('checksum') ||
        error.message.contains('mismatch')))return 'sha_mismatch';
    if(error is TimeoutException)return 'timeout';
    if(error is SocketException)return 'network';
    if(error is HttpException) {
      final match=RegExp(r'\b(400|401|403|404|408|429|500|502|503|504)\b').firstMatch(error.message);
      if(match!=null)return 'http_${match.group(1)}';
    }
    return 'other';
  }

  String _safeLoadReason(Object e){
    if(e is FormatException){
      if(e.message.contains('checksum') || e.message.contains('mismatch')){
        return 'download does not match the published release checksum';
      }
      if(e.message.contains('offline') || e.message.contains('configuration')){
        return 'catalogue is not configured or accessible';
      }
      return 'district JSON failed validation';
    }
    if(e is HttpException){
      final m=e.message;
      final code=RegExp(r'\b(400|401|403|404|409|429|500|502|503|504)\b').firstMatch(m)?.group(0);
      final trace=RegExp(r'API request ([a-zA-Z0-9_-]{1,80})').firstMatch(m)?.group(1);
      final suffix=trace==null?'':' (API request $trace)';
      return code==null?'network/API request failed$suffix':'HTTP $code from location service$suffix';
    }
    if(e is SocketException || e is TimeoutException) return 'network connection or request timeout';
    if(e is FileSystemException) return 'device storage could not be accessed';
    return 'location service unavailable';
  }

  Future<List<Map<String,dynamic>>?> _loadOldCompatibleDistrict() async {
    final state=stateCode, district=districtCode;
    if (state==null || district==null) return null;
    try {
      final cache=await _cacheDir();
      await for (final f in cache.list()) {
        if (f is! File || !RegExp(r'manifest_IN-[a-f0-9]{16}\.json$').hasMatch(f.path)) continue;
        final old=jsonDecode(await f.readAsString()) as Map;
        final version=old['catalogueVersion'] as String;
        if (version==manifest?['catalogueVersion']) continue;
        for (final st in (old['states'] as List)) {
          if (st['code']!=state) continue;
          final options=[...(st['districts'] as List),if(st['unmapped']!=null)st['unmapped']];
          for (final item in options) {
            if (item['code']!=district) continue;
            final pack=_packPath(cache,version,state,district);
            if (!await pack.exists()) continue;
            final bytes=await pack.readAsBytes();
            if (!_matches(bytes,Map<String,dynamic>.from(item as Map))) continue;
            return await compute(_parseVerifiedPack,{
              'bytes':bytes,'version':version,'state':state=='unresolved'?null:state,
              'district':district=='unmapped'?null:district,'count':item['count']
            });
          }
        }
      }
    } catch (_) { /* Never expose unverified old JSON as a successful cache hit. */ }
    return null;
  }

  bool _matches(Uint8List bytes, Map<String,dynamic> meta) =>
    bytes.length==meta['bytes'] && sha256.convert(bytes).toString()==meta['sha256'];

  Future<void> _search(String query) async {
    final generation=++searchGeneration;
    searchText=query;
    final found=await compute(_searchPlaces,{'places':places,'q':query});
    if (mounted && generation==searchGeneration) setState(() => visible=found);
  }

  Future<void> _save() async {
    if (selectedPlace==null || !currentDistrictVerified || busy || !accountLoaded || manifest==null) return;
    setState(() { busy=true;status='Saving selected location…'; });
    final client=HttpClient()..connectionTimeout=const Duration(seconds:8);
    try {
      final body=<String,dynamic>{
        'geonameId':selectedPlace!['id'], 'catalogueVersion':manifest!['catalogueVersion'],
        'stateCode':stateCode, 'districtCode':districtCode=='unmapped'?null:districtCode,
        'expectedRevision':revision
      };
      late final Map<String,dynamic> saved;
      if(widget.testSaveManual!=null){
        saved=await widget.testSaveManual!(body);
      }else{
        final request=await client.putUrl(_endpoint('/v1/me/geo/manual')).timeout(const Duration(seconds:10));
        request.followRedirects=false;
        request.headers.set(HttpHeaders.authorizationHeader,'Bearer ${await widget.access()}');
        request.headers.set(HttpHeaders.contentTypeHeader,'application/json; charset=utf-8');
        request.write(jsonEncode(body));
        final response=await request.close().timeout(const Duration(seconds:15));
        final responseText=await utf8.decoder.bind(response).join().timeout(const Duration(seconds:15));
        if(response.statusCode==409)throw const _RevisionConflict();
        if(response.statusCode==429)throw const _Cooldown();
        if(response.statusCode!=200)throw HttpException('Save denied ${response.statusCode}');
        saved=Map<String,dynamic>.from(jsonDecode(responseText) as Map);
      }
      final location=saved['location'];
      final newRevision=saved['settingsRevision'];
      final newName=location is Map ? location['name'] : null;
      if(newRevision is! int || newRevision<=revision || newName is! String || newName.isEmpty ||
          location is! Map || location['source']!='manual_geonames'){
        throw const FormatException('Invalid owner save acknowledgment');
      }
      if(mounted){
        setState(() {
          revision=newRevision;selectedLocationName=newName;
          selectedLocationSource='manual_geonames';accountLoaded=true;accountStatus='';
          status='Location saved privately. Public discovery is still off.';
          showPlaceResults=false;
        });
        // Only a completed authoritative save may close the outer Settings tile.
        widget.onLocationSaved?.call(newName);
      }
    }on _RevisionConflict{
      if(mounted)setState(()=>status='Settings changed elsewhere. Reload account location and retry.');
      await _loadSavedLocation();
    }on _Cooldown{
      if(mounted)setState(()=>status='Location changes are limited. Wait 15 seconds before changing again.');
    }catch(_){
      if(mounted)setState(()=>status='Save was not confirmed. Check API logs and reload before retrying.');
    }finally{client.close(force:true);if(mounted)setState(()=>busy=false);}
  }

  Future<void> _clearCache() async {
    if (busy) return;
    setState(() => busy=true);
    try {
      final cache=await _cacheDir();
      // Deletes only public location catalogue files in app-private geo dir;
      // does not affect owner settings, photos or authentication records.
      await for (final file in cache.list()) {
        if (file is File && file.path.endsWith('.json') && !file.path.endsWith('/manifest.json')) await file.delete();
      }
      if (mounted) setState(() { places=const [];visible=const [];selectedPlace=null;currentDistrictVerified=false;status='Cached district packs cleared.'; });
    } catch (_) { if (mounted) setState(() => status='Could not clear cached district files.'); }
    finally { if (mounted) setState(() => busy=false); }
  }

  @override
  Widget build(BuildContext context) => Column(
    key: const Key('p03-1b-india-selector'),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Text('Choose an approximate location',style:TextStyle(fontSize:19,fontWeight:FontWeight.bold)),
      const SizedBox(height:8),
      const Text('Manual place selection works without GPS. Selected account location is private and does not make your profile public.'),
      if (selectedLocationName!=null) Padding(padding:const EdgeInsets.symmetric(vertical:8),
        child:Text('Saved location: $selectedLocationName',key:const Key('p03-1b-selected-location'))),
      if(accountStatus.isNotEmpty) Text(accountStatus,key:const Key('p03-1b-account-status')),
      const SizedBox(height:10),
      OneTimeGpsPanel(
        provider:AndroidOneTimeGpsProvider(),
        client:HttpGpsSelectionClient(baseUrl:widget.baseUrl,access:widget.access),
        onSaved:(nextRevision,name){
          if(mounted)setState(() {revision=nextRevision;selectedLocationName=name;
            selectedLocationSource='gps_selected';accountLoaded=true;accountStatus='';
            status='GPS location saved privately. Manual selection remains available.';});
          widget.onLocationSaved?.call(name);
        }),
      const Divider(height:22),
      const Text('Manual location: State → District → Village / Town',
        key:Key('p03-manual-location-heading'),style:TextStyle(fontWeight:FontWeight.w700)),
      const SizedBox(height:8),
      if (manifest==null) const Text('Loading State and District choices…'),
      if (manifest!=null) ...[
        DropdownButtonFormField<String>(
          key:ValueKey('p03-1b-state-$stateCode'),
          initialValue:stateCode, isExpanded:true,
          decoration:const InputDecoration(labelText:'State / Union Territory',border:OutlineInputBorder()),
          items:[for(final st in states) DropdownMenuItem(value:st['code'] as String,child:Text(st['name'] as String,overflow:TextOverflow.ellipsis))],
          onChanged:busy?null:(val)=>setState(() { stateCode=val;districtCode=null;places=const [];visible=const [];selectedPlace=null;showPlaceResults=true;districtFailure=null;currentDistrictVerified=false;status=''; }),
        ),
        const SizedBox(height:12),
        if (selectedState!=null) DropdownButtonFormField<String>(
          key:ValueKey('p03-1b-district-$stateCode-$districtCode'),initialValue:districtCode,isExpanded:true,
          decoration:const InputDecoration(labelText:'District',border:OutlineInputBorder()),
          items:[for(final d in districts) DropdownMenuItem(value:d['code'] as String,child:Text(d['name'] as String,overflow:TextOverflow.ellipsis))],
          onChanged:busy?null:(val){
            setState(() {districtCode=val;places=const [];visible=const [];selectedPlace=null;showPlaceResults=true;districtFailure=null;currentDistrictVerified=false;status='';});
            if(val!=null) _loadDistrict();
          },
        ),
        if(selectedDistrict!=null && downloading)...[
          const SizedBox(height:12),
          LinearProgressIndicator(value:expectedBytes>0 && transferBytes>0
            ?(transferBytes/expectedBytes).clamp(0.0,1.0):null),
          TextButton(key:const Key('p03-1b-cancel'),onPressed:(){
            canceled=true;activeClient?.close(force:true);
          },child:const Text('Cancel')),
        ],
        if(selectedDistrict!=null && districtFailure!=null)...[
          const SizedBox(height:8),
          TextButton.icon(key:const Key('p03-1b-retry-district'),onPressed:busy?null:_loadDistrict,
            icon:const Icon(Icons.refresh),label:const Text('Retry district')),
        ],
        if (places.isNotEmpty) ...[
          const SizedBox(height:10),
          if(showPlaceResults) KeyedSubtree(key:const PageStorageKey<String>('p03-1b-search-scroll'),child:TextField(
            controller:_placeSearchController,
            key:const Key('p03-1b-search'),onChanged:_search,
            decoration:const InputDecoration(labelText:'Search village / town / locality',prefixIcon:Icon(Icons.search),border:OutlineInputBorder()))),
          if(showPlaceResults) Text('Showing ${visible.length} of ${places.length} places',style:const TextStyle(fontSize:12)),
          if(showPlaceResults) ConstrainedBox(constraints:const BoxConstraints(maxHeight:260),child:ListView.builder(
            key:const PageStorageKey<String>('p03-1b-results-scroll'),
            shrinkWrap:true,itemCount:visible.length,itemBuilder:(context,i){final place=visible[i];
              return ListTile(key:Key('p03-1b-place-${place['id']}'),
                title:Text(place['name'] as String),subtitle:Text(place['asciiName'] as String? ?? ''),
                trailing:selectedPlace?['id']==place['id'] ? const Icon(Icons.check_circle) : const Icon(Icons.circle_outlined),
                onTap:busy?null:()=>setState(() {selectedPlace=place;showPlaceResults=false;
                  FocusManager.instance.primaryFocus?.unfocus();}));
            },
          )),
          if(!showPlaceResults && selectedPlace!=null) ListTile(
            key:const Key('p03-selected-place-summary'),
            title:Text('Selected: ${selectedPlace!['name']}'),
            subtitle:const Text('Save this place to your private account'),
            trailing:TextButton(key:const Key('p03-change-place'),onPressed:busy?null:()=>setState(()=>showPlaceResults=true),
              child:const Text('Change'))),
          FilledButton.icon(key:const Key('p03-1b-save'),onPressed:busy||!currentDistrictVerified||!accountLoaded||selectedPlace==null?null:_save,
            icon:const Icon(Icons.check),label:const Text('Save selected location')),
        ],
      ],
      if (busy && !downloading) const LinearProgressIndicator(),
      if (status.isNotEmpty) Padding(padding:const EdgeInsets.symmetric(vertical:8),child:Text(status,key:const Key('p03-1b-status'))),
      Wrap(spacing:8,children:[
        TextButton(key:const Key('p03-1b-reload'),onPressed:busy||initializing?null:_init,child:const Text('Reload catalogue / settings')),
        TextButton(key:const Key('p03-1b-clear-cache'),onPressed:busy?null:_clearCache,child:const Text('Clear downloaded districts')),
      ]),
      const Text('Location data © GeoNames · CC BY 4.0. Names and boundaries may be incomplete or outdated.',style:TextStyle(fontSize:12)),
      const Divider(height:28),
    ],
  );
}

class _DistrictLoadFailure implements Exception {
  const _DistrictLoadFailure(this.message);
  final String message;
  @override
  String toString() => message;
}
class _Cancelled implements Exception { const _Cancelled(); }
class _RevisionConflict implements Exception { const _RevisionConflict(); }
class _Cooldown implements Exception { const _Cooldown(); }

/// Runs in Flutter background isolate. Fails closed on foreign district IDs,
/// duplicate places, or invalid coordinates before cache activation.
List<Map<String,dynamic>> _parseVerifiedPack(Map<String,dynamic> input) {
  final decoded=jsonDecode(utf8.decode(input['bytes'] as Uint8List));
  if (decoded is! Map || decoded['schemaVersion'] != 1 ||
      decoded['catalogueVersion']!=input['version'] || decoded['country']!='IN' ||
      decoded['stateCode']!=input['state'] || decoded['districtCode']!=input['district'] ||
      decoded['places'] is! List) throw const FormatException('Invalid district pack');
  final items=decoded['places'] as List;
  if (items.length!=input['count'] || items.length>18000) throw const FormatException('Invalid pack count');
  final ids=<String>{};final result=<Map<String,dynamic>>[];
  for(final entry in items){
    if(entry is! Map)throw const FormatException('Invalid place row');
    final x=Map<String,dynamic>.from(entry);
    final id=x['id'],lat=x['lat'],lng=x['lng'];
    if(id is! String || !RegExp(r'^\d{1,15}$').hasMatch(id) || !ids.add(id) ||
       x['name'] is! String || x['asciiName'] is! String || x['aliases'] is! List ||
       lat is! num || lng is! num || !lat.isFinite || !lng.isFinite ||
       lat < -90 || lat > 90 || lng < -180 || lng > 180) throw const FormatException('Invalid place fields');
    result.add(x);
  }
  return result;
}
List<Map<String,dynamic>> _searchPlaces(Map<String,dynamic> input){
  final entries=input['places'] as List<Map<String,dynamic>>;
  final q=(input['q'] as String).toLowerCase().trim();
  if(q.isEmpty)return entries.take(60).toList();
  final result=<Map<String,dynamic>>[];
  for(final p in entries){
    final names=[p['name'],p['asciiName'],...(p['aliases'] as List)];
    if(names.any((n)=>n is String && n.toLowerCase().contains(q))){result.add(p);if(result.length>=60)break;}
  }
  return result;
}

@visibleForTesting
List<Map<String,dynamic>> parseVerifiedGeoPackForTest(Uint8List bytes,
    {required String version, required String? state, required String? district, required int count}) =>
  _parseVerifiedPack({'bytes':bytes,'version':version,'state':state,'district':district,'count':count});
