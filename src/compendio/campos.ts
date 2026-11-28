/** Campos narrativos opcionais (só o nome é obrigatório). Vínculos entre registros usam IDs na tabela de relações. */
import type { CodexCategoria } from './conhecimento';

export type Campo = { id: string; label: string; long?: boolean; opcoes?: readonly string[] };
export const TIPOS_DESCOBERTA = ['Item', 'Mapa', 'Documento', 'Informação', 'Outra'] as const;
const historia: Campo = { id: 'history', label: 'História', long: true };
const descoberta: Campo[] = [
  { id: 'nickname', label: 'Nome provisório' },
  { id: 'provisional', label: 'Descrição provisória', long: true },
  { id: 'type', label: 'Tipo de descoberta', opcoes: TIPOS_DESCOBERTA },
  { id: 'origin', label: 'Origem' },
  { id: 'context', label: 'Contexto', long: true },
  { id: 'purpose', label: 'Finalidade', long: true },
  historia,
];
export const CAMPOS: Record<CodexCategoria, Campo[]> = {
  npc: [
    { id: 'nickname', label: 'Alcunha' }, { id: 'race', label: 'Raça' }, { id: 'age', label: 'Idade' }, { id: 'classLevel', label: 'Classe e nível' },
    { id: 'occupation', label: 'Ocupação' }, { id: 'birthplace', label: 'Naturalidade' }, { id: 'residence', label: 'Residência' }, historia,
    { id: 'personality', label: 'Personalidade', long: true }, { id: 'relationships', label: 'Observações sobre relações', long: true },
  ],
  // `map` (referência em texto) saiu da interface; valores antigos continuam guardados no registro.
  location: [
    { id: 'nickname', label: 'Nome alternativo' }, { id: 'type', label: 'Tipo' }, { id: 'region', label: 'Região' },
    { id: 'inhabitants', label: 'Sobre os habitantes', long: true }, historia,
  ],
  organization: [
    { id: 'nickname', label: 'Sigla ou alcunha' }, { id: 'type', label: 'Tipo' }, { id: 'leadership', label: 'Liderança' },
    { id: 'headquarters', label: 'Sede' }, { id: 'memberCount', label: 'Quantidade de membros' },
    historia, { id: 'objectives', label: 'Objetivos', long: true },
  ],
  discovery: descoberta,
  item: descoberta,
  // Bestiário é somente narrativo: estatísticas ficam na ficha técnica, que o jogador não recebe.
  monster: [
    { id: 'nickname', label: 'Alcunha' }, { id: 'classification', label: 'Classificação narrativa' },
    { id: 'appearance', label: 'Aparência', long: true }, { id: 'habitat', label: 'Habitat', long: true },
    { id: 'behavior', label: 'Comportamento', long: true }, { id: 'diet', label: 'Alimentação', long: true },
    { id: 'capabilities', label: 'Capacidades conhecidas', long: true }, { id: 'weaknesses', label: 'Fraquezas', long: true },
    { id: 'defenses', label: 'Resistências e imunidades', long: true }, { id: 'strategies', label: 'Estratégias conhecidas', long: true },
    { id: 'sightings', label: 'Onde foi avistada', long: true }, historia,
  ],
};
/** Filtro da categoria Descobertas, a partir apenas do que a projeção autorizada trouxe. */
export const FILTROS_DESCOBERTA = ['Todos', 'Itens', 'Mapas', 'Documentos', 'Informações', 'Outras'] as const;
export function filtroDaDescoberta(categoria: string, tipo?: string): string {
  const porTipo: Record<string, string> = { Item: 'Itens', Mapa: 'Mapas', Documento: 'Documentos', 'Informação': 'Informações', Outra: 'Outras' };
  return (tipo && porTipo[tipo]) || (categoria === 'item' ? 'Itens' : 'Outras');
}
