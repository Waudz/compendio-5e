import assert from 'node:assert/strict';
export function localOrigin(value) {
  assert.equal(value, 'http://127.0.0.1:54321', 'Only the disposable loopback stack is allowed');
  return value;
}
export function route(value) {
  if (/^\/storage\/v1\/object\/(?:authenticated\/)?codex-assets(?:\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36})?$/.test(value)) return value;
  assert.match(value, /^\/(auth\/v1|rest\/v1)\/[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*(?:\?[a-zA-Z0-9_=&.,%()-]+)?$/);
  return value;
}
