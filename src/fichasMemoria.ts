// Apoio aos testes e ao modo de demonstração (não é persistência real): API de fichas em memória que imita as regras do banco
// (`supabase/migrations/0008_*` e `0013_*`): dono participante ou mestre leem/gravam a ficha; revisão controlada pelo servidor; escolhas
// da identidade só do dono; apresentação sempre calculada da ficha e visível para a campanha; itens e concessões restritos para o jogador.
// A validação das políticas REAIS é feita em `supabase/character-sheets.test.ts` (PostgreSQL isolado); isto serve para testar a interface.
import { jogadorPodeAdicionar } from "./catalogue/disponibilidade";
import type { CharacterDraft } from "./rules/character-domain";
import { ERRO_CONFLITO_REVISAO, ERRO_SEM_FICHA, identidadeDe, projetarIdentidade, retratoValido, type FichasApi, type IdentidadeGravada, type ResultadoItem } from "./fichas";
import { aplicarAcao, comVitais, vitaisDoDraft } from "./vitais/vitais";
import { consumirItem, transferirEntre } from "./ficha/inventarioAcoes";
import { defaultPublicIdentity, type PublicIdentity } from "./rules/public-identity";
import type { Registro } from "./registros";
import { cicloEmMemoria, type CicloEmMemoria } from "./cicloMemoria";

type Linha = { id: string; campaignId: string; ownerId: string; revision: number; draft: CharacterDraft; updatedAt: string; vitalVersao?: number; operacoes?: string[]; npc?: boolean };
export type BancoFichas = {
  fichas: Linha[];
  /** Notas públicas dos personagens guiados (a mesma lista usada por `registrosEmMemoria`, para a lista de Personagens enxergá-las). */
  registros: { dados: Registro[] };
  /** Simula queda de rede: toda chamada falha com a mensagem de "sem conexão". */
  rede: { caida: boolean };
  /** "Tempo real" entre as APIs que usam o mesmo banco. */
  ouvintes?: Set<() => void>;
  /** Ciclo de vida (0021): situação de quem não está ativo, ofertas, avisos e operações já aceitas. */
  ciclo?: CicloEmMemoria;
  /** Simula um banco sem a 0021. */
  semCiclo?: boolean;
  /** Participação atual: mestre e jogadores por campanha (a RLS lê isto do banco, nunca do cliente). */
  campanhas: Record<string, { mestre: string; jogadores: string[] }>;
};
export const novoBancoFichas = (registros: { dados: Registro[] } = { dados: [] }): BancoFichas => ({ fichas: [], registros, rede: { caida: false }, campanhas: { ca: { mestre: "u9", jogadores: ["u1", "u2"] } } });

