// @vitest-environment jsdom
import { abrirAvulso, abrirBusca } from "../tests/combate-ui";
// Integração combate x ficha: PV carregados da ficha ao adicionar o personagem, PV finais gravados na ficha ao finalizar (sem sobrescrever o resto),
// falhas sem perda silenciosa, e acesso exclusivo do mestre.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VERSION_2014, sheet2014 } from "./criador/regras-2014";
import { fichasEmMemoria, novoBancoFichas, type BancoFichas } from "./fichasMemoria";
import type { CharacterDraft } from "./rules/character-domain";

let escopo: { user: { id: string } | null; active: { role: "mestre" | "jogador"; campaign: { id: string; name: string } } | null } = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } };
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: escopo.user }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: escopo.active }) }));
import { AventureirosContext } from "./AventureirosContext";
import { IniciativaPanel } from "./Iniciativa";
import { RegistrosProvider } from "./RegistrosContext";

const draft = (patch: Partial<CharacterDraft> = {}): CharacterDraft => ({
  id: "p1", name: "Lydia", catalogueVersion: VERSION_2014, ruleset: "5e-2014", classId: "fighter", raceId: "human", backgroundId: "acolyte", level: 1,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], inventory: [], currentHp: 0, temporaryHp: 0, spentResources: {}, ...patch,
});
const MAX = sheet2014(draft()).maxHp;   // 12
let banco: BancoFichas;
const personagens = { listar: async () => ({ ok: true as const, data: [{ id: "p1", nome: "Lydia", classe: "Guerreira", nivel: 1 }, { id: "p2", nome: "Toran", classe: "Guerreiro", nivel: 1 }] }) };
const montar = () => render(<AventureirosContext.Provider value={personagens}><RegistrosProvider api={null} fichas={fichasEmMemoria("u1", banco)}><IniciativaPanel/></RegistrosProvider></AventureirosContext.Provider>);
const fichaDe = (id: string) => banco.fichas.find(f => f.id === id)!;
const abrirSeletor = async () => { await screen.findByText("Nenhum combatente ainda"); abrirBusca("Personagens"); fireEvent.focus(await screen.findByLabelText("Buscar combatentes")); await screen.findByRole("button", { name: "Adicionar Lydia (personagem)" }); };

