// Apoio aos testes e ao modo de demonstração: imita as regras da 0021 sobre o banco em memória das fichas.
// As políticas REAIS são conferidas em `supabase/ciclo-personagens.test.ts`; isto serve para testar a interface.
import { mensagemDoCiclo, ERRO_SEM_CICLO, type AcaoCiclo, type AvisoPersonagem, type CicloApi, type Situacao, type TipoAviso } from "./cicloPersonagem";
import type { BancoFichas } from "./fichasMemoria";

export type CicloEmMemoria = {
  situacoes: Record<string, { campaignId: string; state: Situacao; previousOwner?: string }>;
  ofertas: { id: string; campaignId: string; characterId: string; para: string; status: "pendente" | "aceita" | "recusada" | "cancelada"; criadaEm: string }[];
  avisos: (AvisoPersonagem & { campaignId: string; para: string })[];
  operacoes: string[];
};
export const novoCicloEmMemoria = (): CicloEmMemoria => ({ situacoes: {}, ofertas: [], avisos: [], operacoes: [] });

export function cicloEmMemoria(uid: string, banco: BancoFichas, avisar: () => void): CicloApi {
  const estado = () => (banco.ciclo ??= novoCicloEmMemoria());
  const mestreDe = (cid: string) => banco.campanhas[cid]?.mestre;
  const membro = (cid: string, quem: string) => mestreDe(cid) === quem || !!banco.campanhas[cid]?.jogadores.includes(quem);
  const nota = (id: string) => banco.registros.dados.find(r => r.id === id);
  const falha = (codigo: string) => ({ ok: false as const, error: mensagemDoCiclo(codigo) });
  const indisponivel = () => banco.rede.caida ? { ok: false as const, error: "Sem conexão com o servidor." } : banco.semCiclo ? { ok: false as const, error: ERRO_SEM_CICLO } : null;
  let seq = 0;
  const registrarAviso = (campaignId: string, para: string, characterId: string, kind: TipoAviso, title: string) => {
    if (para !== uid && membro(campaignId, para)) estado().avisos.push({ id: estado().avisos.length + 1, campaignId, para, characterId, kind, title, readAt: null, createdAt: new Date(Date.now() + ++seq).toISOString() });
  };
  const trocarDono = (id: string, dono: string) => {
    const f = banco.fichas.find(x => x.id === id);
    if (f && f.ownerId !== dono) { f.ownerId = dono; f.revision += 1; }
    const i = banco.registros.dados.findIndex(r => r.id === id);
    if (i >= 0) banco.registros.dados[i] = { ...banco.registros.dados[i], ownerId: dono, version: banco.registros.dados[i].version + 1 };
  };
  const encerrarOfertas = (id: string) => estado().ofertas.forEach(o => { if (o.characterId === id && o.status === "pendente") o.status = "cancelada"; });

  const aplicar = (campaignId: string, id: string, acao: AcaoCiclo, destino?: string) => {
    const mestre = mestreDe(campaignId)!, ficha = banco.fichas.find(x => x.id === id), titulo = nota(id)?.title ?? ficha?.draft.name ?? "Personagem";
    const anterior = ficha && ficha.ownerId !== mestre ? ficha.ownerId : nota(id)?.ownerId !== mestre ? nota(id)?.ownerId : undefined;
    const definir = (state: Situacao | null) => { if (!state) delete estado().situacoes[id]; else estado().situacoes[id] = { campaignId, state, previousOwner: anterior ?? estado().situacoes[id]?.previousOwner }; };
    if (acao === "transferir") {
      encerrarOfertas(id);
      if (destino === mestre) { trocarDono(id, mestre); definir(null); return; }
      estado().ofertas.push({ id: `of-${estado().ofertas.length + 1}`, campaignId, characterId: id, para: destino!, status: "pendente", criadaEm: new Date().toISOString() });
      registrarAviso(campaignId, destino!, id, "oferta", titulo); return;
    }
    encerrarOfertas(id);
    if (acao === "cancelar-transferencia") return;
    trocarDono(id, mestre);
    if (acao === "compendio" || acao === "excluir") {
      banco.fichas.splice(0, banco.fichas.length, ...banco.fichas.filter(x => x.id !== id));
      if (acao === "excluir") {
        banco.registros.dados.splice(0, banco.registros.dados.length, ...banco.registros.dados.filter(r => r.id !== id));
        estado().avisos = estado().avisos.filter(a => a.characterId !== id);
        delete estado().situacoes[id]; return;
      }
      definir("compendio"); return;
    }
    definir(acao === "reativar" ? null : acao === "arquivar" ? "arquivado" : acao === "npc" ? "npc" : "aguardando");
    if (acao === "renunciar") registrarAviso(campaignId, mestre, id, "renuncia", titulo);
  };

  return {
    situacoes: async campaignId => {
      if (banco.rede.caida) return { ok: false, error: "Sem conexão com o servidor." };
      if (banco.semCiclo) return { ok: true, data: null };
      if (!membro(campaignId, uid)) return falha("sem_permissao");
      const mestre = mestreDe(campaignId) === uid;
      const semJogador = mestre ? banco.fichas.filter(f => f.campaignId === campaignId && !membro(campaignId, f.ownerId)).map(f => f.id) : [];
      const ids = new Set([...semJogador, ...Object.entries(estado().situacoes).filter(([, s]) => s.campaignId === campaignId).map(([id]) => id),
        ...(mestre ? estado().ofertas.filter(o => o.campaignId === campaignId && o.status === "pendente").map(o => o.characterId) : [])]);
      return { ok: true, data: [...ids].map(id => {
        const s = estado().situacoes[id], oferta = estado().ofertas.find(o => o.characterId === id && o.status === "pendente");
        return { id, state: s?.state ?? "ativo", ...(mestre && oferta ? { pendingTo: oferta.para } : {}), ...(mestre && s?.previousOwner ? { previousOwner: s.previousOwner } : {}), ...(semJogador.includes(id) ? { ownerLeft: true } : {}) };
      }) };
    },
    agir: async ({ campaignId, ids, acao, operacao, revisoes = {}, destino }) => {
      const x = indisponivel(); if (x) return x;
      const mestre = mestreDe(campaignId) === uid;
      if (!membro(campaignId, uid) || (acao !== "renunciar" && !mestre)) return falha("sem_permissao");
      const unicos = [...new Set(ids)];
      // tudo ou nada: confere todos antes de alterar qualquer um
      for (const id of unicos) {
        if (estado().operacoes.includes(`${id}:${operacao}`)) continue;
        const f = banco.fichas.find(y => y.id === id && y.campaignId === campaignId), n = nota(id);
        if (!f && !(n && n.campaignId === campaignId && n.kind === "character")) return falha("personagem_indisponivel");
        if (acao === "renunciar" && (!f || f.ownerId !== uid || estado().situacoes[id] || mestre)) return falha("sem_permissao");
        if (!f && acao !== "excluir" && acao !== "cancelar-transferencia") return falha("sem_ficha");
        if (f && (acao === "renunciar" || acao === "compendio" || acao === "excluir") && revisoes[id] !== f.revision) return falha("conflito_de_revisao");
        if (acao === "transferir" && (!destino || destino === f!.ownerId || !membro(campaignId, destino))) return falha("destino_invalido");
      }
      for (const id of unicos) {
        if (estado().operacoes.includes(`${id}:${operacao}`)) continue;
        aplicar(campaignId, id, acao, destino); estado().operacoes.push(`${id}:${operacao}`);
      }
      avisar(); return { ok: true, data: true };
    },
    ofertas: async campaignId => {
      const x = indisponivel(); if (x) return x;
      return { ok: true, data: estado().ofertas.filter(o => o.campaignId === campaignId && o.para === uid && o.status === "pendente").map(o => ({ id: o.id, characterId: o.characterId, title: nota(o.characterId)?.title ?? "Personagem", createdAt: o.criadaEm })) };
    },
    responder: async (oferta, aceitar) => {
      const x = indisponivel(); if (x) return x;
      const o = estado().ofertas.find(y => y.id === oferta);
      if (!o || o.para !== uid || !membro(o.campaignId, uid)) return falha("oferta_indisponivel");
      if (o.status === (aceitar ? "aceita" : "recusada")) return { ok: true, data: true };
      if (o.status !== "pendente" || !banco.fichas.some(f => f.id === o.characterId)) return falha("oferta_indisponivel");
      o.status = aceitar ? "aceita" : "recusada";
      if (aceitar) { trocarDono(o.characterId, uid); delete estado().situacoes[o.characterId]; }
      registrarAviso(o.campaignId, mestreDe(o.campaignId)!, o.characterId, aceitar ? "oferta-aceita" : "oferta-recusada", nota(o.characterId)?.title ?? "Personagem");
      avisar(); return { ok: true, data: true };
    },
    avisos: async campaignId => {
      const x = indisponivel(); if (x) return x;
      return { ok: true, data: estado().avisos.filter(a => a.campaignId === campaignId && a.para === uid && membro(campaignId, uid)).map(({ campaignId: _c, para: _p, ...a }) => ({ ...a })).reverse() };
    },
    lerAvisos: async ids => {
      const x = indisponivel(); if (x) return x;
      estado().avisos.forEach(a => { if (a.para === uid && ids.includes(a.id) && !a.readAt) a.readAt = new Date().toISOString(); });
      return { ok: true, data: true };
    },
  };
}
