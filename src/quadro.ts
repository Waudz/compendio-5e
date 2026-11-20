// Quadro de Planejamento: COLUNAS (faixas lado a lado, com largura) -> SEÇÕES empilhadas (título próprio, normal ou grande) -> CARTÕES.
// Funções puras (sem React, sem rede). O quadro guarda só a ORDEM (ids de cenas); reorganizar nunca altera as páginas originais. Mestre apenas.
export type Secao = { id: string; titulo: string; cartoes: string[]; grande?: boolean };
export type Coluna = { id: string; secoes: Secao[]; largura?: number };
export type Quadro = { colunas: Coluna[] };
export const MAX_COLUNAS = 12, MAX_SECOES = 60, MAX_CARTOES_POR_SECAO = 100;
/** Largura das colunas em pixels: todas as seções e cartões da coluna acompanham. */
export const LARGURA_PADRAO = 300, LARGURA_MIN = 220, LARGURA_MAX = 900;
export const limitarLargura = (w: number) => Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, w)));

let seq = 0;
export const novoId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Lê o quadro de `meta`, descartando o que for inválido (nunca lança). Formato antigo (coluna com título e cartões direto) vira
 * uma coluna com UMA seção de mesmo título e id: nada se perde e o próximo salvamento já grava o formato novo.
 */
export function lerQuadro(meta: unknown): Quadro {
  const cols = (meta as { colunas?: unknown } | null)?.colunas;
  if (!Array.isArray(cols)) return { colunas: [] };
  const vistos = new Set<string>(), ids = new Set<string>();
  const cartoes = (l: unknown): string[] => (Array.isArray(l) ? l : []).filter((x): x is string => typeof x === "string" && !vistos.has(x) && !!vistos.add(x)).slice(0, MAX_CARTOES_POR_SECAO);
  let totalSecoes = 0;
  const colunas = cols.slice(0, MAX_COLUNAS).flatMap((c): Coluna[] => {
    const o = c as { id?: unknown; titulo?: unknown; cartoes?: unknown; secoes?: unknown; largura?: unknown };
    if (!o || typeof o.id !== "string" || ids.has(o.id)) return [];
    ids.add(o.id);
    const largura = typeof o.largura === "number" && Number.isFinite(o.largura) ? limitarLargura(o.largura) : undefined;
    let secoes: Secao[];
    if (Array.isArray(o.secoes)) {
      secoes = o.secoes.flatMap((s): Secao[] => {
        const x = s as Partial<Secao>; if (!x || typeof x.id !== "string" || typeof x.titulo !== "string" || ids.has(x.id) || totalSecoes >= MAX_SECOES) return [];
        ids.add(x.id); totalSecoes++;
        return [{ id: x.id, titulo: x.titulo.slice(0, 80), cartoes: cartoes(x.cartoes), ...(x.grande === true && { grande: true }) }];
      });
    } else if (typeof o.titulo === "string" && Array.isArray(o.cartoes)) {   // formato antigo
      secoes = [{ id: `${o.id}-s`, titulo: o.titulo.slice(0, 80), cartoes: cartoes(o.cartoes) }]; totalSecoes++;
    } else return [];
    return [{ id: o.id, secoes, ...(largura !== undefined && { largura }) }];
  });
  return { colunas };
}

export const todasSecoes = (q: Quadro): Secao[] => q.colunas.flatMap(c => c.secoes);
export const todosCartoes = (q: Quadro): string[] => todasSecoes(q).flatMap(s => s.cartoes);
const achar = (q: Quadro, secaoId: string) => { for (let ci = 0; ci < q.colunas.length; ci++) { const si = q.colunas[ci].secoes.findIndex(s => s.id === secaoId); if (si >= 0) return { ci, si }; } return null; };
export const colunaDaSecao = (q: Quadro, secaoId: string) => { const p = achar(q, secaoId); return p ? q.colunas[p.ci] : null; };
export const secaoDoCartao = (q: Quadro, cartaoId: string) => todasSecoes(q).find(s => s.cartoes.includes(cartaoId)) ?? null;

