/** Runs the real phone test only with an isolated synthetic account. */
import {spawnSync} from 'node:child_process';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,DeleteCommand} from '@aws-sdk/lib-dynamodb';
import {createP012DeviceFixture} from './p01-2-device-fixture.mjs';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';
let fixture;let resultCode=1;
try {
  fixture=await createP012DeviceFixture();
  const run=spawnSync(process.execPath,['scripts/dev/flutter.mjs','p01-3-e2e',...process.argv.slice(2)],{
    stdio:'inherit',env:{...process.env,ULUV_P01_3_FIXTURE_EMAIL:fixture.email,
      ULUV_P01_3_FIXTURE_PASSWORD:fixture.password,ULUV_P01_3_FIXTURE_UID:fixture.uid}});
  resultCode=run.status??1;
  if(resultCode===0)console.log('PASS: P01-3 physical Android Keystore, sealed restarts, rotation, revocation and logout.');
  else console.error('FAIL: P01-3 physical Android session journey.');
}catch{console.error('P01-3 device setup/runner unavailable; Android gate remains UNVERIFIED.');}
finally{
  if(fixture){
    try{
      const endpoint=assertLocalHttpEndpoint(process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000','DYNAMODB_ENDPOINT');
      const db=DynamoDBDocumentClient.from(new DynamoDBClient({endpoint,region:'ap-south-1',credentials:{accessKeyId:'local',secretAccessKey:'local'}}));
      for(let slot=0;slot<5;slot++)await db.send(new DeleteCommand({TableName:'uluv_auth_links',Key:{PK:`USER#${fixture.uid}`,SK:`DEVICE#${slot}`}}));
      db.destroy();
      await fixture.cleanup();
      console.log('P01-3 synthetic device fixture cleaned up.');
    }catch{console.error('WARNING: P01-3 fixture cleanup incomplete; inspect local test account.');resultCode=1;}
  }
}
process.exitCode=resultCode;
