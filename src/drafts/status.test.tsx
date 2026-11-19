// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SYNC_LABEL, SyncStatus, deriveSyncState, downloadPending, exportFileName, memoryBackend, createDraftStore, usageMessage, type Usage } from "./index";

afterEach(cleanup);
const usage = (o: Partial<Usage> = {}): Usage => ({ count: 1, pendingCount: 1, conflictCount: 0, syncedCount: 0, bytes: 10, limitBytes: 100, ratio: 0.1, level: "ok", persistent: true, ...o });

describe("estados de salvamento", () => {
  it("rótulos em português: Salvo, Salvando, Pendente de sincronização, Offline, Conflito", () => {
    expect(Object.values(SYNC_LABEL)).toEqual(["Salvo", "Salvando…", "Pendente de sincronização", "Offline", "Conflito"]);
  });
  it("prioridade: conflito > salvando > offline > pendente > salvo", () => {
    const d = (status: "pending" | "conflict" | "synced") => ({ status });
    expect(deriveSyncState({ draft: d("conflict"), online: false, inflight: true })).toBe("conflict");
    expect(deriveSyncState({ draft: d("pending"), online: false, inflight: true })).toBe("saving");
    expect(deriveSyncState({ draft: d("pending"), online: false })).toBe("offline");
    expect(deriveSyncState({ draft: d("pending"), online: true })).toBe("pending");
    expect(deriveSyncState({ draft: d("synced"), online: true })).toBe("saved");
    expect(deriveSyncState({ online: true })).toBe("saved"); expect(deriveSyncState({ online: false })).toBe("offline");
  });
  it("o componente mostra o texto (não depende só de ícone/cor) e uma ajuda acessível", () => {
    const { rerender } = render(<SyncStatus state="pending"/>);
    expect(screen.getByRole("status").textContent).toContain("Pendente de sincronização"); expect(screen.getByRole("status").getAttribute("title")).toMatch(/guardadas neste aparelho/);
    for (const [s, l] of Object.entries(SYNC_LABEL)) { rerender(<SyncStatus state={s as keyof typeof SYNC_LABEL}/>); expect(screen.getByRole("status").textContent).toContain(l); }
  });
  it("avisos de espaço: nada quando normal; aviso, cheio e armazenamento indisponível aparecem como alerta", () => {
    expect(usageMessage(usage())).toBeNull();
    expect(usageMessage(usage({ level: "aviso", ratio: 0.85 }))).toMatch(/quase cheio \(85%/);
    expect(usageMessage(usage({ level: "cheio", ratio: 1 }))).toMatch(/Nada foi descartado/);
    expect(usageMessage(usage({ persistent: false }))).toMatch(/navegação privada/);
    render(<SyncStatus state="offline" usage={usage({ level: "cheio" })}/>);
    expect(screen.getByRole("alert").textContent).toMatch(/exporte os rascunhos pendentes/);
  });
});

describe("exportação em arquivo", () => {
  it("nome do arquivo seguro; sem pendentes não cria arquivo; com pendentes baixa o JSON", async () => {
    expect(exportFileName("camp/../x", new Date("2026-11-19T10:20:30Z"))).toBe("rascunhos-camp____x-2026-11-19-10-20-30.json");
    const s = createDraftStore({ backend: memoryBackend(), userId: "u1", campaignId: "c1", estimate: async () => undefined });
    const criar = vi.fn(() => "blob:x"); const revogar = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar }));
    expect(await downloadPending(s, "c1")).toBe(0); expect(criar).not.toHaveBeenCalled();
    await s.save({ kind: "note", entityId: "n1", content: "texto", baseVersion: 1 });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(await downloadPending(s, "c1")).toBe(1); expect(criar).toHaveBeenCalledTimes(1); expect(clique).toHaveBeenCalled();
    vi.unstubAllGlobals(); clique.mockRestore();
  });
});
