import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const flutter=process.platform==='win32'?'flutter.bat':'flutter';
const root=fileURLToPath(new URL('../../',import.meta.url));
const result=spawnSync(flutter,['analyze'],{
  cwd:join(root,'apps/flutter_app'),stdio:'inherit',shell:process.platform==='win32'});
if(result.error||result.signal||result.status!==0){
  console.error('P03 Flutter analyzer FAIL; fix all errors/warnings before Android build.');process.exitCode=1;
}else console.log('P03 Flutter analyzer PASS.');
