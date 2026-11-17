import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Postal directory describes post offices, not precise residence/geolocation.
/// Users must confirm a specific GeoNames place through the manual picker.
class PincodeOffice {
  const PincodeOffice({required this.office,required this.district,required this.state,
    required this.officeType,required this.delivery});
  final String office,district,state,officeType,delivery;
  factory PincodeOffice.fromJson(Map<String,dynamic> x) {
    String field(String key,{bool optional=false}) {
      final value=x[key];
      if(value is! String || value.length>(key=='office'?90:100) || (!optional && value.trim().isEmpty)) {
        throw const FormatException('Invalid postal record');
      }
      return value;
    }
    return PincodeOffice(office:field('office'),district:field('district'),state:field('state'),
      officeType:field('officeType',optional:true),delivery:field('delivery',optional:true));
  }
}

class PincodeLookupResponse {
  const PincodeLookupResponse({required this.pin,required this.totalOffices,
    required this.truncated,required this.offices});
  final String pin;
  final int totalOffices;
  final bool truncated;
  final List<PincodeOffice> offices;
  factory PincodeLookupResponse.fromJson(Map<String,dynamic> input) {
    final pin=input['pin'],total=input['totalOffices'],cut=input['truncated'],entries=input['offices'];
    if(pin is! String || !RegExp(r'^[1-9][0-9]{5}$').hasMatch(pin) ||
        total is! int || total<1 || total>2000 || cut is! bool ||
        entries is! List || entries.isEmpty || entries.length>100 ||
        input['requiresManualPlaceConfirmation']!=true || input['discoveryEnabled']!=false ||
        (cut && total<=entries.length) || (!cut && total!=entries.length)) {
      throw const FormatException('Invalid postal lookup response');
    }
    final offices=entries.map((e)=>PincodeOffice.fromJson(Map<String,dynamic>.from(e as Map))).toList(growable:false);
    return PincodeLookupResponse(pin:pin,totalOffices:total,truncated:cut,offices:offices);
  }
}

class PincodeLookupException implements Exception {
  const PincodeLookupException(this.code);
  final String code;
}

abstract class PincodeLookupClient {
  Future<PincodeLookupResponse> search(String pin);
}

class HttpPincodeLookupClient implements PincodeLookupClient {
  const HttpPincodeLookupClient({required this.baseUrl,required this.access});
  final String baseUrl;
  final Future<String> Function() access;

  Uri _endpoint(String pin) {
    final uri=Uri.parse(baseUrl);
    final local=uri.scheme=='http' && {'127.0.0.1','localhost','10.0.2.2','::1'}.contains(uri.host);
    if ((!local && uri.scheme!='https') || (local && !uri.hasPort) || uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty || uri.fragment.isNotEmpty || (uri.path.isNotEmpty && uri.path!='/')) {
      throw const FormatException('Unsafe PIN lookup origin');
    }
    return uri.replace(path:'/v1/geo/india/pincodes/$pin');
  }

  @override
  Future<PincodeLookupResponse> search(String pin) async {
    if(!RegExp(r'^[1-9][0-9]{5}$').hasMatch(pin))throw const PincodeLookupException('invalid_india_pin');
    final client=HttpClient()..connectionTimeout=const Duration(seconds:6);
    try {
      final request=await client.getUrl(_endpoint(pin)).timeout(const Duration(seconds:8));
      request.headers.set(HttpHeaders.authorizationHeader,'Bearer ${await access()}');
      request.headers.set(HttpHeaders.acceptHeader,'application/json');
      final response=await request.close().timeout(const Duration(seconds:12));
      if(response.statusCode==404)throw const PincodeLookupException('india_pin_not_found');
      if(response.statusCode==503)throw const PincodeLookupException('india_pincode_catalogue_unavailable');
      if(response.statusCode==401 || response.statusCode==403)throw const PincodeLookupException('session_expired');
      if(response.statusCode!=200)throw const PincodeLookupException('pin_lookup_failed');
      final bytes=<int>[];
      await for(final chunk in response.timeout(const Duration(seconds:12))) {
        bytes.addAll(chunk);
        if(bytes.length>64000)throw const FormatException('PIN response too large');
      }
      final value=jsonDecode(utf8.decode(bytes));
      if(value is! Map<String,dynamic>)throw const FormatException('Invalid postal response');
      final data=PincodeLookupResponse.fromJson(value);
      if(data.pin!=pin)throw const FormatException('PIN response mismatch');
      return data;
    } on PincodeLookupException {rethrow;}
      on FormatException {throw const PincodeLookupException('invalid_postal_response');}
      on TimeoutException {throw const PincodeLookupException('network_unavailable');}
      on SocketException {throw const PincodeLookupException('network_unavailable');}
      on HttpException {throw const PincodeLookupException('network_unavailable');}
    catch (_) {throw const PincodeLookupException('network_unavailable');}
    finally {client.close(force:true);}
  }
}

