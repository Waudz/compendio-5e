// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => ({ active: { role: "mestre", campaign: { id: "c1", name: "Teste" } } }) }));
import { RegistrosProvider } from "./RegistrosContext";
import { registrosEmMemoria } from "./registrosMemoria";
import { IniciativaPanel } from "./Iniciativa";
afterEach(() => { cleanup(); localStorage.clear(); });
it("busca personagens pela fonte real de registros, sem injetar AventureirosContext, e mantém isolamento", async () => {
 const api = registrosEmMemoria("mestre");
 await api.create({ campaignId: "c1", kind: "character", title: "Lydia", visibility: "campaign", meta: { classe: "Guerreira", nivel: 4 } });
 await api.create({ campaignId: "c2", kind: "character", title: "Outro grupo", visibility: "campaign" });
 await api.create({ campaignId: "c1", kind: "character", title: "Ficha privada", visibility: "private" });
 render(<RegistrosProvider api={api}><IniciativaPanel/></RegistrosProvider>);
 await screen.findByText("Nenhum combatente ainda");
 expect(screen.queryByRole("form", { name: "Adicionar combatente" })).toBeNull();
 fireEvent.focus(screen.getByLabelText("Buscar combatentes"));
 expect(await screen.findByRole("button", { name: "Adicionar Lydia (personagem)" })).toBeTruthy();
 expect(screen.queryByRole("button", { name: /Adicionar (Outro grupo|Ficha privada)/ })).toBeNull();
 fireEvent.change(screen.getByLabelText("Buscar combatentes"), { target: { value: "Lydia" } });
 fireEvent.click(await screen.findByRole("button", { name: "Adicionar Lydia (personagem)" }));
 expect(await within(screen.getByRole("group", { name: "Combatentes" })).findByText("Lydia", { selector: "strong" })).toBeTruthy();
});
it("uma única pesquisa filtra as fontes selecionadas e só Avulso mostra o formulário", async () => {
 render(<IniciativaPanel/>); await screen.findByText("Nenhum combatente ainda");
 expect(screen.getAllByRole("searchbox")).toHaveLength(1);
 fireEvent.click(screen.getByRole("button", { name: "Bestiário" }));
 fireEvent.change(screen.getByLabelText("Buscar combatentes"), { target: { value: "goblin" } });
 expect(await screen.findByRole("button", { name: "Adicionar Goblin do Bestiário" })).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Combatente avulso" }));
 expect(screen.getByRole("form", { name: "Adicionar combatente" })).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Todos" }));
 expect(screen.queryByRole("form", { name: "Adicionar combatente" })).toBeNull();
 expect(screen.getAllByRole("searchbox")).toHaveLength(1);
});
