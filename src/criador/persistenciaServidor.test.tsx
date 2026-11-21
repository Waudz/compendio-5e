// @vitest-environment jsdom
// Persistência do criador guiado com a API de fichas (modelo em memória que imita as regras da migração 0008; as políticas REAIS são validadas em
// `supabase/character-sheets.test.ts`, em PostgreSQL isolado). Aqui: o caminho do usuário, o isolamento na interface, conflito de revisão, falhas de
// rede e o envio explícito dos rascunhos do armazenamento local.
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CampaignApi, Membership, Role } from "../campaigns";
import { activeKey } from "../CampaignsContext";
import { fichasEmMemoria, novoBancoFichas, type BancoFichas } from "../fichasMemoria";
import { registrosEmMemoria } from "../registrosMemoria";
import { me, memoryStorage, other, renderApp } from "../testUtils";
import { armazenamentoLocalExperimental } from "./armazenamento";
import { defaultPublicIdentity } from "../rules/public-identity";

const mestreUser = { id: "u9", email: "mestre@exemplo.com" } as User;
const camp = { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" };
const membership = (role: Role): Membership => ({ role, campaign: camp });
const apiC = (role: Role) => ({ list: async () => ({ ok: true, data: [membership(role)] }) }) as unknown as CampaignApi;
let banco: BancoFichas, registros: { dados: never[] };

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/");
  registros = { dados: [] }; banco = novoBancoFichas(registros as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
const secoes = () => within(screen.getByRole("navigation", { name: "Seções do personagem" }));
const papelDe = (u: User): Role => (u.id === mestreUser.id ? "mestre" : "jogador");
/** Monta o app como `user`. `layoutNovo`: descarta o layout salvo (janela nova) mantendo o resto do armazenamento. */
const montar = async (user: User = me, layoutNovo = true) => {
  if (layoutNovo) for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i)!; if (k.startsWith("compendio5e:workspace")) localStorage.removeItem(k); }
  localStorage.setItem(activeKey(user.id), "ca");
  return renderApp({ user, api: apiC(papelDe(user)), registros: registrosEmMemoria(papelDe(user), user.id, [], registros as never), fichas: fichasEmMemoria(user.id, banco) });
};
const abrirPersonagens = async () => { await waitFor(() => expect(menu().getByRole("button", { name: "Personagens" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Personagens" })); };
const nomeInput = () => screen.findByLabelText("Nome do personagem") as Promise<HTMLInputElement>;
const novoGuiado = async () => { fireEvent.click(await screen.findByRole("button", { name: /Criar com o criador guiado/ })); return nomeInput(); };
const preencher = async (nome: string) => {
  fireEvent.change(await nomeInput(), { target: { value: nome } });
  fireEvent.click(screen.getByLabelText("Perícia athletics")); fireEvent.click(screen.getByLabelText("Perícia perception"));
  fireEvent.change(screen.getByLabelText("fighter-style-1"), { target: { value: "defense" } });
  fireEvent.click(secoes().getByRole("button", { name: "Equipamento inicial" })); fireEvent.click(screen.getByRole("button", { name: "Confirmar equipamentos iniciais" }));
};
const identidade = (publicar: boolean, titulo = "O Escudo") => {
  fireEvent.click(secoes().getByRole("button", { name: "Identidade pública" }));
  fireEvent.change(screen.getByLabelText("Visibilidade Classe"), { target: { value: "hidden" } });
  fireEvent.change(screen.getByLabelText("Visibilidade Raça"), { target: { value: "hidden" } });
  fireEvent.change(screen.getByLabelText("Título público"), { target: { value: titulo } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar identidade pública" }));
  if (publicar) fireEvent.click(screen.getByLabelText("Publicar identidade na campanha"));
};
const salvar = async (revisao: number) => { fireEvent.click(screen.getByRole("button", { name: "Salvar" })); expect(await screen.findByText(new RegExp(`salvo na campanha \\(revisão ${revisao}\\)`))).toBeTruthy(); };
/** Cria e salva um personagem como `user` pela interface. */
async function criarPersonagem(nome = "Thorin", publicar = false, user: User = me) {
  await montar(user); await abrirPersonagens(); await novoGuiado(); await preencher(nome); identidade(publicar); await salvar(1);
}
const chavesLocais = (prefixo: string) => [...Array(localStorage.length).keys()].map(i => localStorage.key(i)!).filter(k => k.startsWith(prefixo));

describe("salvar e reabrir (servidor)", () => {
  it("cria, salva e reabre sem perder nada; na campanha só vai a identidade pública (nunca ficha, inventário ou atributos)", async () => {
    await criarPersonagem("Thorin", true);
    expect(banco.fichas).toHaveLength(1);
    expect(banco.fichas[0]).toMatchObject({ ownerId: "u1", revision: 1, draft: expect.objectContaining({ name: "Thorin", id: banco.fichas[0].id }) });
    expect(banco.fichas[0].draft.inventory.map(i => i.itemId)).toContain("chain-mail");
    const publico = registros.dados[0] as { title: string; visibility: string; meta: Record<string, unknown> };
    expect(publico).toMatchObject({ title: "O Escudo", visibility: "campaign" });
    expect(Object.keys(publico.meta).sort()).toEqual(["guiado", "identidadePublica"]);
    expect(JSON.stringify(publico)).not.toMatch(/chain-mail|baseAbilities|inventory|currentHp|Guerreiro|Cota de malha/);
    // reabre numa janela nova pela lista
    cleanup(); await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" }));
    expect((await nomeInput()).value).toBe("Thorin");
    expect(screen.getByText(/Atletismo, Percepção/)).toBeTruthy();
    fireEvent.click(secoes().getByRole("button", { name: "Inventário" }));
    expect(within(screen.getByRole("region", { name: "Inventário" })).getByText("Cota de malha")).toBeTruthy();
    fireEvent.click(secoes().getByRole("button", { name: "Identidade pública" }));
    expect((screen.getByLabelText("Título público") as HTMLInputElement).value).toBe("O Escudo");
    expect((screen.getByLabelText("Visibilidade Classe") as HTMLSelectElement).value).toBe("hidden");
    expect((screen.getByLabelText("Publicar identidade na campanha") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId("exclusao-indisponivel")).toBeTruthy();                       // sem botão de excluir: segue o fluxo narrativo
  });

  it("editar o inventário dentro da ficha e salvar grava nova revisão; a identidade pública continua igual", async () => {
    await criarPersonagem("Thorin", true);
    cleanup(); await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" })); await nomeInput();
    fireEvent.click(secoes().getByRole("button", { name: "Inventário" }));
    fireEvent.change(screen.getByLabelText("Buscar item para adicionar"), { target: { value: "adaga" } });
    fireEvent.click(await screen.findByRole("button", { name: /^Adicionar Adaga$/ }));
    await salvar(2);
    expect(banco.fichas[0].revision).toBe(2);
    expect(banco.fichas[0].draft.inventory.map(i => i.itemId)).toContain("dagger");
    expect((registros.dados[0] as { title: string }).title).toBe("O Escudo");
  });

  it("outro dispositivo com a mesma conta (armazenamento local vazio) abre a mesma ficha a partir do servidor", async () => {
    await criarPersonagem("Thorin", false);
    cleanup(); vi.stubGlobal("localStorage", memoryStorage());          // aparelho novo: nada local
    await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" }));
    expect((await nomeInput()).value).toBe("Thorin");
    expect(screen.getByTestId("aviso-servidor")).toBeTruthy();
    expect(screen.queryByTestId("aviso-armazenamento")).toBeNull();
  });

  it("a aba do personagem novo reabre o mesmo personagem depois de recarregar (sem duplicar)", async () => {
    await criarPersonagem("Thorin", false);
    cleanup(); await montar(me, false);                                  // layout salvo mantido: a aba `criador:novo-…` volta
    expect((await nomeInput()).value).toBe("Thorin");
    expect(banco.fichas).toHaveLength(1);
  });

  it("ficha inexistente ou sem acesso (ex.: saiu da campanha) mostra erro e NUNCA abre um editor vazio capaz de duplicar", async () => {
    await criarPersonagem("Thorin", false);
    const id = banco.fichas[0].id;
    banco.campanhas.ca.jogadores = banco.campanhas.ca.jogadores.filter(u => u !== "u1");       // u1 saiu da campanha
    cleanup(); localStorage.setItem(`compendio5e:workspace:v2:u1:ca:navegador`, JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, selected: 0, children: [{ type: "tab", id: `criador:${id}` }] }] } }));
    await montar(me, false);
    expect(await screen.findByText(/Personagem não encontrado, removido ou sem acesso/)).toBeTruthy();
    expect(screen.queryByLabelText("Nome do personagem")).toBeNull();
    expect(banco.fichas).toHaveLength(1);
  });
});

describe("quem vê o quê", () => {
  it("outro jogador da campanha vê só a identidade pública publicada (sem nível, PV, inventário nem ficha) e nada se não foi publicada", async () => {
    await criarPersonagem("Thorin", true);
    cleanup(); await montar(other); await abrirPersonagens();
    expect(screen.queryByRole("button", { name: /Abrir ficha guiada/ })).toBeNull();            // não lê a ficha de ninguém
    fireEvent.click(await screen.findByRole("button", { name: "Abrir identidade pública de O Escudo" }));
    const cartao = await screen.findByTestId("cartao-publico");
    expect(cartao.textContent).toMatch(/O Escudo/);
    expect(cartao.textContent).not.toMatch(/nível|PV|Cota de malha|Guerreiro|Anão|atributo/i);
    // não publicada: não aparece
    banco.registros.dados[0].visibility = "private";
    cleanup(); await montar(other); await abrirPersonagens();
    await screen.findByTestId("guiados-vazio");
    expect(screen.queryByRole("button", { name: /Abrir identidade pública/ })).toBeNull();
    // e abrir a ficha direto (aba restaurada/link) não funciona
    const id = banco.fichas[0].id;
    localStorage.setItem(`compendio5e:workspace:v2:u2:ca:navegador`, JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, selected: 0, children: [{ type: "tab", id: `criador:${id}` }] }] } }));
    cleanup(); await montar(other, false);
    expect(await screen.findByText(/Personagem não encontrado, removido ou sem acesso/)).toBeTruthy();
  });

  it("início da campanha mostra o personagem guiado publicado só com a identidade (sem nível)", async () => {
    await criarPersonagem("Thorin", true);
    cleanup(); await montar(other);
    const card = await screen.findByRole("button", { name: /Abrir ficha de O Escudo/ });
    expect(card.textContent).not.toMatch(/nível/);
  });

  it("o mestre vê e edita a ficha de outro jogador, mas não vê a identidade privada nem a altera", async () => {
    await criarPersonagem("Thorin", false);                               // identidade NÃO publicada (privada)
    cleanup(); await montar(mestreUser); await abrirPersonagens();
    expect(screen.queryByRole("button", { name: /Abrir identidade pública/ })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" }));
    expect((await nomeInput()).value).toBe("Thorin");
    expect(screen.getByTestId("aviso-servidor").textContent).toMatch(/outro jogador.*mestre/);
    fireEvent.click(secoes().getByRole("button", { name: "Identidade pública" }));
    expect(screen.getByText(/pertence ao dono do personagem/)).toBeTruthy();
    expect(screen.queryByLabelText("Título público")).toBeNull();
    fireEvent.click(secoes().getByRole("button", { name: "Inventário" }));
    fireEvent.change(screen.getByLabelText("Buscar item para adicionar"), { target: { value: "adaga" } });
    fireEvent.click(await screen.findByRole("button", { name: /^Adicionar Adaga$/ }));
    await salvar(2);
    expect(banco.fichas[0]).toMatchObject({ ownerId: "u1", revision: 2 });
    expect((registros.dados[0] as { title: string; visibility: string }).visibility).toBe("private");   // identidade intacta
    expect((registros.dados[0] as { title: string }).title).toBe("O Escudo");
  });
});

