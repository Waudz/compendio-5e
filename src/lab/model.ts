// PROTÓTIPO (somente desenvolvimento): modelo local do quadro de planejamento, sem Supabase. Funções puras e imutáveis.
// O formato canônico dos blocos é o JSON do BlockNote (nunca HTML).
export type Inline = { type: string; text?: string; styles?: Record<string, unknown>; href?: string; content?: Inline[]; props?: Record<string, unknown> };
export type LabBlock = { id?: string; type: string; props?: Record<string, unknown>; content?: Inline[] | { type: "tableContent"; rows: { cells: Inline[][] }[] }; children?: LabBlock[] };
export type Card = { id: string; title: string; mode: "compact" | "expanded"; blocks: LabBlock[] };
export type Column = { id: string; title: string; cards: Card[] };
export type Board = { title: string; columns: Column[] };
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
const card = (title: string, blocks: LabBlock[], mode: Card["mode"] = "compact"): Card => ({ id: uid("c"), title, mode, blocks });

/** Sessão 5 — Festival da Lua (dados fictícios). */
export function sampleBoard(): Board {
  return { title: "Sessão 5 — Festival da Lua", columns: [
    { id: uid("col"), title: "Julkoun", cards: [
      card("Taverna", [h("Taverna do Javali Cego"), p(t("Ambiente barulhento. A dona, "), ref("npc", "marta", "Marta"), t(", sabe do desaparecimento do ferreiro.")), li("Boato 1: luzes na floresta", [li("Só à noite"), li("Sempre perto da cabana")]), li("Boato 2: o prefeito paga a uma gangue")], "expanded"),
      card("Prefeito", [p(ref("npc", "aldric", "Prefeito Aldric"), t(" quer discrição. Oferece 50 PO pelo problema na estrada.")), table([["Oferta", "Condição"], ["50 PO", "Resolver em 2 dias"], ["Favor", "Entrada na biblioteca"]])]),
      card("Mercearia", [p(t("Poções de cura comuns (50 PO). "), link("https://www.dndbeyond.com/", "Consulta rápida"), t("."))]),
    ] },
    { id: uid("col"), title: "Estrada", cards: [
      card("Encontro aleatório", [p(t("Se os jogadores demoram, rolar na tabela. "), ref("encontro", "emboscada-goblins", "Emboscada de goblins"), t("."))]),
      card("Carroça atolada", [p(t("Um mercador pede ajuda. Teste de Força CD 12.")), li("Falha: cavalo assustado"), li("Sucesso: ele revela um atalho")]),
    ] },
    { id: uid("col"), title: "Floresta", cards: [
      card("Cabana do eremita", [p(ref("local", "cabana", "Cabana do Eremita"), t(" fica a 2 horas da estrada. O eremita só fala com quem traz cogumelos.")), li("Pista: runas no batente")]),
      card("Preparação de poções", [h("Receitas", 3), li("Poção de cura: 2 ervas + água da nascente"), li("Antídoto: 1 erva amarga + sal")]),
    ] },
  ] };
}

/** Quadro grande para testes de desempenho. */
export function manyCards(columns: number, cardsPerColumn: number): Board {
  return { title: `${columns * cardsPerColumn} cartões`, columns: Array.from({ length: columns }, (_, c) => ({
    id: uid("col"), title: `Coluna ${c + 1}`,
    cards: Array.from({ length: cardsPerColumn }, (_, i) => card(`Cena ${c + 1}.${i + 1}`, [h(`Cena ${c + 1}.${i + 1}`), p(t("Texto de exemplo com "), t("negrito", { bold: true }), t(" e itálico ", { italic: true }), ref("npc", `npc-${i}`, `NPC ${i}`), t(". Lorem ipsum dolor sit amet, consectetur adipiscing elit.")), li("Item A", [li("Subitem A1")]), li("Item B")])),
  })) };
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
export function updateCard(b: Board, id: string, patch: Partial<Pick<Card, "mode" | "blocks" | "title">>): Board {
  return { ...b, columns: b.columns.map(c => ({ ...c, cards: c.cards.map(k => (k.id === id ? { ...k, ...patch } : k)) })) };
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
