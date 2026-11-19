/** P02-style fail-closed P03 verification. Never launches an API, DDB or AWS. */
import {spawnSync} from 'node:child_process';
import {P03_LOCAL_STAGES,P03_PORTABLE_STAGES,assertP03LocalEnvironment,executeP03Stages}
  from './p03-acceptance-plan.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--list'){
  console.log('PORTABLE (npm dependencies required; no .env, Flutter SDK, device or database):');
  P03_PORTABLE_STAGES.forEach(([name,command],i)=>console.log(`${i+1}. npm run ${command} — ${name}`));
  console.log('FULL LOCAL (owner-started Java DynamoDB Local + physical Android):');
  P03_LOCAL_STAGES.forEach(([name,command],i)=>console.log(`${i+1}. npm run ${command} — ${name}`));
  process.exit(0);
}
if(args.length!==0){console.error('P03: invalid args. Use npm run verify:p03:acceptance:plan.');process.exit(2);}
try{assertP03LocalEnvironment(process.env);}catch{
  console.error('P03 BLOCKED: use APP_ENV=local, localhost API:3000/DynamoDB:8000 and the owner DEV token.');
  console.error('P03 never uses a production AWS database or production user.');process.exit(2);
}
const ok=executeP03Stages(P03_LOCAL_STAGES,command=>spawnSync('npm',['run',command],{
  stdio:'inherit',shell:process.platform==='win32'}),message=>console.log(message));
if(!ok){console.error('P03 NOT VERIFIED. Correct the first failing gate before release.');process.exit(1);}
console.log('P03 LOCAL AUTOMATED GATES PASSED.');
console.log('OWNER MANUAL GATE: one-time GPS permission accuracy/island/border and app force-stop/reopen.');
console.log('P03-4 candidate route is session gated; its hydration acceptance, P03-5 UI and production release have separate gates.');
