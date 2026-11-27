/** Relações tipadas. Cada par é gravado uma única vez; `a` é lido na página de origem e `b` na página de destino. */
export const RELACOES = [
  { kind: 'member', a: 'Membro de', b: 'Possui membro' },
  { kind: 'leader', a: 'Líder de', b: 'Liderado por' },
  { kind: 'founder', a: 'Fundador de', b: 'Fundado por' },
  { kind: 'owner', a: 'Proprietário de', b: 'Propriedade de' },
  { kind: 'former-owner', a: 'Antigo proprietário de', b: 'Antigo proprietário' },
  { kind: 'headquarters', a: 'Sede de', b: 'Sede' },
  { kind: 'located', a: 'Localizado em', b: 'Contém' },
  { kind: 'resident', a: 'Habita', b: 'Habitante' },
  { kind: 'represents', a: 'Representa', b: 'Descoberto como' },
  { kind: 'opens', a: 'Abre passagem para', b: 'Passagem aberta por' },
  { kind: 'originates', a: 'Originado em', b: 'Origem de' },
  { kind: 'related', a: 'Relacionado', b: 'Relacionado' },
] as const;
export const PERSONALIZADA = 'custom';

export const OPCOES_RELACAO: { valor: string; rotulo: string }[] = RELACOES.flatMap(r => [
  { valor: r.kind + ':a', rotulo: r.a },
  ...(r.a === r.b ? [] : [{ valor: r.kind + ':b', rotulo: r.b }]),
]);

/** `valor` descreve a página atual em relação à escolhida. A leitura inversa troca origem e destino para não duplicar. */
export function montarRelacao(valor: string, atual: string, alvo: string, personalizada: { ida: string; volta: string }) {
  if (valor === PERSONALIZADA) {
    const ida = personalizada.ida.trim(), volta = personalizada.volta.trim() || ida;
    return ida ? { source: atual, target: alvo, kind: PERSONALIZADA, label: ida, inverse: volta } : null;
  }
  const [kind, lado] = valor.split(':');
  const r = RELACOES.find(x => x.kind === kind);
  if (!r) return null;
  return lado === 'b' ? { source: alvo, target: atual, kind, label: r.a, inverse: r.b } : { source: atual, target: alvo, kind, label: r.a, inverse: r.b };
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
