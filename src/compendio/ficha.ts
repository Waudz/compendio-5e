/** Seções reveláveis herdadas da definição (monstro ou item). A definição continua sendo a fonte: as seções são
 *  recalculadas dela e enviadas ao servidor apenas para que ele entregue ao jogador só as que foram reveladas. */
import type { Monstro } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { formatarDeslocamento, formatarModificador, formatarND, formatarPontosDeVida, formatarSentidos, formatarXP, modificadorDe } from '../catalogue/sistemas/dnd5e-2014/formatar';
import { rotuloGrupoAcao, rotuloPericia, rotuloTamanho, rotuloTipoCriatura, siglaAtributo } from '../catalogue/sistemas/dnd5e-2014/rotulos';
import { itemFacts, srdItem } from '../catalogue/srd-2014-items';
import type { SrdItem } from '../catalogue/item-schema';

export type Secao = { k: string; l: string; v: string };
const LIMITE = 6000;
const secao = (k: string, l: string, v: string | undefined): Secao[] => (v ? [{ k, l, v: v.length > LIMITE ? v.slice(0, LIMITE - 1) + '…' : v }] : []);
const textos = (xs: Monstro['tracos']) => xs.map(x => `${x.n}. ${x.t}`).join('\n\n');

export function secoesDoMonstro(m: Monstro): Secao[] {
  const bonus = (r: Record<string, number> | undefined, nome: (id: string) => string) =>
    Object.entries(r ?? {}).map(([a, v]) => `${nome(a)} ${formatarModificador(v)}`).join(', ');
  const grupo = (g: NonNullable<Monstro['acoes'][number]['grupo']>) => m.acoes.filter(a => (a.grupo ?? 'ACTION') === g);
  return [
    ...secao('kind', 'Tipo e tamanho', `${rotuloTipoCriatura(m.tipo)} ${rotuloTamanho(m.tamanho).toLocaleLowerCase('pt-BR')}${m.tendencia ? ', ' + m.tendencia.toLocaleLowerCase('pt-BR') : ''}`),
    ...secao('ac', 'Classe de Armadura', `${m.ca}${m.caDetalhe ? ` (${m.caDetalhe})` : ''}`),
    ...secao('hp', 'Pontos de vida', formatarPontosDeVida(m)),
    ...secao('speed', 'Deslocamento', formatarDeslocamento(m.deslocamento, m.planar)),
    ...secao('challenge', 'Nível de desafio', `${formatarND(m.nd)} (${formatarXP(m.xp)} XP)`),
    ...secao('abilities', 'Atributos', (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(a => `${siglaAtributo(a)} ${m.atributos[a]} (${formatarModificador(modificadorDe(m.atributos[a]))})`).join(' · ')),
    ...secao('saves', 'Testes de resistência', bonus(m.salvaguardas as Record<string, number> | undefined, siglaAtributo)),
    ...secao('skills', 'Perícias', bonus(m.pericias, rotuloPericia)),
    ...secao('vulnerabilities', 'Vulnerabilidades', m.defesas.vulnerabilidadesTexto),
    ...secao('resistances', 'Resistências', m.defesas.resistenciasTexto),
    ...secao('immunities', 'Imunidades a dano', m.defesas.imunidadesTexto),
    ...secao('conditions', 'Imunidades a condições', m.defesas.condicoesTexto),
    ...secao('senses', 'Sentidos', formatarSentidos(m)),
    ...secao('languages', 'Idiomas', m.idiomas),
    ...secao('traits', 'Características', textos(m.tracos)),
    ...(['ACTION', 'BONUS_ACTION', 'REACTION', 'LEGENDARY_ACTION', 'LAIR_ACTION'] as const).flatMap(g =>
      secao(g.toLowerCase().replaceAll('_', '-'), rotuloGrupoAcao(g), textos(grupo(g)))),
  ];
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** `descricao` é o texto livre de um item personalizado. O resumo dos itens do SRD é derivado dos próprios campos e por isso
 *  não vira seção (revelaria dano ou categoria junto). */
export function secoesDoItem(item: SrdItem, descricao?: string): Secao[] {
  return [
    ...itemFacts(item).flatMap(([l, v]) => secao(slug(l), l, v)),
    ...(item.sintonia ? secao('attunement', 'Sintonização', 'Requer sintonização') : []),
    ...(item.pacote ? secao('contents', 'Conteúdo do pacote', item.pacote.map(c => `${c.qtd} × ${srdItem(c.id)?.nome ?? c.id}`).join('\n')) : []),
    ...secao('effects', 'Descrição e efeitos', descricao),
  ];
}

export const mesmasSecoes = (a: readonly Secao[] = [], b: readonly Secao[] = []) =>
  a.length === b.length && a.every((s, i) => s.k === b[i].k && s.l === b[i].l && s.v === b[i].v);
