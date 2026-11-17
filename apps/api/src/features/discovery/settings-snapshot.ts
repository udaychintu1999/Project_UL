import type {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {GetCommand} from '@aws-sdk/lib-dynamodb';
import {checkLocality} from './pointer-reader.js';
import type {DistanceBand, LocalitySnapshot} from './contracts.js';
/** Reads only the caller's settings with consistent read. No client cell,
 * radius, filter or pointer key is ever trusted as a server source of truth. */
export async function readTrustedLocality(db:DynamoDBDocumentClient,uid:string):Promise<LocalitySnapshot>{
  if(!/^[-_a-zA-Z0-9]{1,128}$/.test(uid))throw new Error('invalid_account_context');
  const row=(await db.send(new GetCommand({TableName:'uluv_settings',
    Key:{PK:`USER#${uid}`,SK:'SETTINGS'},ConsistentRead:true}))).Item;
  if(!row || !row.geoApprovedCenter || !row.geoH3Cell)throw new Error('trusted_locality_required');
  const location={center:row.geoApprovedCenter,cell:row.geoH3Cell,
    localityRevision:row.localityRevision,settingsRevision:row.settingsRevision??0,
    distanceBand:(row.geoDistanceBand??'0-50') as DistanceBand,
    source:row.geoSelectionSource} as LocalitySnapshot;
  checkLocality(location);
  return location;
}
