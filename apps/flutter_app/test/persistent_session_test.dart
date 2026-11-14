import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uluv/features/auth/auth_service.dart';
import 'package:uluv/features/auth/persistent_session.dart';
import 'package:uluv/features/auth/persistent_gate.dart';

const _uid='00000000-0000-4000-8000-000000000001';
const _family='00000000-0000-4000-8000-000000000002';
const _token='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const _next='BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const _access='CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
final _deadline=DateTime.now().millisecondsSinceEpoch~/1000+2592000;

class MemoryVault implements DeviceVault {
  String? data;
  int writes=0;
  @override Future<String?> read() async=>data;
  @override Future<void> write(String value) async{data=value;writes++;}
  @override Future<void> clear() async{data=null;}
  @override Future<String> publicKey()async=>'test-public-key';
  @override Future<String> sign({required String operation,required String uid,required int slot,
    required String familyId,required int generation,required String credential,required String nonce})async=>'test-signature';
}
class FakeDeviceApi extends DeviceSessionApi {
  FakeDeviceApi():super('http://127.0.0.1:3000');
  int refreshCalls=0,logoutCalls=0;
  DeviceApiResponse? response;
  Completer<DeviceApiResponse>? delayed;
  @override Future<DeviceApiResponse> call(String path,{Map<String,Object?>? payload,String? access}) async{
    if(path.endsWith('/refresh')){refreshCalls++;return delayed?.future??response??const DeviceApiResponse(503,{});}
    if(path.endsWith('/logout')){logoutCalls++;return response??const DeviceApiResponse(503,{});}
    return const DeviceApiResponse(503,{});
  }
}
DeviceRecord fixture()=>DeviceRecord(uid:_uid,slot:0,familyId:_family,generation:0,refreshToken:_token,
  reauthAt:_deadline,inactiveAt:_deadline);
DeviceApiResponse refreshed()=>DeviceApiResponse(200,{'token':_access,'refreshToken':_next,
  'device':{'generation':1,'inactiveAt':_deadline}});

void main(){
  test('P01-3 preserves sealed credential and exposes Retry on transient outage',() async{
    final store=MemoryVault()..data=jsonEncode(fixture().toJson());
    final api=FakeDeviceApi()..response=const DeviceApiResponse(503,{});
    final session=PersistentSessionController(vault:store,api:api);
    await session.restore();
    expect(session.stage,SessionStage.offline);expect(store.data,isNotNull);
    expect(api.refreshCalls,1);
  });
  test('P01-3 definitive revocation erases local credential and needs sign-in',() async{
    final store=MemoryVault()..data=jsonEncode(fixture().toJson());
    final api=FakeDeviceApi()..response=const DeviceApiResponse(401,{'error':'refresh_expired_or_revoked'});
    final session=PersistentSessionController(vault:store,api:api);
    await session.restore();
    expect(session.stage,SessionStage.signedOut);expect(store.data,isNull);
  });
  test('P01-3 coalesces concurrent renewal and writes only successor',() async{
    final store=MemoryVault()..data=jsonEncode(fixture().toJson());
    final api=FakeDeviceApi()..delayed=Completer<DeviceApiResponse>();
    final session=PersistentSessionController(vault:store,api:api);
    session.record=fixture();session.stage=SessionStage.authenticated;
    final first=session.access(),second=session.access();
    await Future<void>.delayed(Duration.zero);
    api.delayed!.complete(refreshed());
    expect(await first,_access);expect(await second,_access);
    expect(api.refreshCalls,1);expect(store.writes,1);
    expect(DeviceRecord.fromJson(store.data!).generation,1);
  });
  test('P01-3 logout intent cannot restore offline',() async{
    final store=MemoryVault()..data=jsonEncode(fixture().toJson());
    final api=FakeDeviceApi()..response=const DeviceApiResponse(503,{});
    final session=PersistentSessionController(vault:store,api:api);
    session.record=fixture();session.stage=SessionStage.authenticated;
    await session.signOut();
    expect(session.stage,SessionStage.signedOut);
    expect(DeviceRecord.fromJson(store.data!).signedOut,isTrue);
    final restarted=PersistentSessionController(vault:store,api:api);
    await restarted.restore();
    expect(restarted.stage,SessionStage.signedOut);
    expect(api.refreshCalls,0);
  });
  testWidgets('P01-3 app root does not expose P00 diagnostics to signed-out users',(tester) async{
    final store=MemoryVault();final api=FakeDeviceApi();
    final session=PersistentSessionController(vault:store,api:api);
    await tester.pumpWidget(MaterialApp(home:PersistentAuthGate(
      service:HttpAuthService(baseUrl:'http://127.0.0.1:3000',devToken:'test'),controller:session)));
    await tester.pumpAndSettle();
    expect(find.text('Welcome to U_luv'),findsOneWidget);
    expect(find.text('Check server'),findsNothing);
    expect(find.text('Test database'),findsNothing);
  });
}