/** Nome automático ("Seção 3"): nunca repete um nome existente. */
export function proximoNomeSecao(q: Quadro): string {
  const nomes = new Set(todasSecoes(q).map(s => s.titulo));
  for (let n = todasSecoes(q).length + 1; ; n++) if (!nomes.has(`Seção ${n}`)) return `Seção ${n}`;
}
const secaoVazia = (q: Quadro, titulo?: string, id = novoId()): Secao => ({ id, titulo: titulo?.trim() ? titulo.trim().slice(0, 80) : proximoNomeSecao(q), cartoes: [] });
const limpar = (q: Quadro): Quadro => ({ colunas: q.colunas.filter(c => c.secoes.length > 0) });   // coluna sem seções some

/** Nova coluna no fim, já com uma seção vazia. */
export function novaColuna(q: Quadro, titulo?: string, ids: { coluna?: string; secao?: string } = {}): Quadro {
  if (q.colunas.length >= MAX_COLUNAS || todasSecoes(q).length >= MAX_SECOES) return q;
  return { colunas: [...q.colunas, { id: ids.coluna ?? novoId(), secoes: [secaoVazia(q, titulo, ids.secao)] }] };
}
/** Nova seção logo abaixo de `secaoId`, na mesma coluna. */
export function novaSecaoDepois(q: Quadro, secaoId: string, titulo?: string, id?: string): Quadro {
  const p = achar(q, secaoId); if (!p || todasSecoes(q).length >= MAX_SECOES) return q;
  return { colunas: q.colunas.map((c, ci) => ci !== p.ci ? c : { ...c, secoes: [...c.secoes.slice(0, p.si + 1), secaoVazia(q, titulo, id), ...c.secoes.slice(p.si + 1)] }) };
}
const mudarSecao = (q: Quadro, id: string, f: (s: Secao) => Secao): Quadro => ({ colunas: q.colunas.map(c => c.secoes.some(s => s.id === id) ? { ...c, secoes: c.secoes.map(s => s.id === id ? f(s) : s) } : c) });
export const renomearSecao = (q: Quadro, id: string, titulo: string): Quadro => !titulo.trim() ? q : mudarSecao(q, id, s => ({ ...s, titulo: titulo.trim().slice(0, 80) }));
/** Título grande (cena ou lugar importante) / normal. */
export const alternarTituloGrande = (q: Quadro, id: string): Quadro => mudarSecao(q, id, s => { const { grande, ...resto } = s; return grande ? resto : { ...resto, grande: true }; });
/** Só exclui seção vazia: cartões nunca somem por tabela. A coluna que ficar sem seções some junto. */
export const excluirSecao = (q: Quadro, id: string): Quadro => secaoPorId(q, id)?.cartoes.length ? q : limpar({ colunas: q.colunas.map(c => ({ ...c, secoes: c.secoes.filter(s => s.id !== id) })) });
const secaoPorId = (q: Quadro, id: string) => todasSecoes(q).find(s => s.id === id);

export const redimensionarColuna = (q: Quadro, colunaId: string, largura: number): Quadro =>
  Number.isFinite(largura) && q.colunas.some(c => c.id === colunaId) ? { colunas: q.colunas.map(c => c.id === colunaId ? { ...c, largura: limitarLargura(largura) } : c) } : q;

export const adicionarCartao = (q: Quadro, secaoId: string, cartaoId: string): Quadro =>
  todosCartoes(q).includes(cartaoId) ? q : mudarSecao(q, secaoId, s => s.cartoes.length >= MAX_CARTOES_POR_SECAO ? s : { ...s, cartoes: [...s.cartoes, cartaoId] });
export const removerCartao = (q: Quadro, cartaoId: string): Quadro => ({ colunas: q.colunas.map(c => ({ ...c, secoes: c.secoes.map(s => s.cartoes.includes(cartaoId) ? { ...s, cartoes: s.cartoes.filter(x => x !== cartaoId) } : s) })) });
/** Move o cartão para a seção `destino`, na posição `indice` (fim se omitido). */
export function moverCartao(q: Quadro, cartaoId: string, destino: string, indice?: number): Quadro {
  if (!secaoPorId(q, destino) || !todosCartoes(q).includes(cartaoId)) return q;
  const sem = removerCartao(q, cartaoId);
  return mudarSecao(sem, destino, s => { const cs = [...s.cartoes]; cs.splice(indice === undefined ? cs.length : Math.max(0, Math.min(indice, cs.length)), 0, cartaoId); return { ...s, cartoes: cs }; });
}

