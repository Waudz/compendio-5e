// Visão única dos personagens da campanha para quem está olhando: junta, pelo MESMO id, a linha pública/perfil (`notes`) e a ficha privada
// (`character_sheets`). Não cria nem copia registros. Quem pode ler o quê é decidido pelo banco (RLS): `registros.list` só devolve o que o
// usuário lê (publicados e os próprios) e `fichas.listar` só as fichas legíveis (as próprias; todas as da campanha para o mestre).
import type { CapaApi } from "./capa";
import type { Situacao } from "./cicloPersonagem";
import { juntar, separar } from "./imagem/enquadramento";
import type { Res } from "./campaigns";
import { rotuloClasse } from "./criador/rotulos";
import { cartaoPublico, ehGuiado, type FichasApi, type ResumoFicha } from "./fichas";
import { presentation } from "./rules/public-identity";
import type { FonteAventureiros } from "./inicio";
import { lerPerfil } from "./perfilPersonagem";
import type { RegistrosApi } from "./registros";

export type PersonagemCampanha = {
  id: string; ownerId?:string; revisao?:number;
  /** Ciclo de vida: só `ativo` é um aventureiro em jogo. */ situacao: Situacao; /** Visível ao mestre: transferência aguardando aceite. */ pendenteDe?: string; /** Visível ao mestre: o jogador saiu da campanha. */ semJogador?: boolean;
  nome: string; alcunha: string | null; classe: string; nivel: number | null;
  /** Imagem pública (https) de personagem guiado, ou caminho no armazenamento do retrato de um perfil simples. */
  retratoUrl: string | null; retratoCaminho: string | null;
  guiado: boolean;
  /** Quem está olhando pode abrir a ficha (a própria, ou qualquer uma sendo mestre). */
  comFicha: boolean;
  meu: boolean; publicado: boolean;
};
export type ListaPersonagens = { personagens: PersonagemCampanha[]; avisoFichas: string | null; /** O banco permite as ações do ciclo de vida. */ ciclo: boolean };

const nivelPublico = (v: string | null | undefined) => (v && Number.isInteger(Number(v)) ? Number(v) : null);

export async function listarPersonagens(campaignId: string, de: { registros: RegistrosApi; fichas: FichasApi | null; userId: string | null }): Promise<Res<ListaPersonagens>> {
  const [r, f, c] = await Promise.all([de.registros.list(campaignId, "character"), de.fichas ? de.fichas.listar(campaignId) : Promise.resolve(null), de.fichas?.ciclo ? de.fichas.ciclo.situacoes(campaignId) : Promise.resolve(null)]);
  if (!r.ok) return r;
  // sem saber quem saiu de jogo, não se mostra uma lista que pode estar errada
  if (c && !c.ok) return c;
  const situacoes = new Map((c?.data ?? []).map(s => [s.id, s]));
  const doCiclo = (id: string) => { const s = situacoes.get(id); return { situacao: s?.state ?? "ativo" as const, ...(s?.pendingTo ? { pendenteDe: s.pendingTo } : {}), ...(s?.ownerLeft ? { semJogador: true } : {}) }; };
  const fichas = new Map<string, ResumoFicha>((f?.ok ? f.data : []).map(x => [x.id, x]));
  const classeDaFicha = (x: ResumoFicha) => (x.classId ? rotuloClasse(x.classId) : "Aventureiro");
  const saida: PersonagemCampanha[] = r.data.map(nota => {
    const ficha = fichas.get(nota.id); fichas.delete(nota.id);
    const publicado = nota.visibility === "campaign", meu = (ficha?.ownerId ?? nota.ownerId) === de.userId;
    if (ehGuiado(nota.meta)) {
      const c = cartaoPublico(nota.meta);
      // quem lê a ficha vê o personagem como ele é; os demais, só a apresentação (o que o dono não ocultou)
      const visto = ficha ? { nome: ficha.nome, alcunha: ficha.alcunha ?? null } : c ? presentation(c) : { nome: nota.title, alcunha: null };
      return { id: nota.id, ...doCiclo(nota.id), ownerId: ficha?.ownerId??nota.ownerId, revisao:ficha?.revision, nome: visto.nome, alcunha: visto.alcunha, classe: ficha ? classeDaFicha(ficha) : [c?.race, c?.characterClass].filter(Boolean).join(" ") || "Aventureiro", nivel: ficha ? ficha.nivel : nivelPublico(c?.level),
        retratoUrl: (ficha ? ficha.retrato : c?.imageUrl) ?? null, retratoCaminho: null, guiado: true, comFicha: !!ficha, meu, publicado };
    }
    const p = lerPerfil(nota.meta);
    return { id: nota.id, ...doCiclo(nota.id), ownerId: ficha?.ownerId??nota.ownerId, revisao:ficha?.revision, nome: nota.title, alcunha: null, classe: p.classe || "Sem classe", nivel: p.nivel, retratoUrl: null, retratoCaminho: p.retrato, guiado: false, comFicha: false, meu, publicado };
  });
  // fichas legíveis cuja linha pública não é (ex.: mestre diante de identidade privada): aparecem uma única vez, pelos dados da ficha
  for (const x of fichas.values()) saida.push({ id: x.id, ...doCiclo(x.id), ownerId:x.ownerId, revisao:x.revision, nome: x.nome, alcunha: x.alcunha ?? null, classe: classeDaFicha(x), nivel: x.nivel, retratoUrl: x.retrato ?? null, retratoCaminho: null, guiado: true, comFicha: true, meu: x.ownerId === de.userId, publicado: false });
  // quem passou ao mestre pelo ciclo de vida não é um personagem "dele"
  for (const p of saida) if (p.situacao !== "ativo") p.meu = false;
  saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { ok: true, data: { personagens: saida, avisoFichas: f && !f.ok ? f.error : null, ciclo: !!c?.data } };
}

