// MODO DE DEMONSTRAÇÃO LOCAL (somente `npm run dev`): permite ver e testar o aplicativo sem Supabase, como mestre ou jogador.
// Abra http://localhost:5173/?demo=mestre ou ?demo=jogador. Os dados ficam no localStorage deste navegador e são compartilhados
// entre os dois papéis (publique como mestre, confira como jogador). NÃO entra no build de produção (ver main.tsx).
import { NuvemContext, type ApisNuvem } from "../Iniciativa";
import type { ApiLinha } from "../linhaRemota";
import type { Encontro, EstadoCombate } from "../combate";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import App from "../App";
import { AuthGate } from "../AuthGate";
import { AuthProvider } from "../AuthContext";
import { CampaignsProvider } from "../CampaignsContext";
import type { CampaignApi, Invite, Member, Membership, Role } from "../campaigns";
import type { Registro, RegistrosApi } from "../registros";
import { ENQUADRAMENTO_PADRAO, lerEnquadramento, type CapaApi } from "../capa";
import { ERRO_SEM_MOEDA, type ConfigCampanhaApi } from "../configCampanha";
import { lerMoedasAtivas } from "../moedas/moedas";
import { RegistrosProvider } from "../RegistrosContext";
import { fichasDemo } from "./fichasDemo";

const CAMP = { id: "11111111-1111-4111-8111-111111111111", name: "Sociedade do Véu Negro", description: "Um festival em Daggerford vira um banho de sangue com a revelação de um culto que assola a região.", created_at: "2026-01-01T00:00:00Z" };
const KEY = "demo:registros:v2";
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function carregar(): Registro[] {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* recomeça */ }
  const agora = "2026-11-19T12:00:00Z", base = { campaignId: CAMP.id, ownerId: "demo-mestre", meta: {}, version: 1, createdAt: agora, updatedAt: agora };
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
  return [
    { ...base, id: "d1", kind: "diary", title: "3ª Sessão — O Festival", visibility: "campaign", meta: { sessao: { dia: 20, mes: 11, ano: 1491 } }, updatedAt: "2026-11-10T12:00:00Z", content: [p("O grupo chegou a Daggerford durante o festival e investigou o desaparecimento de um mercador.")] },
    { ...base, id: "d2", kind: "diary", title: "4ª Sessão — Caverna dos Goblins Presa Vermelha 2", visibility: "campaign", meta: { sessao: { dia: 3, mes: 12, ano: 1491 } }, updatedAt: "2026-11-17T12:00:00Z",
      content: [{ type: "image", props: { url: "" } }, { type: "paragraph", content: [] }, p("Pedro foi atacado por um goblin que patrulhava a entrada da caverna junto com seu lobo. Utilizando seu apito, conseguiu chamar o restante do grupo para ajudá-lo. Os aventureiros chegaram a tempo de se juntar ao combate e enfrentaram os inimigos que estavam nos arredores da entrada. Durante a batalha, alguns outros lobos se juntaram ao confronto, e um deles acabou ficando ferido e fugindo."), p("Segundo parágrafo, que não aparece na prévia.")] },
    { ...base, id: "d3", kind: "diary", title: "5ª Sessão — rascunho do mestre", visibility: "private", meta: { sessao: { dia: 9, mes: 12, ano: 1491 } }, updatedAt: "2026-11-18T12:00:00Z", content: [p("Segredo do mestre: o prefeito é parte do culto.")] },
    { ...base, id: "s1", kind: "scene", title: "Julkoun: o bar", visibility: "private", content: [p("O taverneiro conhece o mapa da cabana.")] },
    { ...base, id: "s2", kind: "scene", title: "Estrada: carroça atolada", visibility: "private", content: [p("Encontro aleatório com bandidos disfarçados.")] },
    { ...base, id: "p1", kind: "character", ownerId: "demo-jogador", title: "Lydia Valenmoor", visibility: "campaign", meta: { classe: "Clériga", nivel: 3 } },
    { ...base, id: "p2", kind: "character", ownerId: "demo-jogador", title: "Toran Pedra-Ferro", visibility: "campaign", meta: { classe: "Guerreiro", nivel: 3 } },
    { ...base, id: "p3", kind: "character", ownerId: "demo-mestre", title: "Sabine", visibility: "campaign", meta: { classe: "Ladina", nivel: 2 } },
    { ...base, id: "b1", kind: "board", title: "Quadro de planejamento", visibility: "private", meta: { colunas: [{ id: "k1", titulo: "Sessão 5", cartoes: ["s1", "s2"] }, { id: "k2", titulo: "Floresta", cartoes: [] }] } },
  ] as Registro[];
}

