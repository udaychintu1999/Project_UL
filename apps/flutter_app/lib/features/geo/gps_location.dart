import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

/// Transient phone coordinates exist only during the user-initiated save.
/// Never put a user's raw GPS fix in a location pack, logs, or persistent cache.
class OneTimeGpsFix {
  const OneTimeGpsFix(this.latitude,this.longitude,this.accuracyMeters,this.timestamp);
  final double latitude,longitude,accuracyMeters;
  final DateTime timestamp;
  bool get plausible =>
      latitude.isFinite && longitude.isFinite &&
      latitude>=-90 && latitude<=90 && longitude>=-180 && longitude<=180 &&
      accuracyMeters.isFinite && accuracyMeters>0 && accuracyMeters<=10000 &&
      timestamp.toUtc().isBefore(DateTime.now().toUtc().add(const Duration(seconds:30))) &&
      timestamp.toUtc().isAfter(DateTime.now().toUtc().subtract(const Duration(minutes:2)));
}

abstract class OneTimeLocationProvider {
  Future<OneTimeGpsFix> capture();
}

class GpsPermissionException implements Exception {
  const GpsPermissionException(this.kind);
  final String kind;
}

class AndroidOneTimeGpsProvider implements OneTimeLocationProvider {
  @override Future<OneTimeGpsFix> capture() async {
    if(!await Geolocator.isLocationServiceEnabled())throw const GpsPermissionException('services');
    var permission=await Geolocator.checkPermission();
    if(permission==LocationPermission.denied)permission=await Geolocator.requestPermission();
    if(permission==LocationPermission.deniedForever)throw const GpsPermissionException('forever');
    if(permission==LocationPermission.denied)throw const GpsPermissionException('denied');
    // Explicit one-time fix, never a position stream or background permission.
    final position=await Geolocator.getCurrentPosition(locationSettings:const LocationSettings(
      accuracy:LocationAccuracy.high,timeLimit:Duration(seconds:20)));
    return OneTimeGpsFix(position.latitude,position.longitude,position.accuracy,
      position.timestamp);
  }
}

class GpsSelectionApiException implements Exception {
  const GpsSelectionApiException(this.error);
  final String error;
}

abstract class GpsSelectionClient {
  Future<int> currentSettingsRevision();
  Future<Map<String,dynamic>> save(OneTimeGpsFix fix,int expectedRevision);
}

class HttpGpsSelectionClient implements GpsSelectionClient {
  HttpGpsSelectionClient({required this.baseUrl,required this.access});
  final String baseUrl;
  final Future<String> Function() access;
  Uri _uri(String path) {
    final u=Uri.parse(baseUrl);
    final localhost=u.scheme=='http' && const ['localhost','127.0.0.1','10.0.2.2','::1'].contains(u.host);
    if((!localhost && u.scheme!='https') || (localhost && !u.hasPort) ||
       u.userInfo.isNotEmpty || u.query.isNotEmpty ||
       u.fragment.isNotEmpty || (u.path.isNotEmpty && u.path!='/'))throw const FormatException('Unsafe API origin');
    return u.replace(path:path,query:null,fragment:null);
  }
  Future<Map<String,dynamic>> _call(String path,{Map<String,Object?>? body}) async {
    final client=HttpClient()..connectionTimeout=const Duration(seconds:8);
    try {
      final request=await (body==null?client.getUrl(_uri(path)):client.postUrl(_uri(path)))
        .timeout(const Duration(seconds:10));
      request.followRedirects=false;
      request.headers.set(HttpHeaders.authorizationHeader,'Bearer ${await access()}');
      if(body!=null){request.headers.contentType=ContentType.json;request.write(jsonEncode(body));}
      final response=await request.close().timeout(const Duration(seconds:15));
      final bytes=<int>[];
      await for(final part in response.timeout(const Duration(seconds:15))){
        bytes.addAll(part);
        if(bytes.length>12000)throw const FormatException('Oversized location response');
      }
      final json=Map<String,dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
      if(response.statusCode!=200)throw GpsSelectionApiException(json['error'] as String? ?? 'unavailable');
      return json;
    } finally {client.close(force:true);}
  }
  @override Future<int> currentSettingsRevision() async {
    final result=await _call('/v1/me/geo/location');
    if(result['gpsAvailable']!=true)throw const GpsSelectionApiException('gps_india_boundary_not_configured');
    final revision=result['settingsRevision'];
    if(revision is! int || revision<0)throw const FormatException('Invalid settingsRevision');
    return revision;
  }
  @override Future<Map<String,dynamic>> save(OneTimeGpsFix fix,int expectedRevision) =>
    _call('/v1/me/geo/gps',body:{
      'lat':fix.latitude,'lng':fix.longitude,'accuracyMeters':fix.accuracyMeters,
      'fixTimestamp':fix.timestamp.toUtc().toIso8601String(),'expectedRevision':expectedRevision,
    });
}

