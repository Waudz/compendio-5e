// @vitest-environment jsdom
// Encontros (entrega 3): estados, configuração original x estado atual, vínculo estável com o combate, restauração, duplicação e persistência.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { chaveEncontros, adicionar, remover, combateVazio, enviarParaCombate, lerCombate, lerEncontros, alterarPv, type Encontro, type EstadoCombate } from "./combate";
import { concluirEncontro, duplicarEstadoAtual, estadoDe, iniciarSemCombate, marcarEnviado, pendencias, podeRestaurar, reabrirEncontro, restaurarOriginal, sincronizarComCombate } from "./estadoEncontro";
import { duplicarEncontro } from "./combate";

vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } }) }));
import { EncontrosPanel, IniciativaPanel } from "./Iniciativa";

const goblins = (): Encontro => ({ id: "e1", nome: "Covil", descricao: "Sala dos goblins", participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }, { id: "p2", nome: "Chefe", quantidade: 1, pv: 20 }] });
const nomes = (c: EstadoCombate) => c.combatentes.map(x => x.nome).sort();
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("vínculo estável e duplicação acidental", () => {
  it("combatentes carregam encontroId + criaturaId; reenviar não duplica; combate mistura encontros", () => {
    const a = goblins(), b: Encontro = { id: "e2", nome: "Ponte", participantes: [{ id: "q1", nome: "Troll", quantidade: 1, pv: 84 }] };
    let c = enviarParaCombate(combateVazio(), a);
    expect(c.combatentes.map(x => x.encontro)).toEqual(expect.arrayContaining([{ encontroId: "e1", criaturaId: "p1#1" }, { encontroId: "e1", criaturaId: "p1#2" }, { encontroId: "e1", criaturaId: "p2#1" }]));
    c = enviarParaCombate(enviarParaCombate(c, a), a); expect(c.combatentes).toHaveLength(3);          // idempotente
    c = enviarParaCombate(c, b); expect(nomes(c)).toEqual(["Chefe", "Goblin 1", "Goblin 2", "Troll"]);   // vários encontros no mesmo combate
    expect(lerCombate(JSON.stringify(c)).combatentes.find(x => x.nome === "Troll")?.encontro).toEqual({ encontroId: "e2", criaturaId: "q1#1" });   // sobrevive à leitura
  });
});

