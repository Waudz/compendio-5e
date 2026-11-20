// @vitest-environment jsdom
// Etapa 1: login obrigatório, sem visitante, e isolamento dos dados locais entre contas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccountPanel } from "./AccountPanel";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthContext";
import type { CampaignApi, Membership } from "./campaigns";
import { KEY_PREFIX, clearLegacyLocalData, clearUserLocalData } from "./localData";
import { storageKey } from "./persistence";
import { cacheKey, keyBelongsTo } from "./scope";
import { fakeAuth, me, memoryStorage, other, renderApp } from "./testUtils";

const scopeOf = (u: string, c = "nenhuma") => ({ user: u, campaign: c, device: "navegador" });
const layoutKey = (u: string, c = "nenhuma") => storageKey(scopeOf(u, c));
const nav = (name: string) => within(screen.getByRole("navigation", { name: "Menu principal" })).getByRole("button", { name });
const tabNames = () => [...document.querySelectorAll(".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content")].map(e => e.textContent);
const campApi = (m: Membership[]) => ({ list: async () => ({ ok: true, data: m }), members: async () => ({ ok: true, data: [] }), invites: async () => ({ ok: true, data: [] }) }) as unknown as CampaignApi;

let store: ReturnType<typeof memoryStorage>;
let mobile = false;
beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal("localStorage", store);
  mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.history.pushState({}, "", "/");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("porta de entrada: sem sessão, nada do aplicativo", () => {
  const gate = (client: ReturnType<typeof fakeAuth>["client"] | null) => render(<AuthProvider client={client}><AuthGate><div data-testid="app">APP</div></AuthGate></AuthProvider>);

  it("sem Supabase configurado: o app não abre", () => {
    gate(null);
    expect(screen.getByText(/Ambiente não configurado/)).toBeTruthy();
    expect(screen.queryByTestId("app")).toBeNull();
  });
  it("carregando a sessão: o app não abre", () => {
    gate(fakeAuth(null).client);
    expect(screen.getByRole("status").textContent).toMatch(/Carregando sessão/);
    expect(screen.queryByTestId("app")).toBeNull();
  });
  it("sem sessão: só login/cadastro/recuperação; e a tela não menciona visitante", async () => {
    gate(fakeAuth(null).client);
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
    expect(screen.queryByTestId("app")).toBeNull();
    expect(document.body.textContent).not.toMatch(/visitante/i);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" })); expect(screen.getByRole("heading", { name: "Criar conta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Esqueci a senha" })); expect(screen.getByRole("heading", { name: "Recuperar senha" })).toBeTruthy();
  });
  it("com sessão: abre o app; ao sair, o app some e volta o login", async () => {
    const auth = fakeAuth(me);
    render(<AuthProvider client={auth.client}><AuthGate><div data-testid="app">APP</div></AuthGate></AuthProvider>);
    expect(await screen.findByTestId("app")).toBeTruthy();
    await auth.emit("SIGNED_OUT", null);
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
    expect(screen.queryByTestId("app")).toBeNull();
  });
  it("recuperação de senha: antes de qualquer app, exige definir a nova senha", async () => {
    const auth = fakeAuth(null);
    render(<AuthProvider client={auth.client}><AuthGate><div data-testid="app">APP</div></AuthGate></AuthProvider>);
    await screen.findByRole("heading", { name: "Entrar" });
    await auth.emit("PASSWORD_RECOVERY", { user: me });
    expect(await screen.findByRole("heading", { name: "Definir nova senha" })).toBeTruthy();
    expect(screen.queryByTestId("app")).toBeNull();
  });
  it("convite na URL é mantido e anunciado na porta de entrada", async () => {
    window.history.pushState({}, "", "/?convite=ABCDEFGHIJKL");
    gate(fakeAuth(null).client);
    expect(await screen.findByText(/Você recebeu um convite de campanha/)).toBeTruthy();
    expect(window.location.search).toBe("?convite=ABCDEFGHIJKL");
  });
  it("a aba Conta não renderiza nada sem sessão", () => {
    const { container } = render(<AuthProvider client={fakeAuth(null).client}><AccountPanel/></AuthProvider>);
    expect(container.textContent).toBe("");
  });
});

