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
const semear = async () => {
  const r = await fichasEmMemoria(me.id, banco).criar("ca", rascunho, { identity: defaultPublicIdentity(), source: { name: "Thorin", alias: "Escudo de Pedra", race: "Anão da Colina", characterClass: "Guerreiro", level: "3", portrait: RETRATO } });
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
const numero = (rotulo: string) => within(screen.getByRole("region", { name: "Resumo do personagem" })).getByText(rotulo).closest(".dnd-indicador")!.querySelector("strong")!.textContent;
const salvou = (verifica: () => void) => waitFor(verifica, { timeout: 4000 });
/** As ações de um item ficam no menu de reticências dele. */
const acaoDoItem = (item: string, acao: string) => { fireEvent.click(screen.getByRole("button", { name: `Ações de ${item}` })); fireEvent.click(screen.getByRole("menuitem", { name: acao })); };
const acoesDe = (item: string) => { fireEvent.click(screen.getByRole("button", { name: `Ações de ${item}` })); const nomes = screen.getAllByRole("menuitem").map(m => m.textContent!.trim()); fireEvent.keyDown(document, { key: "Escape" }); return nomes; };

describe("ficha de jogo", () => {
  it("tem as quatro abas internas e um cabeçalho com retrato, nome, alcunha e os números de combate", async () => {
    await semear();
    const ficha = await abrirFicha();
    expect(abas().getAllByRole("button").map(b => b.textContent)).toEqual(["Ficha", "Habilidades", "Inventário", "Identidade"]);
    const topo = within(screen.getByRole("region", { name: "Resumo do personagem" }));
    expect(topo.getByRole("heading", { name: "Thorin" })).toBeTruthy();
    expect(topo.getByText("Escudo de Pedra").tagName).toBe("EM");
    expect(ficha.querySelector(".ficha-identidade img")?.getAttribute("src")).toBe(RETRATO);
    expect(topo.getByText(/Anão da Colina · Guerreiro · Acólito/)).toBeTruthy();
    expect(topo.getByText("Nível 3")).toBeTruthy();
    expect(topo.getByRole("button", { name: "Alterar retrato" })).toBeTruthy();
    expect(screen.getByTestId("ficha-pv").textContent).toMatch(/^20 \/ \d+$/);
    expect(numero("CA")).toBe("11"); expect(numero("Iniciativa")).toBe("+1"); expect(numero("Proficiência")).toBe("+2");
    expect(topo.getByText("Resistências").parentElement!.textContent).toMatch(/Veneno/);
    expect(screen.getByRole("region", { name: "Perícias" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Notas|Anotações da ficha/ })).toBeNull();
  });

  it("PV, condições e inspiração são salvos sozinhos, com revisão, sem trocar de aba nem vazar para a apresentação pública", async () => {
    await semear();
    const publicoAntes = JSON.stringify(registros.dados[0]);
    await abrirFicha();
    fireEvent.change(screen.getByLabelText("Quantidade de pontos de vida"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /definir PV temporários/ }));
    fireEvent.change(screen.getByLabelText("Quantidade de pontos de vida"), { target: { value: "9" } });
    expect((screen.getByLabelText("Quantidade de pontos de vida") as HTMLInputElement).value).toBe("9");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar dano" }));
    expect((screen.getByLabelText("Quantidade de pontos de vida") as HTMLInputElement).value).toBe("1");   // o valor volta a 1
    fireEvent.click(screen.getByRole("button", { name: /adicionar condição/ }));
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
    expect(acoesDe("Mochila")).not.toContain("Equipar");
    acaoDoItem("Cota de malha", acoesDe("Cota de malha").includes("Equipar") ? "Equipar" : "Desequipar");
    expect(numero("CA")).toBe("16");
    acaoDoItem("Espada longa", "Equipar");
    irPara("Habilidades");
    const ataques = within(screen.getByRole("region", { name: "Ataques" }));
    expect(ataques.getByText("Espada longa")).toBeTruthy();
    fireEvent.click(ataques.getByRole("button", { name: "Ataque personalizado" }));
    fireEvent.change(ataques.getByLabelText("Nome do ataque"), { target: { value: "Cabeçada" } });
    fireEvent.change(ataques.getByLabelText("Dano do ataque"), { target: { value: "1d4+2" } });
    fireEvent.click(ataques.getByRole("button", { name: "Adicionar" }));
    expect(ataques.getByText("Cabeçada")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("region", { name: "Recursos de classe" })).getByRole("button", { name: /^Usar Retomar o Fôlego/ }));
    expect(within(screen.getByRole("region", { name: "Recursos de classe" })).getByRole("button", { name: /^Recuperar Retomar o Fôlego/ })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Ações de Adaga" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Alterar quantidade" }));
    fireEvent.change(within(screen.getByRole("dialog", { name: "Quantidade de Adaga" })).getByLabelText("Quantidade"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar quantidade" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar inventário" })).getByRole("button", { name: "Armas" }));
    const itens = within(screen.getByRole("region", { name: "Inventário do personagem" }));
    expect(itens.queryByText("Mochila")).toBeNull();
    fireEvent.click(itens.getByRole("button", { name: "Detalhes de Adaga" }));
    expect(within(screen.getByRole("dialog", { name: "Adaga" })).getByRole("button", { name: "Abrir no Compêndio: Adaga" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Adaga" })).getByRole("button", { name: "Fechar" }));
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

  it("tocar no retrato só amplia a imagem; trocar o retrato é uma ação separada", async () => {
    await semear();
    await abrirFicha();
    const topo = () => within(screen.getByRole("region", { name: "Resumo do personagem" }));
    fireEvent.click(topo().getByRole("button", { name: "Ampliar imagem de Thorin" }));
    const imagem = screen.getByRole("dialog", { name: "Imagem ampliada: Thorin" });
    expect(screen.queryByRole("dialog", { name: "Retrato de Thorin" })).toBeNull();
    fireEvent.keyDown(imagem, { key: "Escape" });
    fireEvent.click(topo().getByRole("button", { name: "Alterar retrato" }));
    expect(screen.getByRole("dialog", { name: "Retrato de Thorin" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /^Imagem ampliada/ })).toBeNull();
  });

  it("aba Identidade mostra a projeção pública do mesmo personagem e a edição é salva na ficha", async () => {
    await semear();
    await abrirFicha();
    fireEvent.click(abas().getByRole("button", { name: "Identidade" }));
    const previa = within(await screen.findByRole("article", { name: "Prévia da identidade pública" }));
    expect(previa.getByRole("heading", { name: "Thorin" })).toBeTruthy();
    expect(previa.queryByText(/Pontos de vida|PV|Inventário/)).toBeNull();
    fireEvent.click(previa.getByRole("button", { name: "Editar identidade pública" }));
    fireEvent.change(await screen.findByLabelText("Descrição pública"), { target: { value: "Um anão de poucas palavras." } });
    await salvou(() => expect(JSON.stringify((registros as unknown as { dados: unknown[] }).dados[0])).toContain("Um anão de poucas palavras."));
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(within(screen.getByRole("article", { name: "Prévia da identidade pública" })).getByText("Um anão de poucas palavras.")).toBeTruthy();
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
    expect(abaDoGesto("inventario", -100, 0)).toBe("identidade");
    expect(abaDoGesto("identidade", -100, 0)).toBeNull();
    expect(abaDoGesto("inventario", 100, 10)).toBe("habilidades");
    expect(abaDoGesto("ficha", -100, 80)).toBeNull();
  });

  it("descansos ficam no cabeçalho, com confirmação", async () => {
    await semear();
    await abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: "Descanso longo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar descanso" }));
    await salvou(() => expect(draftSalvo().currentHp).toBeGreaterThan(20));
    expect(screen.getByText("Descanso longo registrado.")).toBeTruthy();
  });

  it("subir de nível é um fluxo próprio: grava o novo nível sem mexer no inventário e acompanha o ganho de PV sem apagar o dano", async () => {
    await semear();
    await abrirFicha();
    const antes = structuredClone(draftSalvo()), maximoAntes = Number(screen.getByTestId("ficha-pv").textContent!.split(" / ")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Subir de nível" }));
    const passos = () => within(screen.getByRole("navigation", { name: "Etapas da subida de nível" }));
    await screen.findByRole("navigation", { name: "Etapas da subida de nível" });
    expect(screen.queryByLabelText("Nome do personagem")).toBeNull();       // não é a edição
    fireEvent.click(passos().getByRole("button", { name: /^Revisão/ }));
    for (const escolha of screen.queryAllByRole("combobox")) { const s = escolha as HTMLSelectElement; if (!s.value && s.options.length > 1) fireEvent.change(s, { target: { value: [...s.options].find(o => o.value && !o.disabled)!.value } }); }
    const confirmar = screen.getByRole("button", { name: /^Confirmar nível 4/ }) as HTMLButtonElement;
    if (confirmar.disabled) {
      fireEvent.click(passos().getByRole("button", { name: /^Características e escolhas/ }));
      for (const escolha of screen.queryAllByRole("combobox")) { const s = escolha as HTMLSelectElement; if (!s.value && s.options.length > 1) fireEvent.change(s, { target: { value: [...s.options].find(o => o.value && !o.disabled)!.value } }); }
      fireEvent.click(passos().getByRole("button", { name: /^Revisão/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar nível 4/ }));
    await screen.findByTestId("ficha-guiada-leitura");
    await salvou(() => expect(draftSalvo().level).toBe(4));
    expect(draftSalvo().inventory).toEqual(antes.inventory);
    expect(draftSalvo().currency).toEqual(antes.currency);
    const maximoDepois = () => Number(screen.getByTestId("ficha-pv").textContent!.split(" / ")[1]);
    expect(maximoDepois()).toBeGreaterThan(maximoAntes);
    await salvou(() => expect(draftSalvo().currentHp).toBe(antes.currentHp + (maximoDepois() - maximoAntes)));
  });

  it("conflito de revisão pausa o salvamento automático e não sobrescreve a outra alteração", async () => {
    const id = await semear();
    await abrirFicha();
    const pv = draftSalvo().currentHp;
    fireEvent.click(screen.getByRole("checkbox", { name: "Inspiração" }));   // alteração minha pendente...
    const externo = await fichasEmMemoria(mestreUser.id, banco).salvar(id, 1, { ...draftSalvo(), nickname: "Externa", currentHp: 3 });
    expect(externo.ok).toBe(true);
    expect(await screen.findByTestId("aviso-conflito", undefined, { timeout: 4000 })).toBeTruthy();
    expect(draftSalvo()).toMatchObject({ nickname: "Externa", currentHp: pv });   // a gravação da ficha inteira nunca muda os PV
    expect(banco.fichas[0].revision).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Carregar a versão atual" }));
    await waitFor(() => expect(screen.getByText("Externa")).toBeTruthy());
  });

  it("PV guardado acima do máximo (nível ou atributo mudaram) não impede abrir a ficha: aparece no máximo", async () => {
    await semear();
    banco.fichas[0].draft = { ...banco.fichas[0].draft, currentHp: 999 };
    await abrirFicha();
    const [atual, maximo] = screen.getByTestId("ficha-pv").textContent!.split(" / ");
    expect(atual).toBe(maximo);
  });

  it("sem alterações pendentes, mudanças de outra sessão aparecem sozinhas: PV por operação e o restante da ficha", async () => {
    const id = await semear();
    await abrirFicha();
    const mestre = fichasEmMemoria(mestreUser.id, banco);
    expect((await mestre.alterarVitais(id, { tipo: "definir", valor: 7, maximo: 99 }, "op-m1")).ok).toBe(true);
    await waitFor(() => expect(screen.getByTestId("ficha-pv").textContent).toMatch(/^7 \//));
    expect(banco.fichas[0].revision).toBe(1);
    expect((await mestre.salvar(id, 1, { ...draftSalvo(), nickname: "Recebida" })).ok).toBe(true);
    await waitFor(() => expect(screen.getByText("Recebida")).toBeTruthy());
    expect(screen.queryByTestId("aviso-conflito")).toBeNull();
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
    await semear();
    const publico = () => { const { title, visibility, meta } = registros.dados[0] as unknown as { title: string; visibility: string; meta: unknown }; return JSON.stringify({ title, visibility, meta }); };
    const publicoAntes = publico();
    await abrirFicha(mestreUser);
    irPara("Inventário");
    expect(screen.getByRole("button", { name: "Ações de Cota de malha" })).toBeTruthy();
    acaoDoItem("Cota de malha", acoesDe("Cota de malha").includes("Equipar") ? "Equipar" : "Desequipar");
    await salvou(() => expect(banco.fichas[0].revision).toBe(2));
    expect(banco.fichas[0].ownerId).toBe(me.id);
    expect(publico()).toBe(publicoAntes);   // o conteúdo público não muda quando o mestre mexe só em dados privados
  });

  it("outro jogador vê só a apresentação (nome, alcunha e o mesmo retrato), sem PV, CA, atributos ou inventário", async () => {
    await semear();
    await montar(other); await abrirLista();
    fireEvent.click(await screen.findByRole("button", { name: /^Thorin Escudo de Pedra/ }));
    const cartao = await screen.findByTestId("cartao-publico");
    expect(cartao.querySelector("img")?.getAttribute("src")).toBe(RETRATO);
    expect(cartao.textContent).toMatch(/Thorin.*Escudo de Pedra/);
    expect(cartao.textContent).not.toMatch(/PV \d|CA \d|Força|Cota de malha|Mochila/);
    expect(cartao.textContent).toContain("Nível: 3");   // o nível faz parte da apresentação; o dono pode ocultá-lo
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
    expect(within(screen.getByRole("listitem", { name: "Poção de cura" })).getByText("2d4+2 PV")).toBeTruthy();
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
    expect(within(screen.getByRole("listitem", { name: "Espada longa" })).getByText(/1d8 cortante/).textContent).toBe("1d8 cortante (1d10 com duas mãos)");
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
    expect(moedas.getByTestId("saldo-desativado").textContent).toMatch(/7 PE, 3 PL\): 33,5 PO, fora do patrimônio/);
    fireEvent.click(moedas.getByRole("button", { name: "Adicionar 1 moeda de ouro (PO)" }));
    await salvou(() => expect(draftSalvo().currency).toEqual({ cp: 5, sp: 20, ep: 7, gp: 11, pp: 3 }));
  });
});

describe("habilidades: filtros por ação, favoritos e detalhes sem perder a ficha", () => {
  const filtro = (nome: string) => fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por tipo de ação" })).getByRole("button", { name: nome }));

  it("filtra pelo tipo de ação que as regras informam e lembra os favoritos", async () => {
    await semear(); await abrirFicha(); irPara("Habilidades");
    filtro("Ação bônus");
    expect(screen.getByRole("listitem", { name: /Retomar o Fôlego|Second Wind/ })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Ataques" })).toBeNull();
    filtro("Reação");
    expect(screen.getByText(/Nada deste tipo/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Favoritos" })).toBeNull();   // sem favoritos, a seção não aparece
    filtro("Todas");
    const cartao = screen.getByRole("listitem", { name: /Retomar o Fôlego|Second Wind/ });
    fireEvent.click(within(cartao).getByRole("button", { name: /^Favoritar/ }));
    // os favoritos ficam no topo, sem precisar de filtro, e são o MESMO dado: gastar num lugar reflete no outro
    const favoritos = within(screen.getByRole("region", { name: "Favoritos" }));
    expect(favoritos.getAllByRole("listitem", { name: /Retomar o Fôlego|Second Wind/ })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Favoritos" }).compareDocumentPosition(screen.getByRole("region", { name: "Recursos de classe" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(favoritos.getByRole("button", { name: /^Retomar o Fôlego/ }));
    fireEvent.click(favoritos.getByRole("button", { name: /^Usar Retomar o Fôlego/ }));
    expect(within(screen.getByRole("region", { name: "Recursos de classe" })).getByRole("button", { name: /^Recuperar Retomar o Fôlego/ })).toBeTruthy();
    await salvou(() => expect((draftSalvo().play as { favoritos: string[] }).favoritos).toHaveLength(1));
  });

  it("a magia abre no segundo grupo de abas e a ficha continua aberta na mesma aba", async () => {
    await semear();
    banco.fichas[0].draft = { ...banco.fichas[0].draft, classId: "wizard", decisions: [{ id: "cantrips", optionIds: ["fire-bolt"] }] };
    await abrirFicha(); irPara("Habilidades");
    const magia = await screen.findByRole("listitem", { name: "Raio de Fogo" });
    expect(magia.textContent).toMatch(/\+\d para atingir/);
    expect(magia.textContent).toMatch(/1d10 de dano/);
    fireEvent.click(within(magia).getByRole("button", { name: /^Raio de Fogo/ }));
    fireEvent.click(within(magia).getByRole("button", { name: "Abrir no Compêndio: Raio de Fogo" }));
    expect(await screen.findByRole("heading", { name: "Raio de Fogo", level: 1 })).toBeTruthy();
    expect(document.querySelectorAll(".flexlayout__tabset")).toHaveLength(1);
    expect(screen.queryByTestId("ficha-guiada-leitura")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Voltar na aba"}));
    expect(await screen.findByTestId("ficha-guiada-leitura")).toBeTruthy();
    // cada grupo mantém a sua aba selecionada: a ficha de um lado, a magia do outro (a visibilidade real é conferida no Playwright)
    const selecionadas = [...document.querySelectorAll(".flexlayout__tab_button--selected .flexlayout__tab_button_content")].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ""));
    expect(selecionadas.sort()).toEqual(["Thorin"]);
  });
});

describe("controles ainda sem operação no banco ficam desabilitados e não alteram nada", () => {
  it("curar outro personagem e transferir moedas aparecem como indisponíveis", async () => {
    const outra = await fichasEmMemoria(me.id, banco).criar("ca", { ...rascunho, name: "Lydia", nickname: "", inventory: [] }, { identity: defaultPublicIdentity(), source: { name: "Lydia", alias: "", race: "Humana", characterClass: "Clériga", level: "3", portrait: "" } });
    if (!outra.ok) throw new Error(outra.error);
    await semear(); banco.fichas.reverse();
    banco.fichas[0].draft.inventory = [{ id: "p", itemId: "potion-of-healing-common", quantity: 1, equipped: false, origin: "acquired" }];
    await abrirFicha(); irPara("Inventário");
    const antes = JSON.stringify(banco.fichas);
    fireEvent.click(screen.getByRole("button", { name: /^Usar Poção de [Cc]ura/ }));
    const pocao = within(screen.getByRole("dialog"));
    expect(((await pocao.findByRole("radio", { name: "Lydia" })) as HTMLInputElement).disabled).toBe(true);
    expect((pocao.getByRole("radio", { name: /Thorin \(você\)/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(pocao.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Transferir moedas" }));
    const moedas = within(screen.getByRole("dialog", { name: "Transferir moedas" }));
    expect((moedas.getByRole("button", { name: "Transferir moedas" }) as HTMLButtonElement).disabled).toBe(true);
    expect(moedas.getByText(/ainda não está disponível/)).toBeTruthy();
    fireEvent.click(moedas.getByRole("button", { name: "Fechar" }));
    expect(JSON.stringify(banco.fichas)).toBe(antes);
  });
});

describe("itens: usar, transferir e excluir", () => {
  const comInventario = async (extra: { itemId: string; id: string; quantity: number }[]) => {
    const id = await semear();
    banco.fichas[0].draft.inventory = [...banco.fichas[0].draft.inventory, ...extra.map(x => ({ ...x, equipped: false, origin: "acquired" as const }))];
    banco.fichas[0].draft.currentHp = 5;
    await abrirFicha(); irPara("Inventário");
    return id;
  };
  const POCAO = "Poção de Cura";

  it("usar a poção pede o resultado da rolagem, cura até o máximo, baixa uma unidade e registra no histórico, uma única vez", async () => {
    await comInventario([{ id: "pocao", itemId: "potion-of-healing-common", quantity: 2 }]);
    const nome = screen.getByRole("listitem", { name: /Poção de [Cc]ura/ }).getAttribute("aria-label")!;
    acaoDoItem(nome, "Usar");
    const janela = within(screen.getByRole("dialog", { name: `Usar ${nome}` }));
    const confirmar = janela.getByRole("button", { name: "Curar Thorin" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);                                   // sem resultado não há consumo
    const campo = janela.getByLabelText(/Resultado da rolagem \(2d4\+2: de 4 a 10\)/);
    fireEvent.change(campo, { target: { value: "11" } }); expect(confirmar.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: "7" } });
    expect(confirmar.textContent).toBe("Curar Thorin em 7 PV");
    fireEvent.click(confirmar); fireEvent.click(confirmar);                    // clique duplo não consome duas vezes
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(draftSalvo().currentHp).toBe(12);
    expect(draftSalvo().inventory.find(i => i.id === "pocao")!.quantity).toBe(1);
    await waitFor(() => expect(screen.getByTestId("ficha-pv").textContent).toMatch(/^12 \//));
    expect(screen.getByText(new RegExp(`Usou .*: \\+7 PV`))).toBeTruthy();
    expect(screen.queryByTestId("aviso-conflito")).toBeNull();
    void POCAO;
  });

  it("separa o resultado da rolagem da cura aplicada, que para no PV máximo", async () => {
    await comInventario([{ id: "pocao", itemId: "potion-of-healing-common", quantity: 1 }]);
    const maximo = Number(screen.getByTestId("ficha-pv").textContent!.split(" / ")[1]);
    acaoDoItem(screen.getByRole("listitem", { name: /Poção de [Cc]ura/ }).getAttribute("aria-label")!, "Usar");
    const janela = within(screen.getByRole("dialog"));
    fireEvent.change(janela.getByLabelText(/Resultado da rolagem/), { target: { value: "10" } });
    const aplicada = Math.min(maximo - 5, 10);
    expect(janela.getByTestId("previa-da-cura").textContent).toContain(`5 → ${5 + aplicada} de ${maximo}`);
    expect(janela.getByRole("button", { name: /^Curar Thorin/ }).textContent).toBe(`Curar Thorin em ${aplicada} PV`);
  });

  it("transferir move a quantidade para outro personagem da campanha e a ficha de origem se atualiza", async () => {
    const outra = await fichasEmMemoria(me.id, banco).criar("ca", { ...rascunho, name: "Lydia", nickname: "", inventory: [] }, { identity: defaultPublicIdentity(), source: { name: "Lydia", alias: "", race: "Humana", characterClass: "Clériga", level: "3", portrait: "" } });
    if (!outra.ok) throw new Error(outra.error);
    const origem = await semear();
    banco.fichas.reverse();                                                   // a ficha de Thorin volta a ser a primeira
    banco.fichas[0].draft.inventory = [{ id: "f", itemId: "arrow", quantity: 20, equipped: false, origin: "acquired" }];
    await abrirFicha(); irPara("Inventário");
    acaoDoItem("Flecha", "Transferir");
    const janela = within(screen.getByRole("dialog", { name: "Transferir Flecha" }));
    fireEvent.click(await janela.findByRole("radio", { name: "Lydia" }));
    fireEvent.change(janela.getByLabelText(/Quantidade/), { target: { value: "21" } });
    expect((janela.getByRole("button", { name: "Transferir" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(janela.getByLabelText(/Quantidade/), { target: { value: "5" } });
    expect(janela.getByRole("button", { name: /^Transferir/ }).textContent).toBe("Transferir 5 para Lydia");
    fireEvent.click(janela.getByRole("button", { name: /^Transferir/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(banco.fichas.find(f => f.id === origem)!.draft.inventory).toMatchObject([{ id: "f", quantity: 15 }]);
    expect(banco.fichas.find(f => f.id === outra.data.id)!.draft.inventory).toMatchObject([{ itemId: "arrow", quantity: 5, equipped: false }]);
    expect(screen.getByRole("listitem", { name: "Flecha" }).textContent).toContain("×15");
  });

  it("excluir pede confirmação; cancelar mantém o item", async () => {
    await comInventario([{ id: "corda", itemId: "rope-hempen-50-feet", quantity: 1 }]);
    const nome = screen.getAllByRole("listitem").map(l => l.getAttribute("aria-label") ?? "").find(n => /Corda/.test(n))!;
    acaoDoItem(nome, "Excluir");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("listitem", { name: nome })).toBeTruthy();
    acaoDoItem(nome, "Excluir");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Excluir" }));
    expect(screen.queryByRole("listitem", { name: nome })).toBeNull();
    await salvou(() => expect(draftSalvo().inventory.some(i => i.id === "corda")).toBe(false));
  });
});
