import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertLocalDynamoEndpoint,assertLocalMediaDriver} from '../../src/local-safety.ts';

test('local dynamodb accepts only loopback HTTP',()=>{
 for(const url of ['http://127.0.0.1:8000','http://localhost:8000','http://[::1]:8000'])
  assert.equal(assertLocalDynamoEndpoint(url).startsWith('http:'),true);
});
test('missing endpoint never falls back to remote AWS',()=>{
 assert.throws(()=>assertLocalDynamoEndpoint(undefined));
});
test('remote/https/credential-bearing endpoint denied',()=>{
 for(const url of ['https://dynamodb.ap-south-1.amazonaws.com','http://192.168.1.5:8000','http://example.org:8000','https://localhost:8000','http://user:pass@localhost:8000','http://localhost', 'http://localhost:8000/path', 'http://localhost:8000/?query=1', 'http://localhost:8000/#fragment', 'not-a-url'])
  assert.throws(()=>assertLocalDynamoEndpoint(url),url);
});
test('AWS media never implicitly selected',()=>{
 assert.equal(assertLocalMediaDriver(undefined),'local');
 assert.equal(assertLocalMediaDriver('local'),'local');
 assert.throws(()=>assertLocalMediaDriver('aws'));
});
