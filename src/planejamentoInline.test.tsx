// @vitest-environment jsdom
// Cartões do Planejamento: texto no próprio cartão com salvamento automático, menu "Abrir em nova aba", sincronização entre grupos de abas,
// colunas redimensionáveis e criação sem nome.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider, activeKey } from "./CampaignsContext";
import { RegistroPagina } from "./Diario";
import { PlanningPanel } from "./Planning";
import type { CampaignApi, Membership } from "./campaigns";
import type { Registro, RegistrosApi } from "./registros";
import { registrosEmMemoria } from "./registrosMemoria";
import { RegistrosProvider } from "./RegistrosContext";
import { fakeAuth, me, memoryStorage, renderApp } from "./testUtils";
import { UnsavedContext, type UnsavedApi } from "./unsaved";

// Editor mínimo com o contrato do PageEditor (o BlockNote real tem teste próprio em editorRico.test.tsx).
vi.mock("./PageEditor", async () => {
  const { paraBlocos, deBlocos } = await import("./registros");
  return { default: ({ inicial, onChange, editavel = true, rotulo }: { inicial: never[]; onChange?: (b: never[]) => void; editavel?: boolean; rotulo?: string; focar?: boolean }) => editavel
    ? <textarea aria-label={rotulo} defaultValue={deBlocos(inicial)} onChange={e => onChange?.(paraBlocos(e.target.value) as never[])}/>
    : <div>{deBlocos(inicial)}</div> };
});

