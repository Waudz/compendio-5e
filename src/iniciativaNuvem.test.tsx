// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Encontro, EstadoCombate } from "./combate";
import type { ApiLinha, ResultadoLinha } from "./linhaRemota";

let escopo: { user: { id: string } | null; active: { role: "mestre" | "jogador"; campaign: { id: string; name: string } } | null } = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } };
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: escopo.user }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: escopo.active }) }));
import { AventureirosContext } from "./AventureirosContext";
import type { ApiStatus } from "./statusCombate";
import { EncontrosPanel, IniciativaPanel, NuvemContext } from "./Iniciativa";

/** Servidor falso em memória (mesmo contrato do adaptador real): versão otimista por campanha. */
function servidor<T>(vazio: T) {
  const s = { linhas: new Map<string, { valor: T; versao: number }>(), carregamentos: 0, gravacoes: 0, falhas: 0, finalizados: 0 };
  const api: ApiLinha<T> = {
    async carregar(id) { s.carregamentos++; return { ok: true, data: s.linhas.get(id) ?? { valor: vazio, versao: 0 } }; },
    async salvar(id, valor, esperada): Promise<ResultadoLinha<T>> {
      s.gravacoes++;
      if (s.falhas > 0) { s.falhas--; return { ok: false, tipo: "indisponivel", mensagem: "Sem conexão com o servidor." }; }
      if ((s.linhas.get(id)?.versao ?? 0) !== esperada) return { ok: false, tipo: "conflito", mensagem: "O combate mudou em outra sessão." };
      const nova = { valor: JSON.parse(JSON.stringify(valor)) as T, versao: esperada + 1 }; s.linhas.set(id, nova); return { ok: true, data: nova };
    },
    async finalizar(id, esperada) { if (s.linhas.get(id)?.versao !== esperada) return { ok: false, tipo: "conflito", mensagem: "Mudou." }; s.linhas.delete(id); s.finalizados++; return { ok: true }; },
  };
  return { s, api };
}
const vazioCombate: EstadoCombate = { combatentes: [], turno: null, rodada: 1 };
function montar(ui: React.ReactElement, combate = servidor<EstadoCombate>(vazioCombate), encontros = servidor<Encontro[]>([])) {
  const r = render(<NuvemContext.Provider value={{ combate: combate.api, encontros: encontros.api }}>{ui}</NuvemContext.Provider>);
  return { ...r, combate, encontros };
}
const preencher = (rotulo: string, valor: string) => fireEvent.change(within(screen.getByRole("form", { name: /^(Adicionar combatente|Novo encontro)$/ })).getByLabelText(rotulo), { target: { value: valor } });
beforeEach(() => { localStorage.clear(); escopo = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Iniciativa na nuvem", () => {
  it("mostra o modo 'nuvem', salva cada alteração no servidor e retoma o combate ao reabrir (outro aparelho)", async () => {
    const { combate, unmount } = montar(<IniciativaPanel/>);
    await screen.findByText("Nenhum combatente ainda"); expect(document.querySelector("[data-modo='nuvem']")).toBeTruthy();
    preencher("Nome", "Goblin"); preencher("Iniciativa", "12"); preencher("PV (opcional)", "7"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    preencher("Nome", "Lydia"); preencher("Iniciativa", "18"); preencher("Lado", "aliado"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(document.querySelector("[data-sync='salvo']")).toBeTruthy());
    expect(combate.s.linhas.get("c1")?.valor.combatentes.map(c => c.nome)).toEqual(["Lydia", "Goblin"]);
    fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ })); fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ }));
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Goblin"), { target: { value: "3" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Goblin" }));
    await waitFor(() => expect(combate.s.linhas.get("c1")?.valor).toMatchObject({ rodada: 2 }));
    await waitFor(() => expect(combate.s.linhas.get("c1")?.valor.combatentes.find(c => c.nome === "Goblin")?.pv).toBe(4));
    unmount(); localStorage.clear();   // "outro aparelho": sem nada local
    montar(<IniciativaPanel/>, combate);
    expect(await screen.findByText("Rodada 2")).toBeTruthy(); expect(screen.getByLabelText("PV de Goblin").textContent).toBe("PV 4/7");
  });
  it("não usa o armazenamento local como fonte de verdade e não apaga o combate antigo do navegador (backup com opção de baixar)", async () => {
    const antigo = JSON.stringify({ combatentes: [{ id: "x", nome: "Antigo", iniciativa: 1, lado: "inimigo" }], turno: "x", rodada: 5 });
    localStorage.setItem("compendio5e:iniciativa:u1:c1", antigo);
    montar(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
    expect(screen.queryByText("Antigo")).toBeNull(); expect(screen.getByText(/não foi importado nem apagado/)).toBeTruthy(); expect(screen.getByRole("button", { name: /Baixar backup/ })).toBeTruthy();
    preencher("Nome", "Novo"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(document.querySelector("[data-sync='salvo']")).toBeTruthy());
    expect(localStorage.getItem("compendio5e:iniciativa:u1:c1")).toBe(antigo);
  });
  it("queda de conexão: mantém na tela, avisa e grava sozinho quando volta", async () => {
    const combate = servidor<EstadoCombate>(vazioCombate); combate.s.falhas = 1;
    montar(<IniciativaPanel/>, combate); await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Goblin"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeTruthy(); expect(screen.getByRole("group", { name: "Combatentes" }).textContent).toContain("Goblin");
    fireEvent.click(screen.getByRole("button", { name: "Tentar agora" }));
    await waitFor(() => expect(combate.s.linhas.get("c1")?.valor.combatentes[0].nome).toBe("Goblin"));
  });
  it("conflito entre aparelhos: não sobrescreve o servidor, avisa e permite recarregar", async () => {
    const combate = servidor<EstadoCombate>(vazioCombate);
    montar(<IniciativaPanel/>, combate); await screen.findByText("Nenhum combatente ainda");
    combate.s.linhas.set("c1", { valor: { combatentes: [{ id: "o", nome: "Do outro aparelho", iniciativa: 1, lado: "inimigo" }], turno: "o", rodada: 1 }, versao: 1 });
    preencher("Nome", "Meu"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/mudou em outra sessão/);
    expect(combate.s.linhas.get("c1")?.valor.combatentes.map(c => c.nome)).toEqual(["Do outro aparelho"]);
    fireEvent.click(screen.getByRole("button", { name: "Recarregar do servidor" }));
    expect(await screen.findByText("Do outro aparelho", { selector: "strong" })).toBeTruthy(); expect(screen.queryByText("Meu")).toBeNull();
  });
  it("finalizar apaga o combate no servidor mas preserva os encontros; novo combate começa limpo", async () => {
    const combate = servidor<EstadoCombate>(vazioCombate), encontros = servidor<Encontro[]>([]);
    encontros.s.linhas.set("c1", { valor: [{ id: "e1", nome: "Emboscada", participantes: [{ id: "p", nome: "Goblin", quantidade: 2 }] }], versao: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    montar(<IniciativaPanel/>, combate, encontros); await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Goblin"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" })); await waitFor(() => expect(combate.s.linhas.has("c1")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    await waitFor(() => expect(combate.s.finalizados).toBe(1)); expect(combate.s.linhas.has("c1")).toBe(false);
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy(); expect(encontros.s.linhas.get("c1")?.valor).toHaveLength(1);
  });
  it("condições, rolar iniciativa e turno anterior", async () => {
    const combate = servidor<EstadoCombate>(vazioCombate);
    montar(<IniciativaPanel/>, combate); await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Orc"); preencher("Iniciativa", "10"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    preencher("Nome", "Lydia"); preencher("Iniciativa", "15"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.change(screen.getByLabelText("Adicionar condição a Orc"), { target: { value: "Caído" } });
    expect(await screen.findByRole("button", { name: "Remover condição Caído de Orc" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ })); fireEvent.click(screen.getByRole("button", { name: /Próximo turno/ })); expect(screen.getByText("Rodada 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Turno anterior/ })); expect(screen.getByText("Rodada 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover condição Caído de Orc" })); await waitFor(() => expect(screen.queryByRole("button", { name: "Remover condição Caído de Orc" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Rolar iniciativa de Orc" }));
    await waitFor(() => { const ini = combate.s.linhas.get("c1")?.valor.combatentes.find(c => c.nome === "Orc")?.iniciativa; expect(ini).toBeGreaterThanOrEqual(1); expect(ini).toBeLessThanOrEqual(20); });
  });
  it("adiciona monstro do Bestiário com PV e referência estável, e personagem da campanha", async () => {
    const combate = servidor<EstadoCombate>(vazioCombate);
    const fonte = { listar: async () => ({ ok: true as const, data: [{ id: "pj1", nome: "Lydia Valenmoor", classe: "Guerreira", nivel: null }] }) };
    render(<AventureirosContext.Provider value={fonte}><NuvemContext.Provider value={{ combate: combate.api, encontros: servidor<Encontro[]>([]).api }}><IniciativaPanel/></NuvemContext.Provider></AventureirosContext.Provider>);
    await screen.findByText("Nenhum combatente ainda");
    fireEvent.click(screen.getByText(/Adicionar do Bestiário/)); fireEvent.change(await screen.findByLabelText("Buscar monstro"), { target: { value: "goblin" } });
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Goblin do Bestiário" }));
    fireEvent.click(screen.getByText("Adicionar personagem da campanha")); fireEvent.focus(await screen.findByLabelText("Buscar personagem")); fireEvent.click(await screen.findByRole("button", { name: "Adicionar Lydia Valenmoor (personagem)" }));
    await waitFor(() => expect(combate.s.linhas.get("c1")?.valor.combatentes).toHaveLength(2));
    const cs = combate.s.linhas.get("c1")!.valor.combatentes;
    expect(cs.find(c => c.ref?.tipo === "monstro")).toMatchObject({ nome: "Goblin", ref: { tipo: "monstro", id: "goblin" }, pvMax: 7, lado: "inimigo" });
    expect(cs.find(c => c.ref?.tipo === "personagem")).toMatchObject({ nome: "Lydia Valenmoor", ref: { tipo: "personagem", id: "pj1" }, lado: "aliado" });
  });
  it("jogador não acessa nem consulta a API de combate", async () => {
    escopo.active = { role: "jogador", campaign: { id: "c1", name: "Véu Negro" } };
    const { combate, encontros } = montar(<><IniciativaPanel/><EncontrosPanel/></>);
    expect((await screen.findAllByText(/Somente o mestre da campanha/)).length).toBe(2);
    await new Promise(r => setTimeout(r, 50)); expect(combate.s.carregamentos + encontros.s.carregamentos + combate.s.gravacoes + encontros.s.gravacoes).toBe(0);
  });
});

