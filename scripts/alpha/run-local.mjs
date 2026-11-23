import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {localOrigin, route} from './local-only.mjs';
assert.equal(process.env.ALPHA_LOCAL_TESTS, '1', 'Explicit local test mode required');
const config = JSON.parse(await readFile(process.env.ALPHA_STATUS_FILE, 'utf8'));
const origin = localOrigin(config.API_URL);
assert.ok(config.ANON_KEY && config.SERVICE_ROLE_KEY, 'Local CLI credentials required');
let assertions = 0;
let checkpoint = 'synthetic account setup';
const checks = [];
async function check(name, fn) {
  checkpoint = name;
  await fn(); assertions++; checks.push(name); console.log(`PASS ${name}`);
}
async function api(path, {token, method = 'GET', body, admin = false} = {}) {
  route(path);
  assert.ok(!admin || path === '/auth/v1/admin/users', 'Admin key only provisions synthetic users');
  const key = admin ? config.SERVICE_ROLE_KEY : config.ANON_KEY;
  const response = await fetch(origin + path, {method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: {
    apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
  }, body: body === undefined ? undefined : JSON.stringify(body)});
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return {status: response.status, ok: response.ok, data};
}
async function ok(path, options) { const r = await api(path, options); assert.ok(r.ok, `API ${path.split('?')[0]} status ${r.status}`); return r.data; }
async function rpc(name, token, body) { return ok('/rest/v1/rpc/' + name, {token, method: 'POST', body}); }
const suffix = randomUUID();
const password = randomUUID() + '!aA7';
async function user(label) {
  const email = `${label}-${suffix}@example.test`;
  await ok('/auth/v1/admin/users', {admin: true, method: 'POST', body: {email, password, email_confirm: true}});
  const session = await ok('/auth/v1/token?grant_type=password', {method: 'POST', body: {email, password}});
  return {...session, email};
}
try {
  const master = await user('master'), player = await user('player'), other = await user('other-master');
  const m = master.access_token, p = player.access_token, o = other.access_token;
  await check('server rejects public signup while existing users can log in', async () => {
    const r = await api('/auth/v1/signup', {method: 'POST', body: {email: `blocked-${suffix}@example.test`, password}});
    assert.equal(r.ok, false); assert.equal(r.data?.error_code, 'signup_disabled');
  });
  const a = await rpc('create_campaign', m, {p_name: 'Isolated A'});
  const b = await rpc('create_campaign', o, {p_name: 'Isolated B'});
  const code = await rpc('create_invite', m, {p_campaign_id: a});
  await check('invite assigns player role and campaigns remain isolated', async () => {
    assert.equal(await rpc('join_campaign', p, {p_code: code}), a);
    const memberships = await ok(`/rest/v1/campaign_members?campaign_id=eq.${a}`, {token: p});
    assert.equal(memberships.find(x => x.user_id === player.user.id).role, 'jogador');
    assert.deepEqual(await ok(`/rest/v1/campaigns?id=eq.${b}`, {token: p}), []);
    const promote = await api('/rest/v1/rpc/set_member_role', {token: p, method: 'POST', body: {p_campaign_id: a, p_user_id: player.user.id, p_role: 'mestre'}});
    assert.equal(promote.ok, false);
  });
  const [note] = await ok('/rest/v1/notes', {token: p, method: 'POST', body: {campaign_id: a, title: 'Private fixture'}});
  await check('private notes hidden even from master; sharing explicit; foreign campaign hidden', async () => {
    assert.equal(note.visibility, 'private');
    assert.deepEqual(await ok(`/rest/v1/notes?id=eq.${note.id}`, {token: m}), []);
    await ok(`/rest/v1/notes?id=eq.${note.id}&version=eq.${note.version}`, {token: p, method: 'PATCH', body: {visibility: 'campaign'}});
    assert.equal((await ok(`/rest/v1/notes?id=eq.${note.id}`, {token: m})).length, 1);
    assert.deepEqual(await ok(`/rest/v1/notes?id=eq.${note.id}`, {token: o}), []);
    assert.deepEqual(await ok(`/rest/v1/notes?id=eq.${note.id}&version=eq.${note.version}`, {token: p, method: 'PATCH', body: {title: 'stale'}}), []);
  });
  const draft = {nome: 'Fixture', inventario: [{id: 'fixture-item', quantidade: 2}]};
  const [character] = await rpc('create_guided_character', p, {p_campaign_id: a, p_title: 'Fixture', p_meta: {}, p_publish: false, p_draft: draft});
  await check('character and inventory survive remote reload; second session cannot overwrite stale revision', async () => {
    const second = await ok('/auth/v1/token?grant_type=password', {method: 'POST', body: {email: player.email, password}});
    const [sheet] = await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token: second.access_token});
    assert.deepEqual(sheet.draft.inventario, draft.inventario);
    await rpc('save_guided_character', p, {p_id: character.character_id, p_expected_revision: character.revision, p_draft: {...draft, nome: 'Updated'}});
    const stale = await api('/rest/v1/rpc/save_guided_character', {token: second.access_token, method: 'POST', body: {p_id: character.character_id, p_expected_revision: character.revision, p_draft: draft}});
    assert.equal(stale.status, 409);
    assert.deepEqual(await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token: o}), []);
    assert.equal((await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token: m}))[0].draft.nome, 'Updated');
  });
  const state = {combatentes: [{id: 'fixture-enemy', nome: 'Fixture', lado: 'inimigo', iniciativa: 12, pvMax: 20, pv: 20}], turno: 'fixture-enemy', rodada: 1};
  await ok('/rest/v1/campaign_combats', {token: m, method: 'POST', body: {campaign_id: a, state}});
  await check('combat hidden via direct API from player, foreign master and anonymous', async () => {
    for (const token of [p, o, undefined]) {
      const r = await api(`/rest/v1/campaign_combats?campaign_id=eq.${a}`, {token});
      assert.ok(r.ok ? r.data.length === 0 : [401, 403].includes(r.status));
      const write = await api('/rest/v1/campaign_combats', {token, method: 'POST', body: {campaign_id: a, state}});
      assert.ok([401, 403].includes(write.status), 'Unauthorized combat insert must be rejected by permission checks');
      const update = await api(`/rest/v1/campaign_combats?campaign_id=eq.${a}&version=eq.1`, {token, method: 'PATCH', body: {state, version: 2}});
      assert.ok(update.ok ? update.data.length === 0 : [401, 403].includes(update.status));
    }
    const write = await api(`/rest/v1/campaign_combats?campaign_id=eq.${a}&version=eq.1`, {token: o, method: 'PATCH', body: {state, version: 2}});
    assert.ok(write.ok ? write.data.length === 0 : write.status === 403);
  });
  await check('combat compare-and-swap preserves winning update across sessions', async () => {
    const path = `/rest/v1/campaign_combats?campaign_id=eq.${a}&version=eq.1`;
    const results = await Promise.all([2, 3].map(rodada => ok(path, {token: m, method: 'PATCH', body: {state: {...state, rodada, combatentes: [{...state.combatentes[0], pv: rodada}]}, version: 2}})));
    assert.deepEqual(results.map(x => x.length).sort(), [0, 1]);
    const [saved] = await ok(`/rest/v1/campaign_combats?campaign_id=eq.${a}`, {token: m});
    assert.equal(saved.version, 2);
    assert.equal(saved.state.rodada, results.find(x => x.length)[0].state.rodada);
    assert.equal(saved.state.combatentes[0].pv, saved.state.rodada);
    assert.equal(saved.state.turno, 'fixture-enemy');
  });
  await check('password recovery remains available with signup disabled', async () => {
    await ok('/auth/v1/recover', {method: 'POST', body: {email: player.email}});
  });
  await check('expired JWT refused and refresh restores the existing account', async () => {
    const expiry = JSON.parse(Buffer.from(p.split('.')[1], 'base64url').toString()).exp;
    assert.ok(expiry * 1000 - Date.now() < 70000, 'Disposable JWT expiry must be short');
    while (Date.now() <= (expiry + 2) * 1000) await new Promise(resolve => setTimeout(resolve, 1000));
    let expired = await api('/rest/v1/campaigns?select=id', {token: p});
    // Some JWT verifiers allow a short clock-skew window. Bound the real check.
    const deadline = Date.now() + 60000;
    while (expired.status !== 401 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      expired = await api('/rest/v1/campaigns?select=id', {token: p});
    }
    assert.equal(expired.status, 401);
    const refreshed = await ok('/auth/v1/token?grant_type=refresh_token', {method: 'POST', body: {refresh_token: player.refresh_token}});
    assert.equal((await ok(`/rest/v1/campaigns?id=eq.${a}`, {token: refreshed.access_token})).length, 1);
  });
  await writeFile('alpha-local-report.json', JSON.stringify({passed: assertions, checks, limitations: ['Recovery email and password-change flow not yet exercised', 'Browser, realtime subscription, network failure and UI migration remain pending', 'Encounters have no remote persistence yet']}, null, 2));
} catch (error) {
  if (/^API \/(auth|rest)\/v1\/[a-z_/]+ status \d+$/.test(error.message)) console.error(error.message);
  // Never print bodies, credentials, JWTs or fixture emails to CI logs/artifacts.
  console.error(`FAIL isolated API validation after ${assertions} completed checks; checkpoint: ${checkpoint}`);
  process.exitCode = 1;
}
