// POLÍTICA de disponibilidade: o que o jogador pode pôr no próprio inventário. Não é "mundano contra mágico": é uma lista explícita.
// O restante só chega por entrega do mestre (ou, no futuro, pelo loot). A mesma lista vale no banco (migração 0013,
// `private.itens_livres`); `supabase/ficha-regras.test.ts` falha se as duas divergirem.
import { srdItem } from "./srd-2014-items";

/** Itens com raridade que o jogador pode adicionar: as poções comuns. */
export const LIBERADOS_COM_RARIDADE: readonly string[] = ["potion-of-healing-common", "potion-of-climbing"];

/** Itens do equipamento de origem que não são linhas do catálogo (`grantBackground2014`). */
export const ITENS_DE_ORIGEM: readonly string[] = ["background-prayer-book", "background-incense", "background-vestments", "background-trinket"];

export function jogadorPodeAdicionar(itemId: string): boolean {
  if (ITENS_DE_ORIGEM.includes(itemId)) return true;
  const d = srdItem(itemId);
  if (!d) return false;
  if (LIBERADOS_COM_RARIDADE.includes(d.id)) return true;
  return d.raridade === "mundano" && d.categoria !== "magico" && d.categoria !== "pergaminho";
}