const camp = { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" };
const mestre: Membership = { role: "mestre", campaign: camp };
const apiC = () => ({ list: async () => ({ ok: true, data: [mestre] }) }) as unknown as CampaignApi;
const par = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
const base = { campaignId: "ca", ownerId: me.id, meta: {}, version: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", visibility: "private" as const };
const dados = (): Registro[] => [
  { ...base, id: "b1", kind: "board", title: "Quadro", content: [], meta: { colunas: [{ id: "k1", titulo: "Sessão 5", cartoes: ["s1", "s2"] }, { id: "k2", titulo: "Floresta", cartoes: [] }] } },
  { ...base, id: "s1", kind: "scene", title: "Julkoun", content: [par("O bar.")] },
  { ...base, id: "s2", kind: "scene", title: "Estrada", content: [par("Carroça atolada.")] },
];
const AUTO = { timeout: 4000 };   // o salvamento automático espera ~0,9 s depois da última digitação

let mobile = false;
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage()); mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/"); localStorage.setItem(activeKey(me.id), "ca");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";
const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
const abas = () => [...document.querySelectorAll(strip)].map(e => e.textContent);
const abrirPlanejamento = async () => {
  // celular: navegação independente (barra inferior); desktop: menu lateral
  const barra = () => mobile ? within(screen.getByRole("navigation", { name: "Navegação mobile" })) : menu();
  await waitFor(() => expect(barra().getByRole("button", { name: "Anotações" })).toBeTruthy()); fireEvent.click(barra().getByRole("button", { name: "Anotações" }));
};
const editarCartao = async (nome: string) => { const alvo = await screen.findByRole("button", { name: `Editar o texto de ${nome}` }); fireEvent.pointerDown(alvo); fireEvent.click(alvo); return await screen.findByLabelText(`Conteúdo de ${nome}`) as HTMLTextAreaElement; };
const cenaDe = (r: ReturnType<typeof registrosEmMemoria>, id: string) => r.dados.find(x => x.id === id)!;
const SEM_CONEXAO = "Sem conexão com o servidor. Tente de novo.";

/** Dois "grupos" na mesma árvore (mesmo navegador): painéis independentes que compartilham a API e o barramento de registros. */
function Par({ api, children }: { api: RegistrosApi; children: React.ReactNode }) {
  return <AuthProvider client={fakeAuth(me).client}><CampaignsProvider apiFactory={apiC}><RegistrosProvider api={api}>{children}</RegistrosProvider></CampaignsProvider></AuthProvider>;
}
const montarPar = async (api: RegistrosApi, a: React.ReactNode, b: React.ReactNode) => {
  render(<Par api={api}><div data-testid="A">{a}</div><div data-testid="B">{b}</div></Par>);
  await waitFor(() => expect(within(screen.getByTestId("B")).queryByText(/Carregando/)).toBeNull());
  return { A: () => within(screen.getByTestId("A")), B: () => within(screen.getByTestId("B")) };
};

describe("cartão simplificado: texto no cartão, salvamento automático", () => {
  it("mostra o conteúdo inteiro; clicar no texto edita ali mesmo (sem aba, sem Salvar/Recolher/título repetido) e salva sozinho", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const abasAntes = abas();
    expect((await screen.findByRole("button", { name: "Editar o texto de Estrada" })).textContent).toContain("Carroça atolada.");
    const texto = await editarCartao("Estrada");
    expect(abas()).toEqual(abasAntes);
    expect(texto.closest("section")?.getAttribute("aria-label")).toBe("Seção Sessão 5");   // o cartão continua na própria seção
    for (const nome of ["Salvar", "Recolher", "Descartar alterações"]) expect(screen.queryByRole("button", { name: nome })).toBeNull();
    expect(screen.queryByLabelText("Título")).toBeNull();
    fireEvent.change(texto, { target: { value: "Carroça atolada.\n\nBandidos." } });
    fireEvent.change(screen.getByLabelText("Título do cartão Estrada"), { target: { value: "Estrada velha" } });
    expect(screen.getAllByLabelText("alterações não salvas").length).toBeGreaterThan(0);
    await waitFor(() => expect(cenaDe(registros, "s2").content).toHaveLength(2), AUTO);
    expect(cenaDe(registros, "s2").title).toBe("Estrada velha");
    await waitFor(() => expect(screen.queryByLabelText("alterações não salvas")).toBeNull());
    expect(screen.queryByRole("button", { name: /Publicar/ })).toBeNull();
  });
  it("o conteúdo salvo permanece depois de recarregar o painel", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const r = await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.change(await editarCartao("Julkoun"), { target: { value: "Texto novo." } });
    await waitFor(() => expect(cenaDe(registros, "s1").content[0]).toMatchObject({ content: [{ text: "Texto novo." }] }), AUTO);
    r.unmount(); cleanup();
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    expect((await screen.findByRole("button", { name: "Editar o texto de Julkoun" })).textContent).toContain("Texto novo.");
  });
  it("clicar fora salva na hora e volta a mostrar o texto; clicar noutro cartão não perde nada", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.change(await editarCartao("Julkoun"), { target: { value: "Rascunho A" } });
    const b = await editarCartao("Estrada");
    await waitFor(() => expect(cenaDe(registros, "s1").content[0]).toMatchObject({ content: [{ text: "Rascunho A" }] }));
    expect(screen.queryByLabelText("Conteúdo de Julkoun")).toBeNull();
    expect(screen.getByRole("button", { name: "Editar o texto de Julkoun" }).textContent).toContain("Rascunho A");
    expect(b.value).toBe("Carroça atolada.");
  });
  it("se o salvamento falha, o texto continua na tela com aviso e 'tentar de novo'; nada se perde ao clicar fora", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const real = registros.update; let falhar = true;
    registros.update = async (id, v, p) => (falhar && id === "s1" ? { ok: false as const, error: SEM_CONEXAO } : real(id, v, p));
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.change(await editarCartao("Julkoun"), { target: { value: "Texto importante" } });
    expect(await screen.findByText(/Sem conexão/, undefined, AUTO)).toBeTruthy();
    await editarCartao("Estrada");
    expect(screen.getByRole("button", { name: "Editar o texto de Julkoun" }).textContent).toContain("Texto importante");
    expect(cenaDe(registros, "s1").content[0]).toMatchObject({ content: [{ text: "O bar." }] });
    falhar = false; fireEvent.click(screen.getAllByRole("button", { name: "Tentar de novo" })[0]);
    await waitFor(() => expect(cenaDe(registros, "s1").content[0]).toMatchObject({ content: [{ text: "Texto importante" }] }));
  });
  it("fechar a aba com algo não salvo registra 'não salvo' na aba e 'salvar e continuar' grava tudo", async () => {
    const register = vi.fn(); const api: UnsavedApi = { register, isDirty: () => false, guard: (_i, p) => p(), confirmAll: async () => true };
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const real = registros.update; let falhar = true;
    registros.update = async (id, v, p) => (falhar ? { ok: false as const, error: SEM_CONEXAO } : real(id, v, p));
    render(<UnsavedContext.Provider value={api}><Par api={registros}><PlanningPanel/></Par></UnsavedContext.Provider>);
    fireEvent.change(await editarCartao("Julkoun"), { target: { value: "x" } });
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("secao:planejamento", expect.objectContaining({ dirty: true })));
    falhar = false;
    const entrada = register.mock.calls.at(-1)![1] as { save: () => Promise<boolean> };
    await act(async () => { expect(await entrada.save()).toBe(true); });
    expect(cenaDe(registros, "s1").content[0]).toMatchObject({ content: [{ text: "x" }] });
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("secao:planejamento", expect.objectContaining({ dirty: false })));
  });
  it("excluir cartão não pede confirmação mesmo com alteração pendente", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const real = registros.update; registros.update = async (id, v, p) => id === "s1" ? { ok: false as const, error: SEM_CONEXAO } : real(id, v, p);
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.change(await editarCartao("Julkoun"), { target: { value: "y" } });
    await screen.findByText(/Sem conexão/, undefined, AUTO);
    fireEvent.click(screen.getByRole("button", { name: "Excluir cartão Julkoun" }));
    await waitFor(() => expect(registros.dados.some(r => r.id === "s1")).toBe(false));
  });
  it("o título é editado no cabeçalho e pode ser removido sem apagar o cartão", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const t = await screen.findByLabelText("Título do cartão Julkoun") as HTMLInputElement;
    fireEvent.change(t, { target: { value: "Julkoun (vila)" } }); fireEvent.keyDown(t, { key: "Enter" });
    await waitFor(() => expect(cenaDe(registros, "s1").title).toBe("Julkoun (vila)"));
    const t2 = await screen.findByLabelText("Título do cartão Julkoun (vila)") as HTMLInputElement;
    fireEvent.change(t2, { target: { value: "  " } }); fireEvent.blur(t2);
    await waitFor(() => expect(screen.getByRole("button", { name: "Adicionar título ao cartão" })).toBeTruthy());
    expect(cenaDe(registros, "s1").title).toBe("Novo cartão");
  });
  it("celular: o mesmo cartão, com o botão '⋯' como alternativa ao botão direito", async () => {
    mobile = true;
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    expect(await editarCartao("Julkoun")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mais ações de Julkoun" })).toBeTruthy();
  });
  it("cartão sem texto mostra o convite para escrever", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [dados()[0], { ...base, id: "s1", kind: "scene", title: "Julkoun", content: [] }]);
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    expect((await screen.findByRole("button", { name: "Editar o texto de Julkoun" })).textContent).toMatch(/Clique para escrever/);
  });
});

