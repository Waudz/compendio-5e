/** Categorias de D&D 5e 2014 no catálogo: itens, magias e monstros. Magias e monstros são pedaços separados do pacote (`import()` dinâmico), baixados só quando
 * a categoria é aberta. Os dados vêm de `scripts/catalogo/*` e são validados por inteiro nos testes (esquemas Zod, hash e conferência com a SRD API).
 */
import { categoriasDeItem, raridades, type SrdItem } from '../../item-schema';
import { categoriaDoItemRotulo, describeItem, raridadeRotulo, srdItemFile } from '../../srd-2014-items';
import type { CategoriaDef, Opcao } from '../../nucleo/tipos';
import type { ArquivoMagias, ArquivoMonstros, Magia, Monstro } from './esquemas';
import { classesConjuradoras, escolas, tamanhos, tiposDeCriatura } from './esquemas';
import { formatarAlcance, formatarCirculo, formatarND, formatarTempo } from './formatar';
import { rotuloAmbiente, rotuloClasse, rotuloEscola, rotuloTamanho, rotuloTipoCriatura } from './rotulos';

const opcoes = (valores: readonly string[], rotulo: (v: string) => string): Opcao[] => valores.map(valor => ({ valor, rotulo: rotulo(valor) }));
const porNome = <T,>(nome: (x: T) => string) => (a: T, b: T) => nome(a).localeCompare(nome(b), 'pt-BR');

/** Conferência barata no carregamento (a validação completa roda nos testes). */
function conferir<T extends { categoria: string; itens: unknown[]; count: number; schemaVersion: number }>(arq: T, categoria: string): T {
  if (arq.schemaVersion !== 1 || arq.categoria !== categoria || arq.count !== arq.itens.length) throw new Error(`Dados de ${categoria} inválidos ou de versão desconhecida.`);
  return arq;
}

// ------------------------------------------------------------------------------------------------ itens
const propriedadesArma = ['light', 'finesse', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'heavy', 'reach', 'special'];
const rotuloPropriedadeArma: Record<string, string> = { light: 'Leve', finesse: 'Acuidade', thrown: 'Arremesso', 'two-handed': 'Duas mãos', versatile: 'Versátil', ammunition: 'Munição', loading: 'Recarga', heavy: 'Pesada', reach: 'Alcance', special: 'Especial' };
export const categoriaItens: CategoriaDef<SrdItem> = {
  id: 'itens', rotulo: 'Itens', rotuloItem: 'Item',
  carregar: async () => srdItemFile().items, dadosEmMemoria: () => srdItemFile().items,
  resumoDe: i => [i.custo ? `${i.custo.v} ${({ cp: 'pc', sp: 'pp', gp: 'po' } as const)[i.custo.u]}` : '', i.peso != null ? `${i.peso} kg` : ''].filter(Boolean).join(' · '),
  idDe: i => i.id, nomeDe: i => i.nome, nomesAlternativos: i => [i.en, ...(i.alias ?? [])],
  subtituloDe: i => `${categoriaDoItemRotulo(i.categoria)}${i.raridade !== 'mundano' ? ` · ${raridadeRotulo(i.raridade)}` : ''}`,
  corpoDe: i => describeItem(i),
  filtros: [
    { id: 'categoria', rotulo: 'Categoria', tipo: 'selecao', opcoes: opcoes(categoriasDeItem, v => categoriaDoItemRotulo(v as SrdItem['categoria'])), extrair: i => i.categoria },
    { id: 'raridade', rotulo: 'Raridade', tipo: 'selecao', opcoes: opcoes(raridades, v => raridadeRotulo(v as SrdItem['raridade'])), extrair: i => i.raridade },
    { id: 'arma-tipo', rotulo: 'Tipo de arma', tipo: 'selecao', opcoes: [{ valor: 'simple-melee', rotulo: 'Simples, corpo a corpo' }, { valor: 'simple-ranged', rotulo: 'Simples, à distância' }, { valor: 'martial-melee', rotulo: 'Marcial, corpo a corpo' }, { valor: 'martial-ranged', rotulo: 'Marcial, à distância' }], extrair: i => i.arma ? `${i.arma.categoria}-${i.arma.alcance}` : null },
    { id: 'arma-propriedade', rotulo: 'Propriedade de arma', tipo: 'selecao', opcoes: opcoes(propriedadesArma, v => rotuloPropriedadeArma[v] ?? v), extrair: i => i.arma?.propriedades ?? null },
    { id: 'armadura-tipo', rotulo: 'Tipo de armadura', tipo: 'selecao', opcoes: [{ valor: 'light', rotulo: 'Leve' }, { valor: 'medium', rotulo: 'Média' }, { valor: 'heavy', rotulo: 'Pesada' }, { valor: 'shield', rotulo: 'Escudo' }], extrair: i => i.armadura?.categoria ?? null },
    { id: 'sintonia', rotulo: 'Requer sintonização', tipo: 'booleano', extrair: i => i.sintonia === true },
  ],
  ordenacoes: [{ id: 'nome', rotulo: 'Nome', comparar: porNome<SrdItem>(i => i.nome) }, { id: 'categoria', rotulo: 'Categoria', comparar: (a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome, 'pt-BR') }],
};