/// GPS is strictly opt-in and never invoked when Settings opens.
class OneTimeGpsPanel extends StatefulWidget {
  const OneTimeGpsPanel({super.key,required this.provider,required this.client,required this.onSaved});
  final OneTimeLocationProvider provider;
  final GpsSelectionClient client;
  final void Function(int revision,String name) onSaved;
  @override State<OneTimeGpsPanel> createState()=>_OneTimeGpsPanelState();
}
class _OneTimeGpsPanelState extends State<OneTimeGpsPanel> {
  bool busy=false;
  String status='';
  String? recovery;

  /// One explicit tap initiates permission, one fix, and an authenticated save.
  /// The captured raw fix is never stored as widget state or persisted locally.
  Future<void> _captureAndSave() async {
    if(busy)return;
    setState(() {busy=true;recovery=null;status='Checking GPS availability…';});
    try {
      // Fetch revision before requesting the phone fix: no extra confirmation,
      // no duplicate network request after obtaining sensitive coordinates.
      final revision=await widget.client.currentSettingsRevision();
      if(!mounted)return;
      setState(()=>status='Requesting a one-time location fix…');
      final fix=await widget.provider.capture();
      if(!mounted)return;
      if(!fix.plausible)throw const GpsPermissionException('accuracy');
      setState(()=>status='Saving your approximate location…');
      // Fastify independently checks the India polygon, revision and cooldown.
      // Never write the raw GPS fix to local storage or application logs.
      final saved=await widget.client.save(fix,revision);
      if(saved['settingsRevision'] is! int || saved['location'] is! Map ||
         (saved['location'] as Map)['source']!='gps_selected' ||
         (saved['location'] as Map)['name'] is! String) {
        throw const FormatException('Invalid GPS save reply');
      }
      if(mounted){
        setState(()=>status='Approximate location saved privately. Discovery remains disabled.');
        widget.onSaved(saved['settingsRevision'] as int,(saved['location'] as Map)['name'] as String);
      }
    } on GpsPermissionException catch(e) {
      if(mounted)setState(() {recovery=e.kind;status=switch(e.kind){
        'services'=>'Turn on device Location Services, or choose manually.',
        'forever'=>'Location permission is blocked in Android settings. Choose manually or change permission in app settings.',
        'denied'=>'Location permission denied. Manual selection remains available.',
        _=>'GPS accuracy or freshness is insufficient. Retry outdoors or choose manually.'};});
    } on GpsSelectionApiException catch(e) {
      if(mounted)setState(()=>status=switch(e.error){
        'gps_outside_supported_india_boundary'=>'Outside the supported India boundary or close to a simplified coastline. Select manually if the fix is wrong.',
        'gps_india_boundary_not_configured'=>'India GPS validation is unavailable. Manual selection still works.',
        'gps_fix_invalid_stale_or_inaccurate'=>'GPS fix is too old or inaccurate. Try again.',
        'settings_revision_conflict'=>'Settings changed on another device. Tap Use GPS again to refresh.',
        'geo_location_change_cooldown'=>'Please wait 15 seconds before changing location again.',
        _=>'GPS save could not be confirmed. Check your connection or choose manually.'});
    } on TimeoutException {if(mounted)setState(()=>status='GPS timed out. Retry or choose manually.');}
    catch (_) {if(mounted)setState(()=>status='GPS location was not saved. Check your connection and retry or choose manually.');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Column(
    key:const Key('p03-gps-one-shot'),crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      const Text('One-time GPS (optional)',style:TextStyle(fontWeight:FontWeight.w700)),
      const Text('Tap below to request GPS permission and save your approximate India location in one action. Fastify checks the boundary and stores only an H3 R6 location, never your exact GPS fix.'),
      const SizedBox(height:8),
      OutlinedButton.icon(key:const Key('p03-gps-capture'),onPressed:busy?null:_captureAndSave,
        icon:const Icon(Icons.my_location),label:const Text('Use GPS and save location')),
      if(busy) const LinearProgressIndicator(),
      if(status.isNotEmpty) Padding(padding:const EdgeInsets.only(top:8),
        child:Text(status,key:const Key('p03-gps-status'))),
      if(recovery=='forever') TextButton.icon(
        key:const Key('p03-gps-open-settings'),
        onPressed:()=>Geolocator.openAppSettings(),
        icon:const Icon(Icons.settings),label:const Text('Open Android app settings')),
    ],
  );
}
