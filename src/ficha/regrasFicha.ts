// O que a ficha mostra para jogar sem calcular à mão: ataques das armas, dados das magias, CD por fonte e valores das características.
// Funções puras sobre o motor `regras-2014` e o catálogo de itens. Valores numéricos são só os do SRD 5.1 (2014); textos vêm das
// descrições cadastradas (nada é inventado: o que a descrição não diz não aparece).
import { srdItem } from "../catalogue/srd-2014-items";
import { automaticSpells2014, choices2014, class2014, featureDescription2014, label2014, raceTraits2014, selected2014, shortId, spells2014, subclassFeatureIds2014, type Spell2014 } from "../criador/regras-2014";
import { rotuloAtributo, rotuloOpcao } from "../criador/rotulos";
import type { Ability } from "../rules/character-build-pilot";
import type { CharacterDraft, CharacterSheet } from "../rules/character-domain";
import type { Concedido } from "./estadoJogo";
import { metros, sinal } from "./tipos";

export const modificador = (valor: number) => Math.floor((valor - 10) / 2);
export const bonusProficiencia = (nivel: number) => 2 + Math.floor((nivel - 1) / 4);

// ---------------------------------------------------------------- armas e itens
const DANO: Record<string, string> = { bludgeoning: "contundente", piercing: "perfurante", slashing: "cortante" };
const PROPRIEDADE: Record<string, string> = { light: "leve", monk: "arma de monge", finesse: "acuidade", thrown: "arremesso", "two-handed": "duas mãos", versatile: "versátil", ammunition: "munição", loading: "recarga", heavy: "pesada", reach: "alcance estendido", special: "especial" };
export type DadosDaArma = { dado: string; tipo: string; duasMaos: string | null; propriedades: string[]; alcance: string };
/** Dados BÁSICOS da arma (valem mesmo sem estar equipada); `null` se o item não é arma. */
export function dadosDaArma(itemId: string): DadosDaArma | null {
  const w = srdItem(itemId)?.arma; if (!w) return null;
  const faixa = (a?: { normal: number; longo?: number }) => (a ? (a.longo ? `${metros(a.normal)} / ${metros(a.longo)}` : metros(a.normal)) : "");
  const alcance = w.alcance === "ranged" ? faixa(w.alcanceM) || "À distância"
    : [w.propriedades.includes("reach") ? "3 m" : "1,5 m", w.arremessoM ? `arremesso ${faixa(w.arremessoM)}` : ""].filter(Boolean).join(" · ");
  return { dado: w.dano?.dado ?? "—", tipo: w.dano?.tipo ? DANO[w.dano.tipo] : "", duasMaos: w.danoDuasMaos?.dado ?? null, propriedades: w.propriedades.map(p => PROPRIEDADE[p] ?? p), alcance };
}
export const formulaDano = (dado: string, bonus: number) => (dado === "—" ? "—" : bonus ? `${dado}${sinal(bonus)}` : dado);

// ---------------------------------------------------------------- conjuração
export type FonteConjuracao = { chave: string; rotulo: string; atributo: Ability; cd: number; ataque: number };
const fonte = (chave: string, rotulo: string, atributo: Ability, sheet: CharacterSheet, nivel: number): FonteConjuracao => {
  const m = modificador(sheet.abilities[atributo]), p = bonusProficiencia(nivel);
  return { chave, rotulo, atributo, cd: 8 + p + m, ataque: p + m };
};
/** Atributo de conjuração da classe, se ela conjura neste nível. */
function fonteDaClasse(draft: CharacterDraft, sheet: CharacterSheet): FonteConjuracao | null {
  const c = class2014(draft).data.spellcasting;
  return c && draft.level >= c.startsAtLevel ? fonte("classe", label2014(draft.classId), c.ability, sheet, draft.level) : null;
}
/** Truques e magias raciais têm atributo próprio: Tiefling usa Carisma; o truque do Alto Elfo usa Inteligência. */
function fonteRacial(draft: CharacterDraft, sheet: CharacterSheet): FonteConjuracao | null {
  if (draft.raceId === "tiefling") return fonte("raca", `${label2014(draft.raceId)} (racial)`, "cha", sheet, draft.level);
  if (draft.raceId === "high-elf") return fonte("raca", `${label2014(draft.raceId)} (racial)`, "int", sheet, draft.level);
  return null;
}

