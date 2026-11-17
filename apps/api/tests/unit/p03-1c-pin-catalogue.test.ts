import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PinCatalogue,validPin} from '../../src/features/pincode/catalogue.ts';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const data=(x:unknown)=>Buffer.from(JSON.stringify(x)+'\n','utf8');
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'uluv-pin-test-'));
 const version='PIN-0123456789abcdef';
 const pack=data({schemaVersion:1,version,prefix:'500',pincodes:{'500001':[
  {office:'Hyderabad H.O',district:'Hyderabad',state:'Telangana',officeType:'H.O',delivery:'Delivery'},
  {office:'Koti S.O',district:'Hyderabad',state:'Telangana',officeType:'S.O',delivery:'Delivery'}]}});
 await mkdir(join(root,'prefixes'));await writeFile(join(root,'prefixes/500.json'),pack);
 const manifest=data({schemaVersion:1,version,country:'IN',sourceName:'Synthetic fixture, not for production',
  sourceUrl:'https://example.invalid',sourceDate:'2026-01-01',counts:{distinctPins:1,acceptedOfficeRows:2},
  prefixes:[{prefix:'500',path:'prefixes/500.json',sha256:sha(pack),bytes:pack.length,pinCount:1,officeCount:2}]});
 await writeFile(join(root,'manifest.json'),manifest);
 return {root,pack};
}
test('Only six-digit Indian PIN format is valid',()=>{
 assert.equal(validPin('500001'),true);
 for(const x of ['000001','50001','5000017','50A001',500001,null,'500 001'])assert.equal(validPin(x),false);
});
test('Canonical lookup returns multiple offices, not any geographic center',async()=>{
 const {root}=await setup();
 try {
   const index=await PinCatalogue.open(root);
   assert.equal((await index.lookup('500001'))?.length,2);
   assert.equal(await index.lookup('500002'),null);
   assert.equal(await index.lookup('600001'),null);
   assert.ok(!JSON.stringify(await index.lookup('500001')).includes('lat'));
 } finally {await rm(root,{recursive:true,force:true});}
});
test('Checksum tampering fails closed',async()=>{
 const {root,pack}=await setup();
 try {
   await writeFile(join(root,'prefixes/500.json'),Buffer.concat([pack,Buffer.from(' ')]));
   const index=await PinCatalogue.open(root);
   await assert.rejects(index.lookup('500001'),/checksum mismatch/);
 } finally {await rm(root,{recursive:true,force:true});}
});
