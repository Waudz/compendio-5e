// @vitest-environment jsdom
// Caminho do usuário na navegação REAL: menu → Personagens → criador guiado → equipamento (catálogo oficial) → inventário →
// detalhes no Compêndio → identidade pública → salvar → reabrir. Armazenamento experimental local.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CampaignApi, Membership } from '../campaigns';
import { activeKey } from '../CampaignsContext';
import { storageKey } from '../persistence';
import { registrosEmMemoria } from '../registrosMemoria';
import { me, memoryStorage, other, renderApp } from '../testUtils';
import { armazenamentoLocalExperimental } from './armazenamento';
import { clearUserLocalData } from '../localData';
import { buildPilotCharacterCatalog } from '../rules/character-catalogue-adapter';
import { fighter2014Advancements } from '../rules/fighter-2014';
import { criadorRules, criadorRefs } from './catalogo-criador';
import { defaultPublicIdentity } from '../rules/public-identity';

const camp = { id: 'ca', name: 'Mesa dos Dragões', description: 'Desc.', created_at: '' };
const jogador: Membership = { role: 'jogador', campaign: camp };
const apiC = (m: Membership) => ({ list: async () => ({ ok: true, data: [m] }) }) as unknown as CampaignApi;
let mobile = false;

beforeEach(() => {
  mobile = false;
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: mobile && q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, '', '/'); localStorage.setItem(activeKey(me.id), 'ca');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const strip = '.flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content';
const abas = () => [...document.querySelectorAll(strip)].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ''));   // abas abertas por link de conteúdo são fixadas
const menu = () => within(screen.getByRole('navigation', { name: 'Menu principal' }));
const secoes = () => within(screen.getByRole('navigation', { name: 'Seções do personagem' }));
const montar = async (user = me) => { localStorage.setItem(activeKey(user.id), 'ca'); return renderApp({ user, api: apiC(jogador), registros: registrosEmMemoria('jogador', user.id, [], { dados: [] }) }); };
const abrirPersonagens = async () => { await waitFor(() => expect(menu().getByRole('button', { name: 'Personagens' })).toBeTruthy()); fireEvent.click(menu().getByRole('button', { name: 'Personagens' })); };
const novoGuiado = async () => { fireEvent.click(await screen.findByRole('button', { name: /Criar personagem/ })); return screen.findByLabelText('Nome do personagem'); };
const preencherFicha = async (nome: string) => {
  fireEvent.change(await screen.findByLabelText('Nome do personagem'), { target: { value: nome } });
  const opcoes = within(await screen.findByLabelText("Opções SRD 2014"));
  const proficiencias = opcoes.getByText(/Proficiências de Guerreiro — escolha/).closest("fieldset")!;
  fireEvent.click(within(proficiencias).getByRole("checkbox", { name: "Atletismo" }));
  fireEvent.click(within(proficiencias).getByRole("checkbox", { name: "Percepção" }));
};
const confirmarEquipamento = async () => {
  fireEvent.click(secoes().getByRole('button', { name: 'Equipamento inicial' }));
  const equipamento = await screen.findByLabelText('Equipamento inicial SRD 2014');
  for (const seletor of equipamento.querySelectorAll<HTMLSelectElement>('select')) {
    if (seletor.value === '' && seletor.options.length > 1) {
      const escolha = [...seletor.options].find(o => o.value && !o.disabled);
      if (escolha) fireEvent.change(seletor, { target: { value: escolha.value } });
    }
  }
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar equipamentos SRD 2014' }));
};


