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
  assert.equal(route('/auth/v1/admin/users'), '/auth/v1/admin/users');
  assert.equal(route('/auth/v1/token?grant_type=password'), '/auth/v1/token?grant_type=password');
  assert.equal(route('/rest/v1/rpc/create_campaign'), '/rest/v1/rpc/create_campaign');
  for (const path of ['/auth/v1/admin/../users', '/auth/v1/admin//users', '/auth/v1/admin/%2e%2e/users', '/auth/v1/admin/users?next=https://evil.test']) assert.throws(() => route(path));
});
import {redact} from './start-diagnostics.mjs';
test('startup diagnostics remove JWTs, key lines and connection passwords', () => {
  const text = redact('ERROR: failed migration\nAPI key: private-value\neyJabc.def.ghi\npostgres://postgres:password@localhost/db\nsb_secret_abc123\npassword=hidden');
  assert.match(text, /failed migration/);
  for (const secret of ['private-value', 'eyJabc.def.ghi', 'postgres:password', 'abc123', 'hidden']) assert.ok(!text.includes(secret));
});

test('Storage scope is restricted to the codex bucket and UUID paths',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 for(const p of [`/storage/v1/object/codex-assets/${id}/${id}/${id}`,`/storage/v1/object/authenticated/codex-assets/${id}/${id}/${id}`,'/storage/v1/object/codex-assets'])assert.equal(route(p),p);
 for(const p of ['/storage/v1/object/other-bucket','/storage/v1/object/codex-assets/../other','/storage/v1/object/codex-assets?next=evil'])assert.throws(()=>route(p));
});
