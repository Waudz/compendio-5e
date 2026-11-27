/** Definição que um registro ou página do Compêndio referencia. A fonte é sempre a definição: o registro guarda só o ID.
 *  A campanha pode substituir uma definição do catálogo (mesmo ID) ou criar a sua (`custom-…`); o catálogo global não muda. */
import { useEffect, useState } from 'react';
import { useCampaigns } from '../CampaignsContext';
import { monstroSchema, type Monstro } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { itemSchema, type SrdItem } from '../catalogue/item-schema';
import { srdItemPadrao } from '../catalogue/srd-2014-items';
import { secoesDoItem, secoesDoMonstro, type Secao } from './ficha';
import { EVENTO_CODEX, useCodexApi } from './conhecimento';

export type TipoDefinicao = 'monster' | 'item';
export type DadosDefinicao = { definition: unknown; descricao?: string };
export type LinhaDefinicao = { kind: TipoDefinicao; definitionId: string; baseId?: string; version: number; data: DadosDefinicao;
  /** Item não identificado (aparência apenas); `identifiesAs` chega somente ao mestre. */ mask?: boolean; identifiesAs?: string };

export type Definicao = { id: string; nome: string; /** Presente quando a campanha substituiu ou criou a definição. */ campanha?: LinhaDefinicao } & (
  | { kind: 'monster'; monstro: Monstro }
  | { kind: 'item'; item: SrdItem; descricao?: string });

export const ehCriacao = (id: string) => id.startsWith('custom-');
export const novoIdPersonalizado = () => 'custom-' + crypto.randomUUID();

/** Dados fora do formato atual são ignorados (volta o padrão), nunca "consertados". */
export function daCampanha(linha: LinhaDefinicao): Definicao | undefined {
  if (linha.kind === 'monster') {
    const r = monstroSchema.safeParse(linha.data.definition);
    return r.success ? { kind: 'monster', id: linha.definitionId, nome: r.data.nome, monstro: r.data, campanha: linha } : undefined;
  }
  const r = itemSchema.safeParse(linha.data.definition);
  return r.success ? { kind: 'item', id: linha.definitionId, nome: r.data.nome, item: r.data, descricao: linha.data.descricao, campanha: linha } : undefined;
}

export const secoesDaDefinicao = (d: Definicao): Secao[] => (d.kind === 'monster' ? secoesDoMonstro(d.monstro) : secoesDoItem(d.item, d.descricao));

export async function definicaoPadrao(kind: TipoDefinicao, id: string): Promise<Definicao | undefined> {
  if (kind === 'item') {
    const item = srdItemPadrao(id);
    return item && { kind: 'item', id: item.id, nome: item.nome, item };
  }
  const monstro = (await (await import('../catalogue/contratos')).monstrosPadrao()).find(m => m.id === id);
  return monstro && { kind: 'monster', id, nome: monstro.nome, monstro };
}

export async function carregarDefinicao(kind: TipoDefinicao, id: string, daMesa: readonly LinhaDefinicao[] = []): Promise<Definicao | undefined> {
  const linha = daMesa.find(d => d.kind === kind && d.definitionId === id);
  return (linha && daCampanha(linha)) || definicaoPadrao(kind, id);
}

const VAZIO: LinhaDefinicao[] = [];
/** Definições que o servidor autoriza ao usuário (todas ao mestre; ao jogador, o que possuiu ou foi identificado).
 *  Sem a migração, o catálogo padrão continua funcionando. */
export function useDefinicoes() {
  const api = useCodexApi(), { active } = useCampaigns();
  const cid = active?.campaign.id, escopo = `${cid}:${active?.role}`;
  const [versao, setVersao] = useState(0);
  const [state, setState] = useState<{ cid: string; lista: LinhaDefinicao[]; erro?: boolean }>();
  useEffect(() => {
    const f = () => setVersao(v => v + 1);
    window.addEventListener(EVENTO_CODEX, f);
    window.addEventListener('focus', f);
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') f(); }, 30000);
    return () => { window.clearInterval(timer); window.removeEventListener(EVENTO_CODEX, f); window.removeEventListener('focus', f); };
  }, []);
  useEffect(() => {
    let vivo = true;
    if (api?.definitions && cid) void api.definitions(cid).then(
      lista => { if (vivo) setState({ cid: escopo, lista }); },
      () => { if (vivo) setState(anterior => ({ cid: escopo, lista: anterior?.cid === escopo ? anterior.lista : [], erro: true })); });
    return () => { vivo = false; };
  }, [api, escopo, versao]);
  const atual = cid && state?.cid === escopo ? state : undefined;
  return { lista: atual?.lista ?? VAZIO, carregando: !!api?.definitions && !!cid && !atual, indisponivel: !!atual?.erro };
}

export function useDefinicao(category: string, id: string | undefined, systemId = 'dnd5e-2014'): Definicao | undefined {
  const { lista, carregando } = useDefinicoes();
  const chave = (category === 'monster' || category === 'item') && id && systemId === 'dnd5e-2014' ? `${category}:${id}` : '';
  const [carregada, setCarregada] = useState<{ chave: string; definicao?: Definicao }>();
  useEffect(() => {
    let vivo = true;
    if (chave && !carregando) void carregarDefinicao(category as TipoDefinicao, id!, lista).then(definicao => { if (vivo) setCarregada({ chave, definicao }); }, () => {});
    return () => { vivo = false; };
  }, [chave, lista, carregando]);
  return chave && carregada?.chave === chave ? carregada.definicao : undefined;
}

/** Lista do catálogo como a campanha a vê: substituições no lugar das originais e criações ao final. */
export function aplicarDaCampanha<T extends { id: string }>(kind: TipoDefinicao, padrao: readonly T[], daMesa: readonly LinhaDefinicao[]): T[] {
  // Itens não identificados não são entradas de catálogo.
  const minhas = daMesa.filter(d => d.kind === kind && !d.mask && !d.definitionId.startsWith('custom-npc-')).flatMap(d => { const x = daCampanha(d); return x ? [(x.kind === 'item' ? x.item : x.monstro) as unknown as T] : []; });
  const porId = new Map(minhas.map(x => [x.id, x]));
  return [...padrao.map(x => porId.get(x.id) ?? x), ...minhas.filter(x => !padrao.some(p => p.id === x.id))];
}
