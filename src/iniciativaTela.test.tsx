// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

let escopo: { user: { id: string } | null; active: { role: "mestre" | "jogador"; campaign: { id: string; name: string } } | null } = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } };
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: escopo.user }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: escopo.active }) }));
import { EncontrosPanel, IniciativaPanel } from "./Iniciativa";

const preencher = (rotulo: string, valor: string) => fireEvent.change(within(screen.getByRole("form", { name: /^(Adicionar combatente|Novo encontro)$/ })).getByLabelText(rotulo), { target: { value: valor } });
beforeEach(() => { localStorage.clear(); escopo = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("tela Iniciativa", () => {
  it("mostra carregamento, depois o estado vazio com orientação", async () => {
    render(<IniciativaPanel/>);
    expect(screen.getByText("Carregando o combate…")).toBeTruthy();
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy(); expect(screen.getByText(/aba Encontros/)).toBeTruthy();
  });
  it("adiciona combatentes, ordena, avança turno/rodada, aplica dano e persiste ao trocar de aba (remontar)", async () => {
    const { unmount } = render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Goblin"); preencher("Iniciativa", "12"); preencher("PV (opcional)", "7"); fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    preencher("Nome", "Lydia"); preencher("Iniciativa", "18"); preencher("Lado", "aliado"); fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    const lista = screen.getByRole("list", { name: "Ordem de iniciativa" }); const itens = within(lista).getAllByRole("listitem");
    expect(itens[0].textContent).toContain("Lydia"); expect(itens[0].getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ })); fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ }));
    expect(screen.getByText("Rodada 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Goblin"), { target: { value: "3" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Goblin" }));
    expect(screen.getByLabelText("PV de Goblin").textContent).toBe("PV 4/7");
    unmount(); render(<IniciativaPanel/>);   // trocar de aba remonta a tela: nada se perde
    expect(await screen.findByText("Rodada 2")).toBeTruthy(); expect(screen.getByLabelText("PV de Goblin").textContent).toBe("PV 4/7");
  });
  it("dado corrompido mostra erro com 'Tentar de novo' e opção de descartar", async () => {
    localStorage.setItem("compendio5e:iniciativa:u1:c1", "{quebrado");
    render(<IniciativaPanel/>);
    const alerta = await screen.findByRole("alert"); expect(alerta.textContent).toMatch(/Não foi possível ler o combate/);
    localStorage.setItem("compendio5e:iniciativa:u1:c1", JSON.stringify({ combatentes: [], turno: null, rodada: 1 }));
    fireEvent.click(within(alerta).getByRole("button", { name: "Tentar de novo" })); expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy();
    localStorage.setItem("compendio5e:iniciativa:u1:c1", "{quebrado"); cleanup(); render(<IniciativaPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: /descartar o que está guardado/ })); expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy();
    expect(localStorage.getItem("compendio5e:iniciativa:u1:c1")).toBeNull();
  });
  it("sem campanha ativa orienta a escolher uma; dados de outra campanha não aparecem", async () => {
    localStorage.setItem("compendio5e:iniciativa:u1:c2", JSON.stringify({ combatentes: [{ id: "x", nome: "Intruso", iniciativa: 1, lado: "inimigo" }], turno: "x", rodada: 1 }));
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda"); expect(screen.queryByText("Intruso")).toBeNull(); cleanup();
    escopo.active = null; render(<IniciativaPanel/>); expect(screen.getByText(/Escolha ou entre em uma campanha/)).toBeTruthy();
  });
});

describe("tela Encontros", () => {
  it("estado vazio, cria encontro, adiciona participante e envia para a Iniciativa", async () => {
    render(<EncontrosPanel/>); expect(await screen.findByText("Nenhum encontro preparado")).toBeTruthy();
    preencher("Nome do encontro", "Emboscada"); fireEvent.click(screen.getByRole("button", { name: /Criar encontro/ }));
    const cartao = await screen.findByRole("region", { name: "Encontro Emboscada" });
    fireEvent.change(within(cartao).getByLabelText("Nome"), { target: { value: "Goblin" } }); fireEvent.change(within(cartao).getByLabelText("Quantidade"), { target: { value: "2" } });
    fireEvent.change(within(cartao).getByLabelText("PV de cada (opcional)"), { target: { value: "7" } }); fireEvent.click(within(cartao).getByRole("button", { name: /Adicionar/ }));
    expect(within(cartao).getByText(/2× Goblin · PV 7/)).toBeTruthy();
    fireEvent.click(within(cartao).getByRole("button", { name: /Enviar para a Iniciativa/ })); expect(await screen.findByText(/foi enviado para a Iniciativa/)).toBeTruthy();
    cleanup(); render(<IniciativaPanel/>); await waitFor(() => expect(screen.getByText("Goblin 1")).toBeTruthy()); expect(screen.getByText("Goblin 2")).toBeTruthy();
  });
  it("encontro persiste ao remontar e armazenamento corrompido mostra erro com nova tentativa", async () => {
    localStorage.setItem("compendio5e:encontros:u1:c1", JSON.stringify([{ id: "e1", nome: "Ruínas", participantes: [] }]));
    render(<EncontrosPanel/>); expect(await screen.findByRole("region", { name: "Encontro Ruínas" })).toBeTruthy(); cleanup();
    localStorage.setItem("compendio5e:encontros:u1:c1", "[1,2"); render(<EncontrosPanel/>);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Não foi possível ler os encontros/);
  });
});