describe("ciclo de vida", () => {
  it("encontro antigo (sem campos novos) é 'preparado' e segue válido", () => {
    const antigo = lerEncontros(JSON.stringify([{ id: "e1", nome: "Velho", participantes: [{ id: "p", nome: "Orc", quantidade: 1 }] }]))[0];
    expect(estadoDe(antigo)).toBe("preparado"); expect(antigo.atual).toBeUndefined(); expect(podeRestaurar(antigo)).toBe(false);
  });
  it("enviar põe 'em combate' sem mexer na configuração original; fim do combate preserva sobreviventes e PV e fica 'em andamento'", () => {
    const orig = goblins(), original = JSON.stringify(orig.participantes);
    let enc = marcarEnviado(orig, orig); expect(enc.estado).toBe("em_combate"); expect(enc.atual!.criaturas.every(c => c.noCombate)).toBe(true);
    let combate = enviarParaCombate(combateVazio(), orig);
    const g1 = combate.combatentes.find(x => x.nome === "Goblin 1")!, chefe = combate.combatentes.find(x => x.nome === "Chefe")!;
    combate = alterarPv(alterarPv(combate, g1.id, -7), chefe.id, -5);
    const meio = sincronizarComCombate(enc, combate); expect(meio.estado).toBe("em_combate");              // atualizar durante o combate não encerra
    expect(meio.atual!.criaturas.find(c => c.id === "p1#1")).toMatchObject({ situacao: "derrotada", pv: 0 });
    enc = sincronizarComCombate(enc, combate, true);
    expect(enc.estado).toBe("em_andamento"); expect(pendencias(enc)).toEqual(["2 criatura(s) viva(s)"]);
    expect(enc.atual!.criaturas.find(c => c.id === "p2#1")).toMatchObject({ situacao: "viva", pv: 15, pvMax: 20 }); expect(enc.atual!.criaturas.some(c => c.noCombate)).toBe(false);
    expect(JSON.stringify(enc.participantes)).toBe(original);   // original intacto
  });
  it("conclui sozinho só sem pendências (todas derrotadas)", () => {
    let enc = marcarEnviado(goblins(), goblins()), combate = enviarParaCombate(combateVazio(), goblins());
    for (const c of combate.combatentes) combate = alterarPv(combate, c.id, -999);
    enc = sincronizarComCombate(enc, combate, true); expect(enc.estado).toBe("concluido"); expect(pendencias(enc)).toEqual([]);
  });
  it("retomar: só sobreviventes voltam, com o PV atual, sem duplicar quem já está no combate", () => {
    let enc = marcarEnviado(goblins(), goblins()), combate = enviarParaCombate(combateVazio(), goblins());
    const g1 = combate.combatentes.find(x => x.nome === "Goblin 1")!, chefe = combate.combatentes.find(x => x.nome === "Chefe")!;
    combate = alterarPv(alterarPv(combate, g1.id, -7), chefe.id, -5);
    enc = sincronizarComCombate(enc, combate, true);
    const novo = enviarParaCombate(combateVazio(), enc);
    expect(nomes(novo)).toEqual(["Chefe", "Goblin 2"]);                       // o derrotado não volta
    expect(novo.combatentes.find(x => x.nome === "Chefe")).toMatchObject({ pv: 15, pvMax: 20 });
    expect(enviarParaCombate(novo, enc).combatentes).toHaveLength(2);        // reenviar com ele já no combate não duplica
    expect(enviarParaCombate(combate, enc).combatentes).toHaveLength(3);     // nem em um combate que ainda tem as criaturas
  });
  it("criatura removida do combate deixa de estar 'no combate' e o encontro pode terminar o combate", () => {
    let enc = marcarEnviado(goblins(), goblins());
    enc = sincronizarComCombate(enc, combateVazio()); expect(enc.atual!.criaturas.some(c => c.noCombate)).toBe(false); expect(enc.estado).toBe("em_andamento");
  });
  it("sem combate: iniciar, concluir e reabrir; concluir bloqueado em combate; restaurar só fora de combate", () => {
    const enc = goblins(), em = iniciarSemCombate(enc);
    expect(em.estado).toBe("em_andamento"); expect(em.atual!.criaturas).toHaveLength(3);
    const fim = concluirEncontro(em); expect(fim.estado).toBe("concluido"); expect(reabrirEncontro(fim).estado).toBe("em_andamento");
    expect(concluirEncontro(enc).estado).toBe("concluido");                    // pode concluir direto, sem nunca ter havido combate
    const luta = marcarEnviado(enc, enc);
    expect(concluirEncontro(luta)).toBe(luta); expect(restaurarOriginal(luta)).toBe(luta); expect(podeRestaurar(luta)).toBe(false);
    const r = restaurarOriginal(em); expect(r.estado).toBe("preparado"); expect(r.atual).toBeUndefined(); expect(r.participantes).toEqual(enc.participantes);
  });
  it("duplicar original não leva o estado; duplicar estado atual leva, com ids novos e remapeados", () => {
    let enc = marcarEnviado(goblins(), goblins()); enc = sincronizarComCombate(enc, combateVazio());
    const o = duplicarEncontro(enc); expect(o.estado).toBeUndefined(); expect(o.atual).toBeUndefined();
    const a = duplicarEstadoAtual(enc);
    expect(a.id).not.toBe(enc.id); expect(a.estado).toBe("em_andamento"); expect(a.atual!.criaturas).toHaveLength(3);
    const pids = new Set(a.participantes.map(p => p.id)); expect(a.participantes.some(p => enc.participantes.some(q => q.id === p.id))).toBe(false);
    for (const c of a.atual!.criaturas) { expect(pids.has(c.participanteId)).toBe(true); expect(c.id.startsWith(`${c.participanteId}#`)).toBe(true); expect(c.noCombate).toBeUndefined(); }
    expect(lerEncontros(JSON.stringify([a]))).toEqual([a]);                  // persiste e relê igual
  });
  it("estado atual inválido no armazenamento é recusado, não ignorado", () => {
    expect(() => lerEncontros(JSON.stringify([{ id: "e", nome: "x", participantes: [], atual: { criaturas: [{ id: "a" }] } }]))).toThrow();
  });
});

