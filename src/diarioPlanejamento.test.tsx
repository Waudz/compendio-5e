// @vitest-environment jsdom
// Diário, Planejamento e capa de ponta a ponta no aplicativo (API de registros em memória, com a RLS imitada).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CampaignApi, Membership } from "./campaigns";
import { activeKey } from "./CampaignsContext";
import type { CapaApi } from "./capa";
import type { Registro } from "./registros";
import { registrosEmMemoria } from "./registrosMemoria";
import { me, memoryStorage, other, renderApp } from "./testUtils";

// O BlockNote real é carregado sob demanda e testado à parte (editorRico.test.tsx); aqui um editor mínimo com o mesmo contrato.
vi.mock("./PageEditor", async () => {
  const { paraBlocos, deBlocos } = await import("./registros");
  return { default: ({ inicial, onChange, editavel = true, rotulo }: { inicial: never[]; onChange?: (b: never[]) => void; editavel?: boolean; rotulo?: string }) => editavel
    ? <textarea aria-label={rotulo} defaultValue={deBlocos(inicial)} onChange={e => onChange?.(paraBlocos(e.target.value) as never[])}/>
    : <div>{deBlocos(inicial).split(/\n\n/).map((p, i) => <p key={i}>{p}</p>)}</div> };
});

const mestre: Membership = { role: "mestre", campaign: { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" } };
const jogador: Membership = { role: "jogador", campaign: { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" } };
const apiC = (m: Membership) => ({ list: async () => ({ ok: true, data: [m] }) }) as unknown as CampaignApi;
const par = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
const base = { campaignId: "ca", ownerId: "u1", meta: {}, version: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
const reg = (o: Partial<Registro> & Pick<Registro, "id" | "kind" | "title">): Registro => ({ ...base, visibility: "private", content: [], ...o });

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/"); localStorage.setItem(activeKey(me.id), "ca");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
const abrirSecao = async (nome: string) => { await waitFor(() => expect(menu().getByRole("button", { name: nome })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: nome })); };
const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";

describe("Diário (mestre)", () => {
  it("cria, edita com data de Harptos, publica; o Início passa a mostrar título, data e só o primeiro parágrafo", async () => {
    const registros = registrosEmMemoria("mestre");
    await renderApp({ api: apiC(mestre), registros });
    expect((await screen.findByTestId("diario-vazio")).textContent).toMatch(/Nenhum registro/);   // Início sem registros: estado vazio
    await abrirSecao("Diário");
    expect(await screen.findByTestId("diario-lista-vazia")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Novo registro/ }));
    const titulo = await screen.findByLabelText("Título");
    expect(screen.getByRole("button", {name:"Voltar ao Diário"})).toBeTruthy();
    fireEvent.change(titulo, { target: { value: "4ª Sessão — Caverna" } });
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "1491" } });
    fireEvent.change(screen.getByLabelText("Texto do registro"), { target: { value: "Primeiro parágrafo do registro.\n\nSegundo parágrafo." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText("Registro salvo.");
    expect(registros.dados[0].visibility).toBe("private");                       // salvar não publica
    fireEvent.click(screen.getByRole("button", { name: /Publicar para os jogadores/ }));
    await screen.findByText("Publicado para os jogadores.");
    expect(registros.dados[0].visibility).toBe("campaign");
    expect(registros.dados[0].meta).toEqual({ sessao: { dia: 3, mes: 12, ano: 1491 } });
    fireEvent.click(menu().getByRole("button", { name: "Início" }));
    expect((await screen.findAllByText("3 de Nightal, 1491 DR")).length).toBeGreaterThan(0);
    expect(screen.getByText("Primeiro parágrafo do registro.")).toBeTruthy(); expect(screen.queryByText("Segundo parágrafo.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Diário", level: 2 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver registro completo" })).toBeTruthy();
  });
  it("recusa data inválida e título vazio sem gravar", async () => {
    const registros = registrosEmMemoria("mestre", "u1", [reg({ id: "d1", kind: "diary", title: "X", content: [par("a")] })]);
    await renderApp({ api: apiC(mestre), registros });
    await abrirSecao("Diário"); fireEvent.click(await screen.findByRole("button", { name: /^X/ })); await screen.findByLabelText("Dia");
    fireEvent.change(await screen.findByLabelText("Dia"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "1" } }); fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "1491" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByText(/Data inválida/)).getAttribute("role")).toBe("alert");
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "" } }); fireEvent.change(screen.getByLabelText("Mês"), { target: { value: "" } }); fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByText(/título deve ter/i))).toBeTruthy();
    expect(registros.dados[0].version).toBe(1);
  });
  it("excluir pede confirmação e vai para a lixeira", async () => {
    const registros = registrosEmMemoria("mestre", "u1", [reg({ id: "d1", kind: "diary", title: "Apagar", content: [par("texto")] })]);
    await renderApp({ api: apiC(mestre), registros });
    await abrirSecao("Diário"); fireEvent.click(await screen.findByRole("button", { name: /^Apagar/ })); await screen.findByRole("button", { name: "Excluir" });
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(registros.dados).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(registros.dados).toHaveLength(0));
  });
});

