import 'package:flutter/material.dart';
import 'auth_service.dart';

/// P01 first slice: real local DB OTP challenge, but no real mail delivery or Google integration.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key,required this.service});
  final AuthService service;
  @override State<AuthScreen> createState()=>_AuthScreenState();
}
class _AuthScreenState extends State<AuthScreen> {
  final email=TextEditingController(),code=TextEditingController();
  bool busy=false,consent=false,codeRequested=false;
  DateTime? dob;
  String message='Sign in with email; local development outbox only.';
  String? token,uid,localCode;
  @override void dispose(){email.dispose();code.dispose();super.dispose();}
  Future<void> run(Future<AuthResult> Function() task,{String action=''})async {
    if(busy)return;
    // Dismiss the Android keyboard before showing the OTP form/outbox.
    FocusManager.instance.primaryFocus?.unfocus();
    setState((){busy=true;message='Working...';});
    try{
      final result=await task();
      if(!mounted)return;
      setState((){
        message=result.message;
        if(result.ok&&action=='request'){codeRequested=true;localCode=null;}
        if(result.ok&&action=='outbox')localCode=result.code;
        if(result.ok&&action=='verify'){token=result.token;uid=result.uniqueId;code.clear();localCode=null;}
        if(result.ok&&action=='me')uid=result.uniqueId;
        if(result.ok&&action=='logout'){token=null;uid=null;codeRequested=false;localCode=null;}
        if(!result.ok&&action=='me'&&result.message.startsWith('Session expired')){token=null;uid=null;}
      });
    }catch(_){if(mounted)setState(()=>message='Unexpected error. Retry.');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> chooseDate()async {
    final now=DateTime.now();
    final chosen=await showDatePicker(context:context,initialDate:dob??DateTime(now.year-19,now.month,now.day),firstDate:DateTime(1900),lastDate:now,helpText:'Select your date of birth');
    if(mounted&&chosen!=null)setState(()=>dob=chosen);
  }
  String formattedDate(DateTime d)=>'${d.year.toString().padLeft(4,'0')}-${d.month.toString().padLeft(2,'0')}-${d.day.toString().padLeft(2,'0')}';
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('U_luv · Email Sign-In')),
    // Build all short form children eagerly: a lazily built ListView can hide the
    // newly returned local-code widget below the Android keyboard/viewport.
    body:SafeArea(child:SingleChildScrollView(padding:const EdgeInsets.all(24),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      const Text('Adult-only connections',style:TextStyle(fontSize:22,fontWeight:FontWeight.w600)),
      const SizedBox(height:8),
      const Text('P01 local development: the outbox is not real email delivery. Age is self-declared and is not independent identity verification.'),
      const SizedBox(height:16),
      if(token==null)...[
        TextField(key:const Key('auth-email'),controller:email,enabled:!busy,autofillHints:const [AutofillHints.email],keyboardType:TextInputType.emailAddress,textInputAction:TextInputAction.next,decoration:const InputDecoration(labelText:'Email address',border:OutlineInputBorder())),
        const SizedBox(height:10),
        FilledButton(key:const Key('auth-request'),onPressed:busy?null:()=>run(()=>widget.service.requestCode(email.text),action:'request'),child:const Text('Request email code')),
        if(codeRequested)...[
          const SizedBox(height:8),
          OutlinedButton(key:const Key('auth-outbox'),onPressed:busy?null:()=>run(()=>widget.service.localOutboxCode(email.text),action:'outbox'),child:const Text('Read local test outbox (development only)')),
          if(localCode!=null)SelectableText('Local test code: $localCode',key:const Key('auth-local-code')),
          const SizedBox(height:10),
          TextField(key:const Key('auth-code'),controller:code,enabled:!busy,keyboardType:TextInputType.number,maxLength:6,onChanged:(_)=>setState((){}),decoration:const InputDecoration(labelText:'6-digit code',border:OutlineInputBorder())),
          OutlinedButton(key:const Key('auth-dob'),onPressed:busy?null:chooseDate,child:Text(dob==null?'Select date of birth':'Date of birth: ${formattedDate(dob!)}')),
          CheckboxListTile(key:const Key('auth-consent'),value:consent,onChanged:busy?null:(v)=>setState(()=>consent=v??false),controlAffinity:ListTileControlAffinity.leading,title:const Text('I confirm my date of birth is accurate and consent to register or sign in.')),
          FilledButton(key:const Key('auth-verify'),onPressed:busy||dob==null||!consent||code.text.length!=6?null:()=>run(()=>widget.service.verify(email:email.text,code:code.text,dateOfBirth:formattedDate(dob!),consent:consent),action:'verify'),child:const Text('Verify code and sign in')),
        ],
      ]else...[
        const Icon(Icons.verified_user_outlined,size:44),
        Text('Account ID: ${uid??'pending'}',key:const Key('auth-uid')),
        const Text('Account access limited to eligible adults.'),
        FilledButton(key:const Key('auth-me'),onPressed:busy?null:()=>run(()=>widget.service.me(token!),action:'me'),child:const Text('Check account access')),
        OutlinedButton(key:const Key('auth-logout'),onPressed:busy?null:()=>run(()=>widget.service.logout(token!),action:'logout'),child:const Text('Log out')),
      ],
      const SizedBox(height:12),
      Semantics(liveRegion:true,child:Text(message,key:const Key('auth-message'),textAlign:TextAlign.center)),
      if(busy)const Center(child:Padding(padding:EdgeInsets.all(12),child:CircularProgressIndicator())),
    ]))),
  );
}
