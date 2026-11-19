// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthProvider } from "./AuthContext";
import { AccountPanel } from "./AccountPanel";
import { AuthGate } from "./AuthGate";
import { memoryStorage, renderApp } from "./testUtils";
import { createAuthApi, traduzirErro, validateEmail, validatePassword } from "./auth";
import { isUsableConfig } from "./supabase";

type Listener = (event: string, session: { user: User } | null) => void;
const user = { id: "u1", email: "ana@exemplo.com" } as User;

/** Cliente Supabase falso: só o que a camada de autenticação usa. Nenhuma rede, nenhuma credencial. */
function fakeClient(over: Record<string, unknown> = {}, session: { user: User } | null = null) {
  let listener: Listener = () => {};
  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((l: Listener) => { listener = l; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signUp: vi.fn(async () => ({ data: { user: { identities: [{}] }, session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    resend: vi.fn(async () => ({ data: {}, error: null })),
    ...over,
  };
  return { client: { auth } as unknown as SupabaseClient, auth, emit: (e: string, s: { user: User } | null) => act(() => listener(e, s)) };
}

describe("validação e mensagens", () => {
  it("valida e-mail e senha", () => {
    expect(validateEmail("a@b.co")).toBeNull(); expect(validateEmail("a@b")).not.toBeNull(); expect(validateEmail("")).not.toBeNull();
    expect(validatePassword("1234567")).not.toBeNull(); expect(validatePassword("12345678")).toBeNull();
  });
  it.each([
    [{ code: "invalid_credentials" }, /incorretos/], [{ code: "email_not_confirmed" }, /Confirme seu e-mail/], [{ code: "user_already_exists" }, /já está cadastrado/],
    [{ code: "weak_password" }, /fraca/], [{ code: "same_password" }, /diferente/], [{ status: 429 }, /Muitas tentativas/],
    [{ name: "AuthRetryableFetchError", message: "Failed to fetch" }, /Sem conexão/], [new Error("boom: stack secreto"), /Não foi possível/],
  ])("traduz erro %j", (e, re) => { expect(traduzirErro(e)).toMatch(re); expect(traduzirErro(e)).not.toMatch(/stack secreto/); });
  it("recusa configuração vazia, de exemplo ou com chave service_role", () => {
    const jwt = (role: string) => `x.${btoa(JSON.stringify({ role }))}.y`;
    expect(isUsableConfig(undefined, undefined)).toBe(false);
    expect(isUsableConfig("https://SEU-PROJETO.supabase.co", "sua-chave-publica-anon")).toBe(false);
    expect(isUsableConfig("https://abc.supabase.co", jwt("service_role"))).toBe(false);
    expect(isUsableConfig("https://abc.supabase.co", "sb_secret_123")).toBe(false);
    expect(isUsableConfig("https://evil.example.com", jwt("anon"))).toBe(false);
    expect(isUsableConfig("https://abc.supabase.co", jwt("anon"))).toBe(true);
    expect(isUsableConfig("https://abc.supabase.co", "sb_publishable_abc")).toBe(true);
  });
});

describe("createAuthApi", () => {
  it("login ok e erro traduzido", async () => {
    const f = fakeClient({ signInWithPassword: vi.fn().mockResolvedValueOnce({ error: { code: "invalid_credentials" } }).mockResolvedValue({ error: null }) });
    const api = createAuthApi(f.client);
    expect(await api.signIn(" a@b.co ", "x")).toEqual({ ok: false, error: expect.stringMatching(/incorretos/) });
    expect((await api.signIn("a@b.co", "x")).ok).toBe(true);
    expect(f.auth.signInWithPassword).toHaveBeenLastCalledWith({ email: "a@b.co", password: "x" });
  });
  it("cadastro pede confirmação de e-mail e informa o redirecionamento", async () => {
    const f = fakeClient(); const r = await createAuthApi(f.client).signUp("a@b.co", "12345678");
    expect(r).toEqual({ ok: true, message: expect.stringMatching(/link de confirmação/) });
    expect((f.auth.signUp.mock.calls as unknown as [{ options: { emailRedirectTo: string } }][])[0][0].options.emailRedirectTo).toMatch(/^http/);
  });
  it("cadastro de e-mail já existente (identities vazio) vira erro", async () => {
    const f = fakeClient({ signUp: vi.fn(async () => ({ data: { user: { identities: [] }, session: null }, error: null })) });
    expect(await createAuthApi(f.client).signUp("a@b.co", "12345678")).toEqual({ ok: false, error: expect.stringMatching(/já está cadastrado/) });
  });
  it("recuperação usa mensagem neutra; falha de rede vira erro amigável sem lançar", async () => {
    const f = fakeClient(); expect(await createAuthApi(f.client).requestReset("a@b.co")).toEqual({ ok: true, message: expect.stringMatching(/Se o e-mail estiver cadastrado/) });
    const g = fakeClient({ signOut: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    expect(await createAuthApi(g.client).signOut()).toEqual({ ok: false, error: expect.stringMatching(/Sem conexão/) });
  });
  it("alterar senha e reenviar confirmação", async () => {
    const f = fakeClient(); const api = createAuthApi(f.client);
    expect((await api.changePassword("novasenha1")).ok).toBe(true); expect(f.auth.updateUser).toHaveBeenCalledWith({ password: "novasenha1" });
    expect((await api.resendConfirmation("a@b.co")).ok).toBe(true);
  });
});

describe("AuthProvider + AccountPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(cleanup);
  const mount = (f: ReturnType<typeof fakeClient> | null) => render(<AuthProvider client={f?.client ?? null}><AuthGate><AccountPanel/></AuthGate></AuthProvider>);
  const fill = (label: string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

  it("sem Supabase configurado: o app não abre (sem visitante, sem formulário)", () => {
    mount(null);
    expect(screen.getByText(/Ambiente não configurado/)).toBeTruthy(); expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
  it("mostra carregamento e depois o formulário de login (porta de entrada)", async () => {
    mount(fakeClient());
    expect(screen.getByText(/Carregando sessão/)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
  });
  it("login com erro mostra alerta; com sucesso chama o SDK", async () => {
    const f = fakeClient({ signInWithPassword: vi.fn().mockResolvedValueOnce({ error: { code: "invalid_credentials" } }).mockResolvedValue({ error: null }) });
    mount(f); await screen.findByRole("heading", { name: "Entrar" });
    fill("E-mail", "ana@exemplo.com"); fill("Senha", "segredo123");
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/incorretos/);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(f.auth.signInWithPassword).toHaveBeenCalledTimes(2));
  });
  it("validação local impede chamada com e-mail inválido ou senha curta no cadastro", async () => {
    const f = fakeClient(); mount(f); await screen.findByRole("heading", { name: "Entrar" });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    fill("E-mail", "invalido"); fireEvent.click(screen.getAllByRole("button", { name: "Criar conta" })[0]);
    expect((await screen.findByRole("alert")).textContent).toMatch(/e-mail válido/);
    fill("E-mail", "a@b.co"); fill("Senha", "123"); fill("Repita a senha", "123");
    fireEvent.click(screen.getAllByRole("button", { name: "Criar conta" })[0]);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/pelo menos 8/));
    expect(f.auth.signUp).not.toHaveBeenCalled();
  });
  it("cadastro mostra aviso de confirmação e oferece reenvio", async () => {
    const f = fakeClient(); mount(f); await screen.findByRole("heading", { name: "Entrar" });
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    fill("E-mail", "a@b.co"); fill("Senha", "12345678"); fill("Repita a senha", "12345678");
    fireEvent.click(screen.getAllByRole("button", { name: "Criar conta" })[0]);
    expect((await screen.findByRole("status")).textContent).toMatch(/link de confirmação/);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar e-mail de confirmação" }));
    await waitFor(() => expect(f.auth.resend).toHaveBeenCalled());
  });
  it("recuperar senha envia o pedido", async () => {
    const f = fakeClient(); mount(f); await screen.findByRole("heading", { name: "Entrar" });
    fireEvent.click(screen.getByRole("button", { name: "Esqueci a senha" }));
    fill("E-mail", "a@b.co"); fireEvent.click(screen.getByRole("button", { name: "Recuperar senha" }));
    await waitFor(() => expect(f.auth.resetPasswordForEmail).toHaveBeenCalled());
  });
  it("sessão persistida: abre já logado, e sair volta à porta de entrada", async () => {
    const f = fakeClient({}, { user }); mount(f);
    expect(await screen.findByText("ana@exemplo.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(f.auth.signOut).toHaveBeenCalled());
    await f.emit("SIGNED_OUT", null);
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
  });
  it("evento PASSWORD_RECOVERY abre a tela de nova senha e valida confirmação", async () => {
    const f = fakeClient(); mount(f); await screen.findByRole("heading", { name: "Entrar" });
    await f.emit("PASSWORD_RECOVERY", { user });
    expect(await screen.findByRole("heading", { name: "Definir nova senha" })).toBeTruthy();
    fill("Nova senha", "novasenha1"); fill("Repita a nova senha", "outrasenha");
    fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/não coincidem/);
    fill("Repita a nova senha", "novasenha1"); fireEvent.click(screen.getByRole("button", { name: "Salvar senha" }));
    await waitFor(() => expect(f.auth.updateUser).toHaveBeenCalledWith({ password: "novasenha1" }));
  });
  it("falha ao ler a sessão (rede) cai na porta de entrada com aviso", async () => {
    const f = fakeClient({ getSession: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) });
    mount(f);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Sem conexão/);
  });
  it("o app abre a aba Conta pelo menu lateral (autenticado)", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Conta" }));
    expect(document.querySelector(".flexlayout__tabset_tabbar_inner")?.textContent).toMatch(/Conta/);
  });
});