// ------------------------------------------------------------------------------------------------ magias
const niveisMagia = Array.from({ length: 10 }, (_, i) => String(i));
const alcanceTipo = (m: Magia) => (m.alcance.tipo === 'distance' ? 'distancia' : m.alcance.tipo === 'self' ? 'pessoal' : m.alcance.tipo === 'touch' ? 'toque' : m.alcance.tipo === 'sight' ? 'visao' : 'outro');
const duracaoTipo = (m: Magia) => (m.concentracao ? 'concentracao' : m.duracao.tipo === 'instant' ? 'instantanea' : m.duracao.tipo === 'timed' ? 'tempo' : m.duracao.tipo === 'until-dispelled' ? 'dissipada' : 'outra');
export const categoriaMagias: CategoriaDef<Magia> = {
  id: 'magias', rotulo: 'Magias', rotuloItem: 'Magia',
  carregar: async () => conferir((await import('./data/magias.json')).default as unknown as ArquivoMagias, 'magias').itens,
  idDe: m => m.id, nomeDe: m => m.nome, nomesAlternativos: m => [m.en],
  resumoDe: m => `${formatarTempo(m.tempo)} · ${formatarAlcance(m.alcance)}`,
  subtituloDe: m => `${formatarCirculo(m.nivel)} · ${rotuloEscola(m.escola)}${m.ritual ? ' · Ritual' : ''}${m.concentracao ? ' · Concentração' : ''}`,
  corpoDe: m => `${m.descricao.join(' ')} ${m.superiores ?? ''} ${m.material ?? ''} ${m.classes.map(rotuloClasse).join(' ')}`,
  filtros: [
    { id: 'nivel', rotulo: 'Círculo', tipo: 'selecao', opcoes: opcoes(niveisMagia, v => formatarCirculo(Number(v))), extrair: m => String(m.nivel) },
    { id: 'escola', rotulo: 'Escola', tipo: 'selecao', opcoes: opcoes(escolas, rotuloEscola), extrair: m => m.escola },
    { id: 'classe', rotulo: 'Classe', tipo: 'selecao', opcoes: opcoes(classesConjuradoras, rotuloClasse), extrair: m => m.classes },
    { id: 'tempo', rotulo: 'Tempo de conjuração', tipo: 'selecao', opcoes: [{ valor: 'action', rotulo: 'Ação' }, { valor: 'bonus-action', rotulo: 'Ação bônus' }, { valor: 'reaction', rotulo: 'Reação' }, { valor: 'minute', rotulo: 'Minutos' }, { valor: 'hour', rotulo: 'Horas' }], extrair: m => m.tempo.tipo },
    { id: 'alcance', rotulo: 'Alcance', tipo: 'selecao', opcoes: [{ valor: 'pessoal', rotulo: 'Pessoal' }, { valor: 'toque', rotulo: 'Toque' }, { valor: 'distancia', rotulo: 'À distância' }, { valor: 'visao', rotulo: 'Linha de visão' }, { valor: 'outro', rotulo: 'Ilimitado ou especial' }], extrair: alcanceTipo },
    { id: 'duracao', rotulo: 'Duração', tipo: 'selecao', opcoes: [{ valor: 'instantanea', rotulo: 'Instantânea' }, { valor: 'concentracao', rotulo: 'Concentração' }, { valor: 'tempo', rotulo: 'Com duração (sem concentração)' }, { valor: 'dissipada', rotulo: 'Até ser dissipada' }, { valor: 'outra', rotulo: 'Especial' }], extrair: duracaoTipo },
    { id: 'ritual', rotulo: 'Ritual', tipo: 'booleano', extrair: m => m.ritual },
    { id: 'concentracao', rotulo: 'Concentração', tipo: 'booleano', extrair: m => m.concentracao },
    { id: 'material', rotulo: 'Exige componente material', tipo: 'booleano', extrair: m => m.componentes.m },
    { id: 'dano', rotulo: 'Causa dano', tipo: 'booleano', extrair: m => (m.dano?.length ?? 0) > 0 },
  ],
  ordenacoes: [
    { id: 'nome', rotulo: 'Nome', comparar: porNome<Magia>(m => m.nome) },
    { id: 'nivel', rotulo: 'Círculo', comparar: (a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt-BR') },
  ],
};

// ------------------------------------------------------------------------------------------------ monstros
const faixaND = (nd: number) => (nd === 0 ? 'nd0' : nd <= 0.5 ? 'nd-fracao' : nd <= 4 ? 'nd1-4' : nd <= 10 ? 'nd5-10' : nd <= 16 ? 'nd11-16' : 'nd17+');
const ambientesSRD = ['arctic', 'caves', 'coast', 'desert', 'forest', 'grassland', 'hills', 'lake', 'mountain', 'ocean', 'ruins', 'sewer', 'swamp', 'temple', 'underworld', 'urban', 'plane-of-air', 'plane-of-earth', 'plane-of-fire', 'plane-of-water', 'astral-plane', 'ethereal-plane', 'feywild', 'shadowfell', 'abyss', 'hell', 'elysium'];
export const categoriaMonstros: CategoriaDef<Monstro> = {
  id: 'monstros', rotulo: 'Monstros', rotuloItem: 'Monstro',
  carregar: async () => conferir((await import('./data/monstros.json')).default as unknown as ArquivoMonstros, 'monstros').itens,
  idDe: m => m.id, nomeDe: m => m.nome, nomesAlternativos: m => [m.en],
  resumoDe: m => `CA ${m.ca} · PV ${m.pv}`,
  subtituloDe: m => `${rotuloTipoCriatura(m.tipo)} ${rotuloTamanho(m.tamanho).toLocaleLowerCase('pt-BR')} · ND ${formatarND(m.nd)}`,
  corpoDe: m => `${m.tendencia} ${m.idiomas} ${[...m.tracos, ...m.acoes].map(t => `${t.n} ${t.t}`).join(' ')}`,
  filtros: [
    { id: 'nd', rotulo: 'Nível de desafio', tipo: 'selecao', opcoes: [{ valor: 'nd0', rotulo: 'ND 0' }, { valor: 'nd-fracao', rotulo: 'ND 1/8 a 1/2' }, { valor: 'nd1-4', rotulo: 'ND 1 a 4' }, { valor: 'nd5-10', rotulo: 'ND 5 a 10' }, { valor: 'nd11-16', rotulo: 'ND 11 a 16' }, { valor: 'nd17+', rotulo: 'ND 17 ou mais' }], extrair: m => faixaND(m.nd) },
    { id: 'tipo', rotulo: 'Tipo', tipo: 'selecao', opcoes: opcoes(tiposDeCriatura, rotuloTipoCriatura), extrair: m => m.tipo },
    { id: 'tamanho', rotulo: 'Tamanho', tipo: 'selecao', opcoes: opcoes(tamanhos, rotuloTamanho), extrair: m => m.tamanho },
    { id: 'ambiente', rotulo: 'Ambiente', tipo: 'selecao', opcoes: opcoes(ambientesSRD, rotuloAmbiente), extrair: m => m.ambientes },
    { id: 'deslocamento', rotulo: 'Deslocamento especial', tipo: 'selecao', opcoes: [{ valor: 'fly', rotulo: 'Voo' }, { valor: 'swim', rotulo: 'Natação' }, { valor: 'climb', rotulo: 'Escalada' }, { valor: 'burrow', rotulo: 'Escavação' }], extrair: m => (['fly', 'swim', 'climb', 'burrow'] as const).filter(k => m.deslocamento[k]) },
    { id: 'lendario', rotulo: 'Tem ações lendárias', tipo: 'booleano', extrair: m => m.acoes.some(a => a.grupo === 'LEGENDARY_ACTION') },
    { id: 'conjurador', rotulo: 'Conjurador', tipo: 'booleano', extrair: m => m.tracos.some(t => /spellcasting/i.test(t.en)) },
  ],
  ordenacoes: [
    { id: 'nome', rotulo: 'Nome', comparar: porNome<Monstro>(m => m.nome) },
    { id: 'nd-asc', rotulo: 'Nível de desafio (menor)', comparar: (a, b) => a.nd - b.nd || a.nome.localeCompare(b.nome, 'pt-BR') },
    { id: 'nd-desc', rotulo: 'Nível de desafio (maior)', comparar: (a, b) => b.nd - a.nd || a.nome.localeCompare(b.nome, 'pt-BR') },
    { id: 'pv', rotulo: 'Pontos de vida (maior)', comparar: (a, b) => b.pv - a.pv || a.nome.localeCompare(b.nome, 'pt-BR') },
  ],
};
