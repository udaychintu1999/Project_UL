import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'india_location.dart';

/// P03 location tools are mounted only after the owner expands Settings.
/// No GPS permission request, CDN download, or PIN request on page load.
class UluvGeoSettingsPanel extends StatefulWidget {
  const UluvGeoSettingsPanel({super.key,required this.baseUrl,required this.access,
    @visibleForTesting this.testReadLocation, @visibleForTesting this.testGet,
    @visibleForTesting this.testCacheDirectory, @visibleForTesting this.testSaveManual,
    @visibleForTesting this.testHideDiscoveryPreferences=false,
    this.onLocationSaved, this.showDiscoveryPreferences = true,
    this.refreshEpoch = 0});
  final String baseUrl;
  final Future<String> Function() access;
  final Future<Map<String,dynamic>> Function()? testReadLocation;
  final Future<List<int>> Function(String path)? testGet;
  final Future<Directory> Function()? testCacheDirectory;
  final Future<Map<String,dynamic>> Function(Map<String,dynamic> body)? testSaveManual;
  final bool testHideDiscoveryPreferences;
  final ValueChanged<String>? onLocationSaved;
  final bool showDiscoveryPreferences;
  final int refreshEpoch;
  @override State<UluvGeoSettingsPanel> createState()=>_UluvGeoSettingsPanelState();
}
class _UluvGeoSettingsPanelState extends State<UluvGeoSettingsPanel> {
  final ExpansibleController _tile = ExpansibleController();
  String? _savedName;
  bool _savedLoaded=false, _savedLoading=false, _expanded=false, _everOpened=false;
  String? _savedError;
  int _readEpoch=0;

  @override void initState(){
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)_readSavedLocation();});
  }
  @override void dispose() {
    _tile.dispose();
    super.dispose();
  }
  @override void didUpdateWidget(covariant UluvGeoSettingsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshEpoch != oldWidget.refreshEpoch) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _readSavedLocation();
      });
    }
  }
  Uri _endpoint() {
    final base=Uri.parse(widget.baseUrl);
    final local=base.scheme=='http' && {'localhost','127.0.0.1','10.0.2.2','::1'}.contains(base.host);
    if((!local && base.scheme!='https') || base.userInfo.isNotEmpty ||
        base.query.isNotEmpty || base.fragment.isNotEmpty ||
        (base.path.isNotEmpty && base.path!='/')) {
      throw const FormatException('Unsafe account location origin');
    }
    return base.replace(path:'/v1/me/geo/location',query:null,fragment:null);
  }
  Future<Map<String,dynamic>> _fetchLocation() async {
    if(widget.testReadLocation!=null)return widget.testReadLocation!();
    final client=HttpClient()..connectionTimeout=const Duration(seconds:8);
    try{
      final request=await client.getUrl(_endpoint()).timeout(const Duration(seconds:10));
      request.followRedirects=false;
      request.headers.set(HttpHeaders.authorizationHeader,'Bearer ${await widget.access()}');
      request.headers.set(HttpHeaders.acceptHeader,'application/json');
      final response=await request.close().timeout(const Duration(seconds:12));
      if(response.statusCode!=200)throw HttpException('Account location ${response.statusCode}');
      final bytes=<int>[];
      await for(final chunk in response.timeout(const Duration(seconds:12))){
        bytes.addAll(chunk);
        if(bytes.length>12000)throw const FormatException('Account location response too large');
      }
      return Map<String,dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
    }finally{client.close(force:true);}
  }
  Future<void> _readSavedLocation() async {
    final requestEpoch=++_readEpoch;
    if(mounted)setState((){_savedLoading=true;_savedError=null;});
    try{
      final data=await _fetchLocation();
      if(data['settingsRevision'] is! int || data['location']!=null && data['location'] is! Map){
        throw const FormatException('Invalid account location response');
      }
      final loc=data['location'];
      final name=loc is Map ? loc['name'] : null;
      if(name!=null && (name is! String || name.isEmpty))throw const FormatException('Invalid saved label');
      if(mounted && requestEpoch==_readEpoch)setState((){
        _savedName=name as String?;_savedLoaded=true;_savedError=null;
      });
    }catch(_){
      if(mounted && requestEpoch==_readEpoch)setState((){
        // Do not replace the last confirmed saved label with an outage.
        _savedError='Could not refresh saved location';
      });
    }finally{
      if(mounted && requestEpoch==_readEpoch)setState(()=>_savedLoading=false);
    }
  }
  void _onSaved(String label){
    // A 200 save acknowledgement is authoritative, even if a prior GET is late.
    ++_readEpoch;
    if(!mounted)return;
    setState((){_savedName=label;_savedLoaded=true;_savedError=null;_savedLoading=false;});
    if(_expanded) _tile.collapse();
    widget.onLocationSaved?.call(label);
  }
  @override Widget build(BuildContext context)=>Column(
    crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      ExpansionTile(
        controller:_tile,
        key:const PageStorageKey<String>('p03-location-expansion'),
        title:const Text('Location & discovery'),
        subtitle:Text(_savedName!=null?_savedName!:
          _savedError!=null?'Unable to refresh location':
          _savedLoaded?'Choose location':'Location',
          key:const Key('p03-settings-saved-location')),
        leading:const Icon(Icons.location_on_outlined),
        maintainState:true,
        onExpansionChanged:(isExpanded){
          _expanded=isExpanded;
          if(isExpanded){
            if(!_everOpened)setState(()=>_everOpened=true);
            _readSavedLocation();
          }
        },
        children:[if(_everOpened) Padding(
          padding:const EdgeInsets.symmetric(vertical:8,horizontal:5),
          child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
            if(_savedError!=null)TextButton.icon(
              key:const Key('p03-settings-retry-saved'),
              onPressed:_savedLoading?null:_readSavedLocation,
              icon:const Icon(Icons.refresh),label:const Text('Retry saved-location check')),
            IndiaLocationPanel(baseUrl:widget.baseUrl,access:widget.access,
              testGet:widget.testGet==null?null:(path) async=>Uint8List.fromList(await widget.testGet!(path)),
              testCacheDirectory:widget.testCacheDirectory,
              testSaveManual:widget.testSaveManual,
              onLocationSaved:_onSaved, compact:true),
            if(widget.showDiscoveryPreferences && !widget.testHideDiscoveryPreferences)
              ExpansionTile(
                key:const PageStorageKey<String>('p03-discovery-distance-expansion'),
                tilePadding:EdgeInsets.zero,
                title:const Text('Distance preferences'),
                children:[_DiscoveryPreferences(baseUrl:widget.baseUrl,access:widget.access)],
              ),
          ]),
        )],
      ),
    ],
  );
}