typedef PincodeAreaChosen = void Function(String state, String district, String office);

/// P03-1C is a shortcut into the SAME GeoNames picker, not an alternative
/// unauthenticated way to save an H3 cell from a coarse postal district.
class PincodeLookupPanel extends StatefulWidget {
  const PincodeLookupPanel({super.key,required this.client,required this.onAreaChosen});
  final PincodeLookupClient client;
  final PincodeAreaChosen onAreaChosen;
  @override State<PincodeLookupPanel> createState()=>_PincodeLookupPanelState();
}

class _PincodeLookupPanelState extends State<PincodeLookupPanel> {
  final controller=TextEditingController();
  PincodeLookupResponse? result;
  bool busy=false;
  String message='';
  int sequence=0;
  @override void dispose(){sequence++;controller.dispose();super.dispose();}

  Future<void> _lookup() async {
    final pin=controller.text;
    if(busy || !RegExp(r'^[1-9][0-9]{5}$').hasMatch(pin))return;
    final seq=++sequence;
    setState(() {busy=true;message='Looking up PIN code…';result=null;});
    try {
      final data=await widget.client.search(pin);
      if(!mounted || seq!=sequence)return;
      setState(() {result=data;message=data.truncated?'Showing first 100 offices for this PIN. Select an area and confirm a place below.':'Select a post office area, then confirm your exact village or town below.';});
    } on PincodeLookupException catch(e) {
      if(!mounted || seq!=sequence)return;
      setState(() {message=switch(e.code){
        'india_pin_not_found'=>'PIN code not found in this postal snapshot. Try manual location selection.',
        'india_pincode_catalogue_unavailable'=>'Postal directory is not installed. Manual location selection still works.',
        'session_expired'=>'Please sign in again to search PIN codes.',
        _=>'Could not search this PIN. Check your connection and retry.'
      };});
    } catch (_) { if(mounted && seq==sequence)setState(()=>message='Could not search this PIN. Try again.'); }
    finally {if(mounted)setState(()=>busy=false);}
  }

  @override
  Widget build(BuildContext context)=>Column(
    key:const Key('p03-1c-pin-panel'),crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      const Text('Or search by Indian PIN code',style:TextStyle(fontSize:16,fontWeight:FontWeight.w700)),
      const SizedBox(height:5),
      const Text('PIN codes can cover multiple post offices. Select an area, then confirm a village or town before saving your approximate location.',style:TextStyle(fontSize:12)),
      const SizedBox(height:8),
      KeyedSubtree(key:const PageStorageKey<String>('p03-1c-pin-scroll-scope'),child:TextField(
        key:const Key('p03-1c-pin-input'),controller:controller,
        keyboardType:TextInputType.number,
        inputFormatters:[FilteringTextInputFormatter.digitsOnly,LengthLimitingTextInputFormatter(6)],
        decoration:const InputDecoration(labelText:'6-digit PIN code',hintText:'e.g. 500001',border:OutlineInputBorder()),
        onChanged:(_){sequence++;setState((){result=null;message='';});},
        onSubmitted:(_)=>_lookup(),
      )),
      const SizedBox(height:8),
      ListenableBuilder(listenable:controller,builder:(context,_)=>FilledButton.icon(
        key:const Key('p03-1c-search-pin'),icon:const Icon(Icons.search),
        onPressed:busy || !RegExp(r'^[1-9][0-9]{5}$').hasMatch(controller.text)?null:_lookup,
        label:const Text('Find PIN code'))),
      if(busy)const LinearProgressIndicator(),
      if(message.isNotEmpty)Padding(padding:const EdgeInsets.symmetric(vertical:8),
        child:Text(message,key:const Key('p03-1c-status'))),
      if(result!=null) ...[
        Text('${result!.totalOffices} post office(s) for PIN ${result!.pin}',style:const TextStyle(fontSize:13,fontWeight:FontWeight.w600)),
        ConstrainedBox(constraints:const BoxConstraints(maxHeight:235),child:ListView.builder(
          key:const PageStorageKey<String>('p03-1c-results-scroll'),
          shrinkWrap:true,itemCount:result!.offices.length,
          itemBuilder:(context,index){
            final x=result!.offices[index];
            return ListTile(key:Key('p03-1c-office-$index'),
              title:Text(x.office),subtitle:Text('${x.district}, ${x.state}'),
              trailing:const Icon(Icons.chevron_right),
              onTap:()=>widget.onAreaChosen(x.state,x.district,x.office));
          },
        )),
      ],
      const Divider(height:28),
    ]
  );
}
