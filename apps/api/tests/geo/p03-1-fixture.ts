/** Entirely synthetic GeoNames catalogue for LOCAL acceptance tests only.
 * Never S3, never a production person/place or production credentials. */
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const json=(obj:unknown)=>Buffer.from(JSON.stringify(obj),'utf8');
export const FIXTURE_VERSION='IN-0123456789abcdef';
export const FIXTURE_PLACE='1234567';
export const FIXTURE_LAT=17.385;
export const FIXTURE_LNG=78.4867;
export async function makeSyntheticGeoCatalogue(){
  const dir=await mkdtemp(join(tmpdir(),'uluv-p03-test-geo-'));
  const files=new Map<string,Buffer>();
  const save=(path:string,data:Buffer)=>{files.set(path,data);return {path,bytes:data.length,sha256:sha(data)};};
  const packPath='states/01/districts/101.json';
  const pack=json({schemaVersion:1,catalogueVersion:FIXTURE_VERSION,stateCode:'01',districtCode:'101',
    places:[{id:FIXTURE_PLACE,name:'Synthetic Hyderabad Test Place',lat:FIXTURE_LAT,lng:FIXTURE_LNG}]});
  const meta={...save(packPath,pack),count:1,kind:'district',code:'101',name:'Test District'};
  const states=Array.from({length:36},(_,i)=>({code:String(i+1).padStart(2,'0'),name:`Test State ${i+1}`,
    geonameId:String(i+1),districts:i===0?[meta]:[],unmapped:null}));
  const bucket=Number(BigInt(FIXTURE_PLACE)%256n);
  const serverIndex=Array.from({length:256},(_,i)=>save(`server/${i.toString(16).padStart(2,'0')}.json`,
    json({catalogueVersion:FIXTURE_VERSION,places:i===bucket?{
      [FIXTURE_PLACE]:[FIXTURE_LAT,FIXTURE_LNG,'01','101','Synthetic Hyderabad Test Place']
    }:{}})));
  const manifest={catalogueVersion:FIXTURE_VERSION,schemaVersion:1,country:'IN',
    sourceSha256:'a'.repeat(64),sourceBytes:1,packFormat:'application/json',
    totalPlaces:1,serverIndex,states,countryUnmapped:null,attribution:'attribution.json'};
  const {serverIndex:_,...publicManifest}=manifest;
  const pin=sha(json(manifest));
  save('server-index-manifest.json',json(manifest));
  save('manifest.json',json(publicManifest));
  for(const [path,data] of files){await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),data);}
  return {dir,pin,pack,files,close:()=>rm(dir,{recursive:true,force:true})};
}
