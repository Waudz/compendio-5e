// Loot e recipientes dos encontros (funções puras, sem dependências de tela).
// Reutiliza o vocabulário já existente: `itemId` é o id canônico do catálogo de itens (mesmo de InventoryEntry.itemId), `nome` cobre o item
// personalizado (InventoryEntry.customName) e as moedas seguem `CharacterDraft.currency` (cp/sp/gp). Não há inventário paralelo:
// aqui só se registra o que o encontro oferece e o andamento; a entrega automática a fichas/inventários é uma etapa futura.
//
// Configuração original: ItemLoot em `participante.loot` (POR CRIATURA individual), `encontro.recompensas` e `encontro.recipientes[].itens`.
// Estado atual: `atual.loot` (LinhaLoot), uma linha por item e por origem, com quantidades encontrada/coletada/distribuída.

export type Moeda = "cp" | "sp" | "gp";
export const ROTULO_MOEDA: Record<Moeda, string> = { cp: "peças de cobre", sp: "peças de prata", gp: "peças de ouro" };
const MOEDAS: readonly string[] = ["cp", "sp", "gp"];

/** Item (ou moeda) configurado no encontro. `id` é estável dentro do encontro. */
export type ItemLoot = { id: string; itemId?: string; moeda?: Moeda; nome: string; quantidade: number; descricao?: string };
/** Recipiente identificável (baú, armário, saco) com inventário próprio. `id` estável: futura ligação com salas/Anotações. */
export type Recipiente = { id: string; nome: string; descricao?: string; itens: ItemLoot[] };

export type OrigemLoot = { tipo: "criatura"; criaturaId: string } | { tipo: "recipiente"; recipienteId: string } | { tipo: "recompensa" };
/** Linha do estado atual. Ids estáveis: `id` = origem + id do item configurado. Os dados do item são uma cópia da hora em que a linha foi criada. */
export type LinhaLoot = { id: string; lootId: string; origem: OrigemLoot; itemId?: string; moeda?: Moeda; nome: string; descricao?: string; quantidade: number; encontrado?: boolean; coletada: number; distribuida: number };
export type EstadoLoot = "disponivel" | "encontrado" | "coletado" | "distribuido";
export const ROTULO_LOOT: Record<EstadoLoot, string> = { disponivel: "Disponível", encontrado: "Encontrado", coletado: "Coletado", distribuido: "Distribuído" };

/** Parte do encontro que o loot precisa ler (evita importar combate.ts e criar ciclo). */
export type FonteLoot = {
  participantes: { id: string; loot?: ItemLoot[] }[]; recompensas?: ItemLoot[]; recipientes?: Recipiente[];
  atual?: { criaturas: { id: string; participanteId: string; situacao: "viva" | "derrotada" }[]; loot?: LinhaLoot[] };
};

export const idLinha = (o: OrigemLoot, lootId: string) => `${o.tipo === "criatura" ? `c:${o.criaturaId}` : o.tipo === "recipiente" ? `r:${o.recipienteId}` : "g"}|${lootId}`;
export const restante = (l: LinhaLoot) => l.quantidade - l.distribuida;
/** Derivado das quantidades: nunca guardado, não pode ficar incoerente. */
export function estadoLoot(l: LinhaLoot): EstadoLoot {
  if (l.distribuida >= l.quantidade) return "distribuido";
  if (l.coletada > 0 || l.distribuida > 0) return "coletado";
  return l.encontrado ? "encontrado" : "disponivel";
}
export const textoLoot = (i: { nome: string; quantidade: number; moeda?: Moeda }) => (i.moeda ? `${i.quantidade} ${ROTULO_MOEDA[i.moeda]}` : `${i.quantidade}× ${i.nome}`);

/** Valida um item novo: nome obrigatório (ou moeda), quantidade 1..9999. Devolve undefined se inválido. */
export function itemLootValido(i: { id: string; itemId?: string; moeda?: Moeda; nome: string; quantidade: number; descricao?: string }): ItemLoot | undefined {
  const nome = i.nome.trim().slice(0, 80), d = i.descricao?.trim().slice(0, 300);
  if (!i.id || !nome || !Number.isSafeInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 9999) return undefined;
  if (i.moeda !== undefined && !MOEDAS.includes(i.moeda)) return undefined;
  return { id: i.id, ...(i.itemId ? { itemId: i.itemId } : {}), ...(i.moeda ? { moeda: i.moeda } : {}), nome, quantidade: i.quantidade, ...(d ? { descricao: d } : {}) };
}