beforeEach(() => {
  localStorage.clear(); escopo = { user: { id: "u1" }, active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } };
  banco = novoBancoFichas(); banco.campanhas = { c1: { mestre: "u1", jogadores: ["u2"] } };
  banco.fichas.push({ id: "p1", campaignId: "c1", ownerId: "u2", revision: 1, draft: draft({ currentHp: 5, temporaryHp: 3 }), updatedAt: "" });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("adicionar personagem: PV carregados da ficha", () => {
  it("traz PV atuais e máximos automaticamente (sem digitar nada)", async () => {
    montar(); await abrirSeletor();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Lydia (personagem)" }));
    expect((await screen.findByLabelText("PV de Lydia")).textContent).toBe(`PV 5/${MAX}`);
  });
  it("personagem sem ficha guiada: bloqueia inclusão e não oferece PV manual", async () => {
    montar(); await abrirSeletor();
    expect(screen.queryByLabelText(/PV máximo manual/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Toran (personagem)" }));
    expect(await screen.findByText(/Não foi possível adicionar Toran/)).toBeTruthy();
    expect(screen.getByText("Nenhum combatente ainda")).toBeTruthy();
  });
  it("sem rede ao ler a ficha: bloqueia inclusão e avisa", async () => {
    montar(); await abrirSeletor(); banco.rede.caida = true;
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Lydia (personagem)" }));
    expect(await screen.findByText(/Não foi possível adicionar Lydia/)).toBeTruthy();
    expect(screen.queryByLabelText("PV de Lydia")).toBeNull();
    expect(screen.getByText("Nenhum combatente ainda")).toBeTruthy();
  });
});

describe("finalizar o combate: PV persistem na ficha", () => {
  const comDano = async () => {
    montar(); await abrirSeletor(); fireEvent.click(screen.getByRole("button", { name: "Adicionar Lydia (personagem)" }));
    await screen.findByLabelText("PV de Lydia");
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Lydia"), { target: { value: "3" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Lydia" }));
    await waitFor(() => expect(screen.getByLabelText("PV de Lydia").textContent).toBe(`PV 2/${MAX}`));
  };
  it("grava os PV finais na ficha (só currentHp), sobe a revisão e limpa o combate", async () => {
    await comDano(); vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    await waitFor(() => expect(fichaDe("p1").draft.currentHp).toBe(2));
    expect(fichaDe("p1").draft).toMatchObject({ name: "Lydia", temporaryHp: 3 });           // o resto da ficha intacto
    expect(fichaDe("p1").revision).toBe(2);
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy();                // combate finalizado
  });
  it("se o dono alterou a ficha durante o combate, a alteração dele é preservada (revisão relida)", async () => {
    await comDano();
    const f = fichaDe("p1"); f.draft = { ...f.draft, name: "Lydia Valenmoor", temporaryHp: 8 }; f.revision = 7;   // o dono salvou depois de o combate começar
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    await waitFor(() => expect(fichaDe("p1").draft.currentHp).toBe(2));
    expect(fichaDe("p1").draft).toMatchObject({ name: "Lydia Valenmoor", temporaryHp: 8 }); expect(fichaDe("p1").revision).toBe(8);
  });
  it("falha ao gravar a ficha: o mestre decide; cancelar mantém o combate aberto e nada é perdido", async () => {
    await comDano();
    banco.rede.caida = true;
    const conf = vi.spyOn(window, "confirm").mockReturnValueOnce(true).mockReturnValueOnce(false);   // 1ª: finalizar; 2ª: "finalizar mesmo assim?" = não
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    expect(await screen.findByText(/Combate mantido aberto/)).toBeTruthy();
    expect(conf.mock.calls[1][0]).toMatch(/Lydia/);
    expect(screen.getByLabelText("PV de Lydia").textContent).toBe(`PV 2/${MAX}`);              // continua no combate
    expect(fichaDe("p1").draft.currentHp).toBe(5);                                             // ficha intacta
    banco.rede.caida = false; conf.mockReturnValue(true);                                       // tenta de novo, agora com rede
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    await waitFor(() => expect(fichaDe("p1").draft.currentHp).toBe(2));
  });
  it("falha e 'finalizar mesmo assim': o combate termina e a ficha não é tocada", async () => {
    await comDano(); banco.rede.caida = true; vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ }));
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy();
    expect(fichaDe("p1").draft.currentHp).toBe(5);
  });
  it("monstros e combatentes avulsos não tocam em nenhuma ficha", async () => {
    montar(); await screen.findByText("Nenhum combatente ainda");
    abrirAvulso(); fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Goblin" } }); fireEvent.change(screen.getByLabelText("PV (opcional)"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" })); await screen.findByLabelText("PV de Goblin");
    vi.spyOn(window, "confirm").mockReturnValue(true); const antes = JSON.stringify(banco.fichas);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    fireEvent.click(screen.getByRole("button", { name: /Finalizar combate/ })); await screen.findByText("Nenhum combatente ainda");
    expect(JSON.stringify(banco.fichas)).toBe(antes);
  });
});

describe("acesso exclusivo do mestre", () => {
  it("jogador não vê a Iniciativa nem lê fichas por ela", async () => {
    escopo = { user: { id: "u2" }, active: { role: "jogador", campaign: { id: "c1", name: "Véu Negro" } } };
    const carregar = vi.spyOn(fichasEmMemoria("u2", banco), "carregar");
    render(<AventureirosContext.Provider value={personagens}><RegistrosProvider api={null} fichas={fichasEmMemoria("u2", banco)}><IniciativaPanel/></RegistrosProvider></AventureirosContext.Provider>);
    expect(await screen.findByText(/Somente o mestre da campanha pode acessar este módulo/)).toBeTruthy();
    expect(screen.queryByText("Adicionar personagem da campanha")).toBeNull(); expect(screen.queryByRole("button", { name: /Finalizar combate/ })).toBeNull();
    expect(carregar).not.toHaveBeenCalled();
  });
});