function criarRegistros(papel: Role, uid: string): RegistrosApi {
  let dados = carregar();
  const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(dados)); } catch { /* cota */ } };
  const lerTudo = () => { dados = carregar(); };
  /** Imita a RLS de `notes`: dono vê o que é dele; o mestre não vê rascunhos alheios; publicado (campaign) todos veem; diário/cena/quadro só do mestre. */
  const visivel = (r: Registro) => r.ownerId === uid || r.visibility === "campaign";
  const negado = { ok: false as const, error: "Apenas o mestre pode fazer isso." };
  const espera = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 60));
  return {
    list: async (campaignId, kind) => { lerTudo(); return espera({ ok: true as const, data: dados.filter(r => r.campaignId === campaignId && r.kind === kind && visivel(r)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }); },
    get: async id => { lerTudo(); const r = dados.find(x => x.id === id); return espera({ ok: true as const, data: r && visivel(r) ? r : null }); },
    create: async n => {
      lerTudo();
      if (n.kind !== "character" && papel !== "mestre") return negado;
      const agora = new Date().toISOString();
      const r: Registro = { id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: n.kind, campaignId: n.campaignId, ownerId: uid, title: n.title.trim(), content: n.content ?? [], visibility: n.visibility ?? "private", meta: n.meta ?? {}, version: 1, createdAt: agora, updatedAt: agora };
      dados.push(r); salvar(); return espera({ ok: true as const, data: r });
    },
    update: async (id, version, p) => {
      lerTudo(); const i = dados.findIndex(x => x.id === id);
      if (i < 0 || dados[i].ownerId !== uid) return negado;
      if (dados[i].version !== version) return { ok: false as const, error: "Outra pessoa alterou este registro. Recarregue para continuar." };
      dados[i] = { ...dados[i], ...p, title: p.title?.trim() ?? dados[i].title, version: version + 1, updatedAt: new Date().toISOString() }; salvar();
      return espera({ ok: true as const, data: dados[i] });
    },
    remove: async id => { lerTudo(); const r = dados.find(x => x.id === id); if (!r || r.ownerId !== uid) return negado; dados = dados.filter(x => x.id !== id); salvar(); return espera({ ok: true as const, data: true as const }); },
  };
}

function criarCampanhas(papel: Role): CampaignApi {
  let camp = { ...CAMP }; try { const s = localStorage.getItem("demo:campanha:v1"); if (s) camp = { ...camp, ...JSON.parse(s) }; } catch { /* padrão */ }
  const membros: Member[] = [{ user_id: "demo-mestre", role: "mestre", joined_at: "", display_name: "Mestre (demo)" }, { user_id: "demo-jogador", role: "jogador", joined_at: "", display_name: "Jogador (demo)" }];
  return ({
    list: () => ok<Membership[]>([{ role: papel, campaign: camp }]),
    update: async (_i: string, name: string, description: string) => { camp = { ...camp, name: name.trim(), description }; try { localStorage.setItem("demo:campanha:v1", JSON.stringify({ name: camp.name, description })); } catch { /* cota */ } return { ok: true as const, data: camp }; },
    members: () => ok<Member[]>(membros), invites: () => ok<Invite[]>([]),
    create: () => ok(camp.id), remove: () => ok(true as const), join: () => ok(camp.id), removeMember: () => ok(true as const), createInvite: () => ok("DEMO00000000"), revokeInvite: () => ok(true as const),
  }) as unknown as CampaignApi;
}

const CAPA_KEY = "demo:capa:v1", ENQ_KEY = "demo:capa:enquadramento:v1";
const lerArquivo = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
/** Capa de demonstração: guarda a imagem como data URL no localStorage (o app real usa o bucket campaign-assets). */
const capaDemo: CapaApi = {
  enquadramento: async () => { let v: unknown = null; try { v = JSON.parse(localStorage.getItem(ENQ_KEY) ?? "null"); } catch { /* padrão */ } return { ok: true, data: { suportado: new URLSearchParams(window.location.search).get("semEnquadramento") !== "1", valor: v ? lerEnquadramento(v) : ENQUADRAMENTO_PADRAO } }; },
  salvarEnquadramento: async (_c, e) => { localStorage.setItem(ENQ_KEY, JSON.stringify(e)); return { ok: true, data: true }; },
  obter: async () => ({ ok: true, data: localStorage.getItem(CAPA_KEY) }),
  definir: async (_c, f) => { try { const u = await lerArquivo(f); localStorage.setItem(CAPA_KEY, u); localStorage.removeItem(ENQ_KEY); return { ok: true, data: u }; } catch { return { ok: false, error: "Imagem grande demais para o modo de demonstração." }; } },
  remover: async () => { localStorage.removeItem(CAPA_KEY); localStorage.removeItem(ENQ_KEY); return { ok: true, data: true }; },
  enviar: async (_c, f) => { try { const caminho = `demo/${crypto.randomUUID()}`; localStorage.setItem(`demo:retrato:${caminho}`, await lerArquivo(f)); return { ok: true, data: caminho }; } catch { return { ok: false, error: "Imagem grande demais para o modo de demonstração." }; } },
  urlDe: async caminho => { const d = localStorage.getItem(`demo:retrato:${caminho}`); return d ? { ok: true, data: d } : { ok: false, error: "sem imagem" }; },
  apagar: async () => ({ ok: true, data: true }),
};

