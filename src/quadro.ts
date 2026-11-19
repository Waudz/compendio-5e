// Quadro de Planejamento: colunas livres com cartões em lista vertical. Funções puras (sem React, sem rede).
// O quadro guarda só a ORDEM (ids de cenas); reorganizar nunca altera as páginas originais. Mestre apenas.
export type Coluna = { id: string; titulo: string; cartoes: string[] };
export type Quadro = { colunas: Coluna[] };
export const MAX_COLUNAS = 20, MAX_CARTOES_POR_COLUNA = 100;

let seq = 0;
export const novoId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Lê o quadro de `meta`, descartando o que for inválido (nunca lança). */
export function lerQuadro(meta: unknown): Quadro {
  const cols = (meta as { colunas?: unknown } | null)?.colunas;
  if (!Array.isArray(cols)) return { colunas: [] };
  const vistos = new Set<string>();
  return { colunas: cols.slice(0, MAX_COLUNAS).flatMap(c => {
    const o = c as Partial<Coluna>; if (!o || typeof o.id !== "string" || typeof o.titulo !== "string" || !Array.isArray(o.cartoes)) return [];
    return [{ id: o.id, titulo: o.titulo.slice(0, 80), cartoes: o.cartoes.filter((x): x is string => typeof x === "string" && !vistos.has(x) && !!vistos.add(x)).slice(0, MAX_CARTOES_POR_COLUNA) }];
  }) };
}

export const todosCartoes = (q: Quadro) => q.colunas.flatMap(c => c.cartoes);
export const novaColuna = (q: Quadro, titulo: string, id = novoId()): Quadro => q.colunas.length >= MAX_COLUNAS || !titulo.trim() ? q : { colunas: [...q.colunas, { id, titulo: titulo.trim().slice(0, 80), cartoes: [] }] };
export const renomearColuna = (q: Quadro, id: string, titulo: string): Quadro => !titulo.trim() ? q : { colunas: q.colunas.map(c => c.id === id ? { ...c, titulo: titulo.trim().slice(0, 80) } : c) };
/** Só exclui coluna vazia: cartões nunca somem por tabela. */
export const excluirColuna = (q: Quadro, id: string): Quadro => q.colunas.find(c => c.id === id)?.cartoes.length ? q : { colunas: q.colunas.filter(c => c.id !== id) };
export const moverColuna = (q: Quadro, id: string, delta: -1 | 1): Quadro => {
  const i = q.colunas.findIndex(c => c.id === id), j = i + delta;
  if (i < 0 || j < 0 || j >= q.colunas.length) return q;
  const cs = [...q.colunas]; [cs[i], cs[j]] = [cs[j], cs[i]]; return { colunas: cs };
};
export const adicionarCartao = (q: Quadro, colunaId: string, cartaoId: string): Quadro => ({ colunas: q.colunas.map(c => c.id === colunaId && c.cartoes.length < MAX_CARTOES_POR_COLUNA && !todosCartoes(q).includes(cartaoId) ? { ...c, cartoes: [...c.cartoes, cartaoId] } : c) });
export const removerCartao = (q: Quadro, cartaoId: string): Quadro => ({ colunas: q.colunas.map(c => c.cartoes.includes(cartaoId) ? { ...c, cartoes: c.cartoes.filter(x => x !== cartaoId) } : c) });
/** Move o cartão para a coluna `destino`, na posição `indice` (fim se omitido). */
export function moverCartao(q: Quadro, cartaoId: string, destino: string, indice?: number): Quadro {
  const dest = q.colunas.find(c => c.id === destino); if (!dest || !todosCartoes(q).includes(cartaoId)) return q;
  const sem = removerCartao(q, cartaoId);
  return { colunas: sem.colunas.map(c => { if (c.id !== destino) return c; const cs = [...c.cartoes]; cs.splice(indice === undefined ? cs.length : Math.max(0, Math.min(indice, cs.length)), 0, cartaoId); return { ...c, cartoes: cs }; }) };
}
/** Sobe/desce dentro da coluna, ou passa para a coluna vizinha quando já está na ponta (desktop e celular, sem arrastar). */
export function deslocarCartao(q: Quadro, cartaoId: string, direcao: "cima" | "baixo" | "esquerda" | "direita"): Quadro {
  const ci = q.colunas.findIndex(c => c.cartoes.includes(cartaoId)); if (ci < 0) return q;
  const col = q.colunas[ci], i = col.cartoes.indexOf(cartaoId);
  if (direcao === "cima") return i > 0 ? moverCartao(q, cartaoId, col.id, i - 1) : q;
  if (direcao === "baixo") return i < col.cartoes.length - 1 ? moverCartao(q, cartaoId, col.id, i + 1) : q;
  const viz = q.colunas[ci + (direcao === "esquerda" ? -1 : 1)];
  return viz ? moverCartao(q, cartaoId, viz.id, Math.min(i, viz.cartoes.length)) : q;
}

