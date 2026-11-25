// Estado de jogo da ficha (D&D 5e 2014), em funções puras. Tudo é guardado no próprio `draft` (campos opcionais, sem migração) e não altera a
// CONSTRUÇÃO do personagem: modificadores temporários, condições e usos são do jogo. Regras de dano, cura, morte, descanso, recarga e carga
// seguem o Compêndio 1.0 (`js/jogo.js`, `js/recursos.js`, `js/personagem.js`); os cálculos de atributos continuam no motor `regras-2014`.
import { srdItem } from "../catalogue/srd-2014-items";
import type { CharacterDraft, CharacterSheet } from "../rules/character-domain";


export type AlvoMod = "ac" | "initiative" | "speed" | "passivePerception" | "saves" | "attacks";
export const ROTULO_ALVO: Record<AlvoMod, string> = { ac: "CA", initiative: "Iniciativa", speed: "Deslocamento (m)", passivePerception: "Percepção passiva", saves: "Salvaguardas", attacks: "Ataques" };
export type TipoDefesa = "resistencia" | "imunidade" | "vulnerabilidade";
export const ROTULO_DEFESA: Record<TipoDefesa, string> = { resistencia: "Resistência", imunidade: "Imunidade", vulnerabilidade: "Vulnerabilidade" };
export type ModTemporario = { id: string; nome: string; alvo: AlvoMod; valor: number };
export type Defesa = { id: string; tipo: TipoDefesa; texto: string };
export type AtaquePersonalizado = { id: string; nome: string; bonus: string; dano: string; notas?: string };
export type Movimento = { em: string; texto: string };
export type EstadoJogo = {
  condicoes: string[]; inspiracao: boolean; morte: { sucessos: number; falhas: number };
  modificadores: ModTemporario[]; defesas: Defesa[]; ataques: AtaquePersonalizado[]; historico: Movimento[];
};
export const MAX_HISTORICO = 40;

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const inteiro = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : min);
const lista = <T,>(v: unknown, max: number, ler: (x: Record<string, unknown>) => T | null): T[] => (Array.isArray(v) ? v.slice(0, max).flatMap(x => { const r = obj(x) ? ler(x) : null; return r ? [r] : []; }) : []);

/** Leitura segura (o dado pode vir de outra versão ou de outro aparelho): o que não serve é ignorado, nunca quebra a ficha. */
export function lerEstadoJogo(draft: { play?: unknown }): EstadoJogo {
  const p = obj(draft.play) ? draft.play : {};
  const morte = obj(p.morte) ? p.morte : {};
  return {
    condicoes: Array.isArray(p.condicoes) ? [...new Set(p.condicoes.filter((c): c is string => typeof c === "string" && !!c))].slice(0, 30) : [],
    inspiracao: p.inspiracao === true,
    morte: { sucessos: inteiro(morte.sucessos, 0, 3), falhas: inteiro(morte.falhas, 0, 3) },
    modificadores: lista(p.modificadores, 20, x => (texto(x.id, 60) && typeof x.alvo === "string" && x.alvo in ROTULO_ALVO && typeof x.valor === "number" ? { id: texto(x.id, 60), nome: texto(x.nome, 60), alvo: x.alvo as AlvoMod, valor: inteiro(x.valor, -30, 30) } : null)),
    defesas: lista(p.defesas, 30, x => (texto(x.id, 60) && typeof x.tipo === "string" && x.tipo in ROTULO_DEFESA && texto(x.texto, 80).trim() ? { id: texto(x.id, 60), tipo: x.tipo as TipoDefesa, texto: texto(x.texto, 80) } : null)),
    ataques: lista(p.ataques, 20, x => (texto(x.id, 60) && texto(x.nome, 60).trim() ? { id: texto(x.id, 60), nome: texto(x.nome, 60), bonus: texto(x.bonus, 20), dano: texto(x.dano, 60), ...(texto(x.notas, 200) ? { notas: texto(x.notas, 200) } : {}) } : null)),
    historico: lista(p.historico, MAX_HISTORICO, x => (texto(x.texto, 160) ? { em: texto(x.em, 30), texto: texto(x.texto, 160) } : null)),
  };
}
export const comEstado = (draft: CharacterDraft, patch: Partial<EstadoJogo>): CharacterDraft => ({ ...draft, play: { ...lerEstadoJogo(draft), ...patch } });
export const somaTemporaria = (estado: EstadoJogo, alvo: AlvoMod) => estado.modificadores.filter(m => m.alvo === alvo).reduce((s, m) => s + m.valor, 0);
export const registrarMovimento = (draft: CharacterDraft, textoMov: string, agora = new Date()): CharacterDraft => comEstado(draft, { historico: [{ em: agora.toISOString(), texto: textoMov.slice(0, 160) }, ...lerEstadoJogo(draft).historico].slice(0, MAX_HISTORICO) });