describe("recuperação de senha", () => {
  it("ao salvar a nova senha, a recuperação termina e o app abre (não fica preso na tela de senha)", async () => {
    const updateUser = vi.fn(async () => ({ data: {}, error: null }));
    const auth = fakeAuth(null);
    (auth.client as unknown as { auth: Record<string, unknown> }).auth.updateUser = updateUser;
    render(<AuthProvider client={auth.client}><AuthGate><div data-testid="app">APP</div></AuthGate></AuthProvider>);
    await screen.findByRole("heading", { name: "Entrar" });
    await auth.emit("PASSWORD_RECOVERY", { user: me });
    await screen.findByRole("heading", { name: "Definir nova senha" });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "novasenha1" } });
    fireEvent.change(screen.getByLabelText("Repita a nova senha"), { target: { value: "novasenha1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    expect(await screen.findByTestId("app")).toBeTruthy();
    expect(updateUser).toHaveBeenCalledWith({ password: "novasenha1" });
  });
});

describe("isolamento dos dados locais entre contas", () => {
  it("logout apaga tudo que pertence à conta e preserva o que é de outras contas ou não é do app", async () => {
    const a = layoutKey(me.id), b = layoutKey(other.id), act = `${KEY_PREFIX}active-campaign:${me.id}`;
    localStorage.setItem(a, "A"); localStorage.setItem(layoutKey(me.id, "c9"), "A9"); localStorage.setItem(act, "c9");
    localStorage.setItem(b, "B"); localStorage.setItem("outra-coisa", "x");
    const { auth } = await renderApp();
    await auth.emit("SIGNED_OUT", null);
    await screen.findByRole("heading", { name: "Entrar" });
    expect(localStorage.getItem(a)).toBeNull(); expect(localStorage.getItem(layoutKey(me.id, "c9"))).toBeNull(); expect(localStorage.getItem(act)).toBeNull();
    expect(localStorage.getItem(b)).toBe("B"); expect(localStorage.getItem("outra-coisa")).toBe("x");
  });

  it("troca de conta sem recarregar: a segunda conta nunca vê abas, estado ou menus da primeira", async () => {
    const { auth } = await renderApp();
    fireEvent.click(nav("Compêndio"), { ctrlKey: true }); fireEvent.click(nav("Documentos"), { ctrlKey: true });
    expect(tabNames()).toEqual(["Personagens", "Compêndio", "Documentos"]);
    await auth.emit("SIGNED_OUT", null);
    await screen.findByRole("heading", { name: "Entrar" });
    await auth.emit("SIGNED_IN", { user: other });
    await screen.findByRole("navigation", { name: "Menu principal" });
    expect(tabNames()).toEqual(["Personagens"]);                                         // layout padrão da conta B
    expect(localStorage.getItem(layoutKey(me.id))).toBeNull();                           // e o da A foi apagado
  });

  it("troca direta (A -> B sem SIGNED_OUT): remonta o app e apaga os dados locais de A", async () => {
    const { auth } = await renderApp();
    fireEvent.click(nav("Encontros"));
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));                // estado de interface da conta A
    expect(localStorage.getItem(layoutKey(me.id))).not.toBeNull();
    await auth.emit("SIGNED_IN", { user: other });
    await waitFor(() => expect(localStorage.getItem(layoutKey(me.id))).toBeNull());
    expect(tabNames()).toEqual(["Personagens"]);
    expect(document.querySelector(".sidebar.collapsed")).toBeNull();                       // o estado de A não sobrevive: o app foi remontado
  });

  it("restos do modo visitante e do layout v1 são removidos ao iniciar, sem tocar em dados de contas", async () => {
    localStorage.setItem(`${KEY_PREFIX}workspace:columns:v1`, "{}");
    localStorage.setItem(`${KEY_PREFIX}workspace:v2:visitante:demo:navegador`, "{}");
    localStorage.setItem(`${KEY_PREFIX}workspace:v2:visitante:nenhuma:navegador`, "{}");
    localStorage.setItem(layoutKey(other.id), "B");
    await renderApp();
    expect(localStorage.getItem(`${KEY_PREFIX}workspace:columns:v1`)).toBeNull();
    expect(localStorage.getItem(`${KEY_PREFIX}workspace:v2:visitante:demo:navegador`)).toBeNull();
    expect(localStorage.getItem(`${KEY_PREFIX}workspace:v2:visitante:nenhuma:navegador`)).toBeNull();
    expect(localStorage.getItem(layoutKey(other.id))).toBe("B");
  });

  it("o layout de uma conta não é lido por outra, nem com o mesmo navegador e o mesmo dispositivo", async () => {
    localStorage.setItem(layoutKey(me.id), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", weight: 100, children: [{ type: "tab", id: "secao:documentos" }] }] } }));
    await renderApp({ user: other });
    expect(tabNames()).toEqual(["Personagens"]);
  });
});

