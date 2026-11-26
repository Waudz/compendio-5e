// O que muda ao subir um nível, calculado pelo motor `regras-2014` (nenhuma regra é recriada aqui). A subida parte da ficha atual e só
// altera nível, PV por nível e as escolhas novas: inventário, moedas, recursos gastos, história e identidade continuam como estão.
import type { CharacterDraft } from "../rules/character-domain";
import { choices2014, class2014, decide2014, progressLevel2014, selected2014, sheet2014, spellSlots2014, statistics2014, subclassFeatureIds2014, type Choice2014 } from "./regras-2014";

export const valorFixoDoDado = (dado: number) => Math.floor(dado / 2) + 1;

/** Ficha no próximo nível, ainda sem as escolhas novas; PV do novo nível pelo valor fixo, a não ser que `rolagem` seja informada. */
export function prepararSubida(atual: CharacterDraft, rolagem: number | null): CharacterDraft {
  const nivel = atual.level + 1;
  if (nivel > 20) throw Error("O personagem já está no 20º nível.");
  const dado = class2014(atual).data.hitDie;
  // fichas com valor fixo continuam fixas; para informar uma rolagem, os níveis anteriores mantêm exatamente os PV que já tinham
  if (rolagem === null && !atual.hpRolls) return progressLevel2014(atual, nivel);
  const anteriores = Array.from({ length: atual.level - 1 }, (_, i) => atual.hpRolls?.[i] ?? valorFixoDoDado(dado));
  const novo = rolagem ?? valorFixoDoDado(dado);
  let d: CharacterDraft = { ...atual, level: nivel, hpRolls: [...anteriores, novo] };
  anteriores.forEach((v, i) => { if (!atual.hpRolls) d = decide2014(d, "hp-roll-confirmed-" + (i + 2), [String(v)]); });
  return decide2014(d, "hp-roll-confirmed-" + nivel, [String(novo)]);
}
/** Reaplica as escolhas feitas durante a subida (as que existem no novo nível). */
export function comEscolhas(base: CharacterDraft, escolhas: Record<string, string[]>): CharacterDraft {
  return Object.entries(escolhas).reduce((d, [id, ids]) => decide2014(d, id, ids), base);
}
/** Escolhas que surgem (ou aumentam) neste nível. */
export function escolhasNovas(antes: CharacterDraft, depois: CharacterDraft): Choice2014[] {
  const anteriores = new Map(choices2014(antes).map(c => [c.id, c.count]));
  return choices2014(depois).filter(c => !anteriores.has(c.id) || c.count > anteriores.get(c.id)!);
}
export const incompletas = (d: CharacterDraft, escolhas: Choice2014[]) => escolhas.filter(c => selected2014(d, c.id).length < c.count);

export function comparar(antes: CharacterDraft, depois: CharacterDraft) {
  const a = sheet2014({ ...antes, name: antes.name || "Sem nome", currentHp: 0 }), b = sheet2014({ ...depois, name: depois.name || "Sem nome", currentHp: 0 });
  const sa = statistics2014({ ...antes, name: antes.name || "Sem nome", currentHp: 0 }), sb = statistics2014({ ...depois, name: depois.name || "Sem nome", currentHp: 0 });
  const espacos = (v: number[]) => v.map((n, i) => (n ? `${i + 1}º: ${n}` : "")).filter(Boolean).join(" · ") || "nenhum";
  const novasCaracteristicas = b.features.filter(f => !a.features.includes(f));
  const daSubclasse = new Set(subclassFeatureIds2014(depois));
  const recursos = Object.entries(b.resources).filter(([id, r]) => !id.startsWith("spell-slot-") && id !== "hit-dice" && a.resources[id]?.maximum !== r.maximum)
    .map(([id, r]) => ({ id, antes: a.resources[id]?.maximum ?? 0, depois: r.maximum }));
  return {
    pv: [a.maxHp, b.maxHp] as const, dadosDeVida: [antes.level, depois.level] as const, proficiencia: [sa.prof, sb.prof] as const,
    atributos: (Object.keys(b.abilities) as (keyof typeof b.abilities)[]).filter(k => a.abilities[k] !== b.abilities[k]).map(k => ({ atributo: k, antes: a.abilities[k], depois: b.abilities[k] })),
    novasCaracteristicas, daSubclasse, recursos,
    espacos: [espacos(spellSlots2014(antes)), espacos(spellSlots2014(depois))] as const,
    cdMagia: [sa.spellDc, sb.spellDc] as const,
  };
}
