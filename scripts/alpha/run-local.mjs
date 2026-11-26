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
  await check('cover framing (0012): master saves, members read, player cannot write, invalid rejected', async () => {
    const framing = {zoom: 1.5, x: 20, y: 80};
    await ok(`/rest/v1/campaigns?id=eq.${a}`, {token: m, method: 'PATCH', body: {cover_framing: framing}});
    assert.deepEqual((await ok(`/rest/v1/campaigns?id=eq.${a}&select=cover_framing`, {token: p}))[0].cover_framing, framing);
    const denied = await api(`/rest/v1/campaigns?id=eq.${a}`, {token: p, method: 'PATCH', body: {cover_framing: {zoom: 3, x: 0, y: 0}}});
    assert.ok(!denied.ok || denied.data.length === 0, 'player must not update framing');
    assert.equal((await api(`/rest/v1/campaigns?id=eq.${a}`, {token: m, method: 'PATCH', body: {cover_framing: {zoom: 9, x: 0, y: 0}}})).ok, false);
    assert.deepEqual((await ok(`/rest/v1/campaigns?id=eq.${a}&select=cover_framing`, {token: m}))[0].cover_framing, framing);
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
    checkpoint = 'second session login';
    const second = await ok('/auth/v1/token?grant_type=password', {method: 'POST', body: {email: player.email, password}});
    checkpoint = 'second session sheet reload';
    const [sheet] = await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token: second.access_token});
    checkpoint = 'inventory reload assertion';
    assert.deepEqual(sheet.draft.inventario, draft.inventario);
    checkpoint = 'first session save';
    await rpc('save_guided_character', p, {p_id: character.character_id, p_expected_revision: character.revision, p_draft: {...draft, nome: 'Updated'}});
    checkpoint = 'second session stale save';
    const stale = await api('/rest/v1/rpc/save_guided_character', {token: second.access_token, method: 'POST', body: {p_id: character.character_id, p_expected_revision: character.revision, p_draft: draft}});
    checkpoint = 'stale revision HTTP status';
    console.log(`INFO stale revision response: HTTP ${stale.status}, SQLSTATE ${/^[A-Z0-9]{4,6}$/.test(stale.data?.code ?? '') ? stale.data.code : 'unknown'}`);
    assert.ok(stale.status === 409 || (stale.status === 500 && stale.data?.code === '40001'), 'Stale revision must fail with a recognized concurrency conflict');
    if (stale.status === 500) console.log('WARN stale revision is rejected with HTTP 500/SQLSTATE 40001; normalize to HTTP 409 before Beta');
    checkpoint = 'foreign campaign sheet isolation';
    assert.deepEqual(await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token: o}), []);
    checkpoint = 'master sees updated character';
    assert.equal((await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token: m}))[0].draft.nome, 'Updated');
  });
  await check('sheet rules (0013): campaign coins are master-only, restricted items and grants are refused for players, presentation is automatic', async () => {
    await ok(`/rest/v1/campaigns?id=eq.${a}`, {token: m, method: 'PATCH', body: {enabled_coins: ['cp', 'sp', 'gp']}});
    assert.deepEqual((await ok(`/rest/v1/campaigns?id=eq.${a}&select=enabled_coins`, {token: p}))[0].enabled_coins, ['cp', 'sp', 'gp']);
    const denied = await api(`/rest/v1/campaigns?id=eq.${a}`, {token: p, method: 'PATCH', body: {enabled_coins: ['pp']}});
    assert.ok(!denied.ok || denied.data.length === 0, 'player must not change coins');
    const item = (itemId, quantity) => ({id: itemId, itemId, quantity, equipped: false, origin: 'acquired'});
    const sheetOf = async token => (await ok(`/rest/v1/character_sheets?character_id=eq.${character.character_id}`, {token}))[0];
    const save = async (token, patch) => { const cur = await sheetOf(token); return api('/rest/v1/rpc/save_guided_character', {token, method: 'POST', body: {p_id: character.character_id, p_expected_revision: cur.revision, p_draft: {...cur.draft, ...patch, _protocolo: 2}}}); };
    assert.ok((await save(p, {inventory: [item('potion-of-healing-common', 1)]})).ok);
    assert.equal((await save(p, {inventory: [item('potion-of-healing-greater', 1)]})).ok, false);
    assert.equal((await save(p, {inventory: [item('potion-of-healing-greater', 7), {...item('potion-of-healing-greater', -7), id: 'offset'}]})).ok, false, 'offsetting quantities must be refused');
    await ok(`/rest/v1/notes?id=eq.${character.character_id}`, {token: p, method: 'PATCH', body: {meta: {guiado: true, identidadePublica: {settings: {imageUrl: null, title: 'OLD-SECRET', name: {mode: 'real'}, surname: {mode: 'hidden', customValue: 'HIDDEN-SECRET'}, race: {mode: 'hidden'}, characterClass: {mode: 'hidden'}, description: ''}, card: {imageUrl: null, title: '', name: null, surname: null, race: null, characterClass: null, description: ''}}}}});
    assert.ok(!/OLD-SECRET|HIDDEN-SECRET/.test(JSON.stringify(await ok(`/rest/v1/notes?id=eq.${character.character_id}`, {token: m}))), 'hidden text must never be stored in the campaign-readable row');
    assert.equal((await save(p, {play: {concedidos: [{id: 'g', tipo: 'talento', nome: 'X', origem: 'Y'}]}})).ok, false);
    assert.ok((await save(m, {inventory: [item('potion-of-healing-greater', 1)], name: 'Renamed by master', level: 4})).ok);
    const [shown] = await ok(`/rest/v1/notes?id=eq.${character.character_id}`, {token: p});
    assert.equal(shown.visibility, 'campaign');
    assert.equal(shown.meta.identidadePublica.card.name, 'Renamed by master');
    assert.equal(shown.meta.identidadePublica.card.level, '4');
    assert.ok(!JSON.stringify(shown).includes('potion-of-healing'));
    assert.deepEqual(await ok(`/rest/v1/notes?id=eq.${character.character_id}`, {token: o}), []);
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
  const encontros = {encontros: [{id: 'e1', nome: 'Emboscada', participantes: [{id: 'p1', nome: 'Goblin', quantidade: 2, pv: 7, ref: {tipo: 'monstro', id: 'goblin'}}]}]};
  await check('encounters: master saves and reloads; player, foreign master and anonymous see nothing and cannot write; nobody deletes via API', async () => {
    await ok('/rest/v1/campaign_encounters', {token: m, method: 'POST', body: {campaign_id: a, state: encontros}});
    assert.deepEqual((await ok(`/rest/v1/campaign_encounters?campaign_id=eq.${a}`, {token: m}))[0].state, encontros);
    for (const token of [p, o, undefined]) {
      const r = await api(`/rest/v1/campaign_encounters?campaign_id=eq.${a}`, {token});
      assert.ok(r.ok ? r.data.length === 0 : [401, 403].includes(r.status));
      const w = await api(`/rest/v1/campaign_encounters?campaign_id=eq.${a}&version=eq.1`, {token, method: 'PATCH', body: {state: {encontros: []}, version: 2}});
      assert.ok(w.ok ? w.data.length === 0 : [401, 403].includes(w.status));
    }
    const del = await api(`/rest/v1/campaign_encounters?campaign_id=eq.${a}`, {token: m, method: 'DELETE'});
    assert.ok([401, 403].includes(del.status), 'Data API must not delete encounters');
    const invalid = await api(`/rest/v1/campaign_encounters?campaign_id=eq.${a}&version=eq.1`, {token: m, method: 'PATCH', body: {state: {encontros: [{id: 'x', nome: ' ', participantes: []}]}, version: 2}});
    assert.equal(invalid.ok, false);
    assert.equal((await ok(`/rest/v1/campaign_encounters?campaign_id=eq.${a}`, {token: m}))[0].version, 1);
  });
  await check('combat finalization removes only the active combat; encounters survive; a new combat starts at version 1', async () => {
    const cur = await ok(`/rest/v1/campaign_combats?campaign_id=eq.${a}`, {token: m});
    const stale = await api(`/rest/v1/campaign_combats?campaign_id=eq.${a}&version=eq.${cur[0].version + 5}`, {token: m, method: 'DELETE', });
    assert.ok(stale.ok ? stale.data.length === 0 : false, 'Stale finalize must delete nothing');
    for (const token of [p, o]) { const r = await api(`/rest/v1/campaign_combats?campaign_id=eq.${a}&version=eq.${cur[0].version}`, {token, method: 'DELETE'}); assert.ok(r.ok ? r.data.length === 0 : [401, 403].includes(r.status)); }
    assert.equal((await ok(`/rest/v1/campaign_combats?campaign_id=eq.${a}&version=eq.${cur[0].version}`, {token: m, method: 'DELETE'})).length, 1);
    assert.deepEqual(await ok(`/rest/v1/campaign_combats?campaign_id=eq.${a}`, {token: m}), []);
    assert.equal((await ok(`/rest/v1/campaign_encounters?campaign_id=eq.${a}`, {token: m})).length, 1);
    assert.equal((await ok('/rest/v1/campaign_combats', {token: m, method: 'POST', body: {campaign_id: a, state}}))[0].version, 1);
  });
  await check('combat status reaches the player sheet through the authorized flow only', async () => {
    const id = character.character_id;
    assert.ok(await rpc('set_combat_status', m, {p_character_id: id, p_current_hp: 7, p_max_hp: 12, p_conditions: ['Caído']}));
    const mine = await ok(`/rest/v1/character_combat_status?character_id=eq.${id}`, {token: p});
    assert.equal(mine.length, 1); assert.deepEqual(Object.keys(mine[0]).sort(), ['campaign_id', 'character_id', 'conditions', 'current_hp', 'max_hp', 'updated_at', 'version']);
    assert.equal(mine[0].current_hp, 7); assert.deepEqual(mine[0].conditions, ['Caído']);
    assert.deepEqual(await ok(`/rest/v1/campaign_combats?campaign_id=eq.${a}`, {token: p}), []);   // o jogador continua sem ver o combate
    for (const token of [o, undefined]) { const r = await api(`/rest/v1/character_combat_status?character_id=eq.${id}`, {token}); assert.ok(r.ok ? r.data.length === 0 : [401, 403].includes(r.status)); }
    for (const token of [p, o]) { const r = await api('/rest/v1/rpc/set_combat_status', {token, method: 'POST', body: {p_character_id: id, p_current_hp: 1, p_max_hp: 12, p_conditions: []}}); assert.equal(r.ok, false); }
    for (const token of [m, p]) { const r = await api('/rest/v1/character_combat_status', {token, method: 'POST', body: {character_id: id, campaign_id: a, conditions: []}}); assert.equal(r.ok, false, 'Direct writes are closed'); }
    const [sheet] = await ok(`/rest/v1/character_sheets?character_id=eq.${id}`, {token: p});
    assert.equal(sheet.draft.nome, 'Updated', 'status does not touch the sheet');
    assert.equal(await rpc('clear_combat_status', m, {p_campaign_id: a}), 1);
    assert.deepEqual(await ok(`/rest/v1/character_combat_status?character_id=eq.${id}`, {token: p}), []);
  });
  await check('vital state and inventory operations are atomic, idempotent and authorized (0014)', async () => {
    const id = character.character_id;
    const sheetOf = async token => (await ok(`/rest/v1/character_sheets?character_id=eq.${id}&select=draft,revision,vitals_version`, {token}))[0];
    // the owner prepares hit points and an inventory through the ordinary full save
    const start = await sheetOf(p);
    await ok(`/rest/v1/character_sheets?character_id=eq.${id}`, {token: p, method: 'PATCH', body: {draft: {...start.draft, inventory: [{id: 'pocao', itemId: 'potion-of-healing-common', quantity: 2, equipped: false, origin: 'acquired'}]}}});
    const before = await sheetOf(p);
    const op = crypto.randomUUID();
    const set = await rpc('alterar_vitais', m, {p_character_id: id, p_acao: {tipo: 'definir', valor: 9, maximo: 20}, p_operacao: op});
    assert.equal(set.pv, 9); assert.equal(set.revision, before.revision, 'vital operations do not bump the sheet revision');
    const hit = crypto.randomUUID();
    for (let i = 0; i < 2; i++) assert.equal((await rpc('alterar_vitais', p, {p_character_id: id, p_acao: {tipo: 'dano', valor: 4}, p_operacao: hit})).pv, 5);
    // a stale full save never overwrites hit points
    const outdated = await api(`/rest/v1/character_sheets?character_id=eq.${id}`, {token: p, method: 'PATCH', body: {draft: {...before.draft, currentHp: 999}}});
    assert.equal(outdated.ok, false, 'a pre-0014 client changing hit points must get a visible error');
    await ok(`/rest/v1/character_sheets?character_id=eq.${id}`, {token: p, method: 'PATCH', body: {draft: {...before.draft, currentHp: 999, _protocolo: 2}}});
    assert.equal((await sheetOf(m)).draft._protocolo, undefined, 'the transport marker is never stored');
    assert.equal((await sheetOf(m)).draft.currentHp, 5);
    assert.equal((await rpc('alterar_vitais', p, {p_character_id: id, p_acao: {tipo: 'cura', valor: 0, maximo: 20}, p_operacao: crypto.randomUUID()})).pv, 5);
    // simultaneous damage from master and player is never lost
    await Promise.all([m, p].map(token => rpc('alterar_vitais', token, {p_character_id: id, p_acao: {tipo: 'dano', valor: 1}, p_operacao: crypto.randomUUID()})));
    assert.equal((await sheetOf(p)).draft.currentHp, 3);
    const use = crypto.randomUUID();
    for (let i = 0; i < 2; i++) { const r = await rpc('usar_consumivel', p, {p_character_id: id, p_instancia: 'pocao', p_cura: 6, p_maximo: 20, p_operacao: use}); assert.equal(r.pv, 9); assert.equal(r.draft.inventory[0].quantity, 1); }
    for (const token of [o, undefined]) {
      for (const [fn, body] of [['alterar_vitais', {p_character_id: id, p_acao: {tipo: 'dano', valor: 1}, p_operacao: crypto.randomUUID()}], ['usar_consumivel', {p_character_id: id, p_instancia: 'pocao', p_cura: 1, p_maximo: 20, p_operacao: crypto.randomUUID()}], ['transferir_item', {p_origem: id, p_destino: crypto.randomUUID(), p_instancia: 'pocao', p_quantidade: 1, p_operacao: crypto.randomUUID()}]]) {
        const r = await api(`/rest/v1/rpc/${fn}`, {token, method: 'POST', body}); assert.equal(r.ok, false, `${fn} must be refused`);
      }
    }
    const bad = await api('/rest/v1/rpc/transferir_item', {token: p, method: 'POST', body: {p_origem: id, p_destino: crypto.randomUUID(), p_instancia: 'pocao', p_quantidade: 1, p_operacao: crypto.randomUUID()}});
    assert.equal(bad.ok, false, 'transfer to a character outside the campaign is refused');
    assert.equal((await sheetOf(p)).draft.inventory[0].quantity, 1);
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
  await writeFile('alpha-local-report.json', JSON.stringify({passed: assertions, checks, limitations: ['Stale character revision currently returns HTTP 500/SQLSTATE 40001 instead of HTTP 409; normalize before Beta', 'Recovery email and password-change flow not yet exercised', 'Browser, realtime subscription, network failure and UI migration remain pending', 'Encounters have no remote persistence yet']}, null, 2));
} catch (error) {
  if (/^API \/(auth|rest)\/v1\/[a-z_/]+ status \d+$/.test(error.message)) console.error(error.message);
  // Never print bodies, credentials, JWTs or fixture emails to CI logs/artifacts.
  console.error(`FAIL isolated API validation after ${assertions} completed checks; checkpoint: ${checkpoint}`);
  process.exitCode = 1;
}