/** WCAG 2.5.3 (axe `label-content-name-mismatch`): o nome acessível precisa conter o texto visível do botão. Devolve os botões que violam. */
const nomesDivergentes = (raiz: ParentNode) => [...raiz.querySelectorAll('button[aria-label]')].filter(b => {
  const visivel = (b.textContent ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  return visivel !== '' && !(b.getAttribute('aria-label') ?? '').toLocaleLowerCase('pt-BR').includes(visivel);
}).map(b => `"${b.textContent?.trim()}" → "${b.getAttribute('aria-label')}"`);

describe('criador guiado na navegação real (desktop)', () => {
  it('acessível pelo menu: Personagens oferece o criador, mostra o aviso de armazenamento experimental e a lista vazia', async () => {
    await montar(); await abrirPersonagens();
    expect(await screen.findByTestId('personagens-vazio')).toBeTruthy();
    await novoGuiado();
    expect(abas()).toEqual(['Mesa dos Dragões', 'Personagens', 'Novo personagem']);
    expect(screen.getByTestId('aviso-armazenamento').textContent).toMatch(/experimental.*só neste navegador.*não é privado/s);
    expect(screen.getByRole('heading', { name: 'Novo personagem' })).toBeTruthy();
    expect(await screen.findByLabelText('Opções SRD 2014')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ativar opções SRD 2014' })).toBeNull();
  });

  it('fluxo completo: ficha, equipamento do catálogo oficial com prévia, inventário, detalhes no Compêndio, identidade pública, salvar e reabrir', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado();
    await preencherFicha('Thorin');
    const calculada = within(screen.getByRole('region', { name: 'Ficha calculada' }));
    expect(calculada.getByText(/Atletismo, Percepção/)).toBeTruthy();
    expect(calculada.getByText(/Estado: rascunho incompleto/)).toBeTruthy();

    // equipamento: prévia com os nomes oficiais em português ANTES de confirmar; inventário ainda vazio
    fireEvent.click(secoes().getByRole('button', { name: 'Equipamento inicial' }));
    const equipamentoSRD = await screen.findByLabelText('Equipamento inicial SRD 2014');
    expect(within(equipamentoSRD).getByText(/Equipamento inicial/)).toBeTruthy();
    expect(within(equipamentoSRD).getByRole('button', { name: 'Confirmar equipamentos SRD 2014' })).toBeTruthy();
    fireEvent.click(secoes().getByRole('button', { name: 'Inventário' })); expect(screen.getByTestId('inventario-vazio')).toBeTruthy();
    await confirmarEquipamento();
    expect(await screen.findByText(/Equipamentos iniciais aplicados/)).toBeTruthy();
    fireEvent.click(secoes().getByRole('button', { name: 'Inventário' }));
    const inv = within(screen.getByRole('region', { name: 'Inventário' }));
    expect(inv.getByText('Cota de malha')).toBeTruthy(); expect(inv.getByText('Besta leve')).toBeTruthy(); expect(inv.getByText('Mochila')).toBeTruthy();

    // detalhes do item com a MESMA definição do Compêndio, em nova aba
    fireEvent.click(inv.getByRole('button', { name: 'Consultar no Compêndio: Cota de malha' }));
    expect(await screen.findByRole('heading', { name: 'Cota de malha' })).toBeTruthy();
    expect(abas()).toContain('Cota de malha');
    const fatos = within(document.querySelector('.item-fatos') as HTMLElement);
    expect(fatos.getByText('Classe de Armadura').nextSibling?.textContent).toBe('16');
    expect(fatos.getByText('Força mínima').nextSibling?.textContent).toBe('13');
    expect(document.body.textContent).toContain('srd-2014:item:chain-mail:1');

    // volta ao criador: o rascunho continua intacto; identidade pública separada da ficha privada
    fireEvent.click(screen.getByText('Novo personagem', { selector: strip }));
    fireEvent.click(await screen.findByRole('button', { name: 'Identidade pública' }));
    expect(screen.getByText(/nunca aparecem nele/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Visibilidade Classe'), { target: { value: 'hidden' } });
    fireEvent.change(screen.getByLabelText('Visibilidade Alcunha'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Alcunha pública'), { target: { value: 'O Escudo de Pedra' } });
    const previa = within(screen.getByRole('region', { name: 'Prévia para outros jogadores' }));
    expect(previa.queryByText(/Classe:/)).toBeNull(); expect(previa.queryByText(/Guerreiro/)).toBeNull(); expect(previa.queryByText(/nível|PV|Cota de malha/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar identidade pública' }));
    expect(await screen.findByText(/Identidade pública atualizada/)).toBeTruthy();

    // salvar
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Personagem salvo neste navegador \(armazenamento experimental\)|Rascunho incompleto salvo/)).toBeTruthy();
    await waitFor(() => expect(abas()).toContain('Thorin'));
    const chaves = [...Array(localStorage.length).keys()].map(i => localStorage.key(i)!).filter(k => k.startsWith('compendio5e:experimental:criador:'));
    expect(chaves).toHaveLength(1); expect(chaves[0]).toContain(`:${me.id}:ca:`);

    // reabrir (novo carregamento do app): lista, ficha, inventário e identidade restaurados
    cleanup(); await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole('button', { name: /^Thorin/ }));
    // um personagem salvo reabre na ficha de jogo; a edição é uma ação explícita
    await screen.findByTestId('ficha-guiada-leitura');
    fireEvent.click(screen.getByRole('button', { name: 'Editar personagem' }));
    await waitFor(() => expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Thorin'));
    expect(screen.getByText(/Atletismo, Percepção/)).toBeTruthy();
    fireEvent.click(secoes().getByRole('button', { name: 'Inventário' }));
    expect(within(screen.getByRole('region', { name: 'Inventário' })).getByText('Cota de malha')).toBeTruthy();
    fireEvent.click(secoes().getByRole('button', { name: 'Identidade pública' }));
    expect((screen.getByLabelText('Visibilidade Classe') as HTMLSelectElement).value).toBe('hidden');
    expect((screen.getByLabelText('Alcunha pública') as HTMLInputElement).value).toBe('O Escudo de Pedra');
    expect(screen.queryByText('Alterações não salvas.')).toBeNull();   // nada pendente depois de reabrir
  });

  it('equipamento SRD 2014 não é concedido duas vezes e preserva itens adquiridos', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado(); await preencherFicha('Thorin');
    await confirmarEquipamento();
    fireEvent.click(secoes().getByRole('button', { name: 'Inventário' }));
    const inventario = screen.getByRole('region', { name: 'Inventário' });
    const quantidadeInicial = inventario.querySelectorAll('li').length;
    fireEvent.change(screen.getByLabelText('Buscar item para adicionar'), { target: { value: 'adaga' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Adicionar Adaga$/ }));
    fireEvent.click(secoes().getByRole('button', { name: 'Equipamento inicial' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar equipamentos SRD 2014' }));
    expect(await screen.findByText(/Já existe equipamento inicial nesta ficha|Equipamento inicial já concedido e consumido|Equipamentos iniciais aplicados/)).toBeTruthy();
    fireEvent.click(secoes().getByRole('button', { name: 'Inventário' }));
    expect(screen.getByRole('region', { name: 'Inventário' }).querySelectorAll('li').length).toBeGreaterThanOrEqual(quantidadeInicial + 1);
    expect(screen.getAllByText('Adaga').length).toBeGreaterThan(0);
  });

  it('C-E2E-01: no inventário o nome acessível de "Consultar no Compêndio", "+1" e "−1" contém o texto visível e continua identificando o item', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado(); await preencherFicha('Thorin');
    await confirmarEquipamento();
    fireEvent.click(secoes().getByRole('button', { name: 'Inventário' }));
    const inv = screen.getByRole('region', { name: 'Inventário' });
    expect(nomesDivergentes(inv)).toEqual([]);                                   // nenhum botão do inventário viola a regra
    const botoes = [...inv.querySelectorAll('li button')].map(b => ({ texto: b.textContent, nome: b.getAttribute('aria-label') }));
    expect(botoes).toContainEqual({ texto: 'Consultar no Compêndio', nome: 'Consultar no Compêndio: Cota de malha' });
    expect(botoes).toContainEqual({ texto: '+1', nome: '+1: adicionar quantidade de Cota de malha' });
    expect(botoes).toContainEqual({ texto: '−1', nome: '−1: remover quantidade de Cota de malha' });
    // o contexto do item continua no nome (cada linha distinta) e as ações funcionam pelos novos nomes
    const linha = within(inv.querySelector('li') as HTMLElement);
    const nome = linha.getByText(/.+/, { selector: 'strong' }).textContent!;
    fireEvent.click(within(inv).getByRole('button', { name: `+1: adicionar quantidade de ${nome}` }));
    expect(inv.textContent).toMatch(new RegExp(`${nome} · quantidade 2`));
    fireEvent.click(within(inv).getByRole('button', { name: `−1: remover quantidade de ${nome}` }));
    expect(inv.textContent).toMatch(new RegExp(`${nome} · quantidade 1`));
  });
  it('as demais seções do criador também não têm botões com nome acessível divergente do texto visível', async () => {
    await montar(); await abrirPersonagens();
    expect(nomesDivergentes(await screen.findByRole('region', { name: 'Personagens da campanha' }))).toEqual([]);
    await novoGuiado(); await preencherFicha('Thorin');
    for (const sec of ['Ficha', 'Equipamento inicial', 'Inventário', 'Identidade pública']) {
      fireEvent.click(secoes().getByRole('button', { name: sec }));
      expect(nomesDivergentes(document.querySelector('.criador') as HTMLElement), sec).toEqual([]);
    }
  });

  it('erro de salvamento não perde o que foi digitado', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado(); await preencherFicha('Thorin');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Cota de armazenamento excedida.'); });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Cota de armazenamento excedida\. Suas alterações continuam na tela\./)).toBeTruthy();
    expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Thorin');
    expect(screen.getByText('Alterações não salvas.')).toBeTruthy();
  });

  it('exige nome para salvar e valida a compra de pontos sem alterar o rascunho', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Informe o nome/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Atributo int'), { target: { value: '15' } });   // estoura os 27 pontos
    await waitFor(() => expect(document.querySelector('p[role=alert]')?.textContent).toBeTruthy());
    expect((screen.getByLabelText('Atributo int') as HTMLSelectElement).value).toBe('10');
  });

  it('personagem salvo de um usuário não aparece para outro usuário no mesmo navegador (separação por conta, não segurança)', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado(); await preencherFicha('Thorin');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' })); await screen.findByText(/Rascunho incompleto salvo|Personagem salvo/);
    cleanup(); await montar(other); await abrirPersonagens();
    expect(await screen.findByTestId('personagens-vazio')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Thorin/ })).toBeNull();
    expect(clearUserLocalData(me.id)).toBeGreaterThan(0);          // logout do primeiro usuário apaga o personagem local dele
    expect(armazenamentoLocalExperimental(me.id, 'ca').listar()).toEqual([]);
  });

  it('dado salvo corrompido mostra erro claro e permite descartar, sem quebrar o aplicativo', async () => {
    localStorage.setItem('compendio5e:experimental:criador:v1:u1:ca:ruim', '{"schemaVersion":1,"draft":42}');
    localStorage.setItem(storageKey({ user: me.id, campaign: 'ca', device: 'navegador' }), JSON.stringify({ version: 2, layout: { type: 'row', children: [{ type: 'tabset', id: 'grupo-1', weight: 100, active: true, selected: 0, children: [{ type: 'tab', id: 'criador:ruim' }] }] } }));
    await montar();
    expect(await screen.findByText(/Não foi possível abrir este personagem/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Descartar dado corrompido e recomeçar/ }));
    expect(await screen.findByLabelText('Nome do personagem')).toBeTruthy();
    expect(localStorage.getItem('compendio5e:experimental:criador:v1:u1:ca:ruim')).toBeNull();
  });
});