/** Resultado de arrastar `ativo` e soltar sobre `alvo`: o alvo é um cartão (entra na posição dele) ou uma coluna (`col:<id>`, vai para o fim). */
export function soltarCartao(q: Quadro, ativo: string, alvo: string | null | undefined): Quadro {
  if (!alvo || alvo === ativo || !todosCartoes(q).includes(ativo)) return q;
  if (alvo.startsWith("col:") || alvo.startsWith("coluna:")) { const c = alvo.slice(alvo.startsWith("col:") ? 4 : 7); return q.colunas.some(x => x.id === c) ? moverCartao(q, ativo, c) : q; }
  const dest = q.colunas.find(c => c.cartoes.includes(alvo)); if (!dest) return q;
  const origem = q.colunas.find(c => c.cartoes.includes(ativo))!;
  const i = dest.cartoes.indexOf(alvo), j = origem.cartoes.indexOf(ativo);
  // mesma coluna: arrastar para baixo cai DEPOIS do alvo (como na lista visual); para cima, antes
  return moverCartao(q, ativo, dest.id, origem.id === dest.id && j < i ? i : i);
}

/** Nome automático para coluna criada sem nome ("Coluna 3"): nunca repete um nome existente. */
export function proximoNomeColuna(q: Quadro): string {
  const nomes = new Set(q.colunas.map(c => c.titulo));
  for (let n = q.colunas.length + 1; ; n++) if (!nomes.has(`Coluna ${n}`)) return `Coluna ${n}`;
}
/** Cria uma coluna no fim já com o cartão dentro (soltar um cartão na área "nova coluna"). */
export function moverParaNovaColuna(q: Quadro, cartaoId: string, titulo = proximoNomeColuna(q), id = novoId()): Quadro {
  if (q.colunas.length >= MAX_COLUNAS || !todosCartoes(q).includes(cartaoId)) return q;
  return moverCartao({ colunas: [...q.colunas, { id, titulo, cartoes: [] }] }, cartaoId, id);   // a coluna nasce vazia e o cartão é MOVIDO para ela (nunca removido antes)
}
/** Arrastar uma coluna (ids "coluna:<id>") e soltar sobre outra coluna, uma lista de cartões ("col:<id>"), um cartão ou a área de nova coluna (fim). */
export function soltarColuna(q: Quadro, colunaId: string, alvo: string | null | undefined): Quadro {
  if (!alvo) return q;
  let destino: string | undefined;
  if (alvo === "nova-coluna") destino = q.colunas[q.colunas.length - 1]?.id;
  else if (alvo.startsWith("coluna:")) destino = alvo.slice(7);
  else if (alvo.startsWith("col:")) destino = alvo.slice(4);
  else destino = q.colunas.find(c => c.cartoes.includes(alvo))?.id;
  const de = q.colunas.findIndex(c => c.id === colunaId), para = q.colunas.findIndex(c => c.id === destino);
  if (de < 0 || para < 0 || de === para) return q;
  const cs = [...q.colunas]; const [c] = cs.splice(de, 1); cs.splice(para, 0, c); return { colunas: cs };
}