export type MagiaDaFicha = { chave: string; magia: Spell2014; origem: string; fonte: FonteConjuracao | null; cdFixa?: number; ataqueFixo?: number; concedida?: Concedido };
const RACIAIS_TIEFLING = ["thaumaturgy", "hellish-rebuke", "darkness"];
/** Magias escolhidas, automáticas e concedidas, cada uma com a sua origem e o atributo que vale para ela. */
export function magiasDaFicha(draft: CharacterDraft, sheet: CharacterSheet, concedidos: readonly Concedido[] = []): MagiaDaFicha[] {
  const classe = fonteDaClasse(draft, sheet), raca = fonteRacial(draft, sheet);
  const mapa = new Map<string, { origens: Set<string>; racial: boolean }>();
  const add = (id: string, origem: string, racial = false) => { const x = mapa.get(id) ?? { origens: new Set<string>(), racial }; x.origens.add(origem); x.racial = x.racial && racial; mapa.set(id, x); };
  for (const c of choices2014(draft).filter(c => c.kind === "spell")) {
    const origem = c.id === "spells-prepared" ? "preparada" : c.id.startsWith("spellbook-level-") ? "grimório" : c.id === "spells-known" ? (draft.classId === "wizard" ? "grimório" : "conhecida") : c.id === "cantrips" ? "truque da classe" : c.id === "racial-cantrip" ? "raça" : "característica";
    for (const id of selected2014(draft, c.id)) add(id, origem, c.id === "racial-cantrip");
  }
  const daClasse = new Set(automaticSpells2014(draft, false).map(m => m.id));
  for (const m of automaticSpells2014(draft)) {
    const racial = !daClasse.has(m.id) && draft.raceId === "tiefling" && RACIAIS_TIEFLING.includes(m.id);
    add(m.id, racial ? "raça" : "concedida pela classe", racial);
  }
  const escolhidas = [...mapa].flatMap(([id, x]) => { const magia = spells2014.find(s => s.id === id); return magia ? [{ chave: id, magia, origem: [...x.origens].join(", "), fonte: x.racial ? raca : classe ?? raca }] : []; });
  const extras = concedidos.filter(c => c.tipo === "magia").flatMap<MagiaDaFicha>(c => {
    const magia = spells2014.find(s => s.id === c.ref); if (!magia) return [];
    return [{ chave: c.id, magia, origem: c.origem, fonte: c.atributo ? fonte(`concedida:${c.atributo}`, c.origem, c.atributo, sheet, draft.level) : classe ?? raca, cdFixa: c.cd, ataqueFixo: c.ataque, concedida: c }];
  });
  return [...escolhidas, ...extras].sort((a, b) => a.magia.level - b.magia.level || a.magia.name.localeCompare(b.magia.name, "pt-BR"));
}