describe('títulos das abas do criador', () => {
  it('aba restaurada sem nome conhecido mostra um rótulo legível, e a lista de Personagens passa a nomear as salvas', async () => {
    armazenamentoLocalExperimental(me.id, 'ca').salvar({ schemaVersion: 1, savedAt: '2026-11-20T10:00:00Z', identity: defaultPublicIdentity(), draft: { id: 'p9', name: 'Thorin', ruleset: '5e-2014', catalogueVersion: 'v', baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, raceId: 'r', backgroundId: 'b', classId: 'c', level: 1, decisions: [], inventory: [], currentHp: 13, temporaryHp: 0, spentResources: {} } });
    localStorage.setItem(storageKey({ user: me.id, campaign: 'ca', device: 'navegador' }), JSON.stringify({ version: 2, layout: { type: 'row', children: [{ type: 'tabset', id: 'grupo-1', weight: 100, active: true, selected: 0, children: [{ type: 'tab', id: 'secao:personagens' }, { type: 'tab', id: 'criador:p9' }] }] } }));
    await montar();
    await waitFor(() => expect(abas()).toEqual(['Personagens', 'Thorin']));   // a lista de Personagens (aba ativa) registra os nomes
    expect(abas().join()).not.toMatch(/p9/);
  });
});

describe('criador guiado no celular', () => {
  beforeEach(() => { mobile = true; });
  const naBarra = () => within(screen.getByRole('navigation', { name: 'Navegação mobile' }));
  it('acessível por Menu → Personagens, sem abas, e Voltar respeita alterações não salvas', async () => {
    await renderApp({ user: me, api: apiC(jogador), registros: registrosEmMemoria('jogador', me.id, [], { dados: [] }) });
    await waitFor(() => expect(document.querySelector('.mobile-page-title')?.textContent).toBe(camp.name));
    fireEvent.click(naBarra().getByRole('button', { name: 'Menu' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Menu de navegação' })).getByRole('button', { name: 'Personagens' }));
    fireEvent.click(await screen.findByRole('button', { name: /Criar personagem/ }));
    fireEvent.change(await screen.findByLabelText('Nome do personagem'), { target: { value: 'Thorin' } });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByTestId('aviso-armazenamento')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Thorin');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' })); await screen.findByText(/Rascunho incompleto salvo/);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));                       // salvo: volta sem confirmação
    await waitFor(() => expect(screen.queryByLabelText('Nome do personagem')).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await screen.findByRole('button', { name: /^Thorin/ })).toBeTruthy();
  });
});


