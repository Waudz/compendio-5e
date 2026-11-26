// @vitest-environment jsdom
// Ficha de jogo pela navegação real: três abas, cabeçalho, salvamento automático com revisão, inventário → CA e ataques, estado
// preservado ao trocar de menu, gesto no celular, conflito, mestre e privacidade entre jogadores.
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CampaignApi, Membership, Role } from "../campaigns";
import { activeKey } from "../CampaignsContext";
import { configCampanhaEmMemoria } from "../configCampanha";
import { fichasEmMemoria, novoBancoFichas, type BancoFichas } from "../fichasMemoria";
import { registrosEmMemoria } from "../registrosMemoria";
import { me, memoryStorage, other, renderApp } from "../testUtils";
import type { CharacterDraft } from "../rules/character-domain";
import { defaultPublicIdentity } from "../rules/public-identity";
import { abaDoGesto } from "./FichaJogo";

const mestreUser = { id: "u9", email: "mestre@exemplo.com" } as User;
const camp = { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" };
const apiC = (role: Role) => ({ list: async () => ({ ok: true, data: [{ role, campaign: camp } as Membership] }) }) as unknown as CampaignApi;
const RETRATO = "https://exemplo.test/thorin.png";
let banco: BancoFichas, registros: { dados: never[] };

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  sessionStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/");
  registros = { dados: [] }; banco = novoBancoFichas(registros as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rascunho: CharacterDraft = { id: "novo", name: "Thorin", nickname: "Escudo de Pedra", portrait: RETRATO, ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2",
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, raceId: "hill-dwarf", backgroundId: "acolyte", classId: "fighter", level: 3, decisions: [],
  inventory: [
    { id: "espada", itemId: "longsword", quantity: 1, equipped: false, origin: "acquired" },
    { id: "malha", itemId: "chain-mail", quantity: 1, equipped: false, origin: "acquired" },
    { id: "mochila", itemId: "backpack", quantity: 1, equipped: false, origin: "acquired" },
  ], currentHp: 20, temporaryHp: 0, spentResources: {} };
const semear = async (publicar = true) => {
  const r = await fichasEmMemoria(me.id, banco).criar("ca", rascunho, { identity: defaultPublicIdentity(), source: { name: "Thorin", alias: "Escudo de Pedra", race: "Anão da Colina", characterClass: "Guerreiro", portrait: RETRATO }, publicar });
  if (!r.ok) throw new Error(r.error);
  return r.data.id;
};
const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
const montar = async (user: User = me) => {
  const papel: Role = user.id === mestreUser.id ? "mestre" : "jogador";
  localStorage.setItem(activeKey(user.id), "ca");
  return renderApp({ user, api: apiC(papel), registros: registrosEmMemoria(papel, user.id, [], registros as never), fichas: fichasEmMemoria(user.id, banco) });
};
const abrirLista = async () => { await waitFor(() => expect(menu().getByRole("button", { name: "Personagens" })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: "Personagens" })); };
const abrirFicha = async (user: User = me) => {
  await montar(user); await abrirLista();
  fireEvent.click(await within(await screen.findByRole("region", { name: "Personagens da campanha" })).findByRole("button", { name: /^Thorin/ }));
  return screen.findByTestId("ficha-guiada-leitura");
};
const abas = () => within(screen.getByRole("navigation", { name: "Seções da ficha" }));
const irPara = (nome: string) => fireEvent.click(abas().getByRole("button", { name: nome }));
const draftSalvo = () => banco.fichas[0].draft;
const numero = (rotulo: string) => within(screen.getByRole("region", { name: "Resumo do personagem" })).getByText(rotulo).parentElement!.querySelector("strong")!.textContent;
const salvou = (verifica: () => void) => waitFor(verifica, { timeout: 4000 });

describe("ficha de jogo", () => {
  it("tem exatamente três abas e um cabeçalho com retrato, nome, alcunha e os números de combate", async () => {
    await semear();
    const ficha = await abrirFicha();
    expect(abas().getAllByRole("button").map(b => b.textContent)).toEqual(["Ficha", "Habilidades", "Inventário"]);
    const topo = within(screen.getByRole("region", { name: "Resumo do personagem" }));
    expect(topo.getByRole("heading", { name: "Thorin" })).toBeTruthy();
    expect(topo.getByText("Escudo de Pedra").tagName).toBe("EM");
    expect(ficha.querySelector(".ficha-identidade img")?.getAttribute("src")).toBe(RETRATO);
    expect(topo.getByText(/Anão da Colina · Guerreiro · Nível 3 · Acólito/)).toBeTruthy();
    expect(screen.getByTestId("ficha-pv").textContent).toMatch(/^20 \/ \d+$/);
    expect(numero("CA")).toBe("11"); expect(numero("Iniciativa")).toBe("+1"); expect(numero("Proficiência")).toBe("+2");
    expect(topo.getByText(/Resistência:/).parentElement!.textContent).toMatch(/veneno/);
    expect(screen.getByRole("region", { name: "Perícias" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Notas|Anotações da ficha/ })).toBeNull();
  });

  it("PV, condições e inspiração são salvos sozinhos, com revisão, sem trocar de aba nem vazar para a apresentação pública", async () => {
    await semear();
    const publicoAntes = JSON.stringify(registros.dados[0]);
    await abrirFicha();
    fireEvent.change(screen.getByLabelText("Quantidade de pontos de vida"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Definir PV temporários" }));
    fireEvent.change(screen.getByLabelText("Quantidade de pontos de vida"), { target: { value: "9" } });
    expect((screen.getByLabelText("Quantidade de pontos de vida") as HTMLInputElement).value).toBe("9");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar dano" }));
    expect((screen.getByLabelText("Quantidade de pontos de vida") as HTMLInputElement).value).toBe("1");   // o valor volta a 1
    fireEvent.click(screen.getByRole("button", { name: "Adicionar condição" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Escolher condição" })).getByRole("button", { name: "Envenenado" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Inspiração" }));
    await salvou(() => expect(draftSalvo()).toMatchObject({ currentHp: 18, temporaryHp: 0, play: { condicoes: ["Envenenado"], inspiracao: true } }));
    await salvou(() => expect(screen.getByTestId("estado-salvamento").textContent).toBe("Tudo salvo."));
    expect(banco.fichas[0].revision).toBeGreaterThan(1);
    expect(abas().getByRole("button", { name: "Ficha" }).getAttribute("aria-current")).toBe("true");
    const publico = JSON.parse(JSON.stringify(registros.dados[0])) as { meta: unknown };
    expect(publico.meta).toEqual((JSON.parse(publicoAntes) as { meta: unknown }).meta);
    // reabrir: os mesmos valores
    cleanup(); sessionStorage.clear(); await abrirFicha();
    expect(screen.getByTestId("ficha-pv").textContent).toMatch(/^18 \//);
    expect(screen.getByRole("button", { name: "Remover condição Envenenado" })).toBeTruthy();
  });

  it("equipar armadura muda a CA uma única vez e a arma equipada vira ataque; modificador temporário não altera a construção", async () => {
    await semear();
    await abrirFicha();
    irPara("Inventário");
    expect(screen.queryByRole("checkbox", { name: "Equipar Mochila" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Equipar Cota de malha" }));
    expect(numero("CA")).toBe("16");
    fireEvent.click(screen.getByRole("checkbox", { name: "Equipar Espada longa" }));
    irPara("Habilidades");
    const ataques = within(screen.getByRole("region", { name: "Ataques" }));
    expect(ataques.getByText("Espada longa")).toBeTruthy();
    fireEvent.click(ataques.getByRole("button", { name: "Ataque personalizado" }));
    fireEvent.change(ataques.getByLabelText("Nome do ataque"), { target: { value: "Cabeçada" } });
    fireEvent.change(ataques.getByLabelText("Dano do ataque"), { target: { value: "1d4+2" } });
    fireEvent.click(ataques.getByRole("button", { name: "Adicionar" }));
    expect(ataques.getByText("Cabeçada")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("region", { name: "Características" })).getByRole("button", { name: /^Usar Retomar o Fôlego/ }));
    expect(within(screen.getByRole("region", { name: "Características" })).getByRole("button", { name: /^Recuperar Retomar o Fôlego/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Magias" })).toBeNull();   // guerreiro sem magia: sem seção vazia
    irPara("Ficha");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito temporário" }));
    fireEvent.change(screen.getByLabelText("Valor do modificador"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(numero("CA")).toBe("18");
    await salvou(() => expect(draftSalvo()).toMatchObject({ baseAbilities: rascunho.baseAbilities, spentResources: { "second-wind": 1 } }));
    await salvou(() => expect(screen.getByTestId("estado-salvamento").textContent).toBe("Tudo salvo."));
    fireEvent.click(screen.getByRole("button", { name: /^Remover modificador/ }));
    expect(numero("CA")).toBe("16");
  });

  it("moedas, quantidade, filtro, grade e histórico no inventário", async () => {
    await semear();
    await abrirFicha();
    irPara("Inventário");
    const pl = screen.getByLabelText("Moedas de platina (PL)");
    fireEvent.change(pl, { target: { value: "4" } }); fireEvent.blur(pl);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    fireEvent.change(screen.getByLabelText("Adicionar item do catálogo"), { target: { value: "adaga" } });
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar Adaga" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Adaga" }));
    fireEvent.change(screen.getByLabelText("Filtrar inventário"), { target: { value: "armas" } });
    const itens = within(screen.getByRole("region", { name: "Inventário do personagem" }));
    expect(itens.queryByText("Mochila")).toBeNull();
    expect(itens.getByRole("button", { name: "Consultar Adaga no Compêndio" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver em grade" }));
    expect(document.querySelector(".ficha-itens.grade")).toBeTruthy();
    expect(screen.getByTestId("carga").textContent).toMatch(/kg de 105 kg/);
    expect(screen.getByText(/Histórico de movimentações \(2\)/)).toBeTruthy();
    await salvou(() => expect(draftSalvo()).toMatchObject({ currency: { pp: 4 } }));
    await salvou(() => expect(draftSalvo().inventory.find(i => i.itemId === "dagger")?.quantity).toBe(2));
  });

  it("trocar de menu e voltar mantém a aba e as preferências do inventário", async () => {
    await semear();
    await abrirFicha();
    irPara("Inventário");
    fireEvent.click(screen.getByRole("button", { name: "Ver em grade" }));
    fireEvent.click(menu().getByRole("button", { name: "Diário" }));
    cleanup(); await abrirFicha();
    expect(abas().getByRole("button", { name: "Inventário" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "Ver em grade" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("no celular, arrastar para o lado troca de aba; rolagem vertical, controles e a borda não trocam", async () => {
    await semear();
    const ficha = await abrirFicha();
    const alvo = () => ficha.querySelector(".ficha-conteudo h2")!;
    const arrastar = (el: Element, de: [number, number], ate: [number, number]) => {
      fireEvent.touchStart(el, { touches: [{ clientX: de[0], clientY: de[1] }] });
      fireEvent.touchEnd(el, { changedTouches: [{ clientX: ate[0], clientY: ate[1] }] });
    };
    const atual = () => abas().getAllByRole("button").find(b => b.getAttribute("aria-current") === "true")!.textContent;
    arrastar(alvo(), [300, 400], [290, 100]); expect(atual()).toBe("Ficha");
    arrastar(alvo(), [10, 400], [200, 400]); expect(atual()).toBe("Ficha");
    arrastar(screen.getByRole("checkbox", { name: "Inspiração" }), [300, 400], [100, 400]); expect(atual()).toBe("Ficha");
    arrastar(alvo(), [300, 400], [150, 405]); expect(atual()).toBe("Habilidades");
    expect(abaDoGesto("ficha", 100, 0)).toBeNull();
    expect(abaDoGesto("inventario", -100, 0)).toBeNull();
    expect(abaDoGesto("inventario", 100, 10)).toBe("habilidades");
    expect(abaDoGesto("ficha", -100, 80)).toBeNull();
  });

  it("descansos ficam no menu de ações, com confirmação", async () => {
    await semear();
    await abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: "Ações" }));
    fireEvent.click(screen.getByRole("button", { name: "Descanso longo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar descanso" }));
    await salvou(() => expect(draftSalvo().currentHp).toBeGreaterThan(20));
    expect(screen.getByText("Descanso longo registrado.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ações" }));
    fireEvent.click(screen.getByRole("button", { name: "Progressão de nível" }));
    expect(await screen.findByLabelText("Nível")).toBeTruthy();
  });

  it("conflito de revisão pausa o salvamento automático e não sobrescreve a outra alteração", async () => {
    const id = await semear();
    await abrirFicha();
    const externo = await fichasEmMemoria(mestreUser.id, banco).salvar(id, 1, { ...draftSalvo(), currentHp: 3 });
    expect(externo.ok).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Inspiração" }));
    expect(await screen.findByTestId("aviso-conflito", undefined, { timeout: 4000 })).toBeTruthy();
    expect(draftSalvo().currentHp).toBe(3);
    expect(banco.fichas[0].revision).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Carregar a versão atual" }));
    await waitFor(() => expect(screen.getByTestId("ficha-pv").textContent).toMatch(/^3 \//));
  });

  it("falha de rede não é repetida em laço: avisa e permite tentar de novo", async () => {
    await semear();
    await abrirFicha();
    banco.rede.caida = true;
    fireEvent.click(screen.getByRole("checkbox", { name: "Inspiração" }));
    const tentar = await screen.findByRole("button", { name: "Tentar salvar de novo" }, { timeout: 4000 });
    expect(banco.fichas[0].revision).toBe(1);
    banco.rede.caida = false; fireEvent.click(tentar);
    await salvou(() => expect(banco.fichas[0].revision).toBe(2));
  });

  it("o mestre consulta e altera a ficha completa sem tocar na identidade pública do dono", async () => {
    await semear(false);
    const publicoAntes = JSON.stringify(registros.dados[0]);
    await abrirFicha(mestreUser);
    irPara("Inventário");
    expect(screen.getByRole("checkbox", { name: "Equipar Cota de malha" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Equipar Cota de malha" }));
    await salvou(() => expect(banco.fichas[0].revision).toBe(2));
    expect(banco.fichas[0].ownerId).toBe(me.id);
    expect(JSON.stringify(registros.dados[0])).toBe(publicoAntes);
  });

  it("outro jogador vê só a apresentação (nome, alcunha e o mesmo retrato), sem PV, CA, atributos ou inventário", async () => {
    await semear(true);
    await montar(other); await abrirLista();
    fireEvent.click(await screen.findByRole("button", { name: /^Thorin Escudo de Pedra/ }));
    const cartao = await screen.findByTestId("cartao-publico");
    expect(cartao.querySelector("img")?.getAttribute("src")).toBe(RETRATO);
    expect(cartao.textContent).toMatch(/Thorin.*Escudo de Pedra/);
    expect(cartao.textContent).not.toMatch(/PV \d|CA \d|Força|Cota de malha|Mochila|Nível/);
    expect(screen.queryByTestId("ficha-guiada-leitura")).toBeNull();
  });
});

describe("navegação da edição", () => {
  const editor = () => screen.queryByLabelText("Nome do personagem") as HTMLInputElement | null;
  const entrarNaEdicao = async () => { fireEvent.click(screen.getByRole("button", { name: "Editar personagem" })); return screen.findByLabelText("Nome do personagem") as Promise<HTMLInputElement>; };
  const naFicha = async () => { await screen.findByTestId("ficha-guiada-leitura"); expect(editor()).toBeNull(); };
  const abasDoEspaco = () => [...document.querySelectorAll(".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content")].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ""));
  const reabrirPelaLista = async () => { fireEvent.click(menu().getByRole("button", { name: "Personagens" })); fireEvent.click(await within(await screen.findByRole("region", { name: "Personagens da campanha" })).findByRole("button", { name: /^Thorin/ })); };

  it("Cancelar sem alterações volta à ficha, mantendo a aba escolhida", async () => {
    await semear(); await abrirFicha(); irPara("Inventário");
    await entrarNaEdicao();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await naFicha();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(abas().getByRole("button", { name: "Inventário" }).getAttribute("aria-current")).toBe("true");
  });

  it("Cancelar com alterações pede confirmação; continuar mantém o texto e descartar não grava nada", async () => {
    await semear(); await abrirFicha();
    const antes = structuredClone(banco.fichas[0]);
    fireEvent.change(await entrarNaEdicao(), { target: { value: "Thorin alterado" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = () => within(screen.getByRole("alertdialog", { name: "Alterações não salvas" }));
    fireEvent.click(dialogo().getByRole("button", { name: "Continuar editando" }));
    expect(editor()!.value).toBe("Thorin alterado");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(dialogo().getByRole("button", { name: "Descartar alterações" }));
    await naFicha();
    expect(screen.getByRole("heading", { name: "Thorin" })).toBeTruthy();
    await new Promise(r => setTimeout(r, 900));   // passa do prazo do salvamento automático
    expect(banco.fichas[0]).toEqual(antes);
  });

  it("Salvar volta à ficha já atualizada", async () => {
    await semear(); await abrirFicha();
    fireEvent.change(await entrarNaEdicao(), { target: { value: "Thorin, o Firme" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await naFicha();
    expect(screen.getByRole("heading", { name: "Thorin, o Firme" })).toBeTruthy();
    expect(draftSalvo().name).toBe("Thorin, o Firme");
  });

  it("o Voltar do navegador sai da edição para a ficha, e com alterações pergunta antes", async () => {
    await semear(); await abrirFicha();
    await entrarNaEdicao();
    window.history.back();
    await naFicha();
    fireEvent.change(await entrarNaEdicao(), { target: { value: "Pendente" } });
    window.history.back();
    expect(await screen.findByRole("alertdialog", { name: "Alterações não salvas" })).toBeTruthy();
    expect(editor()!.value).toBe("Pendente");
    window.history.back();   // insistir no Voltar continua sem descartar nada
    await new Promise(r => setTimeout(r, 50));
    expect(editor()!.value).toBe("Pendente");
  });

  it("abrir de novo pela lista de Personagens mostra a ficha, na mesma aba, sem descartar em silêncio", async () => {
    await semear(); await abrirFicha();
    await entrarNaEdicao();
    await reabrirPelaLista();
    await naFicha();
    expect(abasDoEspaco().filter(t => t === "Thorin")).toHaveLength(1);
    fireEvent.change(await entrarNaEdicao(), { target: { value: "Sem salvar" } });
    await reabrirPelaLista();
    expect(await screen.findByRole("alertdialog", { name: "Alterações não salvas" })).toBeTruthy();
    expect(editor()!.value).toBe("Sem salvar");
    expect(abasDoEspaco().filter(t => t === "Thorin" || t === "Sem salvar")).toHaveLength(1);
  });

  it("depois de recarregar o aplicativo, o personagem reabre na ficha mesmo que tenha sido deixado na edição", async () => {
    await semear(); await abrirFicha(); await entrarNaEdicao();
    cleanup(); await montar(); await abrirLista(); await reabrirPelaLista();
    await naFicha();
  });
});

describe("inventário: moedas da campanha, poções e informações dos itens", () => {
  const buscarNoCatalogo = async (texto: string) => {
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    fireEvent.change(screen.getByLabelText("Adicionar item do catálogo"), { target: { value: texto } });
  };
  const oferecidos = () => within(screen.getByRole("list", { name: "Resultados da pesquisa de itens" })).queryAllByRole("button").map(b => b.getAttribute("aria-label"));

  it("o jogador encontra as poções comuns, mas não poções raras nem itens mágicos", async () => {
    await semear(); await abrirFicha(); irPara("Inventário");
    await buscarNoCatalogo("poção");
    await waitFor(() => expect(oferecidos()).toContain("Adicionar Poção de cura"));
    expect(oferecidos().sort()).toEqual(["Adicionar Poção de cura", "Adicionar Poção de escalada"]);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Poção de cura" }));
    expect(within(screen.getByRole("listitem", { name: "Poção de cura" })).getByText(/recupera 2d4\+2 PV/)).toBeTruthy();
  });

  it("o mestre pode entregar qualquer item", async () => {
    await semear(); await montar(mestreUser); await abrirLista();
    fireEvent.click(await within(await screen.findByRole("region", { name: "Personagens da campanha" })).findByRole("button", { name: /^Thorin/ }));
    await screen.findByTestId("ficha-guiada-leitura"); irPara("Inventário");
    await buscarNoCatalogo("poção de cura");
    await waitFor(() => expect(oferecidos()).toContain("Adicionar Poção de cura maior"));
  });

  it("arma mostra o dano básico mesmo sem equipar; armadura mostra a CA", async () => {
    await semear(); await abrirFicha(); irPara("Inventário");
    expect(within(screen.getByRole("listitem", { name: "Espada longa" })).getByText(/Dano básico 1d8 cortante \(1d10 com duas mãos\)/)).toBeTruthy();
    expect(within(screen.getByRole("listitem", { name: "Cota de malha" })).getByText(/CA 16/)).toBeTruthy();
  });

  it("só aparecem as moedas da campanha; o valor guardado numa moeda desativada não se perde nem entra no total", async () => {
    await semear();
    banco.fichas[0].draft.currency = { cp: 5, sp: 20, ep: 7, gp: 10, pp: 3 };
    const config = configCampanhaEmMemoria(new Map([["ca", ["cp", "sp", "gp"]]]));
    localStorage.setItem(activeKey(me.id), "ca");
    await renderApp({ user: me, api: apiC("jogador"), registros: registrosEmMemoria("jogador", me.id, [], registros as never), fichas: fichasEmMemoria(me.id, banco), config });
    await abrirLista();
    fireEvent.click(await within(await screen.findByRole("region", { name: "Personagens da campanha" })).findByRole("button", { name: /^Thorin/ }));
    await screen.findByTestId("ficha-guiada-leitura"); irPara("Inventário");
    const moedas = within(screen.getByRole("region", { name: "Moedas" }));
    await waitFor(() => expect(moedas.queryByLabelText("Moedas de platina (PL)")).toBeNull());
    expect(moedas.queryByLabelText("Moedas de electro (PE)")).toBeNull();
    expect(moedas.getAllByRole("listitem")).toHaveLength(3);
    expect(moedas.getByTestId("patrimonio").textContent).toBe("12,05 PO");
    expect(moedas.getByText(/continuam guardados/)).toBeTruthy();
    fireEvent.click(moedas.getByRole("button", { name: "Adicionar 1 moeda de ouro (PO)" }));
    await salvou(() => expect(draftSalvo().currency).toEqual({ cp: 5, sp: 20, ep: 7, gp: 11, pp: 3 }));
  });
});
