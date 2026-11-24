// @vitest-environment jsdom
// Encontros (entrega 4): loot por criatura, recompensas, recipientes, estados e coleta parcial, pendências, restauração e duplicação.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { alterarPv, chaveEncontros, combateVazio, duplicarEncontro, enviarParaCombate, lerEncontros, type Encontro } from "./combate";
import { duplicarEstadoAtual, iniciarSemCombate, marcarEnviado, normalizarLoot, pendencias, restaurarOriginal, sincronizarComCombate } from "./estadoEncontro";
import { ajustarColeta, ajustarDistribuicao, estadoLoot, itemLootValido, lerItensLoot, marcarEncontrado, type LinhaLoot } from "./loot";

vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } }) }));
import { EncontrosPanel } from "./Iniciativa";

const base = (): Encontro => ({
  id: "e1", nome: "Covil",
  participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7, loot: [{ id: "i1", nome: "Adaga enferrujada", quantidade: 1, itemId: "dagger" }, { id: "i2", moeda: "cp", nome: "peças de cobre", quantidade: 5 }] }],
  recompensas: [{ id: "g1", nome: "Gratidão da vila", quantidade: 1, descricao: "Um jantar por conta da casa" }],
  recipientes: [{ id: "r1", nome: "Baú trancado", descricao: "Fundo da sala", itens: [{ id: "b1", nome: "Poção de cura", quantidade: 2, itemId: "potion-of-healing" }, { id: "b2", moeda: "gp", nome: "peças de ouro", quantidade: 50 }] }],
});
const linha = (e: Encontro, id: string) => e.atual!.loot!.find(l => l.id === id)!;
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("modelo de loot", () => {
  it("valida itens: quantidade 1..9999, nome obrigatório, moeda conhecida, ids únicos", () => {
    expect(itemLootValido({ id: "a", nome: " Corda ", quantidade: 2 })).toEqual({ id: "a", nome: "Corda", quantidade: 2 });
    expect(itemLootValido({ id: "a", nome: "", quantidade: 2 })).toBeUndefined(); expect(itemLootValido({ id: "a", nome: "x", quantidade: 0 })).toBeUndefined();
    expect(itemLootValido({ id: "a", nome: "x", quantidade: 10000 })).toBeUndefined(); expect(itemLootValido({ id: "a", nome: "x", quantidade: 1, moeda: "pp" as never })).toBeUndefined();
    expect(() => lerItensLoot([{ id: "a", nome: "x", quantidade: 1 }, { id: "a", nome: "y", quantidade: 1 }])).toThrow();
  });
  it("estado atual nasce com uma linha por criatura individual, recipiente e recompensa (ids estáveis)", () => {
    const e = iniciarSemCombate(base());
    expect(e.atual!.loot!.map(l => l.id).sort()).toEqual(["c:p1#1|i1", "c:p1#1|i2", "c:p1#2|i1", "c:p1#2|i2", "g|g1", "r:r1|b1", "r:r1|b2"]);
    expect(e.atual!.loot!.every(l => estadoLoot(l) === "disponivel")).toBe(true);
    expect(base().atual).toBeUndefined();   // a configuração original não carrega estado
  });
  it("estados e coleta parcial: encontrado, coletado (parcial), distribuído; limites respeitados", () => {
    let e = iniciarSemCombate(base()); const id = "r:r1|b1";
    e = marcarEncontrado(e, id, true); expect(estadoLoot(linha(e, id))).toBe("encontrado");
    e = ajustarColeta(e, id, 1); expect(linha(e, id)).toMatchObject({ coletada: 1, encontrado: true }); expect(estadoLoot(linha(e, id))).toBe("coletado");
    expect(ajustarColeta(e, id, 2)).toBe(e);                         // passaria do total
    expect(ajustarDistribuicao(e, id, 2)).toBe(e);                   // distribuir mais do que coletou
    e = ajustarDistribuicao(e, id, 1); expect(estadoLoot(linha(e, id))).toBe("coletado");   // 1 de 2 distribuído: ainda parcial
    expect(ajustarColeta(e, id, -1)).toBe(e);                        // não desfaz abaixo do que já foi distribuído
    e = ajustarDistribuicao(ajustarColeta(e, id, 1), id, 1); expect(estadoLoot(linha(e, id))).toBe("distribuido");
    expect(marcarEncontrado(e, id, false)).toBe(e);                  // coletado: o estado vem das quantidades
  });
  it("pendências de loot impedem a conclusão automática; loot de criatura viva não é contado duas vezes", () => {
    const e = marcarEnviado(base(), base());
    expect(pendencias(e)).toEqual(["2 criatura(s) viva(s)", "3 item(ns) de loot sem distribuir"]);   // recompensas e recipientes já contam; o loot das vivas não
    let c = enviarParaCombate(combateVazio(), base());
    for (const k of c.combatentes) c = alterarPv(c, k.id, -99);
    const fim = sincronizarComCombate(e, c, true);
    expect(fim.estado).toBe("em_andamento"); expect(pendencias(fim)).toEqual(["7 item(ns) de loot sem distribuir"]);
    let tudo = fim; for (const l of fim.atual!.loot!) tudo = ajustarDistribuicao(ajustarColeta(tudo, l.id, l.quantidade), l.id, l.quantidade);
    expect(pendencias(tudo)).toEqual([]);
    expect(sincronizarComCombate({ ...tudo, estado: "em_combate" }, c, true).estado).toBe("concluido");
  });
  it("itens novos na configuração entram sem tocar no que já foi coletado; remover da configuração não apaga o registro", () => {
    let e = iniciarSemCombate(base()); e = ajustarColeta(e, "g|g1", 1);
    const n = normalizarLoot({ ...e, recompensas: [...e.recompensas!, { id: "g2", nome: "Mapa", quantidade: 1 }] });
    expect(linha(n, "g|g1")).toMatchObject({ coletada: 1 }); expect(linha(n, "g|g2")).toBeTruthy();
    expect(normalizarLoot(n)).toBe(n);                                  // idempotente
    expect(normalizarLoot({ ...n, recompensas: [n.recompensas![1]] }).atual!.loot!.some(l => l.id === "g|g1")).toBe(true);
  });
  it("restaurar volta à configuração original (sem estado/loot) mantendo a configuração de loot; duplicar original não leva estado", () => {
    let e = iniciarSemCombate(base()); e = ajustarDistribuicao(ajustarColeta(e, "g|g1", 1), "g|g1", 1);
    const r = restaurarOriginal(e); expect(r.atual).toBeUndefined(); expect(r.estado).toBe("preparado"); expect(r.recompensas).toEqual(base().recompensas); expect(r.recipientes).toEqual(base().recipientes);
    const d = duplicarEncontro(e); expect(d.atual).toBeUndefined(); expect(d.recipientes![0].id).not.toBe("r1"); expect(d.recipientes![0].itens).toEqual(base().recipientes![0].itens); expect(d.participantes[0].loot).toHaveLength(2);
  });
  it("duplicar estado atual remapeia criaturas e recipientes e preserva as quantidades coletadas", () => {
    let e = iniciarSemCombate(base()); e = ajustarColeta(e, "r:r1|b2", 20); e = ajustarColeta(e, "c:p1#1|i1", 1);
    const d = duplicarEstadoAtual(e);
    const ids = new Set(d.atual!.loot!.map(l => l.id)); expect(ids.size).toBe(7);
    expect([...ids].some(i => i === "r:r1|b2" || i.includes("p1#"))).toBe(false);
    const rid = d.recipientes![0].id, pid = d.participantes[0].id;
    expect(linha(d, `r:${rid}|b2`)).toMatchObject({ coletada: 20, origem: { tipo: "recipiente", recipienteId: rid } });
    expect(linha(d, `c:${pid}#1|i1`)).toMatchObject({ coletada: 1 });
    expect(normalizarLoot(d)).toBe(d);                                  // nenhuma linha órfã ou faltando
    expect(lerEncontros(JSON.stringify([d]))).toEqual([d]);
  });
  it("dados antigos (sem loot) continuam válidos e linhas corrompidas são recusadas", () => {
    const velho = { id: "e", nome: "Velho", participantes: [{ id: "p", nome: "Orc", quantidade: 1 }] };
    expect(lerEncontros(JSON.stringify([velho]))[0]).toEqual(velho);
    const ruim: LinhaLoot = { id: "g|x", lootId: "x", origem: { tipo: "recompensa" }, nome: "Ouro", quantidade: 2, coletada: 3, distribuida: 0 };
    expect(() => lerEncontros(JSON.stringify([{ id: "e", nome: "x", participantes: [], atual: { criaturas: [], loot: [ruim] } }]))).toThrow();
  });
});

