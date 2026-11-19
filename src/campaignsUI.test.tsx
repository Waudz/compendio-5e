// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider, activeKey } from "./CampaignsContext";
import { normalizeCode, type Campaign, type CampaignApi, type Invite, type Member, type Membership, type Res } from "./campaigns";
import { storageKey } from "./persistence";

const me = { id: "me", email: "eu@exemplo.com" } as User;
const camp = (id: string, name: string): Campaign => ({ id, name, description: `desc ${name}`, created_at: "2026-01-01T00:00:00Z" });
const ok = <T,>(data: T): Res<T> => ({ ok: true, data });

/** API de campanhas em memória: simula as respostas do servidor, inclusive recusas de permissão. */
function fakeApi(state: { memberships: Membership[]; members?: Member[]; invites?: Invite[]; listError?: string }) {
  const api = {
    list: vi.fn(async (): Promise<Res<Membership[]>> => state.listError ? { ok: false, error: state.listError } : ok([...state.memberships])),
    create: vi.fn(async (name: string): Promise<Res<string>> => { state.memberships.push({ role: "mestre", campaign: camp("new1", name) }); return ok("new1"); }),
    update: vi.fn(async (id: string, name: string, description: string): Promise<Res<Campaign>> => { const m = state.memberships.find(x => x.campaign.id === id)!; m.campaign = { ...m.campaign, name, description }; return ok(m.campaign); }),
    remove: vi.fn(async (id: string): Promise<Res<true>> => { state.memberships = state.memberships.filter(m => m.campaign.id !== id); return ok(true); }),
    join: vi.fn(async (code: string): Promise<Res<string>> => normalizeCode(code) === "ABCDEFGHIJKL" ? (state.memberships.push({ role: "jogador", campaign: camp("j1", "Mesa do Caio") }), ok("j1")) : { ok: false, error: "Convite inválido, expirado ou esgotado." }),
    members: vi.fn(async (): Promise<Res<Member[]>> => ok(state.members ?? [])),
    removeMember: vi.fn(async (_c: string, uid: string): Promise<Res<true>> => { state.members = state.members?.filter(x => x.user_id !== uid); return ok(true); }),
    invites: vi.fn(async (): Promise<Res<Invite[]>> => ok(state.invites ?? [])),
    createInvite: vi.fn(async (): Promise<Res<string>> => { state.invites = [...(state.invites ?? []), { id: "i2", code: "NEWCODE12345", expires_at: "2030-01-01T00:00:00Z", max_uses: 5, uses: 0 }]; return ok("NEWCODE12345"); }),
    revokeInvite: vi.fn(async (id: string): Promise<Res<true>> => { state.invites = state.invites?.filter(i => i.id !== id); return ok(true); }),
  };
  return api;
}

