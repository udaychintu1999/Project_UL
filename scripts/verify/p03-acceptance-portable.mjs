/** Device/database independent runner. Full local mode adds API/DDB/Flutter. */
import {spawnSync} from 'node:child_process';
import {P03_PORTABLE_STAGES,executeP03Stages} from './p03-acceptance-plan.mjs';
if(process.argv.length!==2){console.error('P03 portable: no arguments');process.exit(2);}
const ok=executeP03Stages(P03_PORTABLE_STAGES,command=>spawnSync('npm',['run',command],{
  stdio:'inherit',shell:process.platform==='win32'}),console.log);
if(!ok){console.error('P03 portable NOT VERIFIED.');process.exitCode=1;}
else console.log('P03 portable tests PASS. Full DynamoDB/Flutter/Android gates still required.');
