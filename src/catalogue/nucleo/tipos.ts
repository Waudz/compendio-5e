/** Núcleo do catálogo: tipos independentes de sistema de RPG e de React. Um SISTEMA (ex.: D&D 5e 2014) registra CATEGORIAS (itens, magias, monstros...);
 * cada categoria declara como carregar os dados, o que é pesquisável, quais filtros e ordenações oferece. A interface só conhece estes tipos,
 * então outro sistema entra registrando um `SistemaDef`, sem mexer no Compêndio.
 */
export type Opcao = { valor: string; rotulo: string };

export type FiltroSelecao<T> = {
  id: string; rotulo: string; tipo: 'selecao'; opcoes: readonly Opcao[];
  /** Valor(es) do item para este filtro (string ou lista); null/undefined = não se aplica. */
  extrair: (item: T) => string | readonly string[] | null | undefined;
};
export type FiltroBooleano<T> = { id: string; rotulo: string; tipo: 'booleano'; extrair: (item: T) => boolean };
export type DefFiltro<T> = FiltroSelecao<T> | FiltroBooleano<T>;

export type Ordenacao<T> = { id: string; rotulo: string; comparar: (a: T, b: T) => number };

export type CategoriaDef<T> = {
  id: string;
  rotulo: string;          // plural, ex.: "Magias"
  rotuloItem: string;      // singular, ex.: "Magia"
  /** Carrega os dados da categoria (pode ser um `import()` dinâmico: vira um pedaço separado do pacote, baixado só quando a categoria é aberta). */
  carregar: () => Promise<readonly T[]>;
  /** Dados já em memória (sem rede): a categoria é indexada de forma SÍNCRONA, sem estado de carregamento. */
  dadosEmMemoria?: () => readonly T[];
  idDe: (item: T) => string;
  nomeDe: (item: T) => string;
  /** Outros nomes pesquisáveis (ex.: nome original em inglês). */
  nomesAlternativos?: (item: T) => readonly string[];
  /** Linha curta exibida no cartão (ex.: "3º círculo · Evocação"). */
  subtituloDe: (item: T) => string;
  /** Resumo de uma linha mostrado no cartão em grade (ex.: "1 ação · 45 m"). */
  resumoDe?: (item: T) => string;
  /** Texto do corpo, usado só na pesquisa (peso menor que os nomes). */
  corpoDe?: (item: T) => string;
  filtros: readonly DefFiltro<T>[];
  ordenacoes: readonly Ordenacao<T>[];
};

export type SistemaDef = {
  id: string;
  nome: string;
  fonte: { titulo: string; licenca: string; atribuicao: string };
  categorias: readonly CategoriaDef<never>[];
};
