// @vitest-environment jsdom
// Encontros (entrega 2): lista + página na mesma aba, descrição, edição individual de criaturas, compatibilidade dos dados salvos.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { adicionarParticipante, chaveCombate, chaveEncontros, definirDescricao, duplicarEncontro, editarParticipante, lerEncontros, type Encontro } from "./combate";

vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: { role: "mestre", campaign: { id: "c1", name: "Véu Negro" } } }) }));
import { EncontrosPanel } from "./Iniciativa";

const base: Encontro = { id: "e1", nome: "Covil", participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }] };
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("domínio dos encontros", () => {
  it("edita só a cópia: valida valores, remove PV/CA com null e mantém a origem", () => {
    const com = { ...base, participantes: [{ id: "p1", nome: "Ogro", quantidade: 1, pv: 59, ca: 11, ref: { tipo: "monstro" as const, id: "ogre" } }] };
    const r = editarParticipante(com, "p1", { nome: " Ogro ferido ", pv: 30, ca: null, notas: " carrega um saco " });
    expect(r.participantes[0]).toEqual({ id: "p1", nome: "Ogro ferido", quantidade: 1, pv: 30, notas: "carrega um saco", ref: { tipo: "monstro", id: "ogre" } });
    expect(editarParticipante(com, "p1", { quantidade: 0 })).toBe(com);
    expect(editarParticipante(com, "p1", { quantidade: 51 })).toBe(com);
    expect(editarParticipante(com, "p1", { nome: "  " })).toBe(com);
    expect(editarParticipante(com, "p1", { ca: 99 })).toBe(com);
    expect(editarParticipante(com, "nao-existe", { nome: "X" })).toBe(com);
  });
  it("descrição: define, limpa e é copiada na duplicação; dados antigos sem descrição seguem válidos", () => {
    const d = definirDescricao(base, "  Sala escura  "); expect(d.descricao).toBe("Sala escura");
    expect("descricao" in definirDescricao(d, "  ")).toBe(false);
    expect(duplicarEncontro(d).descricao).toBe("Sala escura");
    expect(lerEncontros(JSON.stringify([base]))).toEqual([base]);   // formato antigo intacto
    const novo = adicionarParticipante(d, { nome: "Lobo", quantidade: 1, pv: 11, ca: 13, notas: "faminto" });
    expect(lerEncontros(JSON.stringify([novo]))).toEqual([novo]);   // campos novos sobrevivem à leitura
  });
});