const medir = () => vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);   // o jsdom não mede; sem isso o FlexLayout não desenha o conteúdo

describe("layout guarda só ids (nunca títulos)", () => {
  const m: Membership = { role: "mestre", campaign: { id: "c1", name: "Segredo da Mesa Sombria", description: "desc", created_at: "" } };

  it("o título da campanha aparece na aba, mas não é gravado no aparelho", async () => {
    medir();
    await renderApp({ api: campApi([m]) });
    fireEvent.click(screen.getByRole("button", { name: "Nenhuma campanha ativa: escolher ou criar" }));
    fireEvent.click(within((await screen.findByText("Segredo da Mesa Sombria")).closest("li")!).getByRole("button", { name: "Abrir" }));
    expect(tabNames()).toContain("Segredo da Mesa Sombria");
    const dump = store.key(0) === null ? "" : [...Array(store.length).keys()].map(i => `${store.key(i)}=${store.getItem(store.key(i)!)}`).join("\n");
    expect(dump).toContain("campanha:c1");
    expect(dump).not.toContain("Segredo da Mesa Sombria");
    expect(dump).not.toMatch(/"name"/);
  });

  it("ao recarregar, o título vem da API; um layout antigo com nomes salvos não os exibe", async () => {
    medir();
    localStorage.setItem(layoutKey(me.id), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", weight: 100, selected: 1, children: [
      { type: "tab", id: "secao:personagens", name: "Nome antigo vazado" }, { type: "tab", id: "campanha:c1", name: "Titulo antigo vazado" }] }] } }));
    await renderApp({ api: campApi([m]) });
    const tabs = tabNames();
    expect(tabs).toEqual(["Personagens", "Segredo da Mesa Sombria"]);
    expect(document.body.textContent).not.toMatch(/vazado/);
  });

  it("campanha sem acesso (removido) cai no rótulo genérico, sem revelar o nome", async () => {
    medir();
    localStorage.setItem(layoutKey(me.id), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", weight: 100, selected: 1, children: [
      { type: "tab", id: "secao:personagens" }, { type: "tab", id: "campanha:c1" }] }] } }));
    await renderApp({ api: campApi([]) });
    expect(tabNames()).toEqual(["Personagens", "Campanha"]);
    expect(screen.getByText(/não participa desta campanha/)).toBeTruthy();
  });
});

describe("clearUserLocalData / clearLegacyLocalData / chaves de cache (unidade)", () => {
  it("não confunde usuários cujo id é prefixo do outro", () => {
    const s = memoryStorage();
    s.setItem(`${KEY_PREFIX}workspace:v2:u1:nenhuma:navegador`, "1"); s.setItem(`${KEY_PREFIX}workspace:v2:u10:nenhuma:navegador`, "10");
    s.setItem(`${KEY_PREFIX}active-campaign:u1`, "x"); s.setItem(`${KEY_PREFIX}active-campaign:u10`, "y"); s.setItem("fora:u1:", "z");
    expect(clearUserLocalData("u1", s)).toBe(2);
    expect(s.getItem(`${KEY_PREFIX}workspace:v2:u10:nenhuma:navegador`)).toBe("10"); expect(s.getItem(`${KEY_PREFIX}active-campaign:u10`)).toBe("y"); expect(s.getItem("fora:u1:")).toBe("z");
  });
  it("sem id de usuário ou sem armazenamento, não faz nada nem lança", () => {
    expect(clearUserLocalData("", memoryStorage())).toBe(0); expect(clearUserLocalData("u1", null)).toBe(0); expect(clearLegacyLocalData(null)).toBe(0);
  });
  it("chaves de cache sempre carregam usuário e campanha; limpeza por escopo", () => {
    const k = cacheKey("u1", "c1", "notas", 3);
    expect(k).toEqual(["u1", "c1", "notas", 3]);
    expect(keyBelongsTo(k, "u1")).toBe(true); expect(keyBelongsTo(k, "u1", "c1")).toBe(true);
    expect(keyBelongsTo(k, "u1", "c2")).toBe(false); expect(keyBelongsTo(k, "u2")).toBe(false);
    expect(keyBelongsTo(cacheKey("u1", null, "pessoais"), "u1", null)).toBe(true);
    expect(() => cacheKey("", "c1")).toThrow();
  });
});