describe("menu de contexto 'Abrir em nova aba'", () => {
  it("botão direito no cartão abre o menu; escolher abre aba interna sem duplicar; Esc e clique fora fecham", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    const alvo = await screen.findByRole("button", { name: "Editar o texto de Estrada" });
    fireEvent.contextMenu(alvo);
    expect(screen.getByRole("menuitem", { name: "Abrir em nova aba" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(alvo); fireEvent.pointerDown(document.body); expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(alvo); fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().filter(t => t?.startsWith("Estrada"))).toHaveLength(1));
    fireEvent.click(menu().getByRole("button", { name: "Anotações" }));
    fireEvent.contextMenu(await screen.findByRole("button", { name: "Editar o texto de Estrada" })); fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().filter(t => t?.startsWith("Estrada"))).toHaveLength(1));
  });
  it("o botão '⋯' abre o mesmo menu (celular e teclado)", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: "Mais ações de Julkoun" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().some(t => t?.startsWith("Julkoun"))).toBe(true));
  });
  it("sobre o título e o editor o menu nativo do navegador é preservado (nenhum preventDefault)", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    const texto = await editarCartao("Julkoun");
    for (const el of [texto, screen.getByLabelText("Título do cartão Julkoun")]) {
      expect(fireEvent.contextMenu(el)).toBe(true); expect(screen.queryByRole("menu")).toBeNull();
    }
  });
  it("Diário: botão direito num registro oferece o mesmo menu", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("a")] }]);
    await renderApp({ api: apiC(), registros });
    await waitFor(() => expect(menu().getByRole("button", { name: "Diário" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Diário" }));
    fireEvent.contextMenu(await screen.findByRole("button", { name: /^Sessão 1/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().some(t => t?.startsWith("Sessão 1"))).toBe(true));
  });
});

describe("sincronização entre grupos de abas (sem F5)", () => {
  const diario = () => registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("Original.")] }]);
  it("salvar numa aba atualiza a outra na hora, sem novas requisições", async () => {
    const registros = diario(); const get = vi.spyOn(registros, "get");
    const { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    const chamadasIniciais = get.mock.calls.length;
    fireEvent.change(A().getByLabelText("Título"), { target: { value: "Sessão 1 — editada" } });
    fireEvent.change(A().getByLabelText("Texto do registro"), { target: { value: "Texto novo." } });
    fireEvent.click(A().getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect((B().getByLabelText("Título") as HTMLInputElement).value).toBe("Sessão 1 — editada"));
    expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("Texto novo.");
    expect(get.mock.calls.length).toBe(chamadasIniciais);
    expect(B().queryByTestId("conflito")).toBeNull();
  });
  it("com alterações NÃO salvas na outra aba: preserva o que foi digitado e mostra o conflito com dois caminhos", async () => {
    const registros = diario();
    const { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "Minha edição em B" } });
    fireEvent.change(A().getByLabelText("Texto do registro"), { target: { value: "Edição salva em A" } });
    fireEvent.click(A().getByRole("button", { name: "Salvar" }));
    expect(await B().findByTestId("conflito")).toBeTruthy();
    expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("Minha edição em B");
    fireEvent.click(B().getByRole("button", { name: /Manter minhas alterações/ }));
    expect(B().queryByTestId("conflito")).toBeNull();
    fireEvent.click(B().getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(registros.dados[0].content[0]).toMatchObject({ content: [{ text: "Minha edição em B" }] }));
    await waitFor(() => expect((A().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("Minha edição em B"));
  });
  it("conflito, caminho 'usar a versão mais recente': descarta só o rascunho local", async () => {
    const registros = diario();
    const { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "rascunho em B" } });
    fireEvent.change(A().getByLabelText("Texto do registro"), { target: { value: "versão de A" } });
    fireEvent.click(A().getByRole("button", { name: "Salvar" }));
    await B().findByTestId("conflito");
    fireEvent.click(B().getByRole("button", { name: /Usar a versão mais recente/ }));
    await waitFor(() => expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("versão de A"));
    expect(B().queryByTestId("conflito")).toBeNull();
  });
  it("registro excluído numa aba: a outra (sem rascunho) mostra 'não encontrado'; com rascunho, avisa sem apagar o texto", async () => {
    let registros = diario(); let { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.click(A().getByRole("button", { name: "Excluir" })); fireEvent.click(A().getByRole("button", { name: "Confirmar exclusão" }));
    expect(await B().findByText(/não encontrado/i)).toBeTruthy();
    cleanup(); registros = diario(); ({ A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>));
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "não perder" } });
    fireEvent.click(A().getByRole("button", { name: "Excluir" })); fireEvent.click(A().getByRole("button", { name: "Confirmar exclusão" }));
    expect(await B().findByTestId("conflito-excluido")).toBeTruthy();
    expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("não perder");
  });
  it("conflito com o servidor (outro aparelho gravou antes) usa o mesmo caminho seguro, sem perder o texto", async () => {
    const registros = diario();
    await renderApp({ api: apiC(), registros });
    await waitFor(() => expect(menu().getByRole("button", { name: "Diário" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Diário" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Sessão 1/ }));
    await screen.findByLabelText("Título");
    fireEvent.change(await screen.findByLabelText("Texto do registro"), { target: { value: "minha edição" } });
    registros.dados[0] = { ...registros.dados[0], version: 5, content: [par("de outro aparelho")] };
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByTestId("conflito")).toBeTruthy();
    expect((screen.getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("minha edição");
  });
  it("Planejamento x página aberta do mesmo registro: o cartão acompanha título e texto; com edição pendente no cartão há conflito, sem perder o digitado", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const { A, B } = await montarPar(registros, <PlanningPanel/>, <RegistroPagina id="s1"/>);
    await A().findByRole("button", { name: "Editar o texto de Julkoun" }); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Título"), { target: { value: "Julkoun (bar)" } });
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "O bar mudou." } });
    fireEvent.click(B().getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect((A().getByLabelText("Título do cartão Julkoun (bar)") as HTMLInputElement).value).toBe("Julkoun (bar)"));
    expect(A().getByRole("button", { name: "Editar o texto de Julkoun (bar)" }).textContent).toContain("O bar mudou.");
    fireEvent.click(A().getByRole("button", { name: "Editar o texto de Julkoun (bar)" }));
    fireEvent.change(await A().findByLabelText("Conteúdo de Julkoun (bar)"), { target: { value: "rascunho no cartão" } });
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "gravado na página" } });
    fireEvent.click(B().getByRole("button", { name: "Salvar" }));
    expect(await A().findByTestId("conflito")).toBeTruthy();
    expect((A().getByLabelText("Conteúdo de Julkoun (bar)") as HTMLTextAreaElement).value).toBe("rascunho no cartão");
  });
  it("a exclusão de uma cena pela página remove o cartão do quadro (sem rascunho)", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const { A, B } = await montarPar(registros, <PlanningPanel/>, <RegistroPagina id="s2"/>);
    await A().findByRole("button", { name: "Editar o texto de Estrada" }); await B().findByLabelText("Título");
    fireEvent.click(B().getByRole("button", { name: "Excluir" })); fireEvent.click(B().getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(A().queryByRole("button", { name: "Editar o texto de Estrada" })).toBeNull());
    await waitFor(() => expect((registros.dados.find(r => r.kind === "board")!.meta as { colunas: { secoes: { cartoes: string[] }[] }[] }).colunas[0].secoes[0].cartoes).toEqual(["s1"]));
  });
});