// ---------------------------------------------------------------- pontos de vida
/** Dano: consome primeiro os PV temporários. */
export function causarDano(draft: CharacterDraft, n: number): CharacterDraft {
  if (!Number.isSafeInteger(n) || n <= 0) return draft;
  const doTemp = Math.min(draft.temporaryHp, n);
  return { ...draft, temporaryHp: draft.temporaryHp - doTemp, currentHp: Math.max(0, draft.currentHp - (n - doTemp)) };
}
/** Cura: até o máximo. Voltar de 0 PV zera as salvaguardas contra a morte. */
export function curar(draft: CharacterDraft, maximo: number, n: number): CharacterDraft {
  if (!Number.isSafeInteger(n) || n <= 0) return draft;
  const prox = { ...draft, currentHp: Math.min(maximo, draft.currentHp + n) };
  return draft.currentHp === 0 && prox.currentHp > 0 ? comEstado(prox, { morte: { sucessos: 0, falhas: 0 } }) : prox;
}
/** PV temporários não se acumulam: o valor informado substitui o atual (0 remove). */
export const definirTemporarios = (draft: CharacterDraft, n: number): CharacterDraft => (Number.isSafeInteger(n) && n >= 0 && n <= 999 ? { ...draft, temporaryHp: n } : draft);

// ---------------------------------------------------------------- recursos e descansos
export type Recarga = "curto" | "longo";
const CURTOS = new Set(["second-wind", "actionSurges", "kiPoints", "channelDivinityCharges", "channel-divinity", "wild-shape", "stroke-of-luck"]);
/** Quando o recurso volta. Espaços do Bruxo (Pacto) voltam no descanso curto; Inspiração de Bardo também, a partir do nível 5. */
export function recargaDe(id: string, classe: string, nivel: number): Recarga {
  if (id.startsWith("spell-slot-")) return classe === "warlock" ? "curto" : "longo";
  if (id === "bardic-inspiration") return nivel >= 5 ? "curto" : "longo";
  return CURTOS.has(id) ? "curto" : "longo";
}
const semGasto = (gasto: Record<string, number>, ids: string[]) => Object.fromEntries(Object.entries(gasto).filter(([id]) => !ids.includes(id)));
export function descansoCurto(draft: CharacterDraft): CharacterDraft {
  const voltam = Object.keys(draft.spentResources).filter(id => id !== "hit-dice" && recargaDe(id, draft.classId, draft.level) === "curto");
  return registrarMovimento({ ...draft, spentResources: semGasto(draft.spentResources, voltam) }, "Descanso curto");
}
/** 2014: o descanso longo só beneficia quem começa com pelo menos 1 PV. Recupera PV, recursos, metade dos dados de vida (mínimo 1) e zera a morte. */
export function descansoLongo(draft: CharacterDraft, maximo: number): { ok: true; draft: CharacterDraft } | { ok: false; motivo: string } {
  if (draft.currentHp < 1) return { ok: false, motivo: "É preciso ter pelo menos 1 PV no começo do descanso longo para receber os benefícios." };
  const usados = draft.spentResources["hit-dice"] ?? 0, restam = Math.max(0, usados - Math.max(1, Math.floor(draft.level / 2)));
  const gasto: Record<string, number> = restam ? { "hit-dice": restam } : {};
  return { ok: true, draft: registrarMovimento(comEstado({ ...draft, currentHp: maximo, temporaryHp: 0, spentResources: gasto }, { morte: { sucessos: 0, falhas: 0 } }), "Descanso longo") };
}
/** Usa (+1) ou devolve (-1) um uso, dentro dos limites calculados pela ficha. */
export function usarRecurso(draft: CharacterDraft, sheet: CharacterSheet, id: string, delta: 1 | -1): CharacterDraft {
  const r = sheet.resources[id]; if (!r) return draft;
  const gasto = (draft.spentResources[id] ?? 0) + delta;
  if (gasto < 0 || (r.maximum !== null && gasto > r.maximum)) return draft;
  return { ...draft, spentResources: { ...draft.spentResources, [id]: gasto } };
}