/**
 * Resultado de arrastar o cartão `ativo` e soltar sobre `alvo`:
 *  - outro cartão: entra na posição dele; "sec:<id>": fim daquela seção;
 *  - "abaixo:<secaoId>": cria uma seção nova logo abaixo, já com o cartão;
 *  - "nova-coluna": cria uma coluna nova no fim, com uma seção que contém o cartão.
 */
export function soltarCartao(q: Quadro, ativo: string, alvo: string | null | undefined, ids: { coluna?: string; secao?: string } = {}): Quadro {
  if (!alvo || alvo === ativo || !todosCartoes(q).includes(ativo)) return q;
  if (alvo === "nova-coluna" || alvo.startsWith("abaixo:")) {
    const novo = alvo === "nova-coluna" ? novaColuna(q, undefined, ids) : novaSecaoDepois(q, alvo.slice(7), undefined, ids.secao);
    if (novo === q) return q;
    const sid = alvo === "nova-coluna" ? novo.colunas[novo.colunas.length - 1].secoes[0].id : (todasSecoes(novo).find(s => !todasSecoes(q).some(o => o.id === s.id)))!.id;
    return limpar(moverCartao(novo, ativo, sid));   // limpa colunas que ficaram sem seção (não ocorre com cartões, mas mantém o invariante)
  }
  if (alvo.startsWith("sec:")) return moverCartao(q, ativo, alvo.slice(4));
  if (alvo.startsWith("secao:")) return moverCartao(q, ativo, alvo.slice(6));
  const dest = secaoDoCartao(q, alvo); if (!dest) return q;
  return moverCartao(q, ativo, dest.id, dest.cartoes.indexOf(alvo));
}

/** Arrastar uma seção ("secao:<id>") e soltar sobre outra seção (entra antes dela; abaixo dela se vier de cima na mesma coluna), um cartão ou lista, "abaixo:<id>" ou "nova-coluna". */
export function soltarSecao(q: Quadro, secaoId: string, alvo: string | null | undefined, ids: { coluna?: string } = {}): Quadro {
  const origem = achar(q, secaoId); if (!alvo || !origem) return q;
  const sec = q.colunas[origem.ci].secoes[origem.si];
  const tirar = (x: Quadro) => ({ colunas: x.colunas.map(c => ({ ...c, secoes: c.secoes.filter(s => s.id !== secaoId) })) });
  if (alvo === "nova-coluna") {
    if (q.colunas.length >= MAX_COLUNAS || (q.colunas[origem.ci].secoes.length === 1 && q.colunas.length === 1)) return q;
    return limpar({ colunas: [...tirar(q).colunas, { id: ids.coluna ?? novoId(), secoes: [sec] }] });
  }
  let alvoSecao: string | undefined, depois = false;
  if (alvo.startsWith("abaixo:")) { alvoSecao = alvo.slice(7); depois = true; }
  else if (alvo.startsWith("secao:")) alvoSecao = alvo.slice(6);
  else if (alvo.startsWith("sec:")) alvoSecao = alvo.slice(4);
  else alvoSecao = secaoDoCartao(q, alvo)?.id;
  if (!alvoSecao || alvoSecao === secaoId) return q;
  const dest = achar(q, alvoSecao); if (!dest) return q;
  if (!alvo.startsWith("abaixo:") && dest.ci === origem.ci && origem.si < dest.si) depois = true;   // descendo na mesma coluna: cai depois do alvo, como na lista visual
  const base = tirar(q); const nd = achar(base, alvoSecao)!;
  return limpar({ colunas: base.colunas.map((c, ci) => ci !== nd.ci ? c : { ...c, secoes: [...c.secoes.slice(0, nd.si + (depois ? 1 : 0)), sec, ...c.secoes.slice(nd.si + (depois ? 1 : 0))] }) });
}

/** Exclui seções INTEIRAS (com os cartões delas). Devolve o novo quadro e os ids dos cartões removidos (o chamador apaga as páginas). Coluna sem seções some. */
export function excluirSecoes(q: Quadro, ids: string[]): { quadro: Quadro; cartoes: string[] } {
  const alvo = new Set(ids);
  if (!alvo.size || !todasSecoes(q).some(s => alvo.has(s.id))) return { quadro: q, cartoes: [] };
  const cartoes = todasSecoes(q).filter(s => alvo.has(s.id)).flatMap(s => s.cartoes);
  return { quadro: limpar({ colunas: q.colunas.map(c => ({ ...c, secoes: c.secoes.filter(s => !alvo.has(s.id)) })) }), cartoes };
}
