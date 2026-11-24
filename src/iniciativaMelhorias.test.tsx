// @vitest-environment jsdom
import { abrirAvulso, abrirBusca, abrirEncontro } from "../tests/combate-ui";
// Iniciativa: retratos padronizados, resultado das rolagens, turno atual em destaque e seleção parcial de encontros preparados.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { chaveEncontros, rolarD20, textoRolagem, type Encontro } from "./combate";

let escopo: { user: { id: string } | null; active: { role: "mestre" | "jogador"; campaign: { id: string; name: string } } | null } = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } };
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: escopo.user }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: escopo.active }) }));
import { AventureirosContext } from "./AventureirosContext";
import { IniciativaPanel } from "./Iniciativa";
import { selecionarParticipantes } from "./SeletorEncontro";

const encontros: Encontro[] = [{ id: "e1", nome: "Emboscada", participantes: [{ id: "p1", nome: "Goblin", quantidade: 3, pv: 7 }, { id: "p2", nome: "Lobo", quantidade: 1, pv: 11 }, { id: "p3", nome: "Chefe", quantidade: 1 }] }];
const preencher = (rotulo: string, valor: string) => { if (rotulo === "Nome") abrirAvulso(); return fireEvent.change(within(screen.getByRole("form", { name: "Adicionar combatente" })).getByLabelText(rotulo), { target: { value: valor } }); };
const adicionarAvulso = (nome: string, ini = "10", pv = "") => { preencher("Nome", nome); preencher("Iniciativa", ini); if (pv) preencher("PV (opcional)", pv); fireEvent.click(within(screen.getByRole("form", { name: "Adicionar combatente" })).getByRole("button", { name: "Adicionar" })); };
beforeEach(() => { localStorage.clear(); escopo = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("rolagens: domínio", () => {
  it("rolarD20 devolve dado, modificador e total; textoRolagem formata com sinal", () => {
    expect(rolarD20(2, () => 0.7)).toEqual({ dado: 15, modificador: 2, total: 17 });
    expect(rolarD20(-1, () => 0)).toEqual({ dado: 1, modificador: -1, total: 0 });
    expect(rolarD20(0, () => 0.999)).toEqual({ dado: 20, modificador: 0, total: 20 });
    expect(textoRolagem({ dado: 15, modificador: 2, total: 17 })).toBe("d20 15 + 2 = 17");
    expect(textoRolagem({ dado: 15, modificador: -1, total: 14 })).toBe("d20 15 − 1 = 14");
    expect(textoRolagem({ dado: 15, modificador: 0, total: 15 })).toBe("d20 15 = 15");
    expect(rolarD20(Number.NaN, () => 0.5).modificador).toBe(0);
  });
});

describe("seleção parcial de encontro: domínio", () => {
  it("sem marcas, tudo entra como preparado; marcas desligam criaturas e trocam quantidades; quantidade inválida sai", () => {
    expect(selecionarParticipantes(encontros[0], {}).participantes.map(p => p.quantidade)).toEqual([3, 1, 1]);
    const r = selecionarParticipantes(encontros[0], { p1: { incluir: true, qtd: "2" }, p2: { incluir: false, qtd: "1" }, p3: { incluir: true, qtd: "0" } });
    expect(r.participantes).toEqual([{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }]);
    expect(selecionarParticipantes(encontros[0], { p1: { incluir: true, qtd: "99" } }).participantes.map(p => p.id)).toEqual(["p2", "p3"]);
    expect(encontros[0].participantes[0].quantidade).toBe(3);   // o original nunca é alterado
  });
});

describe("tela da Iniciativa", () => {
  it("retrato padronizado: placeholder para quem não tem imagem; imagem da ficha para personagem; falha de imagem volta ao placeholder", async () => {
    const fonte = { listar: async () => ({ ok: true as const, data: [{ id: "pj1", nome: "Lydia", classe: "Clériga", nivel: null, retratoUrl: "https://exemplo.test/lydia.png" }] }) };
    render(<AventureirosContext.Provider value={fonte}><RegistrosProvider api={null} fichas={fichasTeste()}><IniciativaPanel/></RegistrosProvider></AventureirosContext.Provider>);
    await screen.findByText("Nenhum combatente ainda");
    adicionarAvulso("Goblin avulso");
    expect(await within(screen.getByRole("group", { name: "Combatentes" })).findAllByTestId("retrato-placeholder")).toHaveLength(1);
    abrirBusca("Personagens"); fireEvent.focus(await screen.findByLabelText("Buscar combatentes")); fireEvent.click(await screen.findByRole("button", { name: "Adicionar Lydia (personagem)" }));
    const item = (await within(await screen.findByRole("group", { name: "Combatentes" })).findByText("Lydia", { selector: "strong" })).closest("li")!;
    await waitFor(() => expect(item.querySelector("img")?.getAttribute("src")).toBe("https://exemplo.test/lydia.png"));
    fireEvent.error(item.querySelector("img")!);                                    // imagem quebrada
    expect(within(item).getByTestId("retrato-placeholder")).toBeTruthy();
  });
  it("mostra o resultado da rolagem com o modificador e atualiza a iniciativa", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    adicionarAvulso("Goblin");
    vi.spyOn(Math, "random").mockReturnValue(0.7);   // d20 = 15
    fireEvent.click(screen.getByRole("button", { name: "Rolar iniciativa de Goblin" }));
    expect((await screen.findByLabelText("Resultado da rolagem de Goblin")).textContent).toBe("d20 15 = 15");
    expect((screen.getByLabelText("Iniciativa de Goblin") as HTMLInputElement).value).toBe("15");
  });
  it("rodada e turno atual ficam visíveis e o combatente atual é marcado (aria-current)", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    adicionarAvulso("Lydia", "18"); adicionarAvulso("Goblin", "12");
    expect(screen.getByText("Rodada 1").className).toContain("ini-rodada");
    expect(document.querySelector('.faixa-personagem[aria-current="step"][title="Lydia"]')).toBeTruthy();
    const itens = within(screen.getByRole("group", { name: "Combatentes" })).getAllByRole("listitem");
    expect(itens[0].getAttribute("aria-current")).toBe("true"); expect(itens[0].className).toContain("atual"); expect(itens[1].getAttribute("aria-current")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ }));
    expect(document.querySelector('.faixa-personagem[aria-current="step"][title="Goblin"]')).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Combatentes" })).getAllByRole("listitem")[1].getAttribute("aria-current")).toBe("true");
  });
  it("controles compactos de dano e cura continuam acessíveis e a barra de PV acompanha (baixa fica sinalizada)", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    adicionarAvulso("Goblin", "10", "20");
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Goblin"), { target: { value: "16" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Goblin" }));
    expect(screen.getByLabelText("PV de Goblin").textContent).toBe("PV 4/20");
    const barra = document.querySelector(".ini-pv-preenchimento") as HTMLElement;
    expect(barra.style.width).toBe("20%"); expect(barra.hasAttribute("data-baixo")).toBe(true);
  });
  it("encontro preparado: envia só as criaturas e quantidades escolhidas e PRESERVA quem já está no combate", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify(encontros));
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    adicionarAvulso("Lydia", "18");
    await abrirEncontro("Emboscada");
    await screen.findByText("Emboscada");
    fireEvent.click(screen.getByLabelText("Incluir Lobo de Emboscada"));                                   // desmarca o lobo
    fireEvent.change(screen.getByLabelText("Quantidade de Goblin a enviar de Emboscada"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Incluir no combate: Emboscada" }));
    const lista = within(await screen.findByRole("group", { name: "Combatentes" }));
    await waitFor(() => expect(lista.getAllByRole("listitem")).toHaveLength(4));
    const nomes = lista.getAllByRole("listitem").map(li => within(li).getByText(/^(Lydia|Goblin \d|Chefe|Lobo)$/, { selector: "strong" }).textContent).sort();
    expect(nomes).toEqual(["Chefe", "Goblin 1", "Goblin 2", "Lydia"]);                                    // Lydia preservada; sem Lobo; 2 goblins
    expect(JSON.parse(localStorage.getItem(chaveEncontros("u1", "c1"))!)[0]).toMatchObject({ nome: "Emboscada", participantes: encontros[0].participantes });   // a configuração original continua intacta
  });
  it("sem encontros preparados mostra a orientação; desmarcar tudo desabilita o envio", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    abrirBusca("Encontros preparados"); expect(await screen.findByText(/Nenhum encontro preparado/)).toBeTruthy();
    cleanup(); localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify(encontros));
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    await abrirEncontro("Emboscada"); await screen.findByText("Emboscada");
    for (const n of ["Goblin", "Lobo", "Chefe"]) fireEvent.click(screen.getByLabelText(`Incluir ${n} de Emboscada`));
    expect((screen.getByRole("button", { name: "Incluir no combate: Emboscada" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("o jogador não vê nada disso", async () => {
    escopo = { user: { id: "u2" }, active: { role: "jogador", campaign: { id: "c1", name: "Véu Negro" } } };
    render(<IniciativaPanel/>);
    expect(await screen.findByText(/Somente o mestre/)).toBeTruthy(); expect(screen.queryByText("Adicionar encontro preparado")).toBeNull();
  });
});


describe("preferências e controles independentes", () => {
  it("lista/cartões não altera a separação de lados; ambas as preferências reabrem", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    fireEvent.click(screen.getByRole("button", { name: "Lista compacta" }));
    fireEvent.click(screen.getByRole("button", { name: "Lados separados" }));
    fireEvent.click(screen.getByRole("button", { name: "Cartões" }));
    expect(screen.getByRole("button", { name: "Lados unificados" }).getAttribute("aria-pressed")).toBe("false");
    cleanup(); render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    expect(screen.getByRole("button", { name: "Cartões" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Lados unificados" })).toBeTruthy();
    escopo.user = { id: "outro" }; cleanup(); render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    expect(screen.getByRole("button", { name: "Lados separados" })).toBeTruthy();
  });
  it("dano e cura usam valor editável e voltam a 1 sem trocar turno ou posição", async () => {
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda"); adicionarAvulso("Teste", "10", "20");
    const campo = screen.getByLabelText("Quantidade de dano ou cura de Teste") as HTMLInputElement;
    expect(campo.value).toBe("1");
    fireEvent.change(campo, { target: { value: "6" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Teste" }));
    expect(campo.value).toBe("1"); expect(screen.getByLabelText("PV de Teste").textContent).toBe("PV 14/20");
    fireEvent.change(campo, { target: { value: "3" } }); fireEvent.click(screen.getByRole("button", { name: "Curar Teste" }));
    expect(campo.value).toBe("1"); expect(screen.getByLabelText("PV de Teste").textContent).toBe("PV 17/20");
    expect(document.querySelector('.faixa-personagem[aria-current="step"][title="Teste"]')).toBeTruthy(); expect(screen.getByText("Rodada 1")).toBeTruthy();
  });
});

import { VERSION_2014 } from "./criador/regras-2014";
import { fichasEmMemoria, novoBancoFichas } from "./fichasMemoria";
import { RegistrosProvider } from "./RegistrosContext";
function fichasTeste() {
 const banco = novoBancoFichas(); banco.campanhas = { c1: { mestre: "u1", jogadores: ["u2"] } };
 banco.fichas.push({ id: "pj1", campaignId: "c1", ownerId: "u2", revision: 1, updatedAt: "", draft: { id: "pj1", name: "Lydia", catalogueVersion: VERSION_2014, ruleset: "5e-2014", classId: "fighter", raceId: "human", backgroundId: "acolyte", level: 1, baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], inventory: [], currentHp: 12, temporaryHp: 0, spentResources: {} } });
 return fichasEmMemoria("u1", banco);
}
