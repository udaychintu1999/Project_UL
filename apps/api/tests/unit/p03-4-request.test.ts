import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDiscoveryQuery} from '../../src/features/discovery/request-policy.ts';

test('P03-4 request accepts only a bounded mode, page size and opaque continuation',()=>{
  assert.deepEqual(parseDiscoveryQuery({mode:'dating'}),{mode:'DATING',pageSize:8});
  assert.deepEqual(parseDiscoveryQuery({mode:'friendship',pageSize:'12'}),{mode:'FRIENDSHIP',pageSize:12});
  const token='A'.repeat(45);
  assert.deepEqual(parseDiscoveryQuery({mode:'dating',pageSize:'1',cursor:token}),
    {mode:'DATING',pageSize:1,cursor:token});
  for(const request of [null,{},[],{mode:'DATING'},{mode:'all'},{mode:'dating',uid:'other'},
    {mode:'dating',lat:'17'},{mode:'dating',filter:'age'},{mode:'dating',cell:'123'},
    {mode:'dating',pageSize:'0'},{mode:'dating',pageSize:'13'},
    {mode:'dating',pageSize:'1e1'},{mode:'dating',pageSize:12},
    {mode:'dating',cursor:'not-a-cursor'},{mode:'dating',cursor:'x'.repeat(4097)}]){
    assert.equal(parseDiscoveryQuery(request),null,JSON.stringify(request));
  }
});