describe("Encontros na nuvem", () => {
  it("fim do combate atualiza o encontro no servidor e o painel de Encontros (outra instância) relê o estado novo", async () => {
    const combate = servidor<EstadoCombate>(vazioCombate), encontros = servidor<Encontro[]>([]);
    encontros.s.linhas.set("c1", { valor: [{ id: "e1", nome: "Covil", participantes: [{ id: "p", nome: "Goblin", quantidade: 2, pv: 7 }] }], versao: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    montar(<><IniciativaPanel/><EncontrosPanel/></>, combate, encontros);
    fireEvent.click((await screen.findAllByText("Adicionar encontro preparado"))[0]); fireEvent.click(await screen.findByRole("button", { name: "Incluir no combate: Covil" }));
    await waitFor(() => expect(encontros.s.linhas.get("c1")?.valor[0].estado).toBe("em_combate"));
    await waitFor(() => expect(combate.s.linhas.get("c1")?.valor.combatentes[0]?.encontro).toEqual({ encontroId: "e1", criaturaId: "p#1" }));
    expect((await screen.findAllByText("Em combate")).length).toBeGreaterThan(0);                   // o painel Encontros também já vê
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    await waitFor(() => expect(encontros.s.linhas.get("c1")?.valor[0].estado).toBe("em_andamento"));
    expect(encontros.s.linhas.get("c1")?.valor[0].atual?.criaturas.map(c => [c.id, c.pv, c.noCombate])).toEqual([["p#1", 7, undefined], ["p#2", 7, undefined]]);
    expect((await screen.findAllByText("Em andamento")).length).toBeGreaterThan(0);
  });
  it("cria, edita, duplica, salva no servidor e envia ao combate sem apagar o encontro", async () => {
    const { combate, encontros } = montar(<EncontrosPanel/>);
    expect(await screen.findByText("Nenhum encontro preparado")).toBeTruthy();
    preencher("Nome do encontro", "Emboscada"); fireEvent.click(screen.getByRole("button", { name: /Criar encontro/ }));
    const cartao = await screen.findByRole("region", { name: "Página do encontro Emboscada" });
    fireEvent.change(within(cartao).getByLabelText("Nome"), { target: { value: "Goblin" } }); fireEvent.change(within(cartao).getByLabelText("Quantidade"), { target: { value: "2" } });
    fireEvent.click(within(cartao).getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(encontros.s.linhas.get("c1")?.valor[0].participantes[0]).toMatchObject({ nome: "Goblin", quantidade: 2 }));
    fireEvent.click(screen.getByRole("button", { name: /Voltar à lista/ }));
    fireEvent.click(within(await screen.findByRole("region", { name: "Encontro Emboscada" })).getByRole("button", { name: "Duplicar encontro Emboscada" }));
    await screen.findByRole("region", { name: "Encontro Emboscada (cópia)" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir encontro Emboscada" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Emboscada" });
    fireEvent.click(within(pagina).getByRole("button", { name: "Renomear encontro Emboscada" })); fireEvent.change(within(pagina).getByLabelText("Novo nome"), { target: { value: "Ruínas" } }); fireEvent.click(within(pagina).getByRole("button", { name: "Salvar nome" }));
    fireEvent.click(screen.getByRole("button", { name: /Voltar à lista/ }));
    fireEvent.click(within(await screen.findByRole("region", { name: "Encontro Ruínas" })).getByRole("button", { name: /Enviar para a Iniciativa/ }));
    expect(await screen.findByText(/foi enviado para a Iniciativa/)).toBeTruthy();
    expect(combate.s.linhas.get("c1")?.valor.combatentes.map(c => c.nome).sort()).toEqual(["Goblin 1", "Goblin 2"]);
    expect(encontros.s.linhas.get("c1")?.valor.map(e => e.nome)).toEqual(["Ruínas", "Emboscada (cópia)"]);   // o encontro original segue salvo
  });
  it("adiciona monstro do Bestiário ao encontro com PV e referência", async () => {
    const { encontros } = montar(<EncontrosPanel/>); await screen.findByText("Nenhum encontro preparado");
    preencher("Nome do encontro", "Covil"); fireEvent.click(screen.getByRole("button", { name: /Criar encontro/ }));
    const cartao = await screen.findByRole("region", { name: "Página do encontro Covil" });
    fireEvent.click(within(cartao).getByText("Adicionar do Bestiário")); fireEvent.change(await within(cartao).findByLabelText("Buscar monstro"), { target: { value: "ogro" } });
    fireEvent.click(await within(cartao).findByRole("button", { name: /Adicionar Ogro do Bestiário/ }));
    await waitFor(() => expect(encontros.s.linhas.get("c1")?.valor[0].participantes[0]).toMatchObject({ ref: { tipo: "monstro", id: "ogre" }, pv: 59 }));
  });
  it("conflito e queda de conexão aparecem também nos encontros", async () => {
    const encontros = servidor<Encontro[]>([]); encontros.s.falhas = 1;
    montar(<EncontrosPanel/>, undefined, encontros); await screen.findByText("Nenhum encontro preparado");
    preencher("Nome do encontro", "A"); fireEvent.click(screen.getByRole("button", { name: /Criar encontro/ }));
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeTruthy();
    await waitFor(() => expect(encontros.s.linhas.get("c1")?.valor[0].nome).toBe("A"), { timeout: 4000 });
  });
});

describe("sincronização de PV e condições com a ficha (fluxo autorizado)", () => {
  function statusFalso() {
    const chamadas: { id: string; hp: number | null; max: number | null; condicoes: string[] }[] = []; let limpos = 0, falhar = false;
    const api: ApiStatus = {
      async definir(id, hp, max, condicoes) { if (falhar) return { ok: false, mensagem: "Apenas o mestre da campanha pode atualizar a ficha." }; chamadas.push({ id, hp, max, condicoes: [...condicoes] }); return { ok: true }; },
      async limpar() { limpos++; return { ok: true }; }, async ler() { return { ok: true, status: null }; }, assinar: () => () => {},
    };
    return { api, chamadas, limpos: () => limpos, falhar: (v: boolean) => { falhar = v; } };
  }
  const fonte = { listar: async () => ({ ok: true as const, data: [{ id: "pj1", nome: "Lydia Valenmoor", classe: "Guerreira", nivel: null }] }) };
  const montarComStatus = (st: ReturnType<typeof statusFalso>, combate = servidor<EstadoCombate>(vazioCombate)) => {
    render(<AventureirosContext.Provider value={fonte}><NuvemContext.Provider value={{ combate: combate.api, encontros: servidor<Encontro[]>([]).api, status: st.api }}><IniciativaPanel/></NuvemContext.Provider></AventureirosContext.Provider>);
    return combate;
  };
  const adicionarLydia = async (pv = "12") => {
    await screen.findByText("Nenhum combatente ainda");
    fireEvent.click(screen.getByText("Adicionar personagem da campanha")); fireEvent.focus(await screen.findByLabelText("Buscar personagem")); fireEvent.change(await screen.findByLabelText(/PV máximo manual/), { target: { value: pv } });
    fireEvent.focus(await screen.findByLabelText("Buscar personagem"));
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Lydia Valenmoor (personagem)" }));
  };
  it("dano, cura e condição do personagem chegam à ficha; só PV, máximo e condições são enviados", async () => {
    const st = statusFalso(); montarComStatus(st); await adicionarLydia();
    await waitFor(() => expect(st.chamadas.at(-1)).toEqual({ id: "pj1", hp: 12, max: 12, condicoes: [] }));
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Lydia Valenmoor"), { target: { value: "5" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Lydia Valenmoor" }));
    await waitFor(() => expect(st.chamadas.at(-1)).toMatchObject({ hp: 7, max: 12 }));
    fireEvent.change(screen.getByLabelText("Adicionar condição a Lydia Valenmoor"), { target: { value: "Envenenado" } });
    await waitFor(() => expect(st.chamadas.at(-1)).toEqual({ id: "pj1", hp: 7, max: 12, condicoes: ["Envenenado"] }));
    for (const c of st.chamadas) expect(Object.keys(c).sort()).toEqual(["condicoes", "hp", "id", "max"]);   // nada de ordem, turno, rodada ou outros combatentes
  });
  it("monstros e combatentes genéricos NÃO geram status de ficha nem alteram o Bestiário", async () => {
    const st = statusFalso(); montarComStatus(st); await screen.findByText("Nenhum combatente ainda");
    preencher("Nome", "Orc"); preencher("PV (opcional)", "15"); fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click(screen.getByText(/Adicionar do Bestiário/)); fireEvent.change(await screen.findByLabelText("Buscar monstro"), { target: { value: "goblin" } }); fireEvent.click(await screen.findByRole("button", { name: "Adicionar Goblin do Bestiário" }));
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Goblin"), { target: { value: "3" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Goblin" }));
    await waitFor(() => expect(screen.getByLabelText("PV de Goblin").textContent).toBe("PV 4/7"));
    await new Promise(r => setTimeout(r, 80)); expect(st.chamadas).toEqual([]);
    const { todosOsMonstros } = await import("./catalogue/contratos"); expect((await todosOsMonstros()).find(m => m.id === "goblin")?.pv).toBe(7);   // definição original intacta
  });
  it("remover o personagem do combate limpa o estado dele na ficha; finalizar limpa a campanha", async () => {
    const st = statusFalso(); montarComStatus(st); await adicionarLydia("10");
    await waitFor(() => expect(st.chamadas.at(-1)).toMatchObject({ hp: 10, max: 10 }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Remover Lydia Valenmoor" }));
    await waitFor(() => expect(st.chamadas.at(-1)).toEqual({ id: "pj1", hp: null, max: null, condicoes: [] }));
    await adicionarLydia("10"); await waitFor(() => expect(screen.getByLabelText("PV de Lydia Valenmoor")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ })); await waitFor(() => expect(st.limpos()).toBe(1));
  });
  it("falha ao sincronizar a ficha avisa o mestre e não perde o combate", async () => {
    const st = statusFalso(); st.falhar(true); const combate = montarComStatus(st); await adicionarLydia();
    expect(await screen.findByText(/Ficha do jogador não atualizada/)).toBeTruthy();
    await waitFor(() => expect(combate.s.linhas.get("c1")?.valor.combatentes[0].nome).toBe("Lydia Valenmoor"));
  });
});
