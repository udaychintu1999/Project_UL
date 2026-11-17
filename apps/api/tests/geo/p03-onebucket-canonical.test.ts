import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {IndiaCatalogue} from '../../src/features/geo/india-catalogue.js';
import type {GeoDeliveryConfiguration} from '../../src/features/geo/catalogue-delivery.ts';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const asBytes=(x:unknown)=>Buffer.from(JSON.stringify(x));
const version='IN-0123456789abcdef';

function fixture(){
 const id='1254813';const bucket=Number(BigInt(id)%256n);
 const files=new Map<string,Buffer>();
 const shardMeta=[];
 for(let i=0;i<256;i++){
   const path=`server/${i.toString(16).padStart(2,'0')}.json`;
   const b=asBytes({catalogueVersion:version,places:i===bucket?{[id]:[25.49043,85.94001,'34','222','Teghra']}:{}});
   files.set(path,b);shardMeta.push({path,sha256:sha(b),bytes:b.length});
 }
 const states=Array.from({length:36},(_,i)=>({code:String(i+1).padStart(2,'0'),
   name:`state ${i+1}`,geonameId:String(i+1),districts:i===33?[{
     path:'states/34/districts/222.json',bytes:100,sha256:'a'.repeat(64),count:1,kind:'district',code:'222',name:'District'
   }]:[],unmapped:null}));
 const full={attribution:'attribution.json',catalogueVersion:version,country:'IN',
    countryUnmapped:null,packFormat:'application/json',schemaVersion:1,serverIndex:shardMeta,
    sourceBytes:123,sourceSha256:'b'.repeat(64),states,totalPlaces:1};
 const {serverIndex:_,...pub}=full;
 const canonical=asBytes(full),publicBytes=asBytes(pub);
 files.set('server-index-manifest.json',canonical);
 files.set('manifest.json',publicBytes);
 const calls:string[]=[];
 const read=async(path:string,max:number)=>{
   calls.push(path);
   const content=files.get(path);
   if(!content || content.length>max)throw new Error('Missing or oversized asset');
   return content;
 };
 const config:GeoDeliveryConfiguration={mode:'s3_cloudfront',
   publicBaseUrl:'https://d123.cloudfront.net/geo/india/v1/',canonicalManifestSha256:sha(canonical)};
 return {id,files,calls,read,config,bucket};
}

test('canonical CDN index is anchored to out-of-band deployment hash',async()=>{
 const f=fixture();
 const cat=await IndiaCatalogue.open(f.config,f.read);
 assert.equal(cat.manifest.catalogueVersion,version);
 assert.equal(cat.publicManifestSha256,sha(f.files.get('manifest.json')!));
 const place=await cat.resolvePlace(f.id,version);
 assert.deepEqual(place,{id:f.id,name:'Teghra',lat:25.49043,lng:85.94001,
   state:'34',district:'222',catalogueVersion:version});
 const firstHits=f.calls.filter(x=>x===`server/${f.bucket.toString(16).padStart(2,'0')}.json`).length;
 await cat.resolvePlace(f.id,version);
 assert.equal(f.calls.filter(x=>x===`server/${f.bucket.toString(16).padStart(2,'0')}.json`).length,firstHits);
 assert.equal(firstHits,1);
 assert.equal(await cat.resolvePlace('999999999',version),null);
 assert.equal(await cat.resolvePlace(f.id,'IN-fedcba9876543210'),null);
});
test('tampered canonical manifest fails closed before any ID can be saved',async()=>{
 const f=fixture();
 f.files.set('server-index-manifest.json',Buffer.concat([f.files.get('server-index-manifest.json')!,Buffer.from(' ')]));
 await assert.rejects(()=>IndiaCatalogue.open(f.config,f.read),/SHA-256/);
});
test('public manifest swapping is rejected even if CDN changed it without touching canonical',async()=>{
 const f=fixture();const pub=JSON.parse(f.files.get('manifest.json')!.toString());
 pub.totalPlaces=2;
 f.files.set('manifest.json',asBytes(pub));
 await assert.rejects(()=>IndiaCatalogue.open(f.config,f.read),/disagree/);
});
test('tampered CDN shard fails closed at lookup',async()=>{
 const f=fixture();const cat=await IndiaCatalogue.open(f.config,f.read);
 const path=`server/${f.bucket.toString(16).padStart(2,'0')}.json`;
 f.files.set(path,Buffer.concat([f.files.get(path)!,Buffer.from(' ')]));
 await assert.rejects(()=>cat.resolvePlace(f.id,version),/SHA-256/);
});
test('concurrent lookups share a single verified shard transfer',async()=>{
 const f=fixture();const cat=await IndiaCatalogue.open(f.config,f.read);
 const results=await Promise.all(Array.from({length:8},()=>cat.resolvePlace(f.id,version)));
 assert.equal(results.every(x=>x?.name==='Teghra'),true);
 assert.equal(f.calls.filter(x=>x.startsWith('server/')).length,1);
});
