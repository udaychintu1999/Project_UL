import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import type {AppConfig} from './config.js';
import {assertLocalDynamoEndpoint} from './local-safety.js';

/** Only local Java DynamoDB for current P00 scaffold, even if live AWS credentials exist on host. */
export function createDb(config:AppConfig):DynamoDBDocumentClient {
  const endpoint = assertLocalDynamoEndpoint(config.dynamodbEndpoint);
  const client = new DynamoDBClient({
    region:'ap-south-1', endpoint,
    credentials:{accessKeyId:'local',secretAccessKey:'local'},
  });
  return DynamoDBDocumentClient.from(client,{marshallOptions:{removeUndefinedValues:true}});
}
