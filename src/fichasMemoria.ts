// Apoio aos testes e ao modo de demonstração (não é persistência real): API de fichas em memória que imita as regras do banco
// (`supabase/migrations/0008_*`): dono participante ou mestre leem/gravam a ficha; revisão controlada pelo servidor; identidade pública só do dono.
// A validação das políticas REAIS é feita em `supabase/character-sheets.test.ts` (PostgreSQL isolado); isto serve para testar a interface.
import type { CharacterDraft } from "./rules/character-domain";
import { ERRO_CONFLITO_REVISAO, ERRO_SEM_FICHA, identidadeDe, projetarIdentidade, type FichasApi, type IdentidadeGravada } from "./fichas";
import type { Registro } from "./registros";

type Linha = { id: string; campaignId: string; ownerId: string; revision: number; draft: CharacterDraft; updatedAt: string };
export type BancoFichas = {
  fichas: Linha[];
  /** Notas públicas dos personagens guiados (a mesma lista usada por `registrosEmMemoria`, para a lista de Personagens enxergá-las). */
  registros: { dados: Registro[] };
  /** Simula queda de rede: toda chamada falha com a mensagem de "sem conexão". */
  rede: { caida: boolean };
  /** Participação atual: mestre e jogadores por campanha (a RLS lê isto do banco, nunca do cliente). */
  campanhas: Record<string, { mestre: string; jogadores: string[] }>;
};
export const novoBancoFichas = (registros: { dados: Registro[] } = { dados: [] }): BancoFichas => ({ fichas: [], registros, rede: { caida: false }, campanhas: { ca: { mestre: "u9", jogadores: ["u1", "u2"] } } });

export function fichasEmMemoria(uid: string, banco: BancoFichas): FichasApi & { banco: BancoFichas } {
  const mestre = (cid: string) => banco.campanhas[cid]?.mestre === uid;
  const membro = (cid: string) => mestre(cid) || !!banco.campanhas[cid]?.jogadores.includes(uid);
  const le = (f: Linha) => (f.ownerId === uid && membro(f.campaignId)) || mestre(f.campaignId);       // política de SELECT/UPDATE da 0008
  const semRede = { ok: false as const, error: "Sem conexão com o servidor." };
  let n = 0;
  const agora = () => new Date(Date.now() + ++n).toISOString();
  const api: FichasApi = {
    listar: async cid => banco.rede.caida ? semRede : { ok: true, data: banco.fichas.filter(f => f.campaignId === cid && le(f)).map(f => ({ id: f.id, ownerId: f.ownerId, nome: f.draft.name.trim() || "Sem nome", nivel: f.draft.level, revision: f.revision, updatedAt: f.updatedAt })) },
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
      const id = `srv-${banco.fichas.length + 1}-${cid}`;
      const p = projetarIdentidade(identidade);
      banco.registros.dados.push({ id, kind: "character", campaignId: cid, ownerId: uid, title: p.titulo, content: [], visibility: identidade.publicar ? "campaign" : "private", meta: { guiado: true, ...p.meta }, version: 1, createdAt: agora(), updatedAt: agora() });
      const l: Linha = { id, campaignId: cid, ownerId: uid, revision: 1, draft: { ...structuredClone(draft), id }, updatedAt: agora() };
      banco.fichas.push(l);
      return { ok: true, data: { id, revision: 1, updatedAt: l.updatedAt } };
    },
    salvar: async (id, esperada, draft, identidade) => {
      if (banco.rede.caida) return semRede;
      const l = banco.fichas.find(x => x.id === id); if (!l || !le(l)) return { ok: false, error: ERRO_SEM_FICHA };   // sem oráculo: igual a inexistente
      if (l.revision !== esperada) return { ok: false, error: ERRO_CONFLITO_REVISAO };
      if (identidade && l.ownerId !== uid) return { ok: false, error: "Só o dono do personagem altera a identidade pública." };
      l.draft = { ...structuredClone(draft), id }; l.revision += 1; l.updatedAt = agora();
      if (identidade) {
        const i = banco.registros.dados.findIndex(r => r.id === id); const p = projetarIdentidade(identidade);
        if (i >= 0) banco.registros.dados[i] = { ...banco.registros.dados[i], title: p.titulo, visibility: identidade.publicar ? "campaign" : "private", meta: { guiado: true, ...p.meta }, version: banco.registros.dados[i].version + 1 };
      }
      return { ok: true, data: { id, revision: l.revision, updatedAt: l.updatedAt } };
    },
  };
  return Object.assign(api, { banco });
}
