// MODO DE DEMONSTRAÇÃO LOCAL (somente `npm run dev`): permite ver e testar o aplicativo sem Supabase, como mestre ou jogador.
// Abra http://localhost:5173/?demo=mestre ou ?demo=jogador. Os dados ficam no localStorage deste navegador e são compartilhados
// entre os dois papéis (publique como mestre, confira como jogador). NÃO entra no build de produção (ver main.tsx).
import type { SupabaseClient, User } from "@supabase/supabase-js";
import App from "../App";
import { AuthGate } from "../AuthGate";
import { AuthProvider } from "../AuthContext";
import { CampaignsProvider } from "../CampaignsContext";
import type { CampaignApi, Invite, Member, Membership, Role } from "../campaigns";
import type { Registro, RegistrosApi } from "../registros";
import type { CapaApi } from "../capa";
import { RegistrosProvider } from "../RegistrosContext";

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

const CAPA_KEY = "demo:capa:v1";
const lerArquivo = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
/** Capa de demonstração: guarda a imagem como data URL no localStorage (o app real usa o bucket campaign-assets). */
const capaDemo: CapaApi = {
  obter: async () => ({ ok: true, data: localStorage.getItem(CAPA_KEY) }),
  definir: async (_c, f) => { try { const u = await lerArquivo(f); localStorage.setItem(CAPA_KEY, u); return { ok: true, data: u }; } catch { return { ok: false, error: "Imagem grande demais para o modo de demonstração." }; } },
  remover: async () => { localStorage.removeItem(CAPA_KEY); return { ok: true, data: true }; },
  enviar: async () => ({ ok: false, error: "Envio de retrato indisponível no modo de demonstração." }),
  urlDe: async () => ({ ok: false, error: "sem imagem" }),
  apagar: async () => ({ ok: true, data: true }),
};

export function DemoRoot({ papel }: { papel: Role }) {
  const uid = `demo-${papel}`;
  const user = { id: uid, email: `${papel}@demo.local` } as User;
  const client = { auth: { getSession: async () => ({ data: { session: { user } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }) } } as unknown as SupabaseClient;
  const campanhas = criarCampanhas(papel), registros = criarRegistros(papel, uid);
  try { localStorage.setItem(`compendio5e:active-campaign:${uid}`, CAMP.id); } catch { /* sem armazenamento */ }
  return <AuthProvider client={client}><CampaignsProvider apiFactory={() => campanhas}><RegistrosProvider api={registros} capa={capaDemo}>
    <AuthGate><App/></AuthGate>
  </RegistrosProvider></CampaignsProvider></AuthProvider>;
}