/** Aviso para quem enxerga algo que os outros jogadores não veem, na perspectiva de quem está olhando. */
/** Ninguém ocultou quem ficou sem jogador: o motivo é dito como ele é. */
export const rotuloPrivacidade = (p: PersonagemCampanha, souMestre: boolean) => (p.semJogador ? "jogador saiu da campanha" : p.publicado ? null : souMestre ? "oculto dos jogadores" : p.meu ? "só você e o mestre veem" : "oculto dos jogadores");

/** Aventureiros do Início, sem limite: os publicados para a campanha e os guiados cuja ficha quem olha pode ler (o próprio; todos, para o mestre).
 *  Perfis simples continuam aparecendo só quando marcados como visíveis para a campanha (é o que essa opção significa). */
export function fonteAventureirosDoInicio(registros: RegistrosApi, capa: CapaApi | null, fichas: FichasApi | null, userId: string | null, souMestre = false): FonteAventureiros {
  /** `emJogo`: só os ativos (Início, combate, destino de itens). Sem ele, todos os que o Compêndio preserva. */
  const ler = async (campaignId: string, emJogo: boolean) => {
      const r = await listarPersonagens(campaignId, { registros, fichas, userId });
      if (!r.ok) return r;
      const visiveis = r.data.personagens.filter(p => (!emJogo || p.situacao === "ativo") && (p.publicado || (p.guiado && p.comFicha)));
      const lista = await Promise.all(visiveis.map(async p => {
        let retratoUrl = p.retratoUrl;
        if (!retratoUrl && p.retratoCaminho && capa) { const { base, enquadramento } = separar(p.retratoCaminho), u = await capa.urlDe(base); if (u.ok) retratoUrl = juntar(u.data, enquadramento); }
        const nota = rotuloPrivacidade(p, souMestre);
        return { id: p.id, nome: p.nome, ...(p.situacao !== "ativo" ? { situacao: p.situacao } : {}), ...(p.meu ? { meu: true } : {}), ...(p.alcunha ? { alcunha: p.alcunha } : {}), classe: p.classe, nivel: p.nivel, retratoUrl, ...(nota ? { nota } : {}) };
      }));
      return { ok: true as const, data: lista };
  };
  return { listar: campaignId => ler(campaignId, true), listarTodos: campaignId => ler(campaignId, false) };
}