export type DadosDaMagia = { salvaguarda: string | null; ataque: boolean; dano: string | null; cura: string | null; alcance: string | null; duracao: string | null; tempo: string | null; consumo: string };
const TIPOS_DANO = "ácido|contundente|cortante|perfurante|fogo|ígneo|frio|gélido|elétrico|trovejante|necrótico|radiante|psíquico|energético|venenoso|veneno|força|trovão";
/** Lê da descrição cadastrada o que importa na mesa. O que o texto não informa fica de fora. */
export function dadosDaMagia(m: Spell2014): DadosDaMagia {
  const texto = m.description.replace(/(\d)O\b/g, "$10");   // "1d1O" (letra O no lugar do zero) na origem
  const antesDeCirculos = texto.split(/Em C[íi]rculos Superiores/i)[0];
  const salva = /salvaguarda de (Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/i.exec(antesDeCirculos);
  const dano = new RegExp(`(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)(?: pontos)?(?: de)? dano(?:s)?(?: de)?(?: (${TIPOS_DANO}))?`, "i").exec(antesDeCirculos);
  const cura = /(?:recupera|recuperam|cura)[^.]*?(\d+d\d+(?:\s*\+\s*o modificador[^.,]*)?)/i.exec(antesDeCirculos);
  const parte = (rotulo: string) => m.details.split("·").map(x => x.trim()).find(x => x.startsWith(rotulo + ":"))?.slice(rotulo.length + 1).trim() ?? null;
  const partes = m.details.split("·").map(x => x.trim());
  return {
    salvaguarda: salva ? salva[1][0].toLocaleUpperCase("pt-BR") + salva[1].slice(1) : null,
    ataque: /ataque mágico/i.test(antesDeCirculos),
    dano: dano ? `${dano[1]} de dano${dano[2] ? ` (${dano[2].toLocaleLowerCase("pt-BR")})` : ""}` : null,
    cura: cura ? `cura ${cura[1].replace(/o modificador do seu atributo de conjuração/i, "o modificador de conjuração")}` : null,
    alcance: parte("Alcance"), duracao: parte("Duração"), tempo: partes.length > 1 ? partes[1] : null,
    consumo: m.level === 0 ? "Truque: não gasta espaço" : `Gasta um espaço de ${m.level}º círculo ou superior${m.ritual ? " (ou ritual)" : ""}`,
  };
}

// ---------------------------------------------------------------- características
export type OrigemCaracteristica = "Classe" | "Subclasse" | "Raça" | "Origem" | "Talento" | "Concedida";
export type Caracteristica = { chave: string; nome: string; origem: OrigemCaracteristica; detalheOrigem?: string; resumo: string; descricao: string; recursos: string[]; valores: string[] };

/** Primeira frase da descrição cadastrada (sem inventar resumo). */
export function resumoDe(descricao: string): string {
  const limpo = descricao.replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  const frase = /^.{20,200}?[.!?](?=\s|$)/.exec(limpo)?.[0] ?? limpo;
  return frase.length > 180 ? frase.slice(0, 177).replace(/\s+\S*$/, "") + "…" : frase;
}

const RECURSO_DE: [recurso: string, caracteristica: RegExp][] = [
  ["rageCount", /^rage$/], ["kiPoints", /^ki$/], ["actionSurges", /^action-surge/], ["indomitableUses", /^indomitable-\d/], ["sorceryPoints", /^font-of-magic$/],
  ["second-wind", /^second-wind$/], ["lay-on-hands", /^lay-on-hands$/], ["divine-sense", /^divine-sense$/], ["channel-divinity", /^channel-divinity/], ["channelDivinityCharges", /^channel-divinity/],
  ["bardic-inspiration", /^bardic-inspiration/], ["wild-shape", /^wild-shape/], ["breath-weapon", /^breath-weapon$/], ["infernal-rebuke", /^infernal-legacy$/], ["infernal-darkness", /^infernal-legacy$/],
];
const SOPRO: Record<string, [tipo: string, salvaguarda: Ability, area: string]> = {
  black: ["ácido", "dex", "linha de 1,5 m por 9 m"], blue: ["elétrico", "dex", "linha de 1,5 m por 9 m"], brass: ["fogo", "dex", "linha de 1,5 m por 9 m"], bronze: ["elétrico", "dex", "linha de 1,5 m por 9 m"], copper: ["ácido", "dex", "linha de 1,5 m por 9 m"],
  gold: ["fogo", "dex", "cone de 4,5 m"], green: ["veneno", "con", "cone de 4,5 m"], red: ["fogo", "dex", "cone de 4,5 m"], silver: ["frio", "con", "cone de 4,5 m"], white: ["frio", "con", "cone de 4,5 m"],
};
const porNivel = <T,>(nivel: number, faixas: [number, T][]) => [...faixas].reverse().find(([n]) => nivel >= n)![1];
/** Valores de jogo das características que têm número no SRD 2014. */
export function valoresDe(id: string, draft: CharacterDraft, sheet: CharacterSheet): string[] {
  const n = draft.level, p = bonusProficiencia(n), mod = (a: Ability) => modificador(sheet.abilities[a]);
  if (id === "second-wind") return [`Cura 1d10+${n}`, "Ação bônus"];
  if (id.startsWith("sneak-attack")) return [`Dano extra ${Math.ceil(n / 2)}d6`];
  if (id === "rage") return [`Dano corpo a corpo com Força +${porNivel(n, [[1, 2], [9, 3], [16, 4]])}`];
  if (id === "ki" || id === "stunning-strike") return [`CD ${8 + p + mod("wis")}${id === "stunning-strike" ? " · salvaguarda de Constituição" : " (efeitos de Ki)"}`];
  if (id === "martial-arts") return [`Dado marcial 1d${porNivel(n, [[1, 4], [5, 6], [11, 8], [17, 10]])}`];
  if (id === "lay-on-hands") return [`Reserva de cura: ${5 * n} PV`];
  if (id.startsWith("bardic-inspiration")) return [`Dado de inspiração 1d${porNivel(n, [[1, 6], [5, 8], [10, 10], [15, 12]])}`];
  if (id === "divine-smite") return ["Dano radiante extra 2d8 (+1d8 por círculo acima do 1º, até 5d8)"];
  if (id.startsWith("channel-divinity")) { const f = fonteDaClasse(draft, sheet); return f ? [`CD ${f.cd} (quando o efeito pedir salvaguarda)`] : []; }
  if (id === "breath-weapon") {
    const s = SOPRO[selected2014(draft, "dragon-ancestry")[0] ?? ""]; if (!s) return [];
    return [`${porNivel(n, [[1, 2], [6, 3], [11, 4], [16, 5]])}d6 de dano de ${s[0]}`, `Salvaguarda de ${rotuloAtributo(s[1])} · CD ${8 + p + mod("con")}`, s[2]];
  }
  return [];
}

const nomeDaCaracteristica = (id: string) => (label2014(id) === id ? rotuloOpcao(id) : label2014(id));
/** Características de classe, subclasse, raça, origem, talentos e concedidas, sem repetições e ligadas aos recursos. */
export function caracteristicasDaFicha(draft: CharacterDraft, sheet: CharacterSheet, concedidos: readonly Concedido[] = []): Caracteristica[] {
  const daSubclasse = new Set(subclassFeatureIds2014(draft));
  const recursosDe = (id: string) => RECURSO_DE.filter(([r, re]) => r in sheet.resources && re.test(id)).map(([r]) => r);
  const usados = new Set<string>(), nomes = new Set<string>(), out: Caracteristica[] = [];
  const add = (c: Omit<Caracteristica, "resumo" | "recursos"> & { id: string }) => {
    const { id, ...resto } = c, chaveNome = resto.nome.toLocaleLowerCase("pt-BR") + "|" + resto.descricao;
    if (nomes.has(chaveNome)) return;
    nomes.add(chaveNome);
    const recursos = recursosDe(id).filter(r => !usados.has(r)); recursos.forEach(r => usados.add(r));
    out.push({ ...resto, recursos, resumo: resumoDe(resto.descricao) });
  };
  for (const f of sheet.features) add({ id: shortId(f), chave: f, nome: nomeDaCaracteristica(f), origem: daSubclasse.has(f) ? "Subclasse" : "Classe", detalheOrigem: label2014(draft.classId), descricao: featureDescription2014(f), valores: valoresDe(shortId(f), draft, sheet) });
  for (const t of raceTraits2014(draft)) add({ id: t.index, chave: "raca:" + t.index, nome: t.name, origem: "Raça", detalheOrigem: label2014(draft.raceId), descricao: t.desc.join("\n\n"), valores: valoresDe(t.index, draft, sheet) });
  const origem = selected2014(draft, "background-feature")[0];
  if (origem) add({ id: "origem", chave: "origem", nome: label2014(origem), origem: "Origem", detalheOrigem: label2014(draft.backgroundId), descricao: featureDescription2014(origem), valores: [] });
  for (const c of concedidos.filter(c => c.tipo !== "magia"))
    add({ id: c.id, chave: c.id, nome: c.nome, origem: c.tipo === "talento" ? "Talento" : "Concedida", detalheOrigem: c.origem, descricao: c.descricao ?? "", valores: [c.cd != null ? `CD ${c.cd}${c.salvaguarda ? ` · salvaguarda de ${c.salvaguarda}` : ""}` : "", c.ataque != null ? `Ataque ${sinal(c.ataque)}` : "", c.efeito ?? ""].filter(Boolean) });
  return out;
}

