/** P03 owner-run REAL HTTP gate. Uses only no-token requests to loopback API;
 * no fixture account, no GPS coordinates and no public CDN download. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertP03LocalEnvironment} from './p03-acceptance-plan.mjs';
assertP03LocalEnvironment(process.env);
const origin=new URL(process.env.ULUV_API_BASE_URL??'http://127.0.0.1:3000').origin;
async function call(method,path){
  const r=await fetch(`${origin}${path}`,{method,redirect:'error',
    headers:{Accept:'application/json'},
    ...(method==='GET'?{}:{headers:{Accept:'application/json','Content-Type':'application/json'},body:'{}'}),
    signal:AbortSignal.timeout(10000)});
  const bytes=await r.text();
  assert.ok(bytes.length<12000,'unexpected large API error response');
  return {status:r.status,data:JSON.parse(bytes)};
}
test('real local Fastify API and DynamoDB readiness before any geographic route test',async()=>{
  assert.deepEqual(await call('GET','/health/live'),{status:200,data:{status:'ok',service:'uluv-api'}});
  const ready=await call('GET','/health/ready');
  assert.equal(ready.status,200,'Start owner Java DynamoDB Local first');
  assert.equal(ready.data.database,'connected');
});
test('P03 geolocation, catalogue and preferences are owner-authenticated over HTTP',async()=>{
  for(const [method,path] of [
    ['GET','/v1/me/geo/location'],['PUT','/v1/me/geo/manual'],
    ['POST','/v1/me/geo/gps'],['GET','/v1/geo/india/delivery'],
    ['GET','/v1/geo/india/manifest'],['GET','/v1/geo/india/packs/01/638'],
    ['GET','/v1/me/settings'],['PUT','/v1/me/settings']]){
    const res=await call(method,path);
    assert.equal(res.status,401,`${method} ${path}: authenticated owner required`);
    assert.ok(res.data.error,`${method} ${path}: safe error envelope required`);
  }
});
test('P03-2 internal discovery does not have a public HTTP endpoint yet',async()=>{
  for(const path of ['/v1/discovery/people','/v1/discovery/dating','/v1/discovery/friendship']){
    const res=await call('GET',path);
    assert.equal(res.status,404,`P03-3 not approved: ${path}`);
  }
});