describe("Diário (jogador)", () => {
  const dados = () => [
    reg({ id: "d1", kind: "diary", title: "Publicado antigo", visibility: "campaign", meta: { sessao: { dia: 1, mes: 1, ano: 1491 } }, content: [par("Antigo.")] }),
    reg({ id: "d2", kind: "diary", title: "Segredo do mestre", visibility: "private", meta: { sessao: { dia: 1, mes: 6, ano: 1491 } }, content: [par("Culto do prefeito.")] }),
    reg({ id: "d3", kind: "diary", title: "Publicado recente", visibility: "campaign", meta: { sessao: { dia: 5, mes: 3, ano: 1491 } }, content: [{ type: "image" }, par("Texto recente.")] }),
    reg({ id: "s1", kind: "scene", title: "Cena privada", visibility: "private", content: [par("plano")] }),
  ];
  it("lista e Início mostram só o publicado mais recente; privados e cenas não aparecem", async () => {
    await renderApp({ api: apiC(jogador), registros: registrosEmMemoria("jogador", "u2", dados()) });
    expect(await screen.findByText("Publicado recente")).toBeTruthy(); expect(screen.getByText("Texto recente.")).toBeTruthy();
    expect(screen.queryByText("Segredo do mestre")).toBeNull();
    await abrirSecao("Diário");
    await screen.findByText("Publicado antigo");
    expect(screen.queryByText("Segredo do mestre")).toBeNull(); expect(screen.queryByText("Culto do prefeito.")).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo registro/ })).toBeNull();
    expect(screen.queryByText("Rascunho")).toBeNull();
  });
  it("abre o registro publicado só para leitura; não acessa o privado nem a cena pelo id", async () => {
    const registros = registrosEmMemoria("jogador", "u2", dados());
    await renderApp({ api: apiC(jogador), registros });
    await abrirSecao("Diário"); fireEvent.click(await screen.findByText("Publicado antigo"));
    expect(await screen.findByText("Antigo.")).toBeTruthy();
    expect(screen.queryByLabelText("Título")).toBeNull(); expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect((await registros.get("d2")).ok && (await registros.get("d2") as { data: unknown }).data).toBeNull();
    expect((await registros.get("s1") as { data: unknown }).data).toBeNull();
  });
  it("o menu do jogador tem Anotações (como o do mestre) e a seção abre", async () => {
    await renderApp({ api: apiC(jogador), registros: registrosEmMemoria("jogador", "u2", dados()) });
    await abrirSecao("Anotações");
    expect(await screen.findByRole("heading", { name: "Anotações" })).toBeTruthy();
  });
});

