/** Isolated physical Android P03-1 shell/GPS UI test. No account fixtures or cloud.
 * Never uninstalls, clears or logs anything from com.example.uluv. */
import {spawnSync} from 'node:child_process';
import {localFlutterConnection} from '../../apps/flutter_app/dev_connection.config.mjs';
import {resetP02TestApp} from './p02-1-android-package.mjs';
import {assertP03LocalEnvironment} from './p03-acceptance-plan.mjs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
try{assertP03LocalEnvironment(process.env);}catch{
  console.error('P03 Android BLOCKED: local .env, API:3000, DynamoDB:8000, dev token required.');process.exit(2);
}
const args=process.argv.slice(2);
if(args.length!==0&&!(args.length===2&&['-d','--device'].includes(args[0]))){
  console.error('P03 Android: use [--device <adb-id>] only.');process.exit(2);
}
function autodetectSinglePhysicalDevice(){
  const list=spawnSync('adb',['devices','-l'],{encoding:'utf8',stdio:'pipe',
    shell:process.platform==='win32'});
  if(list.error||list.status!==0)throw new Error('adb_devices_failed');
  const ready=list.stdout.split(/\r?\n/).slice(1).map(line=>line.trim().split(/\s+/))
    .filter(parts=>parts.length>=2&&parts[1]==='device'&&
      !parts[0].startsWith('emulator-')&&!parts[0].startsWith('localhost:'));
  if(ready.length!==1)throw new Error('exactly_one_physical_device_required');
  return ready[0][0];
}
let device;
try{device=args.length===2?args[1]:
  (localFlutterConnection.deviceId||autodetectSinglePhysicalDevice());}
catch{console.error('P03 Android: connect one authorized physical Android phone or pass --device <serial>.');process.exit(2);}
if(typeof device!=='string'||!/^[A-Za-z0-9._:-]+$/.test(device)||device.startsWith('emulator-')){
  console.error('P03 Android: a valid physical Android device ID is required.');process.exit(2);
}
const root=fileURLToPath(new URL('../../',import.meta.url));
const flutterRoot=join(root,'apps/flutter_app');
function adb(cmd){
  const r=spawnSync('adb',['-s',device,...cmd],{encoding:'utf8',stdio:'pipe',shell:process.platform==='win32'});
  if(r.error||r.status!==0)throw new Error('adb_failed');
  return r.stdout.trim();
}
let success=false;
try{
  const state=adb(['get-state']);
  if(state!=='device')throw new Error('device_not_ready');
  // Exact package only. This uses the existing P02 isolation suffix and
  // cannot select the real com.example.uluv package.
  resetP02TestApp(['-s',device],cmd=>{
    const result=spawnSync('adb',cmd,{encoding:'utf8',stdio:'pipe',shell:process.platform==='win32'});
    if(result.error||result.status!==0)throw new Error('isolated_cleanup_failed');
    return result.stdout.trim();
  });
  const program=process.platform==='win32'?'flutter.bat':'flutter';
  const child=spawnSync(program,['test','integration_test/p03_location_acceptance_integration_test.dart',
    '-d',device,'--no-uninstall','--reporter','expanded'],{cwd:flutterRoot,stdio:'inherit',shell:process.platform==='win32',
    env:{...process.env,ULUV_P02_1_ISOLATED_ANDROID_TEST:'1'}});
  success=child.status===0&&!child.error&&!child.signal;
}catch{
  console.error('P03 Android: isolated UI test/preflight failed. See device checklist.');
}finally{
  try{resetP02TestApp(['-s',device],cmd=>{
    const result=spawnSync('adb',cmd,{encoding:'utf8',stdio:'pipe',shell:process.platform==='win32'});
    if(result.error||result.status!==0)throw new Error('isolated_cleanup_failed');
    return result.stdout.trim();
  });}catch{success=false;console.error('P03 Android: isolated package cleanup FAILED.');}
}
if(!success){console.error('P03 ANDROID NOT VERIFIED.');process.exitCode=1;}
else console.log('P03 Android isolated navigation, real picker/HTTP fixture, retries and widget-remount gates PASSED; real OS GPS, CloudFront and force-stop acceptance remain separate.');