describe("remover personagem: os PV vão para a ficha antes de ele sair", () => {
  const comDano = async (fichas = fichasEmMemoria("u1", banco)) => {
    render(<AventureirosContext.Provider value={personagens}><RegistrosProvider api={null} fichas={fichas}><IniciativaPanel/></RegistrosProvider></AventureirosContext.Provider>);
    await abrirSeletor(); fireEvent.click(screen.getByRole("button", { name: "Adicionar Lydia (personagem)" }));
    await screen.findByLabelText("PV de Lydia");
    fireEvent.change(screen.getByLabelText("Quantidade de dano ou cura de Lydia"), { target: { value: "3" } }); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Lydia" }));
  };
  const remover = () => fireEvent.click(screen.getByRole("button", { name: "Remover Lydia" }));

  it("remover logo depois do dano grava só currentHp, e ao adicionar de novo vêm os PV atuais", async () => {
    await comDano(); remover();   // sem esperar nada entre o dano e a remoção
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy();
    expect(fichaDe("p1").draft).toMatchObject({ currentHp: 2, name: "Lydia", temporaryHp: 3 }); expect(fichaDe("p1").revision).toBe(2);
    abrirBusca("Personagens"); fireEvent.focus(screen.getByLabelText("Buscar combatentes"));
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Lydia (personagem)" }));
    expect((await screen.findByLabelText("PV de Lydia")).textContent).toBe(`PV 2/${MAX}`);
  });
  it("falha ao gravar: cancelando, ele continua no combate (inclusive após recarregar) e a nova tentativa grava", async () => {
    await comDano(); banco.rede.caida = true;
    const confirma = vi.spyOn(window, "confirm").mockReturnValue(false); remover();
    expect(await screen.findByText(/continua no combate: os PV não foram gravados/)).toBeTruthy();
    expect(confirma.mock.calls[0][0]).toMatch(/Não foi possível gravar os PV de Lydia \(2\)/);
    expect(screen.getByLabelText("PV de Lydia").textContent).toBe(`PV 2/${MAX}`); expect(fichaDe("p1").draft.currentHp).toBe(5);
    cleanup(); montar(); expect((await screen.findByLabelText("PV de Lydia")).textContent).toBe(`PV 2/${MAX}`);   // recarregar não perde
    banco.rede.caida = false; remover();
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy(); expect(fichaDe("p1").draft.currentHp).toBe(2);
  });
  it("falha ao gravar: confirmando, remove e deixa a ficha como estava", async () => {
    await comDano(); banco.rede.caida = true; vi.spyOn(window, "confirm").mockReturnValue(true); remover();
    expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy(); expect(fichaDe("p1").draft.currentHp).toBe(5);
  });
  it("alteração concorrente do dono é preservada: a gravação usa a revisão mais nova", async () => {
    await comDano();
    const f = fichaDe("p1"); f.draft = { ...f.draft, name: "Lydia Valenmoor", temporaryHp: 8 }; f.revision = 9;
    remover(); await screen.findByText("Nenhum combatente ainda");
    expect(fichaDe("p1").draft).toMatchObject({ currentHp: 2, name: "Lydia Valenmoor", temporaryHp: 8 }); expect(fichaDe("p1").revision).toBe(10);
  });
  it("durante a gravação a linha fica bloqueada: sem remoção dupla nem PV alterado no meio", async () => {
    const base = fichasEmMemoria("u1", banco); let liberar!: () => void; const espera = new Promise<void>(r => { liberar = r; });
    const salvar = vi.fn(async (...a: Parameters<typeof base.salvar>) => { await espera; return base.salvar(...a); });
    await comDano({ ...base, salvar }); remover();
    expect(await screen.findByText("Gravando os PV na ficha…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Remover Lydia" }) as HTMLButtonElement).disabled).toBe(true);
    remover(); fireEvent.click(screen.getByRole("button", { name: "Causar dano a Lydia" }));
    expect(screen.getByLabelText("PV de Lydia").textContent).toBe(`PV 2/${MAX}`);
    liberar(); expect(await screen.findByText("Nenhum combatente ainda")).toBeTruthy();
    expect(salvar).toHaveBeenCalledTimes(1); expect(fichaDe("p1").draft.currentHp).toBe(2);
  });
});

describe("combate ativo sem participantes", () => {
  it("continua podendo ser finalizado; só o que depende de um turno fica desabilitado", async () => {
    montar(); await abrirSeletor(); fireEvent.click(screen.getByRole("button", { name: "Adicionar Lydia (personagem)" }));
    await screen.findByLabelText("PV de Lydia");
    fireEvent.click(screen.getByRole("button", { name: "Próximo turno" })); expect(screen.getByText("Rodada 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover Lydia" })); await screen.findByText("Nenhum combatente ainda");
    expect(screen.getByText("Rodada 2")).toBeTruthy();   // o combate continua ativo, vazio
    for (const nome of ["Próximo turno", "Turno anterior"]) expect((screen.getByRole("button", { name: nome }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações do combate" }));
    expect((screen.getByRole("button", { name: "Reiniciar rodadas" }) as HTMLButtonElement).disabled).toBe(true);
    const fim = screen.getByRole("button", { name: "Finalizar combate" }) as HTMLButtonElement; expect(fim.disabled).toBe(false);
    vi.spyOn(window, "confirm").mockReturnValue(true); fireEvent.click(fim);
    await waitFor(() => expect(screen.getByText("Rodada 1")).toBeTruthy());
  });
});
