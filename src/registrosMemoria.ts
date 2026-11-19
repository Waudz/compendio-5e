// Apoio aos testes (não é importado pelo app): API de registros em memória que imita a RLS de `notes`.
import type { Role } from "./campaigns";
import type { Registro, RegistrosApi } from "./registros";

export function registrosEmMemoria(papel: Role, uid = "u1", inicial: Registro[] = [], compartilhado?: { dados: Registro[] }): RegistrosApi & { dados: Registro[] } {
  const store = compartilhado ?? { dados: [...inicial] };
  const visivel = (r: Registro) => papel === "mestre" || r.visibility === "campaign";
  const negado = { ok: false as const, error: "Apenas o mestre pode fazer isso." };
  let n = 0;
  const api = {
    get dados() { return store.dados; },
    list: async (campaignId: string, kind: string) => ({ ok: true as const, data: store.dados.filter(r => r.campaignId === campaignId && r.kind === kind && visivel(r)) }),
    get: async (id: string) => { const r = store.dados.find(x => x.id === id); return { ok: true as const, data: r && visivel(r) ? r : null }; },
    create: async (x: Parameters<RegistrosApi["create"]>[0]) => {
      if (papel !== "mestre") return negado;
      const agora = new Date(Date.now() + n).toISOString();
      const r: Registro = { id: `n${++n}`, kind: x.kind, campaignId: x.campaignId, ownerId: uid, title: x.title.trim(), content: x.content ?? [], visibility: x.visibility ?? "private", meta: x.meta ?? {}, version: 1, createdAt: agora, updatedAt: agora };
      store.dados.push(r); return { ok: true as const, data: r };
    },
    update: async (id: string, version: number, p: Parameters<RegistrosApi["update"]>[2]) => {
      const i = store.dados.findIndex(x => x.id === id); if (i < 0 || papel !== "mestre") return negado;
      if (store.dados[i].version !== version) return { ok: false as const, error: "Outra pessoa alterou este registro. Recarregue para continuar." };
      store.dados[i] = { ...store.dados[i], ...p, title: p.title?.trim() ?? store.dados[i].title, version: version + 1, updatedAt: new Date(Date.now() + ++n).toISOString() };
      return { ok: true as const, data: store.dados[i] };
    },
    remove: async (id: string) => { if (papel !== "mestre") return negado; store.dados = store.dados.filter(x => x.id !== id); return { ok: true as const, data: true as const }; },
  };
  return api as unknown as RegistrosApi & { dados: Registro[] };
}