it('ficha legada continua editável na versão original, sem conversão nem regravação ao abrir', async()=>{
 const {catalog,ids}=buildPilotCharacterCatalog(criadorRules,{race:criadorRefs.race,background:criadorRefs.background,class:criadorRefs.class},fighter2014Advancements);
 const store=armazenamentoLocalExperimental(me.id,'ca');
 const inventory=[{id:'reliquia',itemId:'dagger',quantity:2,equipped:false,origin:'acquired' as const}];
 store.salvar({schemaVersion:1,savedAt:'2026-11-20T00:00:00Z',identity:defaultPublicIdentity(),draft:{id:'antiga',name:'Veterana',ruleset:'5e-2014',catalogueVersion:catalog.version,baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,level:1,decisions:[],inventory,currentHp:13,temporaryHp:0,spentResources:{},currency:{cp:0,sp:0,gp:7}}});
 const before=structuredClone(store.carregar('antiga'));
 await montar();await abrirPersonagens();fireEvent.click(await screen.findByRole('button',{name:/^Veterana/}));
 fireEvent.click(await screen.findByRole('button',{name:'Editar personagem'}));
 expect((await screen.findByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Veterana');
 expect(store.carregar('antiga')).toEqual(before);
 fireEvent.change(screen.getByLabelText('Nome do personagem'),{target:{value:'Veterana revisada'}});
 fireEvent.click(screen.getByRole('button',{name:/^Salvar$/}));await screen.findByText(/Rascunho incompleto salvo/);
 const after=store.carregar('antiga')!;expect(after.draft.catalogueVersion).toBe(catalog.version);expect(after.draft.inventory).toEqual(inventory);expect(after.draft.currency?.gp).toBe(7);expect(after.draft.name).toBe('Veterana revisada');
});