describe("tela: loot e recipientes", () => {
  it("configura recompensas, recipiente e loot por criatura (catálogo, personalizado, moeda) e persiste", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([{ id: "e1", nome: "Covil", participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }] }]));
    render(<EncontrosPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir encontro Covil" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    const lido = () => lerEncontros(localStorage.getItem(chaveEncontros("u1", "c1")))[0];
    fireEvent.click(within(pagina).getByRole("button", { name: "Tesouros" }));
    const sec = within(within(pagina).getByRole("region", { name: "Loot do encontro" }));
    fireEvent.click(sec.getByText("Adicionar a recompensas gerais"));
    const rec = within(sec.getByText("Adicionar a recompensas gerais").closest("details")!);
    fireEvent.change(rec.getByLabelText("Tipo de item em recompensas gerais"), { target: { value: "personalizado" } });
    fireEvent.change(rec.getByLabelText("Nome do item"), { target: { value: "Selo do duque" } }); fireEvent.change(rec.getByLabelText("Descrição (opcional)"), { target: { value: "Lacre de cera" } });
    fireEvent.click(rec.getByRole("button", { name: "Incluir item" }));
    await waitFor(() => expect(lido().recompensas).toMatchObject([{ nome: "Selo do duque", descricao: "Lacre de cera", quantidade: 1 }]));
    fireEvent.change(sec.getByLabelText("Nome do recipiente"), { target: { value: "Baú" } }); fireEvent.click(sec.getByRole("button", { name: /Criar recipiente/ }));
    await waitFor(() => expect(lido().recipientes).toHaveLength(1));
    fireEvent.click(sec.getByText(/^Baú/)); fireEvent.click(sec.getByText("Adicionar a Baú"));
    const bau = within(sec.getByText("Adicionar a Baú").closest("details")!);
    fireEvent.change(bau.getByLabelText("Buscar item"), { target: { value: "corda" } });
    fireEvent.click((await bau.findAllByRole("button", { name: /do catálogo a Baú/ }))[0]);
    await waitFor(() => expect(lido().recipientes![0].itens[0].itemId).toBeTruthy());
    fireEvent.change(bau.getByLabelText("Tipo de item em Baú"), { target: { value: "moeda" } }); fireEvent.change(bau.getByLabelText("Quantidade a adicionar em Baú"), { target: { value: "30" } }); fireEvent.click(bau.getByRole("button", { name: "Incluir moeda" }));
    await waitFor(() => expect(lido().recipientes![0].itens[1]).toMatchObject({ moeda: "gp", quantidade: 30 }));
    fireEvent.click(within(pagina).getByRole("button", { name: "Criaturas" }));
    const cri = within(pagina.querySelector(".enc-loot-criatura") as HTMLElement);
    fireEvent.click(cri.getByText("Adicionar a loot de Goblin")); fireEvent.change(cri.getByLabelText("Tipo de item em loot de Goblin"), { target: { value: "personalizado" } });
    fireEvent.change(cri.getByLabelText("Nome do item"), { target: { value: "Dente de lobo" } }); fireEvent.click(cri.getByRole("button", { name: "Incluir item" }));
    await waitFor(() => expect(lido().participantes[0].loot).toMatchObject([{ nome: "Dente de lobo" }]));
    fireEvent.click(within(pagina).getByRole("button", { name: "Aumentar quantidade de Goblin" })); await waitFor(() => expect(lido().participantes[0].quantidade).toBe(3));
    expect(lido().participantes[0].loot).toHaveLength(1);   // editar a criatura não perde o loot
  });
  it("andamento: marcar encontrado, coletar e distribuir parcialmente; restaurar e concluir avisam", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([iniciarSemCombate(base())]));
    render(<EncontrosPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir encontro Covil" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    const lido = () => lerEncontros(localStorage.getItem(chaveEncontros("u1", "c1")))[0];
    fireEvent.click(within(pagina).getByRole("button", { name: "Tesouros" }));
    const and = within(within(pagina).getByRole("group", { name: "Andamento do loot" }));
    const bau = within(and.getByText(/^Baú trancado/).closest("details")!);
    fireEvent.click(bau.getAllByRole("button", { name: /Marcar encontrado/ })[0]);
    await waitFor(() => expect(linha(lido(), "r:r1|b1").encontrado).toBe(true));
    fireEvent.change(bau.getAllByLabelText("Quantidade a mover de Poção de cura")[0], { target: { value: "1" } });
    fireEvent.click(bau.getByRole("button", { name: "Coletar Poção de cura" })); await waitFor(() => expect(linha(lido(), "r:r1|b1").coletada).toBe(1));
    fireEvent.click(bau.getByRole("button", { name: "Distribuir Poção de cura" })); await waitFor(() => expect(linha(lido(), "r:r1|b1").distribuida).toBe(1));
    expect(bau.getByText(/coletado 1\/2 · distribuído 1\/2/)).toBeTruthy();
    const confirma = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(within(pagina).getByRole("button", { name: "Progresso" }));
    fireEvent.click(within(pagina).getByRole("button", { name: "Restaurar original" }));
    expect(confirma.mock.calls[0][0]).toMatch(/continuam com os personagens/); expect(lido().estado).toBe("em_andamento");
    fireEvent.click(within(pagina).getByRole("button", { name: "Concluir encontro" }));
    expect(confirma.mock.calls[1][0]).toMatch(/loot sem distribuir/);
  });
});
