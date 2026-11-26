// @vitest-environment jsdom
// Início: enquadramento não destrutivo, persistência, isolamento entre campanhas, retratos e o diálogo único de edição.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { CampaignHome } from "./CampaignHome";
import { CampaignsProvider, activeKey } from "./CampaignsContext";
import type { CampaignApi, Membership } from "./campaigns";
import { createCapaApi, lerEnquadramento, type CapaApi, type Enquadramento } from "./capa";
import { fontePersonagens } from "./perfilPersonagem";
import { RegistrosProvider } from "./RegistrosContext";
import type { RegistrosApi } from "./registros";
import { fakeAuth, me, memoryStorage } from "./testUtils";

const mesa = (id: string, name: string, role: "mestre" | "jogador" = "mestre"): Membership => ({ role, campaign: { id, name, description: "", created_at: "" } });
const todas = [mesa("ca", "Mesa A"), mesa("cb", "Mesa B")];
const api = { list: async () => ({ ok: true, data: todas }), members: async () => ({ ok: true, data: [] }), invites: async () => ({ ok: true, data: [] }) } as unknown as CampaignApi;

/** Capa com a migração 0012: guarda a imagem original e o enquadramento separados, por campanha. */
function capaNaoDestrutiva() {
  const imagens = new Map<string, string>(), enq = new Map<string, Enquadramento>();
  const definir = vi.fn(async (c: string, f: File) => { imagens.set(c, `blob:${f.name}`); enq.delete(c); return { ok: true as const, data: `blob:${f.name}` }; });
  const salvar = vi.fn(async (c: string, e: Enquadramento) => { enq.set(c, e); return { ok: true as const, data: true as const }; });
  const capa = {
    obter: async (c: string) => ({ ok: true as const, data: imagens.get(c) ?? null }), definir,
    remover: async (c: string) => { imagens.delete(c); enq.delete(c); return { ok: true as const, data: true as const }; },
    enquadramento: async (c: string) => ({ ok: true as const, data: { suportado: true, valor: enq.get(c) ?? { zoom: 1, x: 50, y: 50 } } }), salvarEnquadramento: salvar,
  } as unknown as CapaApi;
  return { capa, imagens, enq, definir, salvar };
}
const montar = (capa: CapaApi, id = "ca", membro = todas) => {
  localStorage.setItem(activeKey(me.id), id);
  const lista = { ...api, list: async () => ({ ok: true, data: membro }) } as unknown as CampaignApi;
  const tela = (atual: string) => <AuthProvider client={fakeAuth(me).client}><CampaignsProvider apiFactory={() => lista}><RegistrosProvider api={null} capa={capa}><CampaignHome id={atual} onOpen={() => {}} onOpenContent={() => {}}/></RegistrosProvider></CampaignsProvider></AuthProvider>;
  const r = render(tela(id));
  return { ...r, trocar: (outro: string) => r.rerender(tela(outro)) };
};
const faixa = () => screen.getByAltText("Capa da campanha") as HTMLImageElement;
const abrir = async () => { fireEvent.click(await screen.findByRole("button", { name: "Editar informações" })); return within(await screen.findByRole("dialog", { name: "Editar campanha" })); };

beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (f: File) => `blob:${f.name}`, revokeObjectURL: () => {} })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("enquadramento da capa", () => {
  it("leitura segura: fora do formato ou dos limites nunca quebra a tela", () => {
    expect(lerEnquadramento(null)).toEqual({ zoom: 1, x: 50, y: 50 });
    expect(lerEnquadramento({ zoom: 9, x: -5, y: "a" })).toEqual({ zoom: 3, x: 0, y: 50 });
  });
  it("envia a imagem ORIGINAL, guarda só zoom e posição, e o ajuste volta ao reabrir", async () => {
    const m = capaNaoDestrutiva(); montar(m.capa);
    const d = await abrir();
    const original = new File(["x"], "original.png", { type: "image/png" });
    fireEvent.change(document.querySelector("input[type=file]")!, { target: { files: [original] } });
    const popup = await screen.findByRole("dialog", { name: "Enquadrar capa da campanha" });   // abre sozinho ao escolher o arquivo
    fireEvent.change(within(popup).getByLabelText("Zoom da imagem"), { target: { value: "1.5" } });
    const quadro = within(popup).getByRole("application", { name: "Posicionar a imagem" });
    for (let i = 0; i < 3; i++) { fireEvent.keyDown(quadro, { key: "ArrowLeft", shiftKey: true }); fireEvent.keyDown(quadro, { key: "ArrowDown", shiftKey: true }); }
    expect(within(popup).getByAltText("Prévia do enquadramento").style.objectPosition).toBe("20% 80%");   // a prévia é a mesma conta da faixa
    expect(m.definir).not.toHaveBeenCalled();                // nada gravado antes de confirmar
    fireEvent.click(within(popup).getByRole("button", { name: "Salvar enquadramento" }));
    await waitFor(() => expect(m.salvar).toHaveBeenCalledWith("ca", { zoom: 1.5, x: 20, y: 80 }));
    expect(m.definir).toHaveBeenCalledTimes(1); expect(m.definir.mock.calls[0][1]).toBe(original);   // sem recorte: o mesmo arquivo
    // ajustar de novo não reenvia a imagem
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Enquadrar capa da campanha" })).toBeNull());
    fireEvent.click(d.getByRole("button", { name: "Ajustar enquadramento" }));
    fireEvent.change(screen.getByLabelText("Zoom da imagem"), { target: { value: "2" } }); fireEvent.click(screen.getByRole("button", { name: "Salvar enquadramento" }));
    await waitFor(() => expect(m.enq.get("ca")?.zoom).toBe(2)); expect(m.definir).toHaveBeenCalledTimes(1);
    cleanup(); montar(m.capa);   // "recarregar a página" / outro aparelho
    await waitFor(() => expect(faixa().style.transform).toBe("scale(2)")); expect(faixa().style.objectPosition).toBe("20% 80%");
  });
  it("trocar de campanha não leva capa nem rascunho da anterior", async () => {
    const m = capaNaoDestrutiva(); m.imagens.set("ca", "blob:a.png"); m.enq.set("ca", { zoom: 2, x: 10, y: 10 });
    const tela = montar(m.capa); await waitFor(() => expect(faixa().style.transform).toBe("scale(2)"));
    tela.trocar("cb"); expect(await screen.findByText("Sem capa")).toBeTruthy(); expect(screen.queryByAltText("Capa da campanha")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Mesa B" })).toBeTruthy();
    tela.trocar("ca"); await waitFor(() => expect(faixa().getAttribute("src")).toBe("blob:a.png"));
  });
  it("cancelar o popup (botão ou Escape) descarta o ajuste sem gravar e mantém a edição da campanha aberta; Restaurar volta ao centro", async () => {
    const m = capaNaoDestrutiva(); m.imagens.set("ca", "blob:a.png"); montar(m.capa);
    const d = await abrir();
    fireEvent.click(await d.findByRole("button", { name: "Ajustar enquadramento" }));
    fireEvent.change(screen.getByLabelText("Zoom da imagem"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" })); expect(screen.getByLabelText("Zoom atual").textContent).toBe("100%");
    fireEvent.change(screen.getByLabelText("Zoom da imagem"), { target: { value: "2.5" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Enquadrar capa da campanha" })).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Enquadrar capa da campanha" })).toBeNull();
    fireEvent.click(d.getByRole("button", { name: "Ajustar enquadramento" }));
    fireEvent.keyDown(screen.getByRole("application", { name: "Posicionar a imagem" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Enquadrar capa da campanha" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Editar campanha" })).toBeTruthy();
    expect(faixa().style.transform).toBe("scale(1)"); expect(m.salvar).not.toHaveBeenCalled();
    fireEvent.click(d.getByRole("button", { name: "Fechar edição" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("jogador vê a capa enquadrada e não tem como editar", async () => {
    const m = capaNaoDestrutiva(); m.imagens.set("ca", "blob:a.png"); m.enq.set("ca", { zoom: 1.25, x: 30, y: 40 });
    montar(m.capa, "ca", [mesa("ca", "Mesa A", "jogador")]);
    await waitFor(() => expect(faixa().style.objectPosition).toBe("30% 40%"));
    expect(screen.queryByRole("button", { name: "Editar informações" })).toBeNull(); expect(document.querySelector("input[type=file]")).toBeNull();
  });
});

describe("API real da capa sem a migração 0012", () => {
  /** Cliente mínimo que responde como o PostgREST quando a coluna não existe. */
  const cliente = (comColuna: boolean) => {
    const updates: Record<string, unknown>[] = [];
    const resposta = (campos: string) => (!comColuna && campos.includes("cover_framing") ? { data: null, error: { code: "42703", message: "column campaigns.cover_framing does not exist" } } : { data: { cover_path: null, cover_framing: { zoom: 2, x: 1, y: 2 } }, error: null });
    const c = { from: () => ({ select: (campos: string) => ({ eq: () => ({ maybeSingle: async () => resposta(campos) }) }),
      update: (v: Record<string, unknown>) => ({ eq: () => ({ select: async () => { updates.push(v); return !comColuna && "cover_framing" in v ? { data: null, error: { code: "PGRST204", message: "Could not find the 'cover_framing' column" } } : { data: [{ id: "ca" }], error: null }; } }) }) }),
      storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: "https://x/y" }, error: null }) }) } };
    return { capa: createCapaApi(c as never), updates };
  };
  it("informa que não há suporte e continua trocando e removendo a imagem", async () => {
    const { capa, updates } = cliente(false);
    expect(await capa.enquadramento!("ca")).toEqual({ ok: true, data: { suportado: false, valor: { zoom: 1, x: 50, y: 50 } } });
    expect((await capa.definir("ca", new File(["x"], "a.png", { type: "image/png" }))).ok).toBe(true);
    expect((await capa.remover("ca")).ok).toBe(true);
    expect(updates.map(u => Object.keys(u))).toEqual([["cover_path", "cover_framing"], ["cover_path"], ["cover_path", "cover_framing"], ["cover_path"]]);
  });
  it("com a coluna: lê o enquadramento e troca a imagem zerando-o no mesmo update", async () => {
    const { capa, updates } = cliente(true);
    expect(await capa.enquadramento!("ca")).toEqual({ ok: true, data: { suportado: true, valor: { zoom: 2, x: 1, y: 2 } } });
    await capa.definir("ca", new File(["x"], "a.png", { type: "image/png" }));
    expect(updates).toHaveLength(1); expect(updates[0].cover_framing).toBeNull();
  });
});

describe("retratos dos aventureiros", () => {
  it("personagem guiado mostra só a imagem PÚBLICA (https) escolhida pelo jogador; privados ficam fora", async () => {
    const card = (imageUrl: string | null, name = "Lia") => ({ guiado: true, identidadePublica: { card: { imageUrl, title: "", name, surname: null, race: "Elfa", characterClass: "Barda", description: "" } } });
    const reg = { list: async () => ({ ok: true, data: [
      { id: "1", title: "Lia", visibility: "campaign", meta: card("https://exemplo.test/lia.png") },
      { id: "2", title: "Rui", visibility: "campaign", meta: card("http://inseguro.test/r.png", "Rui") },
      { id: "3", title: "Segredo", visibility: "private", meta: card("https://exemplo.test/s.png") },
    ] }) } as unknown as RegistrosApi;
    const r = await fontePersonagens(reg, null).listar("ca");
    expect(r.ok && r.data.map(a => [a.nome, a.retratoUrl, a.nivel])).toEqual([["Lia", "https://exemplo.test/lia.png", null], ["Rui", null, null]]);
  });
});
