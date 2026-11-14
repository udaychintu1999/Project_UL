/** Complete P01-3 automated-first gate; every runtime/device failure fails closed. */
import {spawnSync} from 'node:child_process';
for(const name of ['verify:p01-3:portable','verify:p01-2','test:p01-3:integration','test:flutter:p01-3:e2e']){
  console.log(`P01-3 verification: npm run ${name}`);
  const run=spawnSync('npm',['run',name],{stdio:'inherit',shell:process.platform==='win32'});
  if(run.error||run.status!==0){console.error(`P01-3 NOT VERIFIED: ${name} failed`);process.exit(1);}
}
console.log('PASS P01-3 all automated gates, subject to owner manual phone reboot + 30-day boundary tests.');
console.log('P01-1 Android OTP automated FAIL remains an owner-accepted local-development exception, not a PASS.');