describe("conflito de revisão", () => {
  it("edição do mestre durante a do dono: o dono recebe aviso, nada é sobrescrito, e pode carregar a versão atual e restaurar as próprias alterações", async () => {
    await criarPersonagem("Thorin", false);
    cleanup(); await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" }));
    fireEvent.change(await nomeInput(), { target: { value: "Thorin B" } });
    // o mestre grava antes (revisão 2)
    const f = banco.fichas[0];
    expect((await fichasEmMemoria("u9", banco).salvar(f.id, 1, { ...f.draft, currentHp: 2 })).ok).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByTestId("aviso-conflito")).toBeTruthy();
    expect(banco.fichas[0]).toMatchObject({ revision: 2, draft: expect.objectContaining({ name: "Thorin", currentHp: 2 }) });   // nada sobrescrito
    expect((screen.getByLabelText("Nome do personagem") as HTMLInputElement).value).toBe("Thorin B");                            // a tela guarda o que foi digitado
    fireEvent.click(screen.getByRole("button", { name: "Carregar a versão atual" }));
    await waitFor(() => expect((screen.getByLabelText("Nome do personagem") as HTMLInputElement).value).toBe("Thorin"));
    expect(screen.getByTestId("aviso-recuperacao")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar essas alterações" }));
    expect((screen.getByLabelText("Nome do personagem") as HTMLInputElement).value).toBe("Thorin B");
    await salvar(3);
    expect(banco.fichas[0].draft.name).toBe("Thorin B");
    expect(chavesLocais("compendio5e:experimental:criador-recuperacao")).toHaveLength(0);
  });
});