// ---------------------------------------------------------------- defesas e sentidos (derivados da construção + o que o jogador/mestre anotar)
const ANCESTRAL: Record<string, string> = { black: "ácido", blue: "elétrico", brass: "fogo", bronze: "elétrico", copper: "ácido", gold: "fogo", green: "veneno", red: "fogo", silver: "frio", white: "frio" };
export function defesasDerivadas(draft: CharacterDraft, tracos: readonly { index: string }[], ancestral?: string): Defesa[] {
  const tem = (i: string) => tracos.some(t => t.index === i);
  const r: Defesa[] = [];
  const add = (tipo: TipoDefesa, t: string) => r.push({ id: `auto:${tipo}:${t}`, tipo, texto: t });
  if (tem("dwarven-resilience")) add("resistencia", "veneno");
  if (tem("hellish-resistance")) add("resistencia", "fogo");
  if (draft.raceId === "dragonborn" && ancestral && ANCESTRAL[ancestral]) add("resistencia", ANCESTRAL[ancestral]);
  if (tem("fey-ancestry")) add("imunidade", "sono mágico");
  if (draft.classId === "monk" && draft.level >= 10) { add("imunidade", "veneno"); add("imunidade", "doenças"); }
  if (draft.classId === "paladin" && draft.level >= 3) add("imunidade", "doenças");
  return r;
}
export const sentidosEspeciais = (tracos: readonly { index: string }[]) => (tracos.some(t => t.index === "darkvision") ? ["Visão no escuro 18 m"] : []);

// ---------------------------------------------------------------- inventário
export function pesoCarregado(draft: CharacterDraft): number {
  return Math.round(draft.inventory.reduce((s, i) => s + (srdItem(i.itemId)?.peso ?? 0) * i.quantity, 0) * 100) / 100;
}
/** Como no Compêndio 1.0: Força × 7 kg. */
export const capacidadeDeCarga = (forca: number) => forca * 7;
export type CategoriaInv = "armas" | "protecao" | "outros";
export function categoriaDoItem(itemId: string): CategoriaInv {
  const d = srdItem(itemId);
  return d?.arma ? "armas" : d?.armadura ? "protecao" : "outros";
}
/** Só armas, armaduras, escudos e acessórios vestíveis podem ser equipados. */
export function podeEquipar(itemId: string): boolean {
  const d = srdItem(itemId);
  return !!(d && (d.arma || d.armadura || d.espaco));
}
export const MOEDAS_FICHA = [["cp", "PC"], ["sp", "PP"], ["ep", "PE"], ["gp", "PO"], ["pp", "PL"]] as const;
export type ChaveMoeda = (typeof MOEDAS_FICHA)[number][0];
export function definirMoeda(draft: CharacterDraft, chave: ChaveMoeda, n: number): CharacterDraft {
  if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000) return draft;
  return { ...draft, currency: { cp: 0, sp: 0, gp: 0, ...draft.currency, [chave]: n } };
}
