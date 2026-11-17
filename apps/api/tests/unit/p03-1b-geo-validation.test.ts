import test from 'node:test';
import assert from 'node:assert/strict';
import {parseManualLocation} from '../../src/features/geo/validation.ts';
const good={geonameId:'1254813',catalogueVersion:'IN-52fd741e8c61b53a',stateCode:'34',districtCode:'222',expectedRevision:0};
test('P03-1B strict manual selection payload',()=>{
 assert.deepEqual(parseManualLocation(good),good);
 assert.equal(parseManualLocation({...good,districtCode:null})?.districtCode,null);
 for (const x of [{...good,lat:11},{...good,geonameId:'../../.env'}, {...good,expectedRevision:-1},
   {...good,stateCode:'LGD 34'}, {...good,districtCode:'foo'}, {...good,catalogueVersion:'IN-v2'}, {...good,center:[1,2]}, {},null]) {
   assert.equal(parseManualLocation(x),null,JSON.stringify(x));
 }
});
