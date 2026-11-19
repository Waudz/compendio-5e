// PROTÓTIPO (somente desenvolvimento): modelo local do quadro de planejamento, sem Supabase. Funções puras e imutáveis.
// O formato canônico dos blocos é o JSON do BlockNote (nunca HTML).
export type Inline = { type: string; text?: string; styles?: Record<string, unknown>; href?: string; content?: Inline[]; props?: Record<string, unknown> };
export type LabBlock = { id?: string; type: string; props?: Record<string, unknown>; content?: Inline[] | { type: "tableContent"; rows: { cells: Inline[][] }[] }; children?: LabBlock[] };
/** Página: conteúdo canônico (JSON de blocos). O cartão só a REFERENCIA; mover, reordenar ou duplicar o atalho nunca altera a página. */
export type Page = { id: string; title: string; blocks: LabBlock[] };
export type Card = { id: string; pageId: string; mode: "compact" | "expanded" };
export type Column = { id: string; title: string; cards: Card[] };
export type Board = { title: string; columns: Column[]; pages: Record<string, Page> };
export type Dir = "up" | "down" | "left" | "right";

const t = (text: string, styles: Record<string, unknown> = {}): Inline => ({ type: "text", text, styles });
export const p = (...content: Inline[]): LabBlock => ({ type: "paragraph", content });
export const h = (text: string, level = 2): LabBlock => ({ type: "heading", props: { level }, content: [t(text)] });
export const li = (text: string, children: LabBlock[] = []): LabBlock => ({ type: "bulletListItem", content: [t(text)], children });
export const ref = (kind: "npc" | "local" | "encontro", refId: string, label: string): Inline => ({ type: "ref", props: { kind, refId, label } });
export const link = (href: string, text: string): Inline => ({ type: "link", href, content: [t(text)] });
export const table = (rows: string[][]): LabBlock => ({ type: "table", content: { type: "tableContent", rows: rows.map(r => ({ cells: r.map(c => [t(c)]) })) } });