describe("telas: fim do combate e página do encontro", () => {
  it("Finalizar combate devolve PV e sobreviventes ao encontro, persiste e mantém 'em andamento'", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([{ id: "e1", nome: "Covil", participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }] }]));
    render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    fireEvent.click(screen.getByText("Adicionar encontro preparado")); fireEvent.click(await screen.findByRole("button", { name: "Incluir no combate: Covil" }));
    await screen.findByText("Goblin 1", { selector: "strong" });
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Goblin 1"), { target: { value: "7" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Goblin 1" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    await screen.findByText("Nenhum combatente ainda");
    await waitFor(() => { const e = lerEncontros(localStorage.getItem(chaveEncontros("u1", "c1")))[0]; expect(e.estado).toBe("em_andamento"); });
    const e = lerEncontros(localStorage.getItem(chaveEncontros("u1", "c1")))[0];
    expect(e.atual!.criaturas.map(c => [c.id, c.situacao, c.pv])).toEqual([["p1#1", "derrotada", 0], ["p1#2", "viva", 7]]);
    expect(e.participantes).toEqual([{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }]);
  });
  it("página: estado visível, restaurar com confirmação, bloqueio em combate, concluir sem combate e duplicar estado atual", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([goblins()]));
    render(<EncontrosPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir encontro Covil" }));
    let pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    fireEvent.click(within(pagina).getByRole("button", { name: "Progresso" }));
    const lido = () => lerEncontros(localStorage.getItem(chaveEncontros("u1", "c1")));
    expect((within(pagina).getByRole("button", { name: "Restaurar original" }) as HTMLButtonElement).disabled).toBe(true);      // nada a restaurar
    fireEvent.click(within(pagina).getByRole("button", { name: "Iniciar sem combate" }));
    await waitFor(() => expect(lido()[0].estado).toBe("em_andamento"));
    expect(within(pagina).getAllByText("Em andamento").length).toBeGreaterThan(0); expect(within(pagina).getByRole("list", { name: "Estado atual das criaturas" })).toBeTruthy();
    fireEvent.click(within(pagina).getByRole("button", { name: "Duplicar estado atual" }));
    fireEvent.click(within(pagina).getByRole("button", { name: /Voltar à lista/ }));
    expect(await screen.findByRole("region", { name: "Encontro Covil (estado atual)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir encontro Covil" })); pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    fireEvent.click(within(pagina).getByRole("button", { name: "Progresso" }));
    const confirma = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(within(pagina).getByRole("button", { name: "Restaurar original" })); expect(lido()[0].estado).toBe("em_andamento");   // recusou: nada muda
    fireEvent.click(within(pagina).getByRole("button", { name: "Restaurar original" })); await waitFor(() => expect(lido()[0].estado).toBe("preparado")); expect(confirma).toHaveBeenCalledTimes(2);
    expect(lido()[0].atual).toBeUndefined(); expect(lido()[0].participantes).toEqual(goblins().participantes);
    fireEvent.click(within(pagina).getByRole("button", { name: "Concluir encontro" })); await waitFor(() => expect(lido()[0].estado).toBe("concluido"));
  });
  it("em combate: restaurar e concluir ficam bloqueados; atualizar a partir do combate encerra quando o combate acabou", async () => {
    const e = marcarEnviado(goblins(), goblins());
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([e]));
    render(<EncontrosPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir encontro Covil" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    fireEvent.click(within(pagina).getByRole("button", { name: "Progresso" }));
    expect((within(pagina).getByRole("button", { name: "Restaurar original" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(pagina).getByRole("button", { name: "Concluir encontro" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(pagina).getByRole("button", { name: "Atualizar a partir do combate" }));    // não há combate guardado: equivale a combate encerrado
    await waitFor(() => expect(lerEncontros(localStorage.getItem(chaveEncontros("u1", "c1")))[0].estado).toBe("em_andamento"));
    expect((within(pagina).getByRole("button", { name: "Restaurar original" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("regressões #138", () => {
  it("envia quatro de cinco, preserva o quinto e permite retomar após remoção", () => {
    const original: Encontro = { id: "e", nome: "Emboscada", participantes: [{ id: "p", nome: "Goblin", quantidade: 5, pv: 7 }] };
    const parcial = { ...original, participantes: [{ ...original.participantes[0], quantidade: 4 }] };
    let combate = enviarParaCombate(combateVazio(), parcial);
    let enc = marcarEnviado(original, parcial);
    expect(enc.atual!.criaturas).toHaveLength(5);
    expect(enc.atual!.criaturas.filter(c => c.noCombate)).toHaveLength(4);
    enc = lerEncontros(JSON.stringify([enc]))[0];
    combate = enviarParaCombate(combate, enc);
    enc = marcarEnviado(enc, enc);
    expect(combate.combatentes).toHaveLength(5);
    const alvo = combate.combatentes[0];
    combate = alterarPv(combate, alvo.id, -3);
    enc = sincronizarComCombate(enc, combate);
    combate = remover(combate, alvo.id);
    enc = sincronizarComCombate(enc, combate);
    expect(enc.atual!.criaturas.find(c => c.id === alvo.encontro!.criaturaId)).toMatchObject({ pv: 4, situacao: "viva" });
    combate = enviarParaCombate(combate, enc);
    expect(combate.combatentes).toHaveLength(5);
    expect(combate.combatentes.find(c => c.encontro?.criaturaId === alvo.encontro!.criaturaId)?.pv).toBe(4);
  });
  it("recupera encontro parcial antigo e evita colisão com avulso", () => {
    const original = goblins();
    const enc = { ...original, atual: { criaturas: [{ id: "p1#1", participanteId: "p1", nome: "Goblin 1", situacao: "viva" as const, noCombate: true }] } };
    const combate = enviarParaCombate(adicionar(combateVazio(), { nome: "Goblin 2", iniciativa: 0, lado: "inimigo" }), enc);
    expect(combate.combatentes).toHaveLength(3);
    expect(new Set(combate.combatentes.map(c => c.nome)).size).toBe(3);
    expect(combate.combatentes.some(c => c.encontro?.criaturaId === "p1#2")).toBe(true);
  });
});
