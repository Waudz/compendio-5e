/** Relações tipadas. Cada par é gravado uma única vez; `a` é lido na página de origem e `b` na página de destino. */
export const RELACOES = [
  { kind: 'member', a: 'Membro de', b: 'Possui membro' },
  { kind: 'leader', a: 'Líder de', b: 'Liderado por' },
  { kind: 'founder', a: 'Fundador de', b: 'Fundado por' },
  { kind: 'owner', a: 'Proprietário de', b: 'Propriedade de' },
  { kind: 'former-owner', a: 'Antigo proprietário de', b: 'Antigo proprietário' },
  { kind: 'headquarters', a: 'Sede de', b: 'Possui sede em' },
  { kind: 'located', a: 'Localizado em', b: 'Contém' },
  { kind: 'resident', a: 'Reside em', b: 'Habitante' },
  { kind: 'represents', a: 'Representa', b: 'Descoberto como' },
  { kind: 'opens', a: 'Abre passagem para', b: 'Passagem aberta por' },
  { kind: 'originates', a: 'Nasceu em', b: 'Natural de' },
  { kind: 'related', a: 'Relacionado', b: 'Relacionado' },
] as const;
export const PERSONALIZADA = 'custom';

export const OPCOES_RELACAO: { valor: string; rotulo: string }[] = RELACOES.flatMap(r => [
  { valor: r.kind + ':a', rotulo: r.a },
  ...(r.a === r.b ? [] : [{ valor: r.kind + ':b', rotulo: r.b }]),
]);

const PESSOAS = ['npc', 'character', 'monster'], COISAS = ['item', 'discovery', 'catalog-item'];
/** Que categorias podem ser origem e destino de cada relação. Fora daqui, a relação não é oferecida. */
const COMPATIVEIS: Record<string, [string[] | null, string[] | null]> = {
  member: [PESSOAS, ['organization']], leader: [PESSOAS, ['organization', 'location']], founder: [PESSOAS, ['organization', 'location']],
  owner: [[...PESSOAS, 'organization'], [...COISAS, 'location']], 'former-owner': [[...PESSOAS, 'organization'], [...COISAS, 'location']],
  headquarters: [['location'], ['organization']], located: [['location', ...COISAS], ['location']], resident: [PESSOAS, ['location']],
  originates: [[...PESSOAS, ...COISAS], ['location']], represents: [COISAS, null], opens: [COISAS, ['location']], related: [null, null],
};
/** Leitura própria quando a origem é um item ou uma descoberta. */
function rotulos(kind: string, a: string, b: string, origem?: string) {
  if (origem && COISAS.includes(origem)) {
    if (kind === 'originates') return { a: 'Originado em', b: 'Origem de' };
    if (kind === 'located' && origem === 'discovery') return { a: 'Descoberta em', b: 'Local da descoberta' };
  }
  return { a, b };
}
const cabe = (lista: string[] | null, categoria?: string) => !lista || !categoria || lista.includes(categoria);
/** Só as relações que fazem sentido entre a página atual e a escolhida (sem destino ainda, todas as da categoria atual). */
export function opcoesDeRelacao(atual?: string, alvo?: string): { valor: string; rotulo: string }[] {
  return RELACOES.flatMap(r => {
    const [origem, destino] = COMPATIVEIS[r.kind];
    const ida = cabe(origem, atual) && cabe(destino, alvo), volta = cabe(destino, atual) && cabe(origem, alvo);
    return [
      ...(ida ? [{ valor: r.kind + ':a', rotulo: rotulos(r.kind, r.a, r.b, atual).a }] : []),
      ...(volta && r.kind !== 'related' ? [{ valor: r.kind + ':b', rotulo: rotulos(r.kind, r.a, r.b, alvo).b }] : []),
    ];
  });
}

/** `valor` descreve a página atual em relação à escolhida. A leitura inversa troca origem e destino para não duplicar. */
export function montarRelacao(valor: string, atual: string, alvo: string, personalizada: { ida: string; volta: string }, categorias: { atual?: string; alvo?: string } = {}) {
  if (valor === PERSONALIZADA) {
    const ida = personalizada.ida.trim(), volta = personalizada.volta.trim() || ida;
    return ida ? { source: atual, target: alvo, kind: PERSONALIZADA, label: ida, inverse: volta } : null;
  }
  const [kind, lado] = valor.split(':');
  const r = RELACOES.find(x => x.kind === kind);
  if (!r) return null;
  const { a, b } = rotulos(r.kind, r.a, r.b, lado === 'b' ? categorias.alvo : categorias.atual);
  return lado === 'b' ? { source: alvo, target: atual, kind, label: a, inverse: b } : { source: atual, target: alvo, kind, label: a, inverse: b };
}

/** Agrupa pela leitura vista na página; "Habitante" abre a lista num local, pois tem seção própria. */
export function agruparVinculos<T extends { relation: string; title: string }>(links: readonly T[]): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const l of links) grupos.set(l.relation, [...(grupos.get(l.relation) ?? []), l]);
  return [...grupos].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([k, v]) => [k, [...v].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))]);
}

export type Vaga = { campo: string; rotulo: string; kind: string; outgoing: boolean };
/** Campos da carta que podem ser preenchidos por um vínculo tipado (`outgoing`: a página atual é a origem). */
export const VAGAS: Record<string, Vaga[]> = {
  npc: [
    { campo: 'birthplace', rotulo: 'Naturalidade', kind: 'originates', outgoing: true },
    { campo: 'residence', rotulo: 'Residência', kind: 'resident', outgoing: true },
  ],
  location: [{ campo: 'inhabitants', rotulo: 'Habitantes', kind: 'resident', outgoing: false }],
  organization: [
    { campo: 'leadership', rotulo: 'Liderança', kind: 'leader', outgoing: false },
    { campo: 'headquarters', rotulo: 'Sede', kind: 'headquarters', outgoing: false },
    { campo: 'members', rotulo: 'Membros', kind: 'member', outgoing: false },
  ],
};
export function separarVinculos<T extends { kind: string; outgoing: boolean }>(categoria: string, links: readonly T[]) {
  const vagas = (VAGAS[categoria] ?? []).map(v => ({ ...v, links: links.filter(l => l.kind === v.kind && l.outgoing === v.outgoing) })).filter(v => v.links.length);
  const usados = new Set(vagas.flatMap(v => v.links));
  return { vagas, demais: links.filter(l => !usados.has(l)) };
}