describe("acesso exclusivo do mestre", () => {
  it("não exibe iniciativa nem lê combate local para jogadores", async () => {
    escopo.active = { role: "jogador", campaign: { id: "c1", name: "Véu Negro" } };
    localStorage.setItem("compendio5e:iniciativa:u1:c1", JSON.stringify({ combatentes: [{ id: "segredo", nome: "Segredo do mestre", iniciativa: 20, lado: "inimigo" }], turno: "segredo", rodada: 1 }));
    const spy = vi.spyOn(Storage.prototype, "getItem");
    render(<IniciativaPanel/>);
    expect(screen.getByText(/Somente o mestre da campanha/)).toBeTruthy();
    expect(screen.queryByText("Segredo do mestre")).toBeNull();
    await waitFor(() => expect(spy).not.toHaveBeenCalledWith("compendio5e:iniciativa:u1:c1"));
  });
  it("não exibe encontros preparados para jogadores", async () => {
    escopo.active = { role: "jogador", campaign: { id: "c1", name: "Véu Negro" } };
    localStorage.setItem("compendio5e:encontros:u1:c1", JSON.stringify([{ id: "e1", nome: "Plano secreto", participantes: [] }]));
    const spy = vi.spyOn(Storage.prototype, "getItem");
    render(<EncontrosPanel/>);
    expect(screen.getByText(/Somente o mestre da campanha/)).toBeTruthy();
    expect(screen.queryByText("Plano secreto")).toBeNull();
    await waitFor(() => expect(spy).not.toHaveBeenCalledWith("compendio5e:encontros:u1:c1"));
  });
});


describe("isolamento entre campanhas", () => {
  it("não mostra o combate anterior nem por um render durante a troca de campanha", async () => {
    const { rerender } = render(<IniciativaPanel/>);
    await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Segredo da campanha A");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(screen.getByText("Segredo da campanha A")).toBeTruthy();
    escopo.active = { role: "mestre", campaign: { id: "c2", name: "Outra mesa" } };
    rerender(<IniciativaPanel/>);
    expect(screen.queryByText("Segredo da campanha A")).toBeNull();
    expect(screen.getByText("Carregando o combate…")).toBeTruthy();
    await screen.findByText("Nenhum combatente ainda");
  });
});

describe("falha de gravação sem perda da edição em tela", () => {
  it("mantém combate editado e permite repetir a gravação após erro de quota", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    const gravacao = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    preencher("Nome", "Goblin preservado");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(screen.getByText("Goblin preservado")).toBeTruthy();
    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toContain("Não foi possível salvar o combate");
    expect(localStorage.getItem("compendio5e:iniciativa:u1:c1")).toBeNull();
    gravacao.mockRestore();
    fireEvent.click(within(alerta).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(JSON.parse(localStorage.getItem("compendio5e:iniciativa:u1:c1")!).combatentes[0].nome).toBe("Goblin preservado");
  });
  it("mantém encontro editado e permite repetir a gravação", async () => {
    render(<EncontrosPanel/>); await screen.findByText("Nenhum encontro preparado");
    const gravacao = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("bloqueado"); });
    preencher("Nome do encontro", "Ruínas preservadas");
    fireEvent.click(screen.getByRole("button", { name: /Criar encontro/ }));
    expect(screen.getByRole("region", { name: "Encontro Ruínas preservadas" })).toBeTruthy();
    const alerta = screen.getByRole("alert");
    gravacao.mockRestore();
    fireEvent.click(within(alerta).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(JSON.parse(localStorage.getItem("compendio5e:encontros:u1:c1")!)[0].nome).toBe("Ruínas preservadas");
  });
});

describe("proteção de navegação com gravação pendente", () => {
  it("registra alterações não salvas até a confirmação do armazenamento", async () => {
    const { UnsavedContext } = await import("./unsaved");
    const register = vi.fn();
    const api = { register, isDirty: () => false, guard: (_ids: string[] | "all", proceed: () => void) => proceed(), confirmAll: async () => true };
    render(<UnsavedContext.Provider value={api}><IniciativaPanel/></UnsavedContext.Provider>);
    await screen.findByText("Nenhum combatente ainda");
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("quota"); });
    preencher("Nome", "Combate pendente");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(register).toHaveBeenLastCalledWith("secao:iniciativa", expect.objectContaining({ dirty: true, save: expect.any(Function) }));
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("secao:iniciativa", expect.objectContaining({ dirty: false })));
  });
});


describe("remoção do último turno na interface", () => {
  it("passa ao primeiro da rodada seguinte e persiste sem repetir turno anterior", async () => {
    const { unmount } = render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Primeiro"); preencher("Iniciativa", "20");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    preencher("Nome", "Último"); preencher("Iniciativa", "10");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo turno" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover Último" }));
    expect(screen.getByText("Rodada 2")).toBeTruthy();
    const linha = screen.getByText("Primeiro").closest("li")!;
    expect(linha.getAttribute("aria-current")).toBe("true");
    unmount(); render(<IniciativaPanel/>);
    expect(await screen.findByText("Rodada 2")).toBeTruthy();
    expect(screen.queryByText("Último")).toBeNull();
    expect(screen.getByText("Primeiro").closest("li")!.getAttribute("aria-current")).toBe("true");
  });
});
