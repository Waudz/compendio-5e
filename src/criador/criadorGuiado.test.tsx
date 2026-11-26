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
const etapas = () => within(screen.getByRole('navigation', { name: 'Etapas do personagem' }));
const irEtapa = (nome: RegExp | string) => fireEvent.click(etapas().getByRole('button', { name: typeof nome === 'string' ? new RegExp('^' + nome) : nome }));
const confirmarEquipamentoDaClasse = async () => {
  irEtapa('Equipamento');
  const equipamento = await screen.findByLabelText('Equipamento inicial SRD 2014');
  for (const seletor of equipamento.querySelectorAll<HTMLSelectElement>('select')) {
    if (seletor.value === '' && seletor.options.length > 1) {
      const escolha = [...seletor.options].find(o => o.value && !o.disabled);
      if (escolha) fireEvent.change(seletor, { target: { value: escolha.value } });
    }
  }
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar equipamentos SRD 2014' }));
};
const escolherPericiasDeGuerreiro = async () => {
  irEtapa('Classe');
  const proficiencias = (await screen.findByText(/Proficiências de Guerreiro — escolha/)).closest('fieldset')!;
  fireEvent.click(within(proficiencias).getByRole('checkbox', { name: 'Atletismo' }));
  fireEvent.click(within(proficiencias).getByRole('checkbox', { name: 'Percepção' }));
};
const itensDaFicha = () => {
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Seções da ficha' })).getByRole('button', { name: 'Inventário' }));
  return within(screen.getByRole('region', { name: 'Inventário do personagem' }));
};
const montar = async (user = me) => { localStorage.setItem(activeKey(user.id), 'ca'); return renderApp({ user, api: apiC(jogador), registros: registrosEmMemoria('jogador', user.id, [], { dados: [] }) }); };
const abrirPersonagens = async () => { await waitFor(() => expect(menu().getByRole('button', { name: 'Personagens' })).toBeTruthy()); fireEvent.click(menu().getByRole('button', { name: 'Personagens' })); };
const novoGuiado = async () => { fireEvent.click(await screen.findByRole('button', { name: /Criar personagem/ })); return screen.findByLabelText('Nome do personagem'); };
const preencherFicha = async (nome: string) => {
  fireEvent.change(await screen.findByLabelText('Nome do personagem'), { target: { value: nome } });
  await escolherPericiasDeGuerreiro();
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
    expect(await screen.findByRole('navigation', { name: 'Etapas do personagem' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ativar opções SRD 2014' })).toBeNull();
  });

  it('fluxo por etapas: escolhas, equipamento do catálogo oficial, identidade pública, salvar, ficha com os itens e reabrir', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado();
    await preencherFicha('Thorin');
    irEtapa('Revisão');
    const pendentes = () => screen.getByRole('region', { name: 'Escolhas pendentes' }).textContent!;
    expect(pendentes()).toMatch(/Confirme o equipamento inicial da classe/);

    irEtapa('Equipamentos iniciais');
    const equipamentoSRD = await screen.findByLabelText('Equipamento inicial SRD 2014');
    expect(within(equipamentoSRD).getByRole('button', { name: 'Confirmar equipamentos SRD 2014' })).toBeTruthy();
    await confirmarEquipamentoDaClasse();
    expect(await screen.findByText(/Equipamento inicial da classe já confirmado/)).toBeTruthy();   // não há como conceder de novo
    expect(screen.queryByRole('button', { name: 'Confirmar equipamentos SRD 2014' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar equipamento da origem' }));
    expect((screen.getByRole('button', { name: 'Atualizar símbolo sagrado da origem' }) as HTMLButtonElement)).toBeTruthy();

    irEtapa('Revisão');
    expect(screen.queryByRole('region', { name: 'Escolhas pendentes' })?.textContent ?? '').not.toMatch(/equipamento/i);
    expect(screen.getByText(/nunca aparecem/)).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Publicar/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Visibilidade Classe'), { target: { value: 'hidden' } });
    fireEvent.change(screen.getByLabelText('Visibilidade Alcunha'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Alcunha pública'), { target: { value: 'O Escudo de Pedra' } });
    const previa = within(screen.getByRole('region', { name: 'Prévia para outros jogadores' }));
    expect(previa.queryByText(/Guerreiro/)).toBeNull(); expect(previa.queryByText(/PV|Cota de malha/i)).toBeNull(); expect(previa.getByText(/Nível 1/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Personagem salvo neste navegador \(armazenamento experimental\)|Rascunho incompleto salvo/)).toBeTruthy();
    await waitFor(() => expect(abas()).toContain('Thorin'));
    const chaves = [...Array(localStorage.length).keys()].map(i => localStorage.key(i)!).filter(k => k.startsWith('compendio5e:experimental:criador:'));
    expect(chaves).toHaveLength(1); expect(chaves[0]).toContain(`:${me.id}:ca:`);

    cleanup(); await montar(); await abrirPersonagens();
    fireEvent.click(await screen.findByRole('button', { name: /^Thorin/ }));
    await screen.findByTestId('ficha-guiada-leitura');
    const itens = itensDaFicha();
    for (const nome of ['Cota de malha', 'Besta leve', 'Mochila']) expect(itens.getByRole('button', { name: `Detalhes de ${nome}` })).toBeTruthy();
    // detalhes com a MESMA definição do Compêndio, em nova aba
    fireEvent.click(itens.getByRole('button', { name: 'Detalhes de Cota de malha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir no Compêndio: Cota de malha' }));
    expect(await screen.findByRole('heading', { name: 'Cota de malha' })).toBeTruthy();
    expect(abas()).toContain('Cota de malha');
    const fatos = within(document.querySelector('.item-fatos') as HTMLElement);
    expect(fatos.getByText('Classe de Armadura').nextSibling?.textContent).toBe('16');
    expect(document.body.textContent).toContain('srd-2014:item:chain-mail:1');
  });

  it('os botões do criador e do inventário têm nome acessível que contém o texto visível (WCAG 2.5.3)', async () => {
    await montar(); await abrirPersonagens();
    expect(nomesDivergentes(await screen.findByRole('region', { name: 'Personagens da campanha' }))).toEqual([]);
    await novoGuiado(); await preencherFicha('Thorin');
    for (const etapa of ['Identidade', 'Raça', 'Classe', 'Origem', 'Atributos', 'Equipamentos iniciais', 'Revisão']) {
      irEtapa(etapa);
      expect(nomesDivergentes(document.querySelector('.criador') as HTMLElement).filter(x => !/^"\+|^"−/.test(x)), etapa).toEqual([]);
    }
  });

  it('erro de salvamento não perde o que foi digitado', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado(); await preencherFicha('Thorin');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Cota de armazenamento excedida.'); });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Cota de armazenamento excedida\. Suas alterações continuam na tela\./)).toBeTruthy();
    irEtapa('Identidade');
    expect((screen.getByLabelText('Nome do personagem') as HTMLInputElement).value).toBe('Thorin');
    expect(screen.getByText('Alterações não salvas.')).toBeTruthy();
  });

  it('exige nome para salvar e valida a compra de pontos sem alterar o rascunho', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Informe o nome/)).toBeTruthy();
    irEtapa('Atributos');
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


it('ficha de versão anterior abre sem regravar e pede a atualização das regras antes de editar', async()=>{
 const {catalog,ids}=buildPilotCharacterCatalog(criadorRules,{race:criadorRefs.race,background:criadorRefs.background,class:criadorRefs.class},fighter2014Advancements);
 const store=armazenamentoLocalExperimental(me.id,'ca');
 const inventory=[{id:'reliquia',itemId:'dagger',quantity:2,equipped:false,origin:'acquired' as const}];
 store.salvar({schemaVersion:1,savedAt:'2026-11-20T00:00:00Z',identity:defaultPublicIdentity(),draft:{id:'antiga',name:'Veterana',ruleset:'5e-2014',catalogueVersion:catalog.version,baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,level:1,decisions:[],inventory,currentHp:13,temporaryHp:0,spentResources:{},currency:{cp:0,sp:0,gp:7}}});
 const before=structuredClone(store.carregar('antiga'));
 await montar();await abrirPersonagens();fireEvent.click(await screen.findByRole('button',{name:/^Veterana/}));
 fireEvent.click(await screen.findByRole('button',{name:'Editar personagem'}));
 expect(await screen.findByRole('button',{name:'Ativar opções SRD 2014'})).toBeTruthy();
 expect(store.carregar('antiga')).toEqual(before);
});

describe('atributos rolados', () => {
  it('valores acima de 15 no método manual não quebram a etapa de atributos', async () => {
    await montar(); await abrirPersonagens(); await novoGuiado(); irEtapa('Atributos');
    fireEvent.change(await screen.findByLabelText('Método de atributos'), { target: { value: 'manual' } });
    fireEvent.change(screen.getByLabelText('Atributo str'), { target: { value: '18' } });
    expect((screen.getByLabelText('Atributo str') as HTMLInputElement).value).toBe('18');
    expect(screen.queryByText(/Pontos gastos/)).toBeNull();
  });
});