describe("criar sem nome e conteúdo inteiro", () => {
  it("coluna, seção e cartão são criados sem digitar nome (nomes automáticos, editáveis); o novo cartão já abre para escrever", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar coluna" }));
    const nova = await screen.findByLabelText("Seção Seção 3");
    fireEvent.click(within(nova).getByRole("button", { name: "Adicionar cartão" }));
    await waitFor(() => expect(registros.dados.some(r => r.kind === "scene" && r.title === "Novo cartão")).toBe(true));
    expect(await screen.findByLabelText("Conteúdo de Novo cartão")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar seção abaixo de Seção 3" }));   // seção nova embaixo, na mesma coluna
    const abaixo = await screen.findByLabelText("Seção Seção 4");
    expect(abaixo.closest("[data-coluna]")).toBe(screen.getByLabelText("Seção Seção 3").closest("[data-coluna]"));
  });
  it("o cartão mostra o CONTEÚDO inteiro (títulos, parágrafos, listas) com a formatação, não só o primeiro parágrafo", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [
      { ...base, id: "b1", kind: "board", title: "Q", content: [], meta: { colunas: [{ id: "k", titulo: "A", cartoes: ["s1"] }] } },
      { ...base, id: "s1", kind: "scene", title: "Daggerford", content: [{ type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Titulo", styles: {} }] }, par("Ola, tudo bem?"), par(""), { type: "bulletListItem", content: [{ type: "text", text: "item da lista", styles: { bold: true } }] }, par("oi")] },
    ]);
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const conteudo = await screen.findByRole("button", { name: "Editar o texto de Daggerford" });
    for (const txt of ["Titulo", "Ola, tudo bem?", "item da lista", "oi"]) expect(conteudo.textContent).toContain(txt);
    expect(conteudo.querySelector("strong")?.textContent).toBe("item da lista");
  });
});

describe("colunas redimensionáveis", () => {
  const colunas = (r: ReturnType<typeof registrosEmMemoria>) => (r.dados.find(x => x.kind === "board")!.meta as { colunas: { id: string; largura?: number; secoes: { cartoes: string[] }[] }[] }).colunas;
  const faixa = (i: number) => document.querySelectorAll("[data-coluna]")[i] as HTMLElement;
  const alca = (i: number) => within(faixa(i)).getByRole("separator", { name: "Redimensionar a coluna" });
  it("teclado e arraste ajustam a largura da coluna, que acompanha todas as seções e cartões e persiste", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const r = await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findAllByRole("separator", { name: "Redimensionar a coluna" });
    expect(faixa(0).style.width).toBe("300px");
    fireEvent.keyDown(alca(0), { key: "ArrowRight" }); fireEvent.keyDown(alca(0), { key: "ArrowRight" });
    await waitFor(() => expect(faixa(0).style.width).toBe("340px"));
    await waitFor(() => expect(colunas(registros)[0].largura).toBe(340));
    expect(colunas(registros)[0].secoes[0].cartoes).toEqual(["s1", "s2"]);
    const a = alca(0); a.setPointerCapture = () => {};
    fireEvent.pointerDown(a, { clientX: 400, pointerId: 1 }); fireEvent.pointerMove(a, { clientX: 1000, pointerId: 1 });
    expect(faixa(0).style.width).toBe("1400px");
    expect(colunas(registros)[0].largura).toBe(340);
    fireEvent.pointerUp(a, { clientX: 1000, pointerId: 1 });
    await waitFor(() => expect(colunas(registros)[0].largura).toBe(900));
    fireEvent.keyDown(alca(0), { key: "ArrowLeft" });
    await waitFor(() => expect(colunas(registros)[0].largura).toBe(880));
    expect(colunas(registros)[1].largura).toBeUndefined();
    r.unmount(); cleanup();
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findAllByRole("separator", { name: "Redimensionar a coluna" });
    expect(faixa(0).style.width).toBe("880px");
  });
  it("limite mínimo: não encolhe abaixo de 220px", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findAllByRole("separator", { name: "Redimensionar a coluna" });
    for (let i = 0; i < 8; i++) fireEvent.keyDown(alca(1), { key: "ArrowLeft" });
    await waitFor(() => expect(colunas(registros)[1].largura).toBe(220));
  });
});

