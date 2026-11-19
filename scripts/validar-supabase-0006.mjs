// Validação REAL das migrações 0005+0006 (RLS de notas e políticas do Storage) contra um projeto Supabase ISOLADO de teste.
// NÃO rode contra o projeto de produção sem decidir isso conscientemente: o script cria uma campanha e contas de teste NÃO; usa 3 contas que
// VOCÊ informa por variáveis de ambiente (nada é gravado em disco, nenhuma senha vai para o repositório) e limpa o que criou ao final.
//
// Uso (PowerShell), com as migrações 0001-0006 já aplicadas no projeto de TESTE:
//   $env:SUPABASE_URL="https://SEU-PROJETO-DE-TESTE.supabase.co"; $env:SUPABASE_ANON_KEY="sb_publishable_..."
//   $env:MESTRE_EMAIL="..."; $env:MESTRE_SENHA="..."; $env:JOGADOR_EMAIL="..."; $env:JOGADOR_SENHA="..."; $env:ESTRANHO_EMAIL="..."; $env:ESTRANHO_SENHA="..."
//   node scripts/validar-supabase-0006.mjs
// Saída: tabela PASS/FAIL; código de saída 1 se algo falhar. Use SOMENTE a chave pública (anon/publishable), nunca a service_role.
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const env = n => { const v = process.env[n]; if (!v) { console.error(`Falta a variável ${n}.`); process.exit(2); } return v; };
const URL = env("SUPABASE_URL"), KEY = env("SUPABASE_ANON_KEY");
if (/service_role|sb_secret_/.test(KEY)) { console.error("Use apenas a chave pública."); process.exit(2); }
const conta = (p) => ({ email: env(`${p}_EMAIL`), password: env(`${p}_SENHA`) });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const login = async (p) => { const c = createClient(URL, KEY, { auth: { persistSession: false } }); const { data, error } = await c.auth.signInWithPassword(conta(p)); if (error) throw new Error(`login ${p}: ${error.message}`); return { c, id: data.user.id }; };
const resultados = []; const t = async (nome, fn) => { try { const ok = await fn(); resultados.push([nome, ok ? "PASS" : "FAIL"]); } catch (e) { resultados.push([nome, `FAIL (${e.message})`]); } };
const bloqueado = r => !!r.error || (Array.isArray(r.data) && r.data.length === 0);

