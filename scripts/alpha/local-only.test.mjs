import { test } from 'node:test';
import assert from 'node:assert/strict';
import {localOrigin, route} from './local-only.mjs';
test('only the exact isolated loopback origin is accepted', () => {
  assert.equal(localOrigin('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
  for (const url of ['https://gwcttjlxzelzjhbuitmi.supabase.co', 'https://pdjzahpxjrlbqqtzkfdr.supabase.co', 'http://127.0.0.1:54321.evil', 'http://user@127.0.0.1:54321', 'http://127.0.0.1:54321/', undefined]) assert.throws(() => localOrigin(url));
});
test('routes cannot change origin or escape API prefixes', () => {
  for (const path of ['//evil.test', '/auth/v1/../admin', '/rest/v1/notes#x', 'https://example.com', '/rest/v1/notes\\evil']) assert.throws(() => route(path));
  assert.equal(route('/rest/v1/notes?id=eq.123'), '/rest/v1/notes?id=eq.123');
});