describe("seções: título grande, seleção com o mouse e exclusão inteira", () => {
  const plano = (r: ReturnType<typeof registrosEmMemoria>) => r.dados.find(x => x.id === "b1")!.meta as { colunas: { secoes: { id: string; titulo: string; grande?: boolean; cartoes: string[] }[] }[] };
  it("o botão de título grande liga e desliga e persiste", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const b = await screen.findByRole("button", { name: "Título grande na seção Sessão 5" });
    expect(b.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(b);
    await waitFor(() => expect(plano(registros).colunas[0].secoes[0].grande).toBe(true));
    expect(screen.getByRole("button", { name: "Título grande na seção Sessão 5" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Título grande na seção Sessão 5" }));
    await waitFor(() => expect(plano(registros).colunas[0].secoes[0].grande).toBeUndefined());
  });
  it("clicar no cabeçalho seleciona a seção; Ctrl+clique soma; Esc limpa; a barra mostra a contagem", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    const s1 = await screen.findByLabelText("Seção Sessão 5"), s2 = screen.getByLabelText("Seção Floresta");
    fireEvent.click(s1.querySelector("header")!);
    expect(s1.getAttribute("data-selecionada")).toBe("true"); expect(screen.getByRole("toolbar", { name: "Seções selecionadas" }).textContent).toContain("1 seção selecionada");
    fireEvent.click(s2.querySelector("header")!, { ctrlKey: true });
    expect(s2.getAttribute("data-selecionada")).toBe("true"); expect(screen.getByRole("toolbar").textContent).toContain("2 seções selecionadas");
    fireEvent.click(s2.querySelector("header")!, { ctrlKey: true }); expect(s2.getAttribute("data-selecionada")).toBe("false");
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("toolbar")).toBeNull();
  });
  it("excluir a seção inteira apaga a seção E os cartões dela (com confirmação); cancelar não faz nada", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findByLabelText("Seção Sessão 5");
    fireEvent.click(screen.getByRole("button", { name: "Excluir seção Sessão 5" }));
    expect(screen.getByRole("alertdialog").textContent).toMatch(/2 cartão/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(registros.dados.some(r => r.id === "s1")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Excluir seção Sessão 5" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir seção" }));
    await waitFor(() => expect(registros.dados.some(r => r.kind === "scene")).toBe(false));
    await waitFor(() => expect(screen.queryByLabelText("Seção Sessão 5")).toBeNull());
    await waitFor(() => expect(plano(registros).colunas.map(c => c.secoes.map(s => s.titulo))).toEqual([["Floresta"]]));
  });
  it("selecionar várias seções e excluir todas de uma vez (botão da barra); seção vazia exclui sem confirmar", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const s1 = await screen.findByLabelText("Seção Sessão 5"), s2 = screen.getByLabelText("Seção Floresta");
    fireEvent.click(s2.querySelector("header")!); fireEvent.click(screen.getByRole("button", { name: "Excluir seção" }));
    await waitFor(() => expect(screen.queryByLabelText("Seção Floresta")).toBeNull());
    expect(screen.queryByRole("alertdialog")).toBeNull();                                        // vazia: sem confirmação
    fireEvent.click(s1.querySelector("header")!); fireEvent.keyDown(window, { key: "Delete" });  // atalho Delete
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir seção" }));
    await waitFor(() => expect(registros.dados.some(r => r.kind === "scene")).toBe(false));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("se apagar um cartão falha, a seção e o cartão continuam no quadro (nada se perde)", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const real = registros.remove; registros.remove = async id => id === "s2" ? { ok: false as const, error: SEM_CONEXAO } : real(id);
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findByLabelText("Seção Sessão 5");
    fireEvent.click(screen.getByRole("button", { name: "Excluir seção Sessão 5" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir seção" }));
    expect(await screen.findByText(/Não foi possível excluir 1 cartão/)).toBeTruthy();
    expect(screen.getByLabelText("Seção Sessão 5")).toBeTruthy();
    await waitFor(() => expect(plano(registros).colunas[0].secoes[0].cartoes).toEqual(["s2"]));
  });
  it("o '+' abaixo da seção cria a próxima seção na mesma coluna, sem pedir nome", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar seção abaixo de Sessão 5" }));
    await waitFor(() => expect(plano(registros).colunas[0].secoes.map(s => s.titulo)).toEqual(["Sessão 5", "Seção 3"]));
  });
});

describe("planejamentos e anotações permanentes", () => {
  const boards = (r: ReturnType<typeof registrosEmMemoria>) => r.dados.filter(x => x.kind === "board");
  it("sempre existem as anotações permanentes (primeiro) e ao menos um planejamento; o chip ativo é o da sessão", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const nav = await screen.findByRole("navigation", { name: "Planejamentos" });
    expect(within(nav).getByRole("button", { name: "Anotações permanentes" })).toBeTruthy();               // fixas, sempre primeiro
    expect(boards(registros).some(b => (b.meta as { permanente?: boolean }).permanente)).toBe(true);
    expect(within(nav).getByRole("button", { name: "Quadro" }).getAttribute("aria-pressed")).toBe("true");   // o planejamento existente continua ativo
  });
  it("permite criar várias abas permanentes, renomear e manter após recarregar", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const r = await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: "Nova guia" }));
    await screen.findByRole("button", { name: "Nova guia 1" });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Nova guia 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fixar" }));
    await waitFor(() => expect(boards(registros).some(b => b.title === "Nova guia 1" && (b.meta as { permanente?: boolean }).permanente === true)).toBe(true));
    fireEvent.contextMenu(screen.getByRole("button", { name: "Nova guia 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Renomear" }));
    const nome = screen.getByLabelText("Renomear guia") as HTMLInputElement;
    fireEvent.change(nome, { target: { value: "Personagens recorrentes" } }); fireEvent.blur(nome);
    await waitFor(() => expect(boards(registros).some(b => b.title === "Personagens recorrentes")).toBe(true));
    r.unmount(); cleanup();
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    expect(screen.getByRole("button", { name: "Anotações permanentes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Personagens recorrentes" })).toBeTruthy();
  });
  it("reordena abas de sessão e mantém a ordem após recarregar", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const r = await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: "Nova guia" }));
    await screen.findByLabelText("Seção Seção 1");
    fireEvent.contextMenu(screen.getByRole("button", { name: "Nova guia 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mover para esquerda" }));
    await waitFor(() => {
      const nav = screen.getByRole("navigation", { name: "Planejamentos" });
      const nomes = [...nav.querySelectorAll(".plano")].map(x => x.textContent);
      expect(nomes.findIndex(x => x?.includes("Nova guia 1"))).toBeLessThan(nomes.findIndex(x => x?.includes("Quadro")));
    });
    r.unmount(); cleanup();
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const nav = screen.getByRole("navigation", { name: "Planejamentos" });
    const nomes = [...nav.querySelectorAll(".plano")].map(x => x.textContent);
    expect(nomes.findIndex(x => x?.includes("Nova guia 1"))).toBeLessThan(nomes.findIndex(x => x?.includes("Quadro")));
  });
  it("novo planejamento cria um quadro vazio e troca para ele; voltar mostra o anterior com seus cartões", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findByLabelText("Seção Sessão 5");
    fireEvent.click(screen.getByRole("button", { name: "Nova guia" }));
    await screen.findByLabelText("Seção Seção 1");
    expect(screen.queryByLabelText("Seção Sessão 5")).toBeNull();                          // outro planejamento: outras seções
    expect(boards(registros).map(b => b.title)).toContain("Nova guia 1");
    fireEvent.click(screen.getByRole("button", { name: "Quadro" }));
    expect(await screen.findByLabelText("Seção Sessão 5")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar o texto de Estrada" })).toBeTruthy();
  });
  it("as anotações permanentes têm quadro próprio, que não aparece nos planejamentos", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findByLabelText("Seção Sessão 5");
    fireEvent.click(screen.getByRole("button", { name: "Anotações permanentes" }));
    const sec = await screen.findByLabelText("Seção Anotações");
    fireEvent.click(within(sec).getByRole("button", { name: "Adicionar cartão" }));
    fireEvent.click(await within(sec).findByRole("button", { name: "Adicionar título ao cartão" }));
    const titulo = await within(sec).findByLabelText("Novo título do cartão");
    fireEvent.change(titulo, { target: { value: "Cultos de Daggerford" } }); fireEvent.blur(titulo);
    await waitFor(() => expect(registros.dados.some(r => r.kind === "scene" && r.title === "Cultos de Daggerford")).toBe(true));
    expect(screen.queryByRole("button", { name: /Excluir o planejamento/ })).toBeNull();      // permanentes não se excluem
    fireEvent.click(screen.getByRole("button", { name: "Quadro" }));
    await screen.findByLabelText("Seção Sessão 5");
    expect(screen.queryByLabelText("Título do cartão Cultos de Daggerford")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Anotações permanentes" }));
    expect(await screen.findByLabelText("Título do cartão Cultos de Daggerford")).toBeTruthy();   // continua lá
  });
  it("duplo clique no nome da guia permite renomear diretamente", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Quadro" }));
    const campo = screen.getByLabelText("Renomear guia") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "Notas da campanha" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() => expect(registros.dados.find(r => r.id === "b1")!.title).toBe("Notas da campanha"));
    expect(await screen.findByRole("button", { name: "Notas da campanha" })).toBeTruthy();
  });
  it("renomear o planejamento ativo; excluir guia preenchida pede confirmação", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.contextMenu(await screen.findByRole("button", { name: "Quadro" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Renomear" }));
    const nome = screen.getByLabelText("Renomear guia") as HTMLInputElement;
    fireEvent.change(nome, { target: { value: "Sessão 4 — Daggerford" } }); fireEvent.blur(nome);
    await waitFor(() => expect(registros.dados.find(r => r.id === "b1")!.title).toBe("Sessão 4 — Daggerford"));
    fireEvent.contextMenu(screen.getByRole("button", { name: "Sessão 4 — Daggerford" })); fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    expect(screen.getByRole("alertdialog").textContent).toMatch(/2 cartão/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(registros.dados.some(r => r.id === "b1")).toBe(true);
    fireEvent.contextMenu(screen.getByRole("button", { name: "Sessão 4 — Daggerford" })); fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir guia" }));
    await waitFor(() => expect(registros.dados.some(r => r.id === "b1")).toBe(false));
    expect(registros.dados.some(r => r.kind === "scene")).toBe(false);
    expect(await screen.findByRole("button", { name: "Anotações permanentes" })).toBeTruthy();               // um novo planejamento é criado: nunca fica sem nenhum
  });
  it("o planejamento escolhido é lembrado ao recarregar; trocar com rascunho não salvo pergunta antes", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const r = await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    await screen.findByLabelText("Seção Sessão 5");
    fireEvent.click(screen.getByRole("button", { name: "Anotações permanentes" }));
    await screen.findByLabelText("Seção Anotações");
    r.unmount(); cleanup();
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    expect(await screen.findByLabelText("Seção Anotações")).toBeTruthy();                    // voltou onde parou
  });
  it("trocar de planejamento com texto que NÃO conseguiu salvar pergunta antes de descartar", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const real = registros.update; registros.update = async (id, v, p) => id === "s1" ? { ok: false as const, error: SEM_CONEXAO } : real(id, v, p);
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.change(await editarCartao("Julkoun"), { target: { value: "texto que não salva" } });
    await screen.findByText(/Sem conexão/, undefined, AUTO);
    const conf = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Anotações permanentes" }));
    await waitFor(() => expect(conf).toHaveBeenCalled());
    expect(screen.getByLabelText("Seção Sessão 5")).toBeTruthy();                           // ficou onde estava, com o texto
    expect((screen.getByLabelText("Conteúdo de Julkoun") as HTMLTextAreaElement).value).toBe("texto que não salva");
    conf.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Anotações permanentes" }));
    expect(await screen.findByLabelText("Seção Anotações")).toBeTruthy();
  });
});
