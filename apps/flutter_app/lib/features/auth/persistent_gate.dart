import 'package:flutter/material.dart';
import 'auth_screen.dart';
import 'auth_service.dart';
import 'persistent_session.dart';

/// P01-3 root: no P00 buttons, no unverified account content during restore.
class PersistentAuthGate extends StatefulWidget {
  const PersistentAuthGate({super.key,required this.service,this.controller});
  final HttpAuthService service;
  final PersistentSessionController? controller;
  @override State<PersistentAuthGate> createState()=>_PersistentAuthGateState();
}
class _PersistentAuthGateState extends State<PersistentAuthGate> {
  late final PersistentSessionController sessions;
  late final RenewingAuthService service;
  @override void initState(){
    super.initState();
    sessions=widget.controller ?? PersistentSessionController(
      vault:const AndroidDeviceVault(),api:DeviceSessionApi(widget.service.baseUrl));
    service=RenewingAuthService(widget.service,sessions);
    sessions.onChanged=(){if(mounted)setState((){});};
    WidgetsBinding.instance.addPostFrameCallback((_){if(mounted) _restore();});
  }
  Future<void> _restore() async {await sessions.restore();}
  @override void dispose(){sessions.onChanged=null;super.dispose();}

  @override Widget build(BuildContext context){
    final stage=sessions.stage;
    if(stage==SessionStage.restoring || stage==SessionStage.offline){
      return Scaffold(body:SafeArea(child:Center(child:ConstrainedBox(
        constraints:const BoxConstraints(maxWidth:420),
        child:Padding(padding:const EdgeInsets.all(28),child:Column(
          mainAxisSize:MainAxisSize.min,children:[
            if(stage==SessionStage.restoring) const CircularProgressIndicator(key:Key('p13-restoring'))
            else const Icon(Icons.wifi_off_outlined,size:48),
            const SizedBox(height:24),
            Text(stage==SessionStage.restoring?'Restoring your session':'Unable to connect',
              style:const TextStyle(fontSize:22,fontWeight:FontWeight.bold)),
            const SizedBox(height:8),
            Text(sessions.notice,textAlign:TextAlign.center),
            if(stage==SessionStage.offline)...[
              const SizedBox(height:20),
              FilledButton(key:const Key('p13-retry'),onPressed:()=>sessions.refresh().catchError((Object _) => ''),child:const Text('Retry')),
              TextButton(key:const Key('p13-signout'),onPressed:()=>sessions.signOut(),child:const Text('Sign out on this device')),
            ]
          ],
        ))))));
    }
    if(stage==SessionStage.authenticated && sessions.record!=null && sessions.accessToken!=null){
      return AuthScreen(key:ValueKey('p13-account-${sessions.record!.familyId}'),
        service:service,initialToken:sessions.accessToken,initialUid:sessions.record!.uid,
        accountExtra:DeviceManagementPanel(controller:sessions));
    }
    return AuthScreen(key:const ValueKey('p13-signin'),service:service,
      onAuthenticated:(token,uid)=>sessions.enroll(token,uid));
  }
}

/// Five bounded server-side device slots; revocation is always enforced by the API.
class DeviceManagementPanel extends StatefulWidget {
  const DeviceManagementPanel({super.key,required this.controller});
  final PersistentSessionController controller;
  @override State<DeviceManagementPanel> createState()=>_DeviceManagementPanelState();
}
class _DeviceManagementPanelState extends State<DeviceManagementPanel> {
  bool busy=false,expanded=false;
  String status='';
  List<Map<String,dynamic>> devices=[];
  Future<void> load() async {
    if(busy)return;
    setState((){busy=true;expanded=true;status='Loading your devices...';});
    try {
      final access=await widget.controller.access();
      final response=await widget.controller.api.call('/v1/auth/device/list',access:access);
      if(!mounted)return;
      if(response.ok && response.data['devices'] is List){
        setState((){devices=(response.data['devices'] as List)
          .whereType<Map<String,dynamic>>().toList();status='';});
      }else setState(()=>status='Unable to load devices. Retry.');
    }catch(_){if(mounted)setState(()=>status='Connection unavailable. Retry.');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> revoke(Map<String,dynamic> device) async {
    if(busy)return;
    final slot=device['slot'],familyId=device['familyId'];
    if(slot is! int||familyId is! String)return;
    if(widget.controller.record?.slot==slot && widget.controller.record?.familyId==familyId){
      await widget.controller.signOut();return;
    }
    setState(()=>busy=true);
    try {
      final access=await widget.controller.access();
      final reply=await widget.controller.api.call('/v1/auth/device/revoke',access:access,
        payload:{'slot':slot,'familyId':familyId});
      if(!mounted)return;
      setState(()=>status=reply.ok?'Device session revoked.':'Could not revoke device. Retry.');
    }catch(_){if(mounted)setState(()=>status='Connection unavailable. Retry.');}
    finally{if(mounted)setState(()=>busy=false);}
    if(mounted)await load();
  }
  @override Widget build(BuildContext context)=>Column(
    crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      OutlinedButton(key:const Key('p13-manage-devices'),
        onPressed:busy?null:(){if(expanded){setState(()=>expanded=false);}else{load();}},
        child:const Text('Manage signed-in devices')),
      if(expanded)...[
        if(busy)const LinearProgressIndicator(),
        if(status.isNotEmpty) Text(status),
        for(final device in devices)
          ListTile(title:Text('Device ${(device['slot'] as int? ?? -1)+1}'),
            subtitle:Text(device['familyId']==widget.controller.record?.familyId?'This device':'Other signed-in device'),
            trailing:TextButton(onPressed:busy?null:()=>revoke(device),child:const Text('Revoke'))),
      ]
    ]);
}