const authClient = (user: User | null) => ({ auth: {
  getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }) as unknown as SupabaseClient;

function mount(api: ReturnType<typeof fakeApi> | null, user: User | null = me) {
  return render(<AuthProvider client={authClient(user)}><CampaignsProvider apiFactory={() => api as unknown as CampaignApi}><App/></CampaignsProvider></AuthProvider>);
}
const nav = (name: string) => within(screen.getByRole("navigation", { name: "Menu principal" })).getByRole("button", { name });
/** O jsdom não mede tamanhos, então o conteúdo do FlexLayout não é desenhado: usamos a visão simples (celular), que usa o mesmo estado e os mesmos painéis. */
const openMobile = async (section: string) => { fireEvent.click(await screen.findByRole("button", { name: section })); };
const fill = (label: string | RegExp, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

describe("campanhas (interface)", () => {
  it("visitante: a seção pede login e não chama o servidor", async () => {
    mount(null, null);
    fireEvent.click(await screen.findByRole("button", { name: "Campanhas" }));
    expect(await screen.findByText(/Entre na sua conta para criar campanhas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Entrar ou criar conta" }));
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
  });

  it("lista campanhas do usuário com papel, e estado vazio", async () => {
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }, { role: "jogador", campaign: camp("c2", "Costa Rubra") }] });
    mount(api); await openMobile("Campanhas");
    expect(await screen.findByText("Festival da Lua")).toBeTruthy(); expect(screen.getByText("Costa Rubra")).toBeTruthy();
    expect(screen.getAllByText("Mestre").length).toBeGreaterThan(0); expect(screen.getAllByText("Jogador").length).toBeGreaterThan(0);
    cleanup(); mount(fakeApi({ memberships: [] })); await openMobile("Campanhas");
    expect(await screen.findByText(/ainda não participa de nenhuma campanha/)).toBeTruthy();
  });

  it("erro ao carregar mostra alerta e permite tentar de novo", async () => {
    const state = { memberships: [{ role: "mestre" as const, campaign: camp("c1", "Festival da Lua") }], listError: "Sem conexão com o servidor. Tente de novo." };
    const api = fakeApi(state); mount(api); await openMobile("Campanhas");
    expect((await screen.findByRole("alert")).textContent).toMatch(/Sem conexão/);
    state.listError = undefined as unknown as string;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Festival da Lua")).toBeTruthy();
  });

  it("criar campanha: valida nome, cria e abre a aba da campanha", async () => {
    const api = fakeApi({ memberships: [] }); mount(api); await openMobile("Campanhas");
    await screen.findByText(/ainda não participa/);
    fireEvent.click(screen.getByRole("button", { name: "Criar campanha" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/nome/i); expect(api.create).not.toHaveBeenCalled();
    fill("Nome", "Nova Mesa"); fireEvent.click(screen.getByRole("button", { name: "Criar campanha" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith("Nova Mesa", ""));
    expect(await screen.findByRole("heading", { name: "Nova Mesa" })).toBeTruthy(); // aba aberta dentro do app
  });

  it("entrar com convite: código inválido (local e do servidor) e válido", async () => {
    const api = fakeApi({ memberships: [] }); mount(api); await openMobile("Campanhas");
    await screen.findByText(/ainda não participa/);
    fill("Código ou link do convite", "123"); fireEvent.click(screen.getByRole("button", { name: "Entrar na campanha" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/12 letras/); expect(api.join).not.toHaveBeenCalled();
    fill("Código ou link do convite", "ZZZZZZZZZZZZ"); fireEvent.click(screen.getByRole("button", { name: "Entrar na campanha" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Convite inválido/));
    fill("Código ou link do convite", "abcd-efgh-ijkl"); fireEvent.click(screen.getByRole("button", { name: "Entrar na campanha" }));
    expect(await screen.findByText("Mesa do Caio")).toBeTruthy();
  });

  it("uma única campanha ativa: ativar troca o rótulo do menu e o espaço de trabalho", async () => {
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }, { role: "jogador", campaign: camp("c2", "Costa Rubra") }] });
    mount(api); await openMobile("Campanhas");
    const first = await screen.findByText("Festival da Lua");
    expect(screen.getByText("Nenhuma")).toBeTruthy();
    fireEvent.click(within(first.closest("li")!).getByRole("button", { name: "Tornar ativa" }));
    await waitFor(() => expect(document.querySelector(".campaign strong")?.textContent).toBe("Festival da Lua"));
    expect(localStorage.getItem(activeKey("me"))).toBe("c1");
    await openMobile("Campanhas"); // trocar de campanha troca o espaço de trabalho; a nova campanha começa com o layout padrão
    const second = await screen.findByText("Costa Rubra");
    fireEvent.click(within(second.closest("li")!).getByRole("button", { name: "Tornar ativa" }));
    await waitFor(() => expect(document.querySelector(".campaign strong")?.textContent).toBe("Costa Rubra"));
    await openMobile("Campanhas");
    await waitFor(() => expect(screen.getAllByText("Ativa")).toHaveLength(1));
    // cada campanha tem o seu layout salvo, e o do visitante é outro
    expect(localStorage.getItem(storageKey({ user: "me", campaign: "c2", device: "navegador" }))).not.toBeNull();
    expect(localStorage.getItem(storageKey({ user: "me", campaign: "c1", device: "navegador" }))).not.toBeNull();
  });

  it("campanha ativa salva é restaurada; se o usuário não participa mais, é descartada", async () => {
    localStorage.setItem(activeKey("me"), "c2");
    mount(fakeApi({ memberships: [{ role: "jogador", campaign: camp("c2", "Costa Rubra") }] }));
    await waitFor(() => expect(document.querySelector(".campaign strong")?.textContent).toBe("Costa Rubra"));
    cleanup(); localStorage.setItem(activeKey("me"), "removida");
    mount(fakeApi({ memberships: [{ role: "jogador", campaign: camp("c2", "Costa Rubra") }] }));
    await waitFor(() => expect(document.querySelector(".campaign strong")?.textContent).toBe("Nenhuma"));
  });
});

describe("campanha (detalhes, mestre x jogador)", () => {
  const members: Member[] = [
    { user_id: "me", role: "mestre", joined_at: "", display_name: "Eu" },
    { user_id: "u2", role: "jogador", joined_at: "", display_name: "Bia" }];
  const invites: Invite[] = [{ id: "i1", code: "ABCDEFGHIJKL", expires_at: "2030-01-01T00:00:00Z", max_uses: 5, uses: 1 }];
  const openCampaign = async (name: string) => { await openMobile("Campanhas"); const li = (await screen.findByText(name)).closest("li")!; fireEvent.click(within(li).getByRole("button", { name: "Abrir" })); };

  it("mestre: edita informações, remove jogadores e administra convites", async () => {
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }], members: structuredClone(members), invites: structuredClone(invites) });
    mount(api); await openCampaign("Festival da Lua");
    expect(await screen.findByText("Bia")).toBeTruthy(); expect(screen.getByText(/convite=ABCDEFGHIJKL/)).toBeTruthy();
    fill("Nome", "Festival Renomeado"); fireEvent.click(screen.getByRole("button", { name: "Salvar informações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("c1", "Festival Renomeado", "desc Festival da Lua"));
    expect(await screen.findByRole("heading", { name: "Festival Renomeado" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tornar mestre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tornar jogador" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sair da campanha" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Criar convite" }));
    expect(await screen.findByText(/convite=NEWCODE12345/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Revogar" })[0]);
    await waitFor(() => expect(api.revokeInvite).toHaveBeenCalledWith("i1"));
  });

  it("jogador: vê participantes, mas não edita, não vê convites nem administra ninguém", async () => {
    const api = fakeApi({ memberships: [{ role: "jogador", campaign: camp("c2", "Costa Rubra") }], members: structuredClone(members) });
    mount(api); await openCampaign("Costa Rubra");
    expect(await screen.findByText("Bia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar informações" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar convite" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tornar mestre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir campanha" })).toBeNull();
    expect(api.invites).not.toHaveBeenCalled();
    expect(screen.getByText("desc Costa Rubra")).toBeTruthy();
  });

  it("mestre único: nenhum participante pode receber promoção pela interface", async () => {
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }], members: structuredClone(members), invites: [] });
    mount(api); await openCampaign("Festival da Lua");
    expect(await screen.findByText("Bia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tornar mestre" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tornar jogador" })).toBeNull();
  });

  it("excluir campanha exige confirmação", async () => {
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }], members: structuredClone(members), invites: [] });
    mount(api); await openCampaign("Festival da Lua");
    fireEvent.click(await screen.findByRole("button", { name: "Excluir campanha" }));
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir campanha" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("c1"));
  });

  it("campanha de que o usuário não participa não mostra nada", async () => {
    mount(fakeApi({ memberships: [] }));
    await openMobile("Campanhas");
    expect(nav).toBeDefined();
    expect(screen.queryByText("Festival da Lua")).toBeNull();
  });
});