/** Alcunha e retrato guardados na própria ficha (como o resumo real do servidor). */
const extrasDaFicha = (d: object) => {
  const x = d as { nickname?: unknown; portrait?: unknown };
  return {
    ...(typeof x.nickname === "string" && x.nickname.trim() ? { alcunha: x.nickname.trim() } : {}),
    ...(retratoValido(x.portrait) ? { retrato: x.portrait } : {}),
  };
};
/** Regra do banco (0013): o jogador não cria nem aumenta item fora da lista, nem cria ou altera concessões. */
function entregaProibida(novo: CharacterDraft, antes: CharacterDraft | null): string | null {
  const total = (d: CharacterDraft | null, item: string) => (d?.inventory ?? []).filter(i => i.itemId === item).reduce((s, i) => s + i.quantity, 0);
  for (const item of new Set((novo.inventory ?? []).map(i => i.itemId))) if (!jogadorPodeAdicionar(item) && total(novo, item) > total(antes, item)) return "Este item só pode ser entregue pelo mestre.";
  const concedidos = (d: CharacterDraft | null) => ((d?.play as { concedidos?: unknown[] } | undefined)?.concedidos ?? []).map(c => JSON.stringify(c));
  const anteriores = new Set(concedidos(antes));
  return concedidos(novo).some(c => !anteriores.has(c)) ? "Só o mestre concede talentos, magias e habilidades." : null;
}
/** Apresentação calculada pelo servidor: as escolhas do dono aplicadas à ficha atual. */
function projecaoDaFicha(identity: PublicIdentity, d: CharacterDraft, anterior: Record<string, unknown> | undefined) {
  const antes = (anterior as { identidadePublica?: { card?: { race?: string; characterClass?: string } } } | undefined)?.identidadePublica?.card;
  return projetarIdentidade({ identity, source: { name: d.name, alias: d.nickname ?? "", race: d.publicLabels?.race ?? antes?.race ?? "", characterClass: d.publicLabels?.characterClass ?? antes?.characterClass ?? "", level: String(d.level), portrait: d.portrait ?? "" } });
}
export function fichasEmMemoria(uid: string, banco: BancoFichas): FichasApi & { banco: BancoFichas } {
  const mestre = (cid: string) => banco.campanhas[cid]?.mestre === uid;
  const membro = (cid: string) => mestre(cid) || !!banco.campanhas[cid]?.jogadores.includes(uid);
  const le = (f: Linha) => (!f.npc && f.ownerId === uid && membro(f.campaignId)) || mestre(f.campaignId);       // política de SELECT/UPDATE da 0008
  const semRede = { ok: false as const, error: "Sem conexão com o servidor." };
  let n = 0;
  const agora = () => new Date(Date.now() + ++n).toISOString();
  const ouvintes = (banco.ouvintes ??= new Set());
  const avisar = () => queueMicrotask(() => ouvintes.forEach(f => f()));
  const vital = (l: Linha) => ({ id: l.id, revision: l.revision, versao: l.vitalVersao ?? 1, ...vitaisDoDraft(l.draft) });
  const itemDe = (l: Linha): ResultadoItem => ({ ...vital(l), draft: structuredClone(l.draft), updatedAt: l.updatedAt });
  const marcar = (l: Linha, draft: CharacterDraft, operacao: string, somenteVital: boolean) => {
    l.draft = draft; l.operacoes = [operacao, ...(l.operacoes ?? [])].slice(0, 40); l.vitalVersao = (l.vitalVersao ?? 1) + 1; if (!somenteVital) l.revision += 1; l.updatedAt = agora();
  };
  const acessivel = (id: string) => { const l = banco.fichas.find(x => x.id === id); return l && le(l) ? l : null; };
  const api: FichasApi = {
    lerVitais: async ids => banco.rede.caida ? semRede : { ok: true, data: ids.flatMap(id => { const l = acessivel(id); return l ? [{ ...vital(l), draft: structuredClone(l.draft) }] : []; }) },
    alterarVitais: async (id, acao, operacao) => {
      if (banco.rede.caida) return semRede;
      const l = acessivel(id); if (!l) return { ok: false, error: ERRO_SEM_FICHA };
      if (!l.operacoes?.includes(operacao)) { marcar(l, comVitais(l.draft, aplicarAcao(vitaisDoDraft(l.draft), acao)), operacao, true); avisar(); }
      return { ok: true, data: vital(l) };
    },
    usarConsumivel: async (id, instancia, cura, maximo, operacao) => {
      if (banco.rede.caida) return semRede;
      const l = acessivel(id); if (!l) return { ok: false, error: ERRO_SEM_FICHA };
      if (!l.operacoes?.includes(operacao)) {
        const r = consumirItem(l.draft, instancia, cura, maximo, new Date(agora()));
        if (!r.ok) return { ok: false, error: r.erro };
        marcar(l, r.draft, operacao, false); avisar();
      }
      return { ok: true, data: itemDe(l) };
    },
    transferirItem: async (origem, destino, instancia, quantidade, operacao) => {
      if (banco.rede.caida) return semRede;
      const o = acessivel(origem); if (!o) return { ok: false, error: ERRO_SEM_FICHA };
      if (!o.operacoes?.includes(operacao)) {
        const t = banco.fichas.find(x => x.id === destino && x.campaignId === o.campaignId && x.id !== origem && (!x.npc || mestre(o.campaignId)));
        if (!t) return { ok: false, error: "O destinatário não é um personagem desta campanha. Nada foi alterado." };
        const publico = banco.registros.dados.find(r => r.id === destino)?.title ?? "outro personagem";
        const r = transferirEntre(o.draft, t.draft, instancia, quantidade, publico, () => `mem-${agora()}`, new Date(agora()));
        if (!r.ok) return { ok: false, error: r.erro };
        marcar(t, r.destino, operacao, false); marcar(o, r.origem, operacao, false); avisar();
      }
      return { ok: true, data: itemDe(o) };
    },
    assinar: (_filtro, aoMudar) => { ouvintes.add(aoMudar); return () => { ouvintes.delete(aoMudar); }; },
    ciclo: cicloEmMemoria(uid, banco, avisar),
    // como no banco (0022): só o mestre, uma ficha por NPC, com o mesmo ID da página; nenhuma nota pública é criada
    criarDeNpc: async (cid, entryId, _versao, draft) => {
      if (banco.rede.caida) return semRede;
      if (!mestre(cid)) return { ok: false, error: "Você não tem permissão para esta operação." };
      if (banco.fichas.some(f => f.id === entryId)) return { ok: false, error: "Este NPC já tem uma ficha. Nada foi alterado." };
      const l: Linha = { id: entryId, campaignId: cid, ownerId: uid, revision: 1, draft: { ...structuredClone(draft), id: entryId }, updatedAt: agora(), npc: true };
      banco.fichas.push(l); avisar();
      return { ok: true, data: { id: entryId, revision: 1, updatedAt: l.updatedAt } };
    },
    listar: async cid => banco.rede.caida ? semRede : { ok: true, data: banco.fichas.filter(f => f.campaignId === cid && le(f)).map(f => ({ ...(f.npc ? { npc: true } : {}), id: f.id, ownerId: f.ownerId, nome: f.draft.name.trim() || "Sem nome", ...extrasDaFicha(f.draft), classId: f.draft.classId, nivel: f.draft.level, revision: f.revision, updatedAt: f.updatedAt })) },
    carregar: async id => {
      if (banco.rede.caida) return semRede;
      const f = banco.fichas.find(x => x.id === id); if (!f || !le(f)) return { ok: true, data: null };
      const nota = banco.registros.dados.find(r => r.id === id);
      const identidade: IdentidadeGravada | null = nota && nota.ownerId === uid ? identidadeDe(nota.meta, nota.visibility === "campaign") : null;   // dono lê a própria nota; o mestre não lê a privada
      return { ok: true, data: { ficha: structuredClone(f), identidade } };
    },
    criar: async (cid, draft, identidade) => {
      if (banco.rede.caida) return semRede;
      if (!membro(cid)) return { ok: false, error: "Você não tem permissão para esta operação." };
      const proibido = mestre(cid) ? null : entregaProibida(draft, null); if (proibido) return { ok: false, error: proibido };
      const id = `srv-${banco.fichas.length + 1}-${cid}`;
      const p = projecaoDaFicha(identidade.identity, { ...draft, publicLabels: draft.publicLabels ?? { race: identidade.source.race, characterClass: identidade.source.characterClass } }, undefined);
      banco.registros.dados.push({ id, kind: "character", campaignId: cid, ownerId: uid, title: p.titulo, content: [], visibility: "campaign", meta: { guiado: true, ...p.meta }, version: 1, createdAt: agora(), updatedAt: agora() });
      const l: Linha = { id, campaignId: cid, ownerId: uid, revision: 1, draft: { ...structuredClone(draft), id }, updatedAt: agora() };
      banco.fichas.push(l);
      return { ok: true, data: { id, revision: 1, updatedAt: l.updatedAt } };
    },
    salvar: async (id, esperada, draft, identidade) => {
      if (banco.rede.caida) return semRede;
      const l = banco.fichas.find(x => x.id === id); if (!l || !le(l)) return { ok: false, error: ERRO_SEM_FICHA };   // sem oráculo: igual a inexistente
      if (l.revision !== esperada) return { ok: false, error: ERRO_CONFLITO_REVISAO };
      if (identidade && l.ownerId !== uid) return { ok: false, error: "Só o dono do personagem altera a identidade pública." };
      const proibido = mestre(l.campaignId) ? null : entregaProibida(draft, l.draft); if (proibido) return { ok: false, error: proibido };
      // como no banco (0014): a gravação da ficha inteira preserva o estado vital
      l.draft = comVitais({ ...structuredClone(draft), id }, vitaisDoDraft(l.draft)); l.revision += 1; l.updatedAt = agora(); avisar();
      const i = banco.registros.dados.findIndex(r => r.id === id);
      if (i >= 0) {
        const nota = banco.registros.dados[i];
        const p = projecaoDaFicha(identidade?.identity ?? identidadeDe(nota.meta, true)?.identity ?? defaultPublicIdentity(), l.draft, nota.meta);
        banco.registros.dados[i] = { ...nota, title: p.titulo, visibility: "campaign", meta: { guiado: true, ...p.meta }, version: nota.version + 1 };
      }
      return { ok: true, data: { id, revision: l.revision, updatedAt: l.updatedAt } };
    },
  };
  return Object.assign(api, { banco });
}
