import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/services.dart';
import 'auth_service.dart';

/// Android Keystore-backed native bridge. No plaintext storage fallback.
abstract class DeviceVault {
  Future<String> publicKey();
  Future<String> sign({required String operation,required String uid,required int slot,
    required String familyId,required int generation,required String credential,required String nonce});
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class AndroidDeviceVault implements DeviceVault {
  const AndroidDeviceVault();
  static const _channel=MethodChannel('uluv/p01_3_secure');
  @override
  Future<String> publicKey() async => (await _channel.invokeMethod<String>('publicKey'))!;
  @override
  Future<String> sign({required String operation,required String uid,required int slot,
      required String familyId,required int generation,required String credential,required String nonce}) async =>
    (await _channel.invokeMethod<String>('sign',{'operation':operation,'uid':uid,'slot':slot,
      'familyId':familyId,'generation':generation,'credential':credential,'nonce':nonce}))!;
  @override
  Future<String?> read() => _channel.invokeMethod<String>('read');
  @override
  Future<void> write(String value) async {
    if(await _channel.invokeMethod<bool>('write',value)!=true)throw StateError('Secure storage unavailable');
  }
  @override
  Future<void> clear() async {
    if(await _channel.invokeMethod<bool>('clear')!=true)throw StateError('Secure storage unavailable');
  }
}

class DeviceApiResponse {
  const DeviceApiResponse(this.status,this.data,{this.networkFailure=false});
  final int status;
  final Map<String,dynamic> data;
  final bool networkFailure;
  bool get ok=>status>=200 && status<300;
  bool get transient=>networkFailure || status==429 || status>=500;
  String get error=>data['error'] is String?data['error'] as String:'device_request_failed';
}

/// Local-only HTTP client; never retries signed writes automatically.
class DeviceSessionApi {
  const DeviceSessionApi(this.baseUrl);
  final String baseUrl;
  Uri _endpoint(String path) {
    final base=Uri.parse(baseUrl);
    if(base.scheme!='http'||!{'localhost','127.0.0.1','::1','10.0.2.2'}.contains(base.host)||
      !base.hasPort||base.userInfo.isNotEmpty||base.query.isNotEmpty||base.fragment.isNotEmpty||
      (base.path.isNotEmpty&&base.path!='/'))throw const FormatException('Invalid local API endpoint');
    return base.replace(path:path);
  }
  Future<DeviceApiResponse> call(String path,{Map<String,Object?>? payload,String? access}) async {
    final client=HttpClient()..connectionTimeout=const Duration(seconds:5);
    try {
      final request=await (payload==null?client.getUrl(_endpoint(path)):client.postUrl(_endpoint(path)))
        .timeout(const Duration(seconds:8));
      request.persistentConnection=false;
      request.headers.set(HttpHeaders.acceptHeader,'application/json');
      if(access!=null)request.headers.set(HttpHeaders.authorizationHeader,'Bearer $access');
      if(payload!=null){
        final bytes=utf8.encode(jsonEncode(payload));
        request.headers.set(HttpHeaders.contentTypeHeader,'application/json; charset=utf-8');
        request.contentLength=bytes.length;request.add(bytes);
      }
      final response=await request.close().timeout(const Duration(seconds:12));
      final raw=await utf8.decoder.bind(response).join().timeout(const Duration(seconds:12));
      final parsed=jsonDecode(raw);
      if(parsed is! Map<String,dynamic>)return const DeviceApiResponse(502,{});
      return DeviceApiResponse(response.statusCode,parsed);
    }on SocketException{return const DeviceApiResponse(0,{},networkFailure:true);
    }on TimeoutException{return const DeviceApiResponse(0,{},networkFailure:true);
    }on HttpException{return const DeviceApiResponse(0,{},networkFailure:true);
    }catch(_){return const DeviceApiResponse(0,{},networkFailure:true);
    }finally{client.close(force:true);}
  }
}

class DeviceRecord {
  const DeviceRecord({required this.uid,required this.slot,required this.familyId,required this.generation,
    required this.refreshToken,required this.reauthAt,required this.inactiveAt,this.signedOut=false});
  final String uid,familyId,refreshToken;
  final int slot,generation,reauthAt,inactiveAt;
  final bool signedOut;
  Map<String,Object?> toJson()=>{'v':1,'uid':uid,'slot':slot,'familyId':familyId,
    'generation':generation,'refreshToken':refreshToken,'reauthAt':reauthAt,
    'inactiveAt':inactiveAt,'signedOut':signedOut};
  factory DeviceRecord.fromJson(String raw){
    final value=jsonDecode(raw);
    if(value is! Map<String,dynamic>||value['v']!=1||value['uid'] is! String||
      value['familyId'] is! String||value['refreshToken'] is! String||value['slot'] is! int||
      value['generation'] is! int||value['reauthAt'] is! int||value['inactiveAt'] is! int||
      value['signedOut'] is! bool)throw const FormatException('Invalid sealed session record');
    if(value['slot']<0||value['slot']>=5||value['generation']<0||
      !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(value['refreshToken']))
      throw const FormatException('Invalid sealed session values');
    return DeviceRecord(uid:value['uid'],slot:value['slot'],familyId:value['familyId'],
      generation:value['generation'],refreshToken:value['refreshToken'],reauthAt:value['reauthAt'],
      inactiveAt:value['inactiveAt'],signedOut:value['signedOut']);
  }
  DeviceRecord copyWith({int? generation,String? refreshToken,int? inactiveAt,bool? signedOut})=>
    DeviceRecord(uid:uid,slot:slot,familyId:familyId,generation:generation??this.generation,
      refreshToken:refreshToken??this.refreshToken,reauthAt:reauthAt,
      inactiveAt:inactiveAt??this.inactiveAt,signedOut:signedOut??this.signedOut);
}

class SessionException implements Exception {
  const SessionException(this.message,{this.transient=false});
  final String message;
  final bool transient;
  @override String toString()=>message;
}

enum SessionStage {restoring,signedOut,authenticated,offline}

class PersistentSessionController {
  PersistentSessionController({required this.vault,required this.api});
  final DeviceVault vault;
  final DeviceSessionApi api;
  DeviceRecord? record;
  String? accessToken;
  DateTime? accessExpires;
  SessionStage stage=SessionStage.restoring;
  String notice='';
  void Function()? onChanged;
  Future<String>? _refreshing;
  int _serial=0;
  static final Random _rng=Random.secure();
  static String randomId(){
    final bytes=List<int>.generate(16,(_)=>_rng.nextInt(256));
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    final hex=bytes.map((b)=>b.toRadixString(16).padLeft(2,'0')).join();
    return '${hex.substring(0,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}';
  }
  static String nonce()=>base64Url.encode(List<int>.generate(24,(_)=>_rng.nextInt(256))).replaceAll('=','');
  void _change(SessionStage next,String text){stage=next;notice=text;onChanged?.call();}
  Map<String,Object?> _body(DeviceRecord state,String signature,String n)=>{
    'uid':state.uid,'slot':state.slot,'familyId':state.familyId,'generation':state.generation,
    'refreshToken':state.refreshToken,'nonce':n,'signature':signature};
  Future<DeviceApiResponse> _signed(String operation,DeviceRecord value) async {
    final n=nonce();
    final sig=await vault.sign(operation:operation,uid:value.uid,slot:value.slot,
      familyId:value.familyId,generation:value.generation,credential:value.refreshToken,nonce:n);
    return api.call('/v1/auth/device/$operation',payload:_body(value,sig,n));
  }
  Future<void> restore() async {
    _change(SessionStage.restoring,'Restoring your session...');
    try {
      final raw=await vault.read();
      if(raw==null){_change(SessionStage.signedOut,'Log in to U_luv.');return;}
      record=DeviceRecord.fromJson(raw);
      if(record!.signedOut){
        _change(SessionStage.signedOut,'Signed out.');
        await retryPendingLogout();return;
      }
      await refresh();
    }on SessionException catch(e){_change(e.transient?SessionStage.offline:SessionStage.signedOut,e.message);
    }catch(_){
      // Device keys/storage may be lost after reinstall or backup restoration.
      record=null;accessToken=null;
      _change(SessionStage.signedOut,'Secure login could not be restored. Please sign in again.');
    }
  }
  Future<void> enroll(String token,String uid) async {
    if(record!=null && !record!.signedOut){throw const SessionException('Sign out before registering another device session.');}
    final publicKey=await vault.publicKey();
    final nonceValue=nonce(),familyId=randomId();
    for(int slot=0;slot<5;slot++){
      final sig=await vault.sign(operation:'enroll',uid:uid,slot:slot,familyId:familyId,
        generation:0,credential:token,nonce:nonceValue);
      final response=await api.call('/v1/auth/device/enroll',access:token,payload:{
        'slot':slot,'familyId':familyId,'publicKey':publicKey,'nonce':nonceValue,'signature':sig});
      if(response.status==409 && response.error=='device_slot_in_use')continue;
      if(!response.ok){throw SessionException(response.transient?'Connection unavailable. Retry device setup.':
        'Unable to enable 30-day sign-in. Please log in again.',transient:response.transient);}
      final data=response.data, info=data['device'];
      if(data['token'] is! String||data['refreshToken'] is! String||info is! Map<String,dynamic>||
        info['reauthAt'] is! int||info['inactiveAt'] is! int)throw const SessionException('Invalid device enrollment response.');
      final next=DeviceRecord(uid:uid,slot:slot,familyId:familyId,generation:0,
        refreshToken:data['refreshToken'],reauthAt:info['reauthAt'],inactiveAt:info['inactiveAt']);
      try {await vault.write(jsonEncode(next.toJson()));}catch(_){
        // Enrollment already committed. Revoke immediately if secure persistence fails.
        try {await _signed('logout',next);}catch(_){/* server-side fallback: expires at 30d */}
        throw const SessionException('Unable to save protected login. Please sign in again.');
      }
      record=next;accessToken=data['token'];
      accessExpires=DateTime.now().add(const Duration(minutes:29));
      _serial++;
      _change(SessionStage.authenticated,'Account ready.');return;
    }
    throw const SessionException('Five devices already registered. Revoke an existing device before signing in here.');
  }
  Future<String> access() async {
    if(stage==SessionStage.signedOut || record?.signedOut==true)throw const SessionException('Please sign in again.');
    if(accessToken!=null && accessExpires!=null && DateTime.now().isBefore(accessExpires!))return accessToken!;
    return refresh();
  }
  Future<String> refresh(){
    if(_refreshing!=null)return _refreshing!;
    final future=_refreshOnce();
    _refreshing=future;
    return future.whenComplete(()=>_refreshing=null);
  }
  Future<String> _refreshOnce() async {
    final before=record, serial=_serial;
    if(before==null||before.signedOut)throw const SessionException('Please sign in again.');
    DeviceApiResponse response;
    try {response=await _signed('refresh',before);}catch(_){
      _change(SessionStage.offline,'Cannot connect. Retry when the server is available.');
      throw const SessionException('Connection unavailable.',transient:true);
    }
    if(serial!=_serial||record?.signedOut==true)throw const SessionException('Signed out.');
    if(response.transient){
      _change(SessionStage.offline,'Cannot connect. Your saved login is preserved.');
      throw const SessionException('Connection unavailable.',transient:true);
    }
    if(!response.ok){
      accessToken=null;record=null;_serial++;
      try{await vault.clear();}catch(_){/* do not restore any invalid token */}
      _change(SessionStage.signedOut,'Session ended. Sign in again.');
      throw const SessionException('Session ended. Sign in again.');
    }
    final data=response.data,info=data['device'];
    if(data['token'] is! String||data['refreshToken'] is! String||info is! Map<String,dynamic>||info['generation'] is! int||info['inactiveAt'] is! int){
      _change(SessionStage.offline,'Unable to read the renewal response. Retry or sign in again.');
      throw const SessionException('Invalid renewal response.',transient:true);
    }
    final next=before.copyWith(generation:info['generation'],refreshToken:data['refreshToken'],inactiveAt:info['inactiveAt']);
    try {await vault.write(jsonEncode(next.toJson()));}catch(_){
      // Server consumed the old token; no grace or unsafe token replay.
      accessToken=null;record=null;_serial++;
      _change(SessionStage.signedOut,'Session storage failed. Please sign in again.');
      throw const SessionException('Session storage unavailable. Please sign in again.');
    }
    if(serial!=_serial){
      // A logout can race with the native write. Re-assert signed-out state
      // so a late successful refresh never persists an active credential.
      try{
        if(record?.signedOut==true)await vault.write(jsonEncode(record!.toJson()));
        else await vault.clear();
      }catch(_){/* sign-out storage failure requires an explicit user warning */}
      throw const SessionException('Signed out.');
    }
    record=next;accessToken=data['token'];
    accessExpires=DateTime.now().add(const Duration(minutes:29));
    _change(SessionStage.authenticated,'Account ready.');
    return accessToken!;
  }
  Future<void> signOut() async {
    _serial++;
    final before=record;
    accessToken=null;accessExpires=null;
    if(before==null){_change(SessionStage.signedOut,'Signed out.');return;}
    final signedOut=before.copyWith(signedOut:true);
    // Persist local logout intent FIRST; a late refresh must never reopen the UI.
    try{await vault.write(jsonEncode(signedOut.toJson()));}catch(_){
      // Fail closed for UI. The server credential expires, but owner may need global revoke.
      try{await vault.clear();}catch(_){/* leave a visible revocation warning */}
      record=null;_change(SessionStage.signedOut,'Signed out locally. Remote revocation may be pending.');return;
    }
    record=signedOut;
    _change(SessionStage.signedOut,'Signed out.');
    await retryPendingLogout();
  }
  Future<void> retryPendingLogout() async {
    final before=record;
    if(before==null || !before.signedOut)return;
    DeviceApiResponse response;
    try{response=await _signed('logout',before);}catch(_){return;}
    if(response.ok || (response.status==401 && !response.transient)){
      try {await vault.clear();}catch(_){return;}
      if(record?.signedOut==true)record=null;
    }
  }
  Future<AuthResult> withAccess(Future<AuthResult> Function(String) request) async {
    try {return await request(await access());}
    on SessionException catch(e){return AuthResult(ok:false,message:e.message);}
  }
}

/// Existing P01-2 screens can use this without knowing that tokens rotate.
class RenewingAuthService implements AuthService,PasswordAuthService,SignupPasswordAuthService {
  RenewingAuthService(this.delegate,this.sessions);
  final HttpAuthService delegate;
  final PersistentSessionController sessions;
  @override Future<AuthResult> requestCode(String email)=>delegate.requestCode(email);
  @override Future<AuthResult> requestSignupCode(String email)=>delegate.requestSignupCode(email);
  @override Future<AuthResult> localOutboxCode(String email)=>delegate.localOutboxCode(email);
  @override Future<AuthResult> verify({required String email,required String code,required String dateOfBirth,required bool consent})=>delegate.verify(email:email,code:code,dateOfBirth:dateOfBirth,consent:consent);
  @override Future<AuthResult> registerAccount({required String email,required String code,required String dateOfBirth,required bool consent,required String password})=>delegate.registerAccount(email:email,code:code,dateOfBirth:dateOfBirth,consent:consent,password:password);
  @override Future<AuthResult> passwordLogin(String email,String password)=>delegate.passwordLogin(email,password);
  @override Future<AuthResult> requestPasswordRecovery(String email)=>delegate.requestPasswordRecovery(email);
  @override Future<AuthResult> localPasswordRecoveryCode(String email)=>delegate.localPasswordRecoveryCode(email);
  @override Future<AuthResult> resetPassword(String email,String code,String password)=>delegate.resetPassword(email,code,password);
  @override Future<AuthResult> me(String token)=>sessions.withAccess(delegate.me);
  @override Future<AuthResult> setPassword(String token,String password)=>sessions.withAccess((t)=>delegate.setPassword(t,password));
  @override Future<AuthResult> changePassword(String token,String current,String next) async {
    final result=await sessions.withAccess((t)=>delegate.changePassword(t,current,next));
    if(result.ok)await sessions.signOut();
    return result;
  }
  @override Future<AuthResult> logout(String token) async {
    await sessions.signOut();
    return const AuthResult(ok:true,message:'Signed out.');
  }
}