// ---------------------------------------------------------------- leitura segura (dado salvo nunca é confiável)
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export function lerItensLoot(v: unknown): ItemLoot[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new Error("loot inválido");
  const itens = v.map((x): ItemLoot => {
    const i = obj(x) ? itemLootValido({ id: String(x.id ?? ""), itemId: typeof x.itemId === "string" ? x.itemId : undefined, moeda: x.moeda as Moeda | undefined, nome: typeof x.nome === "string" ? x.nome : "", quantidade: x.quantidade as number, descricao: typeof x.descricao === "string" ? x.descricao : undefined }) : undefined;
    if (!i) throw new Error("item de loot inválido");
    return i;
  });
  if (new Set(itens.map(i => i.id)).size !== itens.length) throw new Error("itens de loot repetidos");
  return itens;
}
export function lerRecipientes(v: unknown): Recipiente[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new Error("recipientes inválidos");
  const r = v.map((x): Recipiente => {
    if (!obj(x) || typeof x.id !== "string" || !x.id || typeof x.nome !== "string" || !x.nome.trim()) throw new Error("recipiente inválido");
    const d = typeof x.descricao === "string" && x.descricao.trim() ? x.descricao.trim().slice(0, 300) : undefined;
    return { id: x.id, nome: x.nome.trim().slice(0, 60), ...(d ? { descricao: d } : {}), itens: lerItensLoot(x.itens ?? []) ?? [] };
  });
  if (new Set(r.map(x => x.id)).size !== r.length) throw new Error("recipientes repetidos");
  return r;
}
export function lerLinhasLoot(v: unknown): LinhaLoot[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new Error("loot atual inválido");
  const linhas = v.map((x): LinhaLoot => {
    if (!obj(x) || typeof x.id !== "string" || !x.id || typeof x.lootId !== "string" || typeof x.nome !== "string" || !x.nome.trim() || !obj(x.origem)) throw new Error("linha de loot inválida");
    const o = x.origem; let origem: OrigemLoot;
    if (o.tipo === "criatura" && typeof o.criaturaId === "string") origem = { tipo: "criatura", criaturaId: o.criaturaId };
    else if (o.tipo === "recipiente" && typeof o.recipienteId === "string") origem = { tipo: "recipiente", recipienteId: o.recipienteId };
    else if (o.tipo === "recompensa") origem = { tipo: "recompensa" };
    else throw new Error("origem de loot inválida");
    const q = x.quantidade, c = x.coletada, d = x.distribuida;
    if (typeof q !== "number" || !Number.isSafeInteger(q) || q < 1 || typeof c !== "number" || !Number.isSafeInteger(c) || c < 0 || c > q || typeof d !== "number" || !Number.isSafeInteger(d) || d < 0 || d > c) throw new Error("quantidades de loot inválidas");
    if (x.moeda !== undefined && !MOEDAS.includes(x.moeda as string)) throw new Error("moeda inválida");
    const desc = typeof x.descricao === "string" && x.descricao.trim() ? x.descricao.trim().slice(0, 300) : undefined;
    return { id: x.id, lootId: x.lootId, origem, ...(typeof x.itemId === "string" && x.itemId ? { itemId: x.itemId } : {}), ...(x.moeda ? { moeda: x.moeda as Moeda } : {}), nome: x.nome.trim().slice(0, 80), ...(desc ? { descricao: desc } : {}), quantidade: q, ...(x.encontrado === true ? { encontrado: true } : {}), coletada: c, distribuida: d };
  });
  if (new Set(linhas.map(l => l.id)).size !== linhas.length) throw new Error("linhas de loot repetidas");
  return linhas;
}

// ---------------------------------------------------------------- estado atual
const nova = (o: OrigemLoot, i: ItemLoot): LinhaLoot => ({ id: idLinha(o, i.id), lootId: i.id, origem: o, ...(i.itemId ? { itemId: i.itemId } : {}), ...(i.moeda ? { moeda: i.moeda } : {}), nome: i.nome, ...(i.descricao ? { descricao: i.descricao } : {}), quantidade: i.quantidade, coletada: 0, distribuida: 0 });