let seq = 0;
export const uid = (prefix: string) => `${prefix}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
type Draft = { pages: Record<string, Page> };
/** Cria a página (se ainda não existe) e o cartão que a referencia. */
function card(d: Draft, title: string, blocks: LabBlock[], mode: Card["mode"] = "compact", pageId = uid("p")): Card {
  if (!d.pages[pageId]) d.pages[pageId] = { id: pageId, title, blocks };
  return { id: uid("c"), pageId, mode };
}

/** Sessão 5 — Festival da Lua (dados fictícios). A página da Marta aparece em dois cartões (atalho): um conteúdo, duas referências. */
export function sampleBoard(): Board {
  const d: Draft = { pages: {} };
  const marta = card(d, "Marta (NPC)", [h("Marta, dona da taverna", 3), p(t("Viúva, 50 anos. Conhece todos os boatos de Julkoun e cobra por informação.")), li("Segredo: esconde o diário do ferreiro")], "compact", "pagina-marta");
  const columns: Column[] = [
    { id: uid("col"), title: "Julkoun", cards: [
      card(d, "Taverna", [h("Taverna do Javali Cego"), p(t("Ambiente barulhento. A dona, "), ref("npc", "marta", "Marta"), t(", sabe do desaparecimento do ferreiro.")), li("Boato 1: luzes na floresta", [li("Só à noite"), li("Sempre perto da cabana")]), li("Boato 2: o prefeito paga a uma gangue")], "expanded"),
      card(d, "Prefeito", [p(ref("npc", "aldric", "Prefeito Aldric"), t(" quer discrição. Oferece 50 PO pelo problema na estrada.")), table([["Oferta", "Condição"], ["50 PO", "Resolver em 2 dias"], ["Favor", "Entrada na biblioteca"]])]),
      card(d, "Mercearia", [p(t("Poções de cura comuns (50 PO). "), link("https://www.dndbeyond.com/", "Consulta rápida"), t("."))]),
      marta,
    ] },
    { id: uid("col"), title: "Estrada", cards: [
      card(d, "Encontro aleatório", [p(t("Se os jogadores demoram, rolar na tabela. "), ref("encontro", "emboscada-goblins", "Emboscada de goblins"), t("."))]),
      card(d, "Carroça atolada", [p(t("Um mercador pede ajuda. Teste de Força CD 12.")), li("Falha: cavalo assustado"), li("Sucesso: ele revela um atalho")]),
    ] },
    { id: uid("col"), title: "Floresta", cards: [
      card(d, "Cabana do eremita", [p(ref("local", "cabana", "Cabana do Eremita"), t(" fica a 2 horas da estrada. O eremita só fala com quem traz cogumelos.")), li("Pista: runas no batente")]),
      card(d, "Preparação de poções", [h("Receitas", 3), li("Poção de cura: 2 ervas + água da nascente"), li("Antídoto: 1 erva amarga + sal")]),
      { id: uid("c"), pageId: "pagina-marta", mode: "compact" },      // atalho: a mesma página da Marta, sem cópia
    ] },
    { id: uid("col"), title: "Coluna vazia", cards: [] },
  ];
  return { title: "Sessão 5 — Festival da Lua", columns, pages: d.pages };
}

/** Quadro grande para testes de desempenho. */
export function manyCards(columns: number, cardsPerColumn: number): Board {
  const d: Draft = { pages: {} };
  const cols = Array.from({ length: columns }, (_, c) => ({
    id: uid("col"), title: `Coluna ${c + 1}`,
    cards: Array.from({ length: cardsPerColumn }, (_, i) => card(d, `Cena ${c + 1}.${i + 1}`, [h(`Cena ${c + 1}.${i + 1}`), p(t("Texto de exemplo com "), t("negrito", { bold: true }), t(" e itálico ", { italic: true }), ref("npc", `npc-${i}`, `NPC ${i}`), t(". Lorem ipsum dolor sit amet, consectetur adipiscing elit.")), li("Item A", [li("Subitem A1")]), li("Item B")])),
  }));
  return { title: `${columns * cardsPerColumn} cartões`, columns: cols, pages: d.pages };
}

const locate = (b: Board, id: string) => { for (let c = 0; c < b.columns.length; c++) { const i = b.columns[c].cards.findIndex(k => k.id === id); if (i >= 0) return { c, i }; } return null; };

/** Move um cartão: ↑↓ dentro da coluna; ←→ para a coluna vizinha (mantendo a posição aproximada). Nunca copia nem perde conteúdo. */
export function moveCard(b: Board, id: string, dir: Dir): Board {
  const at = locate(b, id); if (!at) return b;
  const cols = b.columns.map(c => ({ ...c, cards: [...c.cards] }));
  const { c, i } = at;
  if (dir === "up" || dir === "down") {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= cols[c].cards.length) return b;
    [cols[c].cards[i], cols[c].cards[j]] = [cols[c].cards[j], cols[c].cards[i]];
  } else {
    const d = dir === "left" ? c - 1 : c + 1;
    if (d < 0 || d >= cols.length) return b;
    const [moved] = cols[c].cards.splice(i, 1);
    cols[d].cards.splice(Math.min(i, cols[d].cards.length), 0, moved);
  }
  return { ...b, columns: cols };
}
export const setCardMode = (b: Board, id: string, mode: Card["mode"]): Board => ({ ...b, columns: b.columns.map(c => ({ ...c, cards: c.cards.map(k => (k.id === id ? { ...k, mode } : k)) })) });
/** Edita o CONTEÚDO da página (único lugar onde o conteúdo muda); todos os cartões que a referenciam passam a refletir. */
export const updatePage = (b: Board, pageId: string, patch: Partial<Pick<Page, "title" | "blocks">>): Board => (b.pages[pageId] ? { ...b, pages: { ...b.pages, [pageId]: { ...b.pages[pageId], ...patch } } } : b);
export const pageOf = (b: Board, card: Card): Page => b.pages[card.pageId];
export const columnOf = (b: Board, cardId: string): Column | undefined => b.columns.find(c => c.cards.some(k => k.id === cardId));

/**
 * Arrastar e soltar: move o cartão para a coluna `toColumnId` na posição final `index` (0 = topo; além do fim = última).
 * Funciona entre colunas, dentro da mesma coluna e para colunas vazias. Só reordena referências: `pages` nunca é tocado.
 */
export function moveCardTo(b: Board, cardId: string, toColumnId: string, index: number): Board {
  const at = locate(b, cardId), dest = b.columns.findIndex(c => c.id === toColumnId);
  if (!at || dest < 0) return b;
  const cols = b.columns.map(c => ({ ...c, cards: [...c.cards] }));
  const [moved] = cols[at.c].cards.splice(at.i, 1);
  const to = Math.max(0, Math.min(Number.isFinite(index) ? Math.trunc(index) : cols[dest].cards.length, cols[dest].cards.length));
  if (at.c === dest && to === at.i) return b;
  cols[dest].cards.splice(to, 0, moved);
  return { ...b, columns: cols };
}
export const countCards = (b: Board) => b.columns.reduce((n, c) => n + c.cards.length, 0);

/** Texto simples dos blocos (prévia compacta): sem montar editor nem DOM. */
export function previewText(blocks: LabBlock[], max = 140): string {
  const out: string[] = [];
  const inline = (c?: Inline[]): string => (c ?? []).map(x => (x.type === "text" ? x.text ?? "" : x.type === "link" ? inline(x.content) : x.type === "ref" ? String(x.props?.label ?? "") : "")).join("");
  const walk = (bs: LabBlock[]) => { for (const b of bs) {
    if (b.type === "table" && b.content && !Array.isArray(b.content)) out.push(b.content.rows.map(r => r.cells.map(inline).join(" | ")).join("; "));
    else if (Array.isArray(b.content)) out.push(inline(b.content));
    if (b.children?.length) walk(b.children);
  } };
  walk(blocks);
  const s = out.filter(Boolean).join(" · ");
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Só aceita destinos seguros em links vindos do JSON: http, https, mailto e referências internas (`compendio:`). Nunca `javascript:`/`data:`. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  if (/^(https?:\/\/|mailto:|compendio:)/i.test(href) && !/[\u0000- ]/.test(href)) return href;   // sem espaços nem controles (nenhum "trim" silencioso)
  return null;
}

/** Serialização canônica: JSON puro (ida e volta sem perda). */
export const serialize = (blocks: LabBlock[]) => JSON.stringify(blocks);
export function deserialize(json: string): LabBlock[] | null {
  try { const v = JSON.parse(json); return Array.isArray(v) && v.every(b => b && typeof b === "object" && typeof b.type === "string") ? (v as LabBlock[]) : null; } catch { return null; }
}
