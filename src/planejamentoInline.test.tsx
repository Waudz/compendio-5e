// @vitest-environment jsdom
// Cartões do Planejamento editados no próprio quadro, menu "Abrir em nova aba" e sincronização entre grupos de abas (mesmo navegador).
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
  return { default: ({ inicial, onChange, editavel = true, rotulo }: { inicial: never[]; onChange?: (b: never[]) => void; editavel?: boolean; rotulo?: string }) => editavel
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
const abrirPlanejamento = async () => { await waitFor(() => expect(menu().getByRole("button", { name: "Planejamento" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Planejamento" })); };
const cartao = (nome: string) => screen.getByRole("button", { name: new RegExp(`^${nome}`), expanded: undefined as never }) as HTMLElement;
const toggle = (nome: string) => screen.getAllByRole("button").find(b => b.hasAttribute("aria-expanded") && b.textContent?.startsWith(nome))!;
void cartao;

/** Dois "grupos" na mesma árvore (mesmo navegador): painéis independentes que compartilham a API e o barramento de registros. */
function Par({ api, children }: { api: RegistrosApi; children: React.ReactNode }) {
  return <AuthProvider client={fakeAuth(me).client}><CampaignsProvider apiFactory={apiC}><RegistrosProvider api={api}>{children}</RegistrosProvider></CampaignsProvider></AuthProvider>;
}
const montarPar = async (api: RegistrosApi, a: React.ReactNode, b: React.ReactNode) => {
  render(<Par api={api}><div data-testid="A">{a}</div><div data-testid="B">{b}</div></Par>);
  await waitFor(() => expect(within(screen.getByTestId("B")).queryByText(/Carregando/)).toBeNull());
  return { A: () => within(screen.getByTestId("A")), B: () => within(screen.getByTestId("B")) };
};

describe("cartão do Planejamento: expandir e editar no lugar", () => {
  it("clique esquerdo expande dentro da coluna, sem abrir aba; editar e salvar persiste conteúdo e título", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    const abasAntes = abas();
    fireEvent.click(await screen.findByRole("button", { name: /^Estrada/ }));
    const texto = await screen.findByLabelText("Conteúdo de Estrada");
    expect(abas()).toEqual(abasAntes);                                                       // nenhuma aba nova
    expect(screen.getByRole("listitem", { name: "Coluna Sessão 5" }).contains(texto)).toBe(true);   // o cartão continua na própria coluna
    fireEvent.change(texto, { target: { value: "Carroça atolada.\n\nBandidos." } });
    fireEvent.change(within(screen.getByRole("listitem", { name: "Coluna Sessão 5" })).getAllByLabelText("Título")[0], { target: { value: "Estrada velha" } });
    expect(screen.getAllByLabelText("alterações não salvas").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(registros.dados.find(r => r.id === "s2")!.title).toBe("Estrada velha"));
    expect(registros.dados.find(r => r.id === "s2")!.content).toHaveLength(2);
    await waitFor(() => expect(screen.queryByLabelText("alterações não salvas")).toBeNull());
    expect(screen.getByRole("button", { name: /^Mais ações de Estrada velha/ })).toBeTruthy();   // título atualizado nas demais partes do cartão
  });
  it("conteúdo salvo permanece após recarregar o painel", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const r = await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    fireEvent.change(await screen.findByLabelText("Conteúdo de Julkoun"), { target: { value: "Texto novo." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(registros.dados.find(x => x.id === "s1")!.content[0]).toMatchObject({ content: [{ text: "Texto novo." }] }));
    r.unmount(); cleanup();
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    expect(((await screen.findByLabelText("Conteúdo de Julkoun")) as HTMLTextAreaElement).value).toBe("Texto novo.");
  });
  it("recolher e alternar entre cartões NÃO descarta o que foi digitado; recolhido mostra a marca de não salvo", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    fireEvent.change(await screen.findByLabelText("Conteúdo de Julkoun"), { target: { value: "Rascunho A" } });
    fireEvent.click(screen.getByRole("button", { name: /^Estrada/ }));                       // abre o segundo cartão
    fireEvent.change(await screen.findByLabelText("Conteúdo de Estrada"), { target: { value: "Rascunho B" } });
    fireEvent.click(toggle("Julkoun")); fireEvent.click(toggle("Estrada"));                    // recolhe os dois
    expect(toggle("Julkoun").textContent).toMatch(/●/); expect(toggle("Estrada").textContent).toMatch(/●/);
    fireEvent.click(toggle("Julkoun"));
    expect((screen.getByLabelText("Conteúdo de Julkoun") as HTMLTextAreaElement).value).toBe("Rascunho A");
    fireEvent.click(toggle("Estrada"));
    expect((screen.getByLabelText("Conteúdo de Estrada") as HTMLTextAreaElement).value).toBe("Rascunho B");
  });
  it("mover o cartão para outra coluna (e reorganizar) mantém o rascunho", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    fireEvent.change(await screen.findByLabelText("Conteúdo de Julkoun"), { target: { value: "Rascunho que sobrevive" } });
    fireEvent.click(screen.getByRole("button", { name: "Mover Julkoun para a próxima coluna" }));
    await waitFor(() => expect(within(screen.getByRole("listitem", { name: "Coluna Floresta" })).getByLabelText("Conteúdo de Julkoun")).toBeTruthy());
    expect((screen.getByLabelText("Conteúdo de Julkoun") as HTMLTextAreaElement).value).toBe("Rascunho que sobrevive");
    expect(screen.getByRole("button", { name: "Arrastar o cartão Julkoun" })).toBeTruthy();       // alça do dnd-kit continua presente
  });
  it("fechar a aba do Planejamento com rascunho registra 'não salvo' na aba (confirmação) e oferece salvar", async () => {
    const register = vi.fn(); const api: UnsavedApi = { register, isDirty: () => false, guard: (_i, p) => p(), confirmAll: async () => true };
    const registros = registrosEmMemoria("mestre", me.id, dados());
    render(<UnsavedContext.Provider value={api}><Par api={registros}><PlanningPanel/></Par></UnsavedContext.Provider>);
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    fireEvent.change(await screen.findByLabelText("Conteúdo de Julkoun"), { target: { value: "x" } });
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("secao:planejamento", expect.objectContaining({ dirty: true })));
    const entrada = register.mock.calls.at(-1)![1] as { save: () => Promise<boolean> };
    await act(async () => { expect(await entrada.save()).toBe(true); });                       // "salvar e continuar" grava tudo
    expect(registros.dados.find(r => r.id === "s1")!.content[0]).toMatchObject({ content: [{ text: "x" }] });
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("secao:planejamento", expect.objectContaining({ dirty: false })));
  });
  it("excluir cartão com rascunho avisa que as alterações serão perdidas e respeita o cancelamento", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    await renderApp({ api: apiC(), registros }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    fireEvent.change(await screen.findByLabelText("Conteúdo de Julkoun"), { target: { value: "y" } });
    const conf = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Excluir cartão Julkoun" }));
    expect(conf.mock.calls[0][0]).toMatch(/alterações não salvas/); expect(registros.dados.some(r => r.id === "s1")).toBe(true);
    conf.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Excluir cartão Julkoun" }));
    await waitFor(() => expect(registros.dados.some(r => r.id === "s1")).toBe(false));
  });
  it("celular: o cartão também expande no lugar", async () => {
    mobile = true;
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    expect(await screen.findByLabelText("Conteúdo de Julkoun")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mais ações de Julkoun" })).toBeTruthy();       // alternativa acessível ao botão direito
  });
});

describe("menu de contexto 'Abrir em nova aba'", () => {
  it("botão direito no cartão abre o menu; escolher abre aba interna sem duplicar; Esc e clique fora fecham", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    const alvo = await screen.findByRole("button", { name: /^Estrada/ });
    fireEvent.contextMenu(alvo);
    expect(screen.getByRole("menuitem", { name: "Abrir em nova aba" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(alvo); fireEvent.pointerDown(document.body); expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(alvo); fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().filter(t => t?.startsWith("Estrada"))).toHaveLength(1));
    fireEvent.click(menu().getByRole("button", { name: "Planejamento" }));
    fireEvent.contextMenu(await screen.findByRole("button", { name: /^Estrada/ })); fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().filter(t => t?.startsWith("Estrada"))).toHaveLength(1));   // já aberta: seleciona, não duplica
  });
  it("o botão '⋯' abre o mesmo menu (celular e teclado)", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: "Mais ações de Julkoun" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().some(t => t?.startsWith("Julkoun"))).toBe(true));
  });
  it("sobre campos de texto e o editor o menu nativo do navegador é preservado (nenhum preventDefault)", async () => {
    await renderApp({ api: apiC(), registros: registrosEmMemoria("mestre", me.id, dados()) }); await abrirPlanejamento();
    fireEvent.click(await screen.findByRole("button", { name: /^Julkoun/ }));
    for (const el of [await screen.findByLabelText("Conteúdo de Julkoun"), screen.getAllByLabelText("Título")[0]]) {
      const livre = fireEvent.contextMenu(el);                // retorna false se algum handler chamou preventDefault
      expect(livre).toBe(true); expect(screen.queryByRole("menu")).toBeNull();
    }
  });
  it("Diário: botão direito num registro oferece o mesmo menu", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("a")] }]);
    await renderApp({ api: apiC(), registros });
    await waitFor(() => expect(menu().getByRole("button", { name: "Diário" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Diário" }));
    fireEvent.contextMenu(await screen.findByText("Sessão 1"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir em nova aba" }));
    await waitFor(() => expect(abas().some(t => t?.startsWith("Sessão 1"))).toBe(true));
  });
});

describe("sincronização entre grupos de abas (sem F5)", () => {
  it("salvar numa aba atualiza a outra na hora, sem recriar o editor desnecessariamente e sem novas requisições", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("Original.")] }]);
    const get = vi.spyOn(registros, "get");
    const { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    const chamadasIniciais = get.mock.calls.length;
    fireEvent.change(A().getByLabelText("Título"), { target: { value: "Sessão 1 — editada" } });
    fireEvent.change(A().getByLabelText("Texto do registro"), { target: { value: "Texto novo." } });
    fireEvent.click(A().getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect((B().getByLabelText("Título") as HTMLInputElement).value).toBe("Sessão 1 — editada"));
    expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("Texto novo.");
    expect(get.mock.calls.length).toBe(chamadasIniciais);       // o dado veio pelo evento: nenhuma requisição extra
    expect(B().queryByTestId("conflito")).toBeNull();
  });
  it("com alterações NÃO salvas na outra aba: preserva o que foi digitado e mostra o conflito com dois caminhos", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("Original.")] }]);
    const { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "Minha edição em B" } });
    fireEvent.change(A().getByLabelText("Texto do registro"), { target: { value: "Edição salva em A" } });
    fireEvent.click(A().getByRole("button", { name: "Salvar" }));
    expect(await B().findByTestId("conflito")).toBeTruthy();
    expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("Minha edição em B");   // nada foi sobrescrito
    // caminho 1: manter as minhas -> salvar sobrescreve conscientemente e sem erro de versão
    fireEvent.click(B().getByRole("button", { name: /Manter minhas alterações/ }));
    expect(B().queryByTestId("conflito")).toBeNull();
    fireEvent.click(B().getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(registros.dados[0].content[0]).toMatchObject({ content: [{ text: "Minha edição em B" }] }));
    // e a aba A, sem alterações, recebe a versão de B automaticamente
    await waitFor(() => expect((A().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("Minha edição em B"));
  });
  it("conflito, caminho 'usar a versão mais recente': descarta só o rascunho local", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("Original.")] }]);
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
  it("registro excluído numa aba: a outra (sem rascunho) passa a mostrar 'não encontrado'; com rascunho, avisa sem apagar o texto", async () => {
    const mk = () => registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("Original.")] }]);
    let registros = mk(); let { A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>);
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.click(A().getByRole("button", { name: "Excluir" })); fireEvent.click(A().getByRole("button", { name: "Confirmar exclusão" }));
    expect(await B().findByText(/não encontrado/i)).toBeTruthy();
    cleanup(); registros = mk(); ({ A, B } = await montarPar(registros, <RegistroPagina id="d1"/>, <RegistroPagina id="d1"/>));
    await A().findByLabelText("Título"); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "não perder" } });
    fireEvent.click(A().getByRole("button", { name: "Excluir" })); fireEvent.click(A().getByRole("button", { name: "Confirmar exclusão" }));
    expect(await B().findByTestId("conflito-excluido")).toBeTruthy();
    expect((B().getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("não perder");
  });
  it("conflito com o servidor (outro aparelho gravou antes) usa o mesmo caminho seguro, sem perder o texto", async () => {
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", title: "Sessão 1", content: [par("Original.")] }]);
    await renderApp({ api: apiC(), registros });
    await waitFor(() => expect(menu().getByRole("button", { name: "Diário" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Diário" }));
    fireEvent.click(await screen.findByText("Sessão 1"));
    fireEvent.change(await screen.findByLabelText("Texto do registro"), { target: { value: "minha edição" } });
    registros.dados[0] = { ...registros.dados[0], version: 5, content: [par("de outro aparelho")] };   // gravação externa, sem passar pelo navegador
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByTestId("conflito")).toBeTruthy();
    expect((screen.getByLabelText("Texto do registro") as HTMLTextAreaElement).value).toBe("minha edição");
  });
  it("Planejamento x página aberta do mesmo registro: título e prévia do cartão acompanham; rascunho do cartão gera conflito", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const { A, B } = await montarPar(registros, <PlanningPanel/>, <RegistroPagina id="s1"/>);
    await A().findByRole("button", { name: /^Julkoun/ }); await B().findByLabelText("Título");
    fireEvent.change(B().getByLabelText("Título"), { target: { value: "Julkoun (bar)" } });
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "O bar mudou." } });
    fireEvent.click(B().getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(A().getByRole("button", { name: /^Julkoun \(bar\)/ })).toBeTruthy());   // título atualizado no quadro
    expect(A().getByText("O bar mudou.")).toBeTruthy();                                                // e a prévia
    // cartão expandido com rascunho + nova gravação na página => conflito no cartão, rascunho intacto
    fireEvent.click(A().getByRole("button", { name: /^Julkoun \(bar\)/ }));
    fireEvent.change(await A().findByLabelText("Conteúdo de Julkoun (bar)"), { target: { value: "rascunho no cartão" } });
    fireEvent.change(B().getByLabelText("Texto do registro"), { target: { value: "gravado na página" } });
    fireEvent.click(B().getByRole("button", { name: "Salvar" }));
    expect(await A().findByTestId("conflito")).toBeTruthy();
    expect((A().getByLabelText("Conteúdo de Julkoun (bar)") as HTMLTextAreaElement).value).toBe("rascunho no cartão");
  });
  it("a exclusão de uma cena pela página remove o cartão do quadro (sem rascunho)", async () => {
    const registros = registrosEmMemoria("mestre", me.id, dados());
    const { A, B } = await montarPar(registros, <PlanningPanel/>, <RegistroPagina id="s2"/>);
    await A().findByRole("button", { name: /^Estrada/ }); await B().findByLabelText("Título");
    fireEvent.click(B().getByRole("button", { name: "Excluir" })); fireEvent.click(B().getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(A().queryByRole("button", { name: /^Estrada/ })).toBeNull());
    await waitFor(() => expect((registros.dados.find(r => r.kind === "board")!.meta as { colunas: { cartoes: string[] }[] }).colunas[0].cartoes).toEqual(["s1"]));
  });
});
