// Exportação manual dos rascunhos pendentes (arquivo .json). O conteúdo nunca inclui ids de conta, tokens ou chaves.
import type { DraftStore } from "./store";

export function exportFileName(campaignId: string, at = new Date()): string {
  return `rascunhos-${campaignId.replace(/[^\w-]/g, "_").slice(0, 24)}-${at.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
}

/** Baixa o arquivo no navegador. Devolve a quantidade exportada (0 = nada pendente; nenhum arquivo é criado). */
export async function downloadPending(store: DraftStore, campaignId = "_pessoal"): Promise<number> {
  const { json, count } = await store.exportPending();
  if (!count) return 0;
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: exportFileName(campaignId) });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return count;
}