const MOEDAS_KEY = "demo:moedas:v1";
const lerMoedasDemo = () => { try { return lerMoedasAtivas(JSON.parse(localStorage.getItem(MOEDAS_KEY) ?? "null")); } catch { return lerMoedasAtivas(null); } };
/** Moedas da campanha na demonstração (no app real: `campaigns.enabled_coins`, gravada só pelo mestre). */
const configDemo = (papel: Role): ConfigCampanhaApi => ({
  moedas: async () => ({ ok: true, data: { suportado: true, ativas: lerMoedasDemo() } }),
  salvarMoedas: async (_c, ativas) => {
    if (!ativas.length) return { ok: false, error: ERRO_SEM_MOEDA };
    if (papel !== "mestre") return { ok: false, error: "Apenas o mestre pode fazer isso." };
    const lista = lerMoedasAtivas([...ativas]); localStorage.setItem(MOEDAS_KEY, JSON.stringify(lista)); return { ok: true, data: lista };
  },
});

/** Servidor FALSO do combate/encontros para o modo de demonstração (`?demo=mestre&nuvem=1`, só em `npm run dev`): guarda no localStorage do navegador com a mesma
 *  semântica de versão do banco real. Serve para exercitar a interface do modo nuvem em E2E; NÃO prova nada sobre o Supabase. */
function apiFalsa<T>(tabela: string, vazio: T): ApiLinha<T> {
  const k = (id: string) => `demo-nuvem:${tabela}:${id}`;
  const ler = (id: string): { valor: T; versao: number } | null => { try { const b = localStorage.getItem(k(id)); return b ? JSON.parse(b) : null; } catch { return null; } };
  return {
    async carregar(id) { return { ok: true, data: ler(id) ?? { valor: vazio, versao: 0 } }; },
    async salvar(id, valor, esperada) {
      if ((ler(id)?.versao ?? 0) !== esperada) return { ok: false, tipo: "conflito", mensagem: "Mudou em outra sessão." };
      const nova = { valor, versao: esperada + 1 }; localStorage.setItem(k(id), JSON.stringify(nova)); return { ok: true, data: nova };
    },
    async finalizar(id, esperada) { if (ler(id)?.versao !== esperada) return { ok: false, tipo: "conflito", mensagem: "Mudou." }; localStorage.removeItem(k(id)); return { ok: true }; },
  };
}
const nuvemDemo: ApisNuvem = { combate: apiFalsa<EstadoCombate>("combate", { combatentes: [], turno: null, rodada: 1 }), encontros: apiFalsa<Encontro[]>("encontros", []) };

export function DemoRoot({ papel }: { papel: Role }) {
  const uid = `demo-${papel}`;
  const user = { id: uid, email: `${papel}@demo.local` } as User;
  const client = { auth: { getSession: async () => ({ data: { session: { user } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) } } as unknown as SupabaseClient;
  const campanhas = criarCampanhas(papel), registros = criarRegistros(papel, uid);
  try { localStorage.setItem(`compendio5e:active-campaign:${uid}`, CAMP.id); } catch { /* sem armazenamento */ }
  const comFichas = new URLSearchParams(window.location.search).get("fichas") === "1";
  const fichas = comFichas ? fichasDemo(uid, CAMP.id, { ler: carregar, gravar: d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* cota */ } } }) : undefined;
  return <AuthProvider client={client}><CampaignsProvider apiFactory={() => campanhas}><RegistrosProvider api={registros} capa={capaDemo} config={configDemo(papel)} fichas={fichas}>
    {new URLSearchParams(window.location.search).get("nuvem") === "1"
      ? <NuvemContext.Provider value={nuvemDemo}><AuthGate><App/></AuthGate></NuvemContext.Provider>
      : <AuthGate><App/></AuthGate>}
  </RegistrosProvider></CampaignsProvider></AuthProvider>;
}
