// Traduz as pendências do motor para linguagem de jogador e diz em que etapa cada uma se resolve.
import type { CharacterDraft, CharacterSheet } from "../rules/character-domain";
import { choices2014, origemEntregue2014, selected2014, type Choice2014 } from "./regras-2014";

export type EtapaId = "identidade" | "raca" | "classe" | "origem" | "atributos" | "equipamento" | "historia" | "revisao" | "publica";
export type Pendencia = { etapa: EtapaId; texto: string; chave: string };

/** Em que etapa se resolve cada escolha do motor. */
export function etapaDaEscolha(id: string): "raca" | "origem" | "classe" {
  if (/^(racial-|elf-|dwarf-|dragon-)/.test(id)) return "raca";
  if (/^background-/.test(id)) return "origem";
  return "classe";
}
export const equipamentoDaClasseAceito = (d: CharacterDraft) => selected2014(d, "equipment-accepted").includes("yes");

export function pendencias2014(draft: CharacterDraft, sheet: CharacterSheet): Pendencia[] {
  const escolhas = new Map<string, Choice2014>(choices2014(draft).map(c => [c.id, c]));
  const lista: Pendencia[] = [];
  const add = (etapa: EtapaId, texto: string, chave: string) => { if (!lista.some(p => p.chave === chave)) lista.push({ etapa, texto, chave }); };
  if (!draft.name.trim()) add("identidade", "Dê um nome ao personagem.", "nome");
  for (const p of sheet.pending) {
    const [tipo, alvo] = p.includes(":") && /^(duplicate-|invalid-|unknown-)/.test(p) ? [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)] : ["", p];
    const escolha = escolhas.get(alvo);
    if (/^hp-roll-confirmed-/.test(p)) { add("classe", `Confirme os PV rolados do nível ${p.slice("hp-roll-confirmed-".length)}.`, p); continue; }
    if (p === "background-feature") { add("origem", "Descreva a característica combinada com o mestre.", p); continue; }
    if (!escolha) continue;
    const etapa = etapaDaEscolha(alvo);
    if (tipo.startsWith("duplicate-")) add(etapa, `${escolha.name}: há uma escolha repetida; troque-a.`, p);
    else if (tipo === "invalid-expertise") add(etapa, `${escolha.name}: escolha só perícias que você tem.`, p);
    else { const feitas = selected2014(draft, alvo).length; add(etapa, `${escolha.name}: ${feitas} de ${escolha.count} escolhidas.`, p); }
  }
  if (!equipamentoDaClasseAceito(draft)) add("equipamento", "Confirme o equipamento inicial da classe.", "equipamento-classe");
  if (!origemEntregue2014(draft)) add("equipamento", "Adicione o equipamento da origem.", "equipamento-origem");
  return lista;
}