describe("falhas de rede e recuperação", () => {
  it("salvar sem conexão preserva a tela e guarda uma cópia; ao reabrir oferece restaurar e, depois de salvar, a cópia some", async () => {
    await criarPersonagem("Thorin", false);
    banco.rede.caida = true;
    fireEvent.click(secoes().getByRole("button", { name: "Ficha" }));
    fireEvent.change(await nomeInput(), { target: { value: "Thorin Editado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Sem conexão com o servidor\. Suas alterações continuam na tela e foram guardadas neste navegador\./)).toBeTruthy();
    expect(screen.getByText("Alterações não salvas.")).toBeTruthy();
    expect(chavesLocais("compendio5e:experimental:criador-recuperacao")).toHaveLength(1);
    expect(banco.fichas[0].draft.name).toBe("Thorin");
    // a conexão volta e a página é recarregada
    banco.rede.caida = false; cleanup(); await montar(me, false);
    expect(await screen.findByTestId("aviso-recuperacao")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar essas alterações" }));
    expect((await nomeInput()).value).toBe("Thorin Editado");
    await salvar(2);
    expect(banco.fichas[0].draft.name).toBe("Thorin Editado");
    expect(chavesLocais("compendio5e:experimental:criador-recuperacao")).toHaveLength(0);
  });

  it("falha ao abrir (rede) mostra o erro com 'Tentar de novo' e recupera quando a conexão volta", async () => {
    await criarPersonagem("Thorin", false);
    cleanup(); await montar(); await abrirPersonagens();
    const botao = await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" });
    banco.rede.caida = true; fireEvent.click(botao);
    expect(await screen.findByText(/Não foi possível abrir este personagem: Sem conexão/)).toBeTruthy();
    banco.rede.caida = false; fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect((await nomeInput()).value).toBe("Thorin");
  });

  it("a lista de fichas informa a falha de rede e permite tentar de novo", async () => {
    await criarPersonagem("Thorin", false);
    banco.rede.caida = true; cleanup(); await montar(); await abrirPersonagens();
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeTruthy();
    banco.rede.caida = false; fireEvent.click(screen.getAllByRole("button", { name: "Tentar de novo" })[0]);
    expect(await screen.findByRole("button", { name: "Abrir ficha guiada Thorin" })).toBeTruthy();
  });

  it("a cópia de recuperação de um usuário não aparece para outro no mesmo navegador", async () => {
    await criarPersonagem("Thorin", false);
    banco.rede.caida = true;
    fireEvent.click(secoes().getByRole("button", { name: "Ficha" }));
    fireEvent.change(await nomeInput(), { target: { value: "Rascunho do u1" } }); fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText(/guardadas neste navegador/);
    banco.rede.caida = false; cleanup(); await montar(other); await abrirPersonagens();
    expect(screen.queryByTestId("aviso-recuperacao")).toBeNull();
    expect(chavesLocais("compendio5e:experimental:criador-recuperacao")[0]).toContain(":u1:");
  });
});

describe("rascunhos do armazenamento local (experimental) → campanha", () => {
  /** Rascunho antigo, gravado direto no armazenamento local experimental (como a versão anterior do criador fazia). */
  const rascunhoLocal = async (nome: string) => {
    armazenamentoLocalExperimental("u1", "ca").salvar({ schemaVersion: 1, savedAt: "2026-11-20T10:00:00Z", identity: defaultPublicIdentity(), draft: { id: "loc-1", name: nome, ruleset: "5e-2014", catalogueVersion: "v", baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, raceId: "r", backgroundId: "b", classId: "c", level: 1, decisions: [], inventory: [], currentHp: 13, temporaryHp: 0, spentResources: {} } });
  };
  it("lista os rascunhos locais à parte; enviar cria a ficha no servidor e só então remove a cópia local", async () => {
    await rascunhoLocal("Velho Rascunho");
    await montar(); await abrirPersonagens();
    const secao = within(await screen.findByTestId("rascunhos-locais"));
    expect(secao.getByText("Velho Rascunho")).toBeTruthy();
    fireEvent.click(secao.getByRole("button", { name: "Enviar Velho Rascunho para a campanha" }));
    expect(await screen.findByText(/foi enviado para a campanha e a cópia deste navegador foi removida/)).toBeTruthy();
    expect(banco.fichas).toHaveLength(1); expect(banco.fichas[0].draft).toMatchObject({ name: "Velho Rascunho", id: banco.fichas[0].id });
    expect((registros.dados[0] as { visibility: string }).visibility).toBe("private");        // identidade começa privada
    expect(armazenamentoLocalExperimental("u1", "ca").listar()).toEqual([]);
    expect(screen.queryByTestId("rascunhos-locais")).toBeNull();
    expect(await screen.findByRole("button", { name: "Abrir ficha guiada Velho Rascunho" })).toBeTruthy();
  });
  it("se o envio falhar, o rascunho local continua intacto (nada se perde em silêncio)", async () => {
    await rascunhoLocal("Velho Rascunho");
    await montar(); await abrirPersonagens();
    const botao = await screen.findByRole("button", { name: "Enviar Velho Rascunho para a campanha" });
    banco.rede.caida = true; fireEvent.click(botao);
    expect(await screen.findByText(/Sem conexão com o servidor.*O rascunho continua guardado neste navegador/)).toBeTruthy();
    expect(banco.fichas).toHaveLength(0);
    expect(armazenamentoLocalExperimental("u1", "ca").listar().map(x => x.nome)).toEqual(["Velho Rascunho"]);
  });
  it("descartar pede confirmação e só então remove o rascunho local", async () => {
    await rascunhoLocal("Velho Rascunho");
    await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole("button", { name: "Descartar rascunho local Velho Rascunho" }));
    expect(armazenamentoLocalExperimental("u1", "ca").listar()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar descarte" }));
    expect(armazenamentoLocalExperimental("u1", "ca").listar()).toEqual([]);
  });
  it("rascunho local sem nome não é enviado", async () => {
    await rascunhoLocal("");
    await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole("button", { name: /^Enviar .* para a campanha$/ }));
    expect(await screen.findByText(/Dê um nome ao personagem/)).toBeTruthy();
    expect(banco.fichas).toHaveLength(0);
  });
});