const M = await login("MESTRE"), J = await login("JOGADOR"), E = await login("ESTRANHO");
let camp = null; const objetos = [];
try {
  const c = await M.c.rpc("create_campaign", { p_name: `Teste 0006 ${Date.now()}`, p_description: "" }); if (c.error) throw new Error(`create_campaign: ${c.error.message}`);
  camp = c.data;
  const inv = await M.c.rpc("create_invite", { p_campaign_id: camp, p_max_uses: 2, p_days: 1 }); if (inv.error) throw new Error(`create_invite: ${inv.error.message}`);
  const j = await J.c.rpc("join_campaign", { p_code: inv.data }); if (j.error) throw new Error(`join_campaign: ${j.error.message}`);
  const B = "campaign-assets", novo = () => `${camp}/${randomUUID()}`, up = (cli, path, corpo = PNG, tipo = "image/png") => cli.c.storage.from(B).upload(path, corpo, { contentType: tipo, upsert: false });

  const pJ = novo(), pM = novo();
  await t("bucket existe, é privado e limita tipo/tamanho", async () => { const r = await M.c.storage.getBucket(B); return !r.error && r.data.public === false && r.data.file_size_limit === 5242880; });
  await t("participante (jogador) ENVIA imagem em <campanha>/<uuid>", async () => { const r = await up(J, pJ); if (!r.error) objetos.push(pJ); return !r.error; });
  await t("mestre ENVIA imagem", async () => { const r = await up(M, pM); if (!r.error) objetos.push(pM); return !r.error; });
  await t("participante LÊ (URL assinada funciona e baixa os bytes)", async () => { const s = await J.c.storage.from(B).createSignedUrl(pM, 60); if (s.error) return false; const r = await fetch(s.data.signedUrl); return r.ok; });
  await t("ESTRANHO não envia para a campanha", async () => { const r = await up(E, novo()); if (!r.error) objetos.push("?"); return !!r.error; });
  await t("ESTRANHO não gera URL assinada nem baixa", async () => { const s = await E.c.storage.from(B).createSignedUrl(pJ, 60); const d = await E.c.storage.from(B).download(pJ); return !!s.error && !!d.error; });
  await t("ESTRANHO não vê a listagem da pasta da campanha", async () => { const r = await E.c.storage.from(B).list(camp); return !r.error ? r.data.length === 0 : true; });
  await t("caminho fora do padrão é recusado", async () => !!(await up(J, `${camp}/arquivo.png`)).error);
  await t("caminho de OUTRA campanha é recusado", async () => !!(await up(J, `${randomUUID()}/${randomUUID()}`)).error);
  await t("SVG é recusado (tipo não permitido)", async () => !!(await up(J, novo(), Buffer.from("<svg/>"), "image/svg+xml")).error);
  await t("arquivo acima de 5 MiB é recusado", async () => !!(await up(J, novo(), Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")).error);
  await t("ESTRANHO não apaga o arquivo do jogador", async () => { const r = await E.c.storage.from(B).remove([pJ]); return bloqueado(r) && !(await J.c.storage.from(B).createSignedUrl(pJ, 5)).error; });
  await t("jogador NÃO apaga o arquivo do mestre", async () => { const r = await J.c.storage.from(B).remove([pM]); return bloqueado(r) && !(await M.c.storage.from(B).createSignedUrl(pM, 5)).error; });
  await t("jogador apaga o PRÓPRIO arquivo", async () => { const r = await J.c.storage.from(B).remove([pJ]); return !r.error && r.data.length === 1; });
  await t("mestre apaga arquivo de qualquer participante", async () => { const p = novo(); const u = await up(J, p); if (u.error) return false; const r = await M.c.storage.from(B).remove([p]); return !r.error && r.data.length === 1; });

  await t("capa: mestre define cover_path; jogador não; formato inválido é recusado", async () => {
    const ok = await M.c.from("campaigns").update({ cover_path: pM }).eq("id", camp).select("id");
    const jg = await J.c.from("campaigns").update({ cover_path: novo() }).eq("id", camp).select("id");
    const ruim = await M.c.from("campaigns").update({ cover_path: "../x" }).eq("id", camp).select("id");
    return ok.data?.length === 1 && bloqueado(jg) && !!ruim.error;
  });

  const nota = (cli, o) => cli.c.from("notes").insert({ campaign_id: camp, title: "t", content: [{ type: "paragraph", content: [{ type: "text", text: "x", styles: {} }] }], meta: {}, ...o }).select("id");
  await t("diário: jogador NÃO cria; mestre cria rascunho", async () => !!(await nota(J, { kind: "diary" })).error && !(await nota(M, { kind: "diary" })).error);
  await t("rascunho invisível ao jogador e ao estranho; ao publicar, jogador lê e estranho não", async () => {
    const d = await nota(M, { kind: "diary", title: "Segredo" }); const id = d.data[0].id;
    const antes = (await J.c.from("notes").select("id").eq("id", id)).data.length + (await E.c.from("notes").select("id").eq("id", id)).data.length;
    await M.c.from("notes").update({ visibility: "campaign" }).eq("id", id);
    const depois = [(await J.c.from("notes").select("id").eq("id", id)).data.length, (await E.c.from("notes").select("id").eq("id", id)).data.length];
    return antes === 0 && depois[0] === 1 && depois[1] === 0;
  });
  await t("cena/quadro: sempre privados e invisíveis ao jogador; jogador não cria", async () => {
    const s = await nota(M, { kind: "scene" }); const pub = await nota(M, { kind: "scene", visibility: "campaign" });
    return !s.error && !!pub.error && !!(await nota(J, { kind: "board" })).error && (await J.c.from("notes").select("id").in("kind", ["scene", "board"]).eq("campaign_id", camp)).data.length === 0;
  });
  await t("personagem: jogador cria e publica; outro participante/estranho: estranho não vê", async () => {
    const p = await nota(J, { kind: "character", title: "Lydia", visibility: "campaign", meta: { classe: "Clériga", nivel: 3 } });
    return !p.error && (await M.c.from("notes").select("id").eq("id", p.data[0].id)).data.length === 1 && (await E.c.from("notes").select("id").eq("id", p.data[0].id)).data.length === 0;
  });
  await t("gravação com versão antiga não sobrescreve (conflito)", async () => {
    const d = await nota(M, { kind: "board", title: "Q", visibility: "private" }); const id = d.data[0].id;
    const a = await M.c.from("notes").update({ meta: { colunas: [] } }).eq("id", id).eq("version", 1).select("version");
    const b = await M.c.from("notes").update({ meta: { colunas: [{}] } }).eq("id", id).eq("version", 1).select("version");
    return a.data?.length === 1 && bloqueado(b);
  });
} finally {
  if (camp) {   // limpeza: arquivos conhecidos e a campanha (a exclusão apaga notas e membros em cascata)
    for (const p of objetos.filter(x => x !== "?")) await M.c.storage.from("campaign-assets").remove([p]).catch(() => {});
    await M.c.from("campaigns").update({ cover_path: null }).eq("id", camp);
    await M.c.from("campaigns").delete().eq("id", camp);
  }
}
const largura = Math.max(...resultados.map(r => r[0].length));
for (const [n, r] of resultados) console.log(`${r.startsWith("PASS") ? "PASS" : "FAIL"}  ${n.padEnd(largura)}${r.startsWith("PASS") ? "" : "  " + r}`);
const falhas = resultados.filter(r => !r[1].startsWith("PASS")).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram.`);
process.exit(falhas ? 1 : 0);
