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
