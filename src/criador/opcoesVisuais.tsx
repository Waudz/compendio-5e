// Apresentação das raças e classes nos cartões de escolha: ícone temático e um resumo próprio (nada de texto de livros). Os números
// (bônus, dado de vida, deslocamento, salvaguardas) vêm dos dados SRD usados pelo motor.
import { Axe, Cog, Cross, Drama, Eye, Feather, Flame, Footprints, Hand, Leaf, Moon, Mountain, Music, Shield, Sparkles, Swords, Target, TreePine, User, VenetianMask, Wand2, type LucideIcon } from "lucide-react";
import dados from "./data/character-2014.json";
import { rotuloAtributo } from "./rotulos";

export const CLASSE_VISUAL: Record<string, { icone: LucideIcon; resumo: string }> = {
  barbarian: { icone: Axe, resumo: "Combatente resistente que luta tomado pela fúria." },
  bard: { icone: Music, resumo: "Artista que inspira aliados e conjura com a música." },
  cleric: { icone: Cross, resumo: "Servo de uma divindade, com magia de cura e proteção." },
  druid: { icone: Leaf, resumo: "Guardião da natureza que muda de forma." },
  fighter: { icone: Swords, resumo: "Mestre das armas e armaduras." },
  monk: { icone: Hand, resumo: "Lutador ágil que canaliza o ki." },
  paladin: { icone: Shield, resumo: "Guerreiro de um juramento sagrado." },
  ranger: { icone: Target, resumo: "Caçador e rastreador das terras selvagens." },
  rogue: { icone: VenetianMask, resumo: "Especialista em furtividade e golpes precisos." },
  sorcerer: { icone: Flame, resumo: "Conjurador com magia no próprio sangue." },
  warlock: { icone: Eye, resumo: "Conjurador que firmou um pacto sobrenatural." },
  wizard: { icone: Wand2, resumo: "Estudioso que registra magias no grimório." },
};
export const RACA_VISUAL: Record<string, { icone: LucideIcon; resumo: string }> = {
  "hill-dwarf": { icone: Mountain, resumo: "Anão robusto e atento." },
  "high-elf": { icone: TreePine, resumo: "Elfo gracioso com dom arcano." },
  "lightfoot-halfling": { icone: Footprints, resumo: "Pequeno, sortudo e difícil de notar." },
  human: { icone: User, resumo: "Versátil em tudo o que faz." },
  dragonborn: { icone: Flame, resumo: "Herdeiro de dragões, com arma de sopro." },
  "rock-gnome": { icone: Cog, resumo: "Pequeno inventor de mente afiada." },
  "half-elf": { icone: Moon, resumo: "Entre dois mundos, hábil e carismático." },
  "half-orc": { icone: Axe, resumo: "Forte e implacável na batalha." },
  tiefling: { icone: Drama, resumo: "Marcado por uma herança infernal." },
};
export const iconeDaRaca = (id: string) => RACA_VISUAL[id]?.icone ?? Feather;
export const iconeDaClasse = (id: string) => CLASSE_VISUAL[id]?.icone ?? Sparkles;

type Bonus = { ability_score: { index: string }; bonus: number };
type Raca = { index: string; speed: number; size: string; ability_bonuses: Bonus[] };
type SubRaca = { index: string; race: { index: string }; ability_bonuses: Bonus[] };
/** Bônus de atributo e deslocamento da raça (com a sub-raça), dos dados SRD. */
export function numerosDaRaca(id: string): string {
  const sub = (dados.subraces as unknown as SubRaca[]).find(s => s.index === id);
  const raca = (dados.races as unknown as Raca[]).find(r => r.index === (sub?.race.index ?? id));
  if (!raca) return "";
  const bonus = [...raca.ability_bonuses, ...(sub?.ability_bonuses ?? [])].map(b => `+${b.bonus} ${rotuloAtributo(b.ability_score.index)}`);
  return [bonus.join(", "), `${(raca.speed * 0.3).toLocaleString("pt-BR")} m`, raca.size === "Small" ? "Pequeno" : "Médio"].filter(Boolean).join(" · ");
}