/** Linhas que a configuração original prevê para o estado atual (criaturas existentes, recipientes e recompensas). */
export function linhasPrevistas(enc: FonteLoot): LinhaLoot[] {
  const r: LinhaLoot[] = [];
  for (const c of enc.atual?.criaturas ?? []) for (const i of enc.participantes.find(p => p.id === c.participanteId)?.loot ?? []) r.push(nova({ tipo: "criatura", criaturaId: c.id }, i));
  for (const rec of enc.recipientes ?? []) for (const i of rec.itens) r.push(nova({ tipo: "recipiente", recipienteId: rec.id }, i));
  for (const i of enc.recompensas ?? []) r.push(nova({ tipo: "recompensa" }, i));
  return r;
}
/** Acrescenta ao estado atual as linhas que ainda não existem (itens novos na configuração, criaturas novas). Nunca altera nem remove linhas existentes: o que já foi coletado/distribuído é preservado. */
export function completarLinhas(enc: FonteLoot): LinhaLoot[] {
  const atuais = enc.atual?.loot ?? [], tem = new Set(atuais.map(l => l.id));
  const novas = linhasPrevistas(enc).filter(l => !tem.has(l.id));
  return novas.length ? [...atuais, ...novas] : atuais;
}

/** Loot ainda não entregue que mantém o encontro em aberto. O loot de criatura viva não conta aqui (a criatura viva já é pendência). */
export function pendenciasLoot(enc: FonteLoot): string[] {
  const vivas = new Set((enc.atual?.criaturas ?? []).filter(c => c.situacao === "viva").map(c => c.id));
  const n = (enc.atual?.loot ?? []).filter(l => restante(l) > 0 && !(l.origem.tipo === "criatura" && vivas.has(l.origem.criaturaId))).length;
  return n ? [`${n} item(ns) de loot sem distribuir`] : [];
}

type Ajuste = (l: LinhaLoot) => LinhaLoot | undefined;
function ajustar<E extends FonteLoot>(enc: E, id: string, f: Ajuste): E {
  const linhas = enc.atual?.loot; const k = linhas?.findIndex(l => l.id === id) ?? -1;
  if (!enc.atual || !linhas || k < 0) return enc;
  const novo = f(linhas[k]); if (!novo) return enc;
  return { ...enc, atual: { ...enc.atual, loot: linhas.map((l, j) => (j === k ? novo : l)) } };
}
/** O mestre marca que o jogador achou o item (ainda não coletado). */
export const marcarEncontrado = <E extends FonteLoot>(enc: E, id: string, encontrado: boolean): E => ajustar(enc, id, l => {
  if (l.coletada > 0) return undefined;   // já coletado: o estado é derivado das quantidades
  const { encontrado: _e, ...resto } = l; void _e; return encontrado ? { ...resto, encontrado: true } : resto;
});
/** Coleta parcial: soma (ou subtrai, para corrigir) `delta` à quantidade coletada. Nunca abaixo do já distribuído nem acima do total. Coletar implica "encontrado". */
export const ajustarColeta = <E extends FonteLoot>(enc: E, id: string, delta: number): E => ajustar(enc, id, l => {
  const c = l.coletada + delta; if (!Number.isSafeInteger(delta) || delta === 0 || c < l.distribuida || c > l.quantidade) return undefined;
  return { ...l, coletada: c, ...(c > 0 ? { encontrado: true } : {}) };
});
/** Distribuição parcial (registro de entrega): só do que já foi coletado. A entrega automática ao inventário é etapa futura. */
export const ajustarDistribuicao = <E extends FonteLoot>(enc: E, id: string, delta: number): E => ajustar(enc, id, l => {
  const d = l.distribuida + delta; if (!Number.isSafeInteger(delta) || delta === 0 || d < 0 || d > l.coletada) return undefined;
  return { ...l, distribuida: d };
});
export const totalDistribuido = (enc: FonteLoot) => (enc.atual?.loot ?? []).filter(l => l.distribuida > 0).length;