describe("tela Encontros: lista e página", () => {
  it("lista mostra resumo; Abrir leva à página na mesma tela; Voltar retorna", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([{ ...base, descricao: "Sala dos goblins" }]));
    render(<EncontrosPanel/>);
    const cartao = await screen.findByRole("region", { name: "Encontro Covil" });
    expect(within(cartao).getByText("Sala dos goblins")).toBeTruthy(); expect(within(cartao).getByText(/2× Goblin/)).toBeTruthy();
    fireEvent.click(within(cartao).getByRole("button", { name: "Abrir encontro Covil" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    expect(screen.queryByRole("region", { name: "Encontro Covil" })).toBeNull();
    expect((within(pagina).getByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Sala dos goblins");
    fireEvent.click(within(pagina).getByRole("button", { name: /Voltar à lista/ }));
    expect(await screen.findByRole("region", { name: "Encontro Covil" })).toBeTruthy();
  });
  it("descrição, edição individual, quantidade compacta e remoção persistem", async () => {
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([base]));
    render(<EncontrosPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir encontro Covil" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    const guardado = () => JSON.parse(localStorage.getItem(chaveEncontros("u1", "c1"))!)[0] as Encontro;
    const desc = within(pagina).getByLabelText("Descrição"); fireEvent.change(desc, { target: { value: "Emboscada ao entardecer" } }); fireEvent.blur(desc);
    await waitFor(() => expect(guardado().descricao).toBe("Emboscada ao entardecer"));
    fireEvent.click(within(pagina).getByRole("button", { name: "Aumentar quantidade de Goblin" }));
    await waitFor(() => expect(guardado().participantes[0].quantidade).toBe(3));
    fireEvent.click(within(pagina).getByRole("button", { name: "Diminuir quantidade de Goblin" })); fireEvent.click(within(pagina).getByRole("button", { name: "Diminuir quantidade de Goblin" }));
    await waitFor(() => expect(guardado().participantes[0].quantidade).toBe(1));
    fireEvent.click(within(pagina).getByRole("button", { name: "Diminuir quantidade de Goblin" }));   // mínimo 1: não grava inválido
    expect(guardado().participantes[0].quantidade).toBe(1);
    fireEvent.click(within(pagina).getByRole("button", { name: "Editar criatura Goblin" }));
    const form = within(pagina).getByRole("form", { name: "Editar Goblin" });
    fireEvent.change(within(form).getByLabelText("Nome"), { target: { value: "Goblin chefe" } }); fireEvent.change(within(form).getByLabelText("PV de cada"), { target: { value: "15" } });
    fireEvent.change(within(form).getByLabelText("CA"), { target: { value: "17" } }); fireEvent.change(within(form).getByLabelText("Notas"), { target: { value: "usa escudo" } });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar criatura" }));
    await waitFor(() => expect(guardado().participantes[0]).toMatchObject({ nome: "Goblin chefe", pv: 15, ca: 17, notas: "usa escudo", quantidade: 1 }));
    expect(within(pagina).getByText(/Avulsa · PV 15 · CA 17/)).toBeTruthy();
    fireEvent.click(within(pagina).getByRole("button", { name: "Editar criatura Goblin chefe" }));
    fireEvent.change(within(within(pagina).getByRole("form", { name: "Editar Goblin chefe" })).getByLabelText("Quantidade"), { target: { value: "0" } });
    fireEvent.click(within(pagina).getByRole("button", { name: "Salvar criatura" }));
    expect((await within(pagina).findByRole("alert")).textContent).toMatch(/Confira os valores/); expect(guardado().participantes[0].quantidade).toBe(1);
    fireEvent.click(within(pagina).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(pagina).getByRole("button", { name: "Remover Goblin chefe de Covil" }));
    await waitFor(() => expect(guardado().participantes).toHaveLength(0));
  });
  it("monstro do Bestiário entra como cópia com PV, CA e referência; editar não toca o catálogo", async () => {
    render(<EncontrosPanel/>); await screen.findByText("Nenhum encontro preparado");
    fireEvent.change(within(screen.getByRole("form", { name: "Novo encontro" })).getByLabelText("Nome do encontro"), { target: { value: "Toca" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar encontro/ }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Toca" });   // criar já abre a página
    fireEvent.click(within(pagina).getByText("Adicionar do Bestiário")); fireEvent.change(await within(pagina).findByLabelText("Buscar monstro"), { target: { value: "ogro" } });
    fireEvent.click(await within(pagina).findByRole("button", { name: /Adicionar Ogro do Bestiário/ }));
    const guardado = () => JSON.parse(localStorage.getItem(chaveEncontros("u1", "c1"))!)[0] as Encontro;
    await waitFor(() => expect(guardado().participantes[0]).toMatchObject({ ref: { tipo: "monstro", id: "ogre" }, pv: 59, ca: 11 }));
    fireEvent.click(within(pagina).getByRole("button", { name: "Editar criatura Ogro" }));
    expect(within(pagina).getByText(/o Bestiário não é alterado/)).toBeTruthy();
    fireEvent.change(within(within(pagina).getByRole("form", { name: "Editar Ogro" })).getByLabelText("PV de cada"), { target: { value: "40" } });
    fireEvent.click(within(pagina).getByRole("button", { name: "Salvar criatura" }));
    await waitFor(() => expect(guardado().participantes[0]).toMatchObject({ pv: 40, ref: { id: "ogre" } }));
  });
  it("na página, envia só parte das criaturas para a Iniciativa e o encontro fica intacto", async () => {
    const enc: Encontro = { id: "e1", nome: "Covil", participantes: [{ id: "p1", nome: "Goblin", quantidade: 3, pv: 7 }, { id: "p2", nome: "Lobo", quantidade: 1, pv: 11 }] };
    localStorage.setItem(chaveEncontros("u1", "c1"), JSON.stringify([enc]));
    render(<EncontrosPanel/>);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir encontro Covil" }));
    const pagina = await screen.findByRole("region", { name: "Página do encontro Covil" });
    fireEvent.click(within(pagina).getByText("Enviar só parte para a Iniciativa"));
    fireEvent.click(within(pagina).getByLabelText("Incluir Lobo de Covil"));
    fireEvent.change(within(pagina).getByLabelText("Quantidade de Goblin a enviar de Covil"), { target: { value: "2" } });
    fireEvent.click(within(pagina).getByRole("button", { name: "Incluir no combate: Covil" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(chaveCombate("u1", "c1"))!).combatentes.map((c: { nome: string }) => c.nome).sort()).toEqual(["Goblin 1", "Goblin 2"]));
    expect(JSON.parse(localStorage.getItem(chaveEncontros("u1", "c1"))!)[0]).toMatchObject({ participantes: enc.participantes });   // configuração original intacta
  });
});