describe("convites por link", () => {
  const withInvite = (code = "ABCDEFGHIJKL") => window.history.pushState({}, "", `/?convite=${code}`);
  afterEach(() => window.history.pushState({}, "", "/"));

  it("mestre vê o link completo e o botão copia exatamente esse link", async () => {
    const writeText = vi.fn(async () => {}); vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }], members: [], invites: [{ id: "i1", code: "ABCDEFGHIJKL", expires_at: "2030-01-01T00:00:00Z", max_uses: 5, uses: 0 }] });
    mount(api); await openMobile("Campanhas");
    fireEvent.click(within((await screen.findByText("Festival da Lua")).closest("li")!).getByRole("button", { name: "Abrir" }));
    expect(await screen.findByText(/\?convite=ABCDEFGHIJKL$/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^https?:\/\/[^/]+\/compendio-5e\/\?convite=ABCDEFGHIJKL$/));
  });

  it("abrir o link logado: entra automaticamente como jogador, limpa a URL e abre a campanha", async () => {
    withInvite();
    const api = fakeApi({ memberships: [], members: [] }); mount(api);
    await waitFor(() => expect(api.join).toHaveBeenCalledWith("ABCDEFGHIJKL"));
    expect(api.join).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Mesa do Caio" })).toBeTruthy();   // entrou, ficou ativa e a aba dela abriu
    expect(window.location.search).toBe("");
    expect(document.querySelector(".campaign strong")?.textContent).toBe("Mesa do Caio");
  });

  it("visitante com link: pede login mantendo o convite e aceita automaticamente após autenticar", async () => {
    withInvite();
    const f = { user: null as User | null };
    const listeners: ((e: string, s: { user: User } | null) => void)[] = [];
    const client = { auth: { getSession: async () => ({ data: { session: f.user ? { user: f.user } : null }, error: null }),
      onAuthStateChange: (l: (e: string, s: { user: User } | null) => void) => { listeners.push(l); return { data: { subscription: { unsubscribe() {} } } }; } } } as unknown as SupabaseClient;
    const api = fakeApi({ memberships: [], members: [] });
    render(<AuthProvider client={client}><CampaignsProvider apiFactory={() => api as unknown as CampaignApi}><App/></CampaignsProvider></AuthProvider>);
    expect(await screen.findByText(/Você recebeu um convite de campanha/)).toBeTruthy();
    expect(window.location.search).toBe("?convite=ABCDEFGHIJKL");   // a URL não é limpa antes de entrar
    listeners.forEach(l => l("SIGNED_IN", { user: me }));
    await waitFor(() => expect(api.join).toHaveBeenCalledWith("ABCDEFGHIJKL"));
    expect(await screen.findByRole("heading", { name: "Mesa do Caio" })).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("aceita o link completo colado no campo", async () => {
    const api = fakeApi({ memberships: [], members: [] }); mount(api); await openMobile("Campanhas");
    await screen.findByText(/ainda não participa/);
    fill("Código ou link do convite", "https://waudz.github.io/compendio-5e/?convite=abcdefghijkl");
    fireEvent.click(screen.getByRole("button", { name: "Entrar na campanha" }));
    await waitFor(() => expect(api.join).toHaveBeenCalledWith("abcdefghijkl"));
  });

  it("convite expirado, esgotado ou revogado: erro claro, nada é criado, a URL permanece para nova tentativa", async () => {
    withInvite("ZZZZZZZZZZZZ");
    const api = fakeApi({ memberships: [], members: [] }); mount(api);
    await waitFor(() => expect(api.join).toHaveBeenCalledWith("ZZZZZZZZZZZZ"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Convite inválido, expirado ou esgotado/);
    expect(window.location.search).toBe("?convite=ZZZZZZZZZZZZ");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(screen.queryByText("Mesa do Caio")).toBeNull();
  });

  it("e-mails de confirmação e de recuperação preservam o convite no redirecionamento", async () => {
    withInvite();
    const { createAuthApi } = await import("./auth");
    const signUp = vi.fn(async () => ({ data: { user: { identities: [{}] }, session: null }, error: null }));
    const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
    const api = createAuthApi({ auth: { signUp, resetPasswordForEmail } } as unknown as SupabaseClient);
    await api.signUp("a@b.co", "12345678"); await api.requestReset("a@b.co");
    expect((signUp.mock.calls[0] as unknown as [{ options: { emailRedirectTo: string } }])[0].options.emailRedirectTo).toMatch(/\?convite=ABCDEFGHIJKL$/);
    expect((resetPasswordForEmail.mock.calls[0] as unknown as [string, { redirectTo: string }])[1].redirectTo).toMatch(/\?convite=ABCDEFGHIJKL$/);
    withInvite("x; drop table");   // valor inválido nunca é propagado
    await api.signUp("a@b.co", "12345678");
    expect((signUp.mock.calls[1] as unknown as [{ options: { emailRedirectTo: string } }])[0].options.emailRedirectTo).not.toMatch(/convite/);
  });
});

describe("mestre único: sair e remover", () => {
  const open = async (name: string) => { await openMobile("Campanhas"); const li = (await screen.findByText(name)).closest("li")!; fireEvent.click(within(li).getByRole("button", { name: "Abrir" })); };

  it("jogador pode sair voluntariamente; o mestre não aparece como removível", async () => {
    const api = fakeApi({ memberships: [{ role: "jogador", campaign: camp("c2", "Costa Rubra") }], members: [
      { user_id: "u2", role: "mestre", joined_at: "", display_name: "Ana" }, { user_id: "me", role: "jogador", joined_at: "", display_name: "Eu" }] });
    mount(api); await open("Costa Rubra");
    expect(await screen.findByText("Ana")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sair da campanha" }));
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith("c2", "me"));
  });

  it("mestre não sai da própria campanha, remove jogadores e pode excluir; sem opções de papel", async () => {
    const api = fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Festival da Lua") }], invites: [], members: [
      { user_id: "me", role: "mestre", joined_at: "", display_name: "Eu" }, { user_id: "u2", role: "jogador", joined_at: "", display_name: "Bia" }] });
    mount(api); await open("Festival da Lua");
    expect(await screen.findByText("Bia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sair da campanha" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Remover" })).toHaveLength(1);   // só o jogador
    expect(screen.queryByRole("button", { name: /Tornar (mestre|jogador)/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith("c1", "u2"));
    expect(screen.getByRole("button", { name: "Excluir campanha" })).toBeTruthy();
  });

  it("a mesma pessoa é mestre de uma campanha e jogadora de outra", async () => {
    mount(fakeApi({ memberships: [{ role: "mestre", campaign: camp("c1", "Minha Mesa") }, { role: "jogador", campaign: camp("c2", "Mesa da Ana") }] }));
    await openMobile("Campanhas");
    expect(within((await screen.findByText("Minha Mesa")).closest("li")!).getByText("Mestre")).toBeTruthy();
    expect(within(screen.getByText("Mesa da Ana").closest("li")!).getByText("Jogador")).toBeTruthy();
  });
});