describe("Anotações: cada usuário só vê as próprias (mestre e jogador)", () => {
  const quadro = (id: string, owner: string, titulo: string, cartao: string, permanente = false) =>
    reg({ id, kind: "board", ownerId: owner, title: titulo, meta: { ...(permanente && { permanente: true }), colunas: [{ id: `${id}-c`, secoes: [{ id: `${id}-s`, titulo: `Seção de ${owner}`, cartoes: [cartao] }] }] } });
  const dadosDois = () => [
    quadro("bm1", "u1", "Sessão do Mestre", "cm1"), quadro("bm2", "u1", "Anotações permanentes", "cm2", true),
    reg({ id: "cm1", kind: "scene", ownerId: "u1", title: "Cena secreta do mestre", content: [par("o vilão é o taverneiro")] }),
    reg({ id: "cm2", kind: "scene", ownerId: "u1", title: "Nota permanente do mestre" }),
    quadro("bj1", "u2", "Sessão do Jogador", "cj1"), quadro("bj2", "u2", "Anotações permanentes", "cj2", true),
    reg({ id: "cj1", kind: "scene", ownerId: "u2", title: "Minha cena de jogador", content: [par("desconfio do taverneiro")] }),
    reg({ id: "cj2", kind: "scene", ownerId: "u2", title: "Minha nota permanente" }),
  ];
  /** Servidor "vazador": devolve tudo, sem filtrar por dono. A interface não pode confiar nisso para mostrar dados alheios. */
  const vazador = (api: ReturnType<typeof registrosEmMemoria>, todos: Registro[]) => ({ ...api, list: async (cid: string, kind: string) => ({ ok: true as const, data: todos.filter(r => r.campaignId === cid && r.kind === kind) }) }) as unknown as typeof api;

  it("jogador: vê só os próprios quadros e cartões; nada do mestre aparece (nem com um servidor que devolve tudo)", async () => {
    const dados2 = dadosDois();
    localStorage.setItem(activeKey(other.id), "ca");   // a conta logada é a do jogador (u2)
    await renderApp({ user: other, api: apiC(jogador), registros: vazador(registrosEmMemoria("jogador", "u2", dados2), dados2) });
    await abrirSecao("Anotações");
    expect(await screen.findByLabelText("Seção Seção de u2")).toBeTruthy();
    expect(await screen.findByLabelText("Título do cartão Minha cena de jogador")).toBeTruthy();
    expect(screen.queryByText(/Seção de u1/)).toBeNull();
    expect(screen.queryByText("Cena secreta do mestre")).toBeNull(); expect(screen.queryByLabelText("Título do cartão Cena secreta do mestre")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Sessão do Mestre|taverneiro" ?$/);
  });
  it("mestre: vê só os próprios; os quadros e cartões do jogador nunca aparecem", async () => {
    const dados2 = dadosDois();
    await renderApp({ api: apiC(mestre), registros: vazador(registrosEmMemoria("mestre", "u1", dados2), dados2) });
    await abrirSecao("Anotações");
    expect(await screen.findByLabelText("Seção Seção de u1")).toBeTruthy();
    expect(screen.queryByText(/Seção de u2/)).toBeNull(); expect(screen.queryByLabelText("Título do cartão Minha cena de jogador")).toBeNull();
    expect(screen.queryByText("Sessão do Jogador")).toBeNull();
  });
  it("quadros alheios que o servidor devolva também não viram 'Sessão do Jogador' na lista de planos do mestre", async () => {
    const dados2 = dadosDois();
    await renderApp({ api: apiC(mestre), registros: vazador(registrosEmMemoria("mestre", "u1", dados2), dados2) });
    await abrirSecao("Anotações");
    await screen.findByLabelText("Seção Seção de u1");
    const planos = screen.getByRole("navigation", { name: "Planejamentos" });
    expect(within(planos).queryByText("Sessão do Jogador")).toBeNull();
  });
  it("sem quadros ainda, o jogador vê erro claro (o banco proposto na 0006 só deixa o mestre criar quadros) e nada é criado nem perdido", async () => {
    const registros = registrosEmMemoria("jogador", "u2");
    localStorage.setItem(activeKey(other.id), "ca");
    await renderApp({ user: other, api: apiC(jogador), registros });
    await abrirSecao("Anotações");
    expect((await screen.findByRole("alert")).textContent).toMatch(/Apenas o mestre/);
    expect(registros.dados).toHaveLength(0);
  });
});

describe("Planejamento (mestre)", () => {
  it("cria o planejamento e as anotações permanentes, adiciona colunas, seções e cartões sem nome, exclui, com persistência", async () => {
    const registros = registrosEmMemoria("mestre");
    await renderApp({ api: apiC(mestre), registros });
    await abrirSecao("Anotações");
    await screen.findByLabelText("Seção Seção 1");
    const plano = () => registros.dados.find(r => r.kind === "board" && !(r.meta as { permanente?: boolean }).permanente)!;
    expect(registros.dados.filter(r => r.kind === "board").map(r => r.title).sort()).toEqual(["Anotações permanentes", "Sessão 1"]);
    expect(plano().visibility).toBe("private");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar coluna" }));            // sem pedir nome
    await screen.findByLabelText("Seção Seção 2");
    const sec1 = within(screen.getByLabelText("Seção Seção 1"));
    fireEvent.click(sec1.getByRole("button", { name: "Adicionar cartão" }));
    fireEvent.click(await sec1.findByRole("button", { name: "Adicionar título ao cartão" }));
    const titulo = await sec1.findByLabelText("Novo título do cartão");
    fireEvent.change(titulo, { target: { value: "O bar" } }); fireEvent.blur(titulo);
    await waitFor(() => expect(registros.dados.some(r => r.kind === "scene" && r.title === "O bar")).toBe(true));
    expect(registros.dados.filter(r => r.kind === "scene").map(r => r.title)).toEqual(["O bar"]);
    expect(registros.dados.find(r => r.kind === "scene")!.visibility).toBe("private");
    await waitFor(() => expect((plano().meta as { colunas: { secoes: { cartoes: string[] }[] }[] }).colunas.map(c => c.secoes[0].cartoes.length)).toEqual([1, 0]));
    expect(screen.getByRole("button", { name: "Excluir seção Seção 1" })).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Excluir cartão O bar" }));
    await waitFor(() => expect(registros.dados.some(r => r.kind === "scene")).toBe(false));
  });
  it("editar o cartão dentro do planejamento (sem nova aba) salva sozinho; o planejamento nunca é publicado", async () => {
    const registros = registrosEmMemoria("mestre", "u1", [
      reg({ id: "b1", kind: "board", title: "Quadro", meta: { colunas: [{ id: "k", titulo: "Sessão 5", cartoes: ["s1"] }] } }),
      reg({ id: "s1", kind: "scene", title: "Estrada", content: [par("Carroça atolada.")] }),
    ]);
    await renderApp({ api: apiC(mestre), registros });
    await abrirSecao("Anotações");
    fireEvent.click(await screen.findByRole("button", { name: "Editar o texto de Estrada" }));
    fireEvent.change(await screen.findByLabelText("Conteúdo de Estrada"), { target: { value: "Carroça atolada.\n\nBandidos." } });
    await waitFor(() => expect(registros.dados.find(r => r.id === "s1")!.content).toHaveLength(2), { timeout: 4000 });
    expect(screen.queryByRole("button", { name: /Publicar/ })).toBeNull();   // cena não tem publicação
    expect([...document.querySelectorAll(strip)].map(e => e.textContent)).not.toContain("Estrada (fixada)");
  });
  it("conflito de versão não sobrescreve: mostra aviso e recarrega", async () => {
    const registros = registrosEmMemoria("mestre", "u1", [reg({ id: "b1", kind: "board", title: "Quadro", meta: { colunas: [{ id: "k", titulo: "A", cartoes: [] }] } })]);
    await renderApp({ api: apiC(mestre), registros });
    await abrirSecao("Anotações"); await screen.findByLabelText("Seção A");
    registros.dados[0] = { ...registros.dados[0], version: 7 };      // outra aba/aparelho gravou antes
    fireEvent.click(screen.getByRole("button", { name: "Adicionar coluna" }));
    expect((await screen.findByText(/Outra pessoa alterou/)).getAttribute("role")).toBe("alert");
  });
});

describe("Capa da campanha", () => {
  const capaEmMemoria = (): CapaApi & { url: string | null } => {
    const s = { url: null as string | null };
    return { get url() { return s.url; }, obter: async () => ({ ok: true as const, data: s.url }), definir: async (_c: string, f: File) => { s.url = `blob:${f.name}`; return { ok: true as const, data: s.url }; }, remover: async () => { s.url = null; return { ok: true as const, data: true as const }; } } as never;
  };
  it("mestre adiciona, substitui e remove; jogador só vê", async () => {
    const capa = capaEmMemoria();
    await renderApp({ api: apiC(mestre), capa });
    expect(await screen.findByText("Sem capa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name:"Editar informações"}));
    vi.stubGlobal("URL", Object.assign(URL, {createObjectURL: (f:File)=>`blob:${f.name}`, revokeObjectURL:()=>{}}));
    vi.spyOn(window,"confirm").mockReturnValue(true);
    const input = () => document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input(), { target: { files: [new File(["x"], "capa.png", { type: "image/png" })] } });
    fireEvent.click(await screen.findByRole("button", {name:"Salvar enquadramento"}));
    const img = await screen.findByAltText("Capa da campanha"); expect(img.getAttribute("src")).toBe("blob:capa.png");
    fireEvent.change(input(), { target: { files: [new File(["y"], "nova.webp", { type: "image/webp" })] } });
    await waitFor(() => expect((screen.getByAltText("Capa da campanha")).getAttribute("src")).toBe("blob:nova.webp"));
    fireEvent.click(screen.getByRole("button", {name:"Salvar enquadramento"}));
    await waitFor(()=>expect(capa.url).toBe("blob:nova.webp"));
    expect(screen.getByText("Substituir capa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover capa" }));
    await screen.findByText("Sem capa"); expect(capa.url).toBeNull();
    cleanup(); capa.definir("ca", new File(["z"], "x.jpg", { type: "image/jpeg" }));
    await renderApp({ api: apiC(jogador), capa });
    expect(await screen.findByAltText("Capa da campanha")).toBeTruthy();
    expect(document.querySelector("input[type=file]")).toBeNull(); expect(screen.queryByRole("button", { name: "Remover capa" })).toBeNull();
  });
  it("recusa tipo inválido e arquivo grande antes de enviar", async () => {
    const capa = capaEmMemoria(); const definir = vi.spyOn(capa, "definir");
    await renderApp({ api: apiC(mestre), capa });
    await screen.findByText("Sem capa");
    fireEvent.click(screen.getByRole("button", {name:"Editar informações"}));
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["<svg/>"], "a.svg", { type: "image/svg+xml" })] } });
    expect((await screen.findByText(/JPEG, PNG ou WebP/)).getAttribute("role")).toBe("alert");
    const grande = new File(["x"], "g.png", { type: "image/png" }); Object.defineProperty(grande, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [grande] } });
    expect(await screen.findByText(/no máximo 5 MB/)).toBeTruthy();
    expect(definir).not.toHaveBeenCalled();
  });
});