class _DiscoveryPreferences extends StatefulWidget {
  const _DiscoveryPreferences({required this.baseUrl,required this.access});
  final String baseUrl;
  final Future<String> Function() access;
  @override State<_DiscoveryPreferences> createState()=>_DiscoveryPreferencesState();
}
class _DiscoveryPreferencesState extends State<_DiscoveryPreferences> {
  String band='0-50',sort='near_band_first',status='';
  int revision=0;
  bool busy=false,loaded=false;
  @override void initState(){super.initState();WidgetsBinding.instance.addPostFrameCallback((_){if(mounted)_load();});}
  Uri _uri() {
    final base=Uri.parse(widget.baseUrl);
    final local=base.scheme=='http' && {'localhost','127.0.0.1','10.0.2.2','::1'}.contains(base.host);
    if(!local && base.scheme!='https' || base.userInfo.isNotEmpty || base.query.isNotEmpty ||
        base.fragment.isNotEmpty || (base.path.isNotEmpty && base.path!='/')) {
      throw const FormatException('Unsafe settings origin');
    }
    return base.replace(path:'/v1/me/settings',query:null,fragment:null);
  }
  Future<Map<String,dynamic>> _request({Map<String,Object?>? body}) async {
    final client=HttpClient()..connectionTimeout=const Duration(seconds:8);
    try {
      final req=await (body==null?client.getUrl(_uri()):client.putUrl(_uri())).timeout(const Duration(seconds:10));
      req.followRedirects=false;
      req.headers.set(HttpHeaders.authorizationHeader,'Bearer ${await widget.access()}');
      if(body!=null){req.headers.contentType=ContentType.json;req.write(jsonEncode(body));}
      final response=await req.close().timeout(const Duration(seconds:12));
      if(response.statusCode==409)throw const FormatException('Settings changed on another device');
      if(response.statusCode!=200)throw const HttpException('Settings unavailable');
      final bytes=<int>[];
      await for(final b in response.timeout(const Duration(seconds:12))) {
        bytes.addAll(b);if(bytes.length>16000)throw const FormatException('Oversized settings');
      }
      return Map<String,dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
    }finally{client.close(force:true);}
  }
  void _apply(Map<String,dynamic> m) {
    final b=m['distanceBand'],s=m['sortMode'],r=m['settingsRevision'];
    if(b is! String || !const ['0-10','10-35','35-50','0-50'].contains(b) ||
      s is! String || !const ['near_band_first','recent_first'].contains(s) || r is! int || r<0) {
      throw const FormatException('Invalid settings response');
    }
    band=b;sort=s;revision=r;loaded=true;status='';
  }
  Future<void> _load() async {
    if(busy)return;setState(()=>busy=true);
    try{final result=await _request();if(mounted)setState(()=>_apply(result));}
    catch(_){if(mounted)setState(()=>status='Could not load preferences. Retry.');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> _save() async {
    if(busy || !loaded)return;setState(()=>busy=true);
    try{
      final result=await _request(body:{'distanceBand':band,'sortMode':sort,'expectedRevision':revision});
      if(mounted)setState((){_apply(result);status='Preferences saved privately. Discovery remains disabled.';});
    }on FormatException {if(mounted)setState(()=>status='Settings changed elsewhere. Reload and try again.');}
    catch(_){if(mounted)setState(()=>status='Save not confirmed. Reload before retrying.');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[

    if(loaded)...[
      DropdownButtonFormField<String>(
        key:ValueKey('p03-distance-$revision'),initialValue:band,
        items:const [
          DropdownMenuItem(value:'0-10',child:Text('0–10 km')),
          DropdownMenuItem(value:'10-35',child:Text('10–35 km')),
          DropdownMenuItem(value:'35-50',child:Text('35–50 km')),
          DropdownMenuItem(value:'0-50',child:Text('All 0–50 km')),
        ],onChanged:busy?null:(v){if(v!=null)setState(()=>band=v);},
      ),
      DropdownButtonFormField<String>(
        key:ValueKey('p03-sort-$revision'),initialValue:sort,
        items:const [
          DropdownMenuItem(value:'near_band_first',child:Text('Nearest distance band first')),
          DropdownMenuItem(value:'recent_first',child:Text('Newest profiles first (future)')),
        ],onChanged:busy?null:(v){if(v!=null)setState(()=>sort=v);},
      ),
      FilledButton(key:const Key('p03-save-preferences'),onPressed:busy?null:_save,child:const Text('Save preferences')),
    ],
    if(busy)const LinearProgressIndicator(),
    if(status.isNotEmpty)Text(status,key:const Key('p03-preferences-status')),
    if(status.isNotEmpty || !loaded)TextButton(key:const Key('p03-reload-preferences'),onPressed:busy?null:_load,child:const Text('Retry')),
  ]);
}
