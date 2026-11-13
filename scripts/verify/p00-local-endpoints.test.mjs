import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalHttpEndpoint} from '../lib/local-endpoints.mjs';

test('script endpoints permit only explicit local HTTP ports', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    assert.equal(assertLocalHttpEndpoint(`http://${host}:8000/`), `http://${host}:8000`);
  }
});
test('no remote host, HTTPS, credentials, paths, query, fragment or empty port', () => {
  for (const bad of [undefined, '', 'bad-url', 'http://example.com:8000', 'http://192.168.0.5:8000',
    'https://localhost:8000', 'http://name:password@localhost:8000',
    'http://127.0.0.1:8000/foo', 'http://localhost:8000/?query=1',
    'http://localhost:8000/#frag', 'http://localhost']) {
    assert.throws(() => assertLocalHttpEndpoint(bad, 'P00_TEST'), String(bad));
  }
});
