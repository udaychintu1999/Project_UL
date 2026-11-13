import {spawnSync} from 'node:child_process';
// Owner manually runs Java DynamoDB Local and Fastify first. No secret reading in this wrapper.
for (const script of ['test:portable','typecheck','test:db','test:integration','test:p01:integration','test:flutter','test:flutter:e2e','test:flutter:p01:e2e']) {
  console.log(`P01 verification: npm run ${script}`);
  const result=spawnSync('npm',['run',script],{stdio:'inherit',shell:process.platform==='win32'});
  if(result.status!==0){console.error(`P01 NOT VERIFIED: ${script} missing or failed`);process.exit(result.status||1);}
}
console.log('P01 slice automated checks passed on this machine. Real Google/email provider and additional P01 slices remain UNVERIFIED.');
