// @vitest-environment jsdom
// Compêndio real (seção e página de item) na navegação do aplicativo: busca, filtros, lista/grade, detalhes, links entre itens.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CampaignApi, Membership } from './campaigns';
import { activeKey } from './CampaignsContext';
import { storageKey } from './persistence';
import { me, memoryStorage, renderApp } from './testUtils';

const camp = { id: 'ca', name: 'Mesa dos Dragões', description: 'Desc.', created_at: '' };
const mestre: Membership = { role: 'mestre', campaign: camp };
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
const abas = () => [...document.querySelectorAll(strip)].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ''));
const menu = () => within(screen.getByRole('navigation', { name: 'Menu principal' }));
const montar = () => renderApp({ api: apiC(mestre) });
const abrirCompendio = async () => { await waitFor(() => expect(menu().getByRole('button', { name: 'Compêndio' })).toBeTruthy()); fireEvent.click(menu().getByRole('button', { name: 'Compêndio' })); await screen.findByRole('heading', { name: 'Compêndio' }); };
const pesquisar = (t: string) => fireEvent.change(screen.getByLabelText('Pesquisar no Compêndio'), { target: { value: t } });
const resultados = () => within(screen.getByRole('list', { name: 'Resultados do Compêndio' })).queryAllByRole('listitem');

describe('Compêndio na navegação real', () => {
  it('a seção deixa de ser placeholder: mostra o catálogo, pagina a lista e informa a fonte', async () => {
    await montar(); await abrirCompendio();
    expect(screen.queryByText(/ainda não foi desenvolvido/)).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('578 resultados (mostrando 60)');
    expect(resultados()).toHaveLength(60);
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(resultados()).toHaveLength(120);
    expect(screen.getByText(/SRD 5.1 \(2014\)/)).toBeTruthy();
  });

  it('pesquisa por nome em português (sem acento), em inglês e sem resultado', async () => {
    await montar(); await abrirCompendio();
    pesquisar('rapieira'); expect(resultados()).toHaveLength(1); expect(screen.getByRole('button', { name: 'Abrir Rapieira' })).toBeTruthy();
    pesquisar('longsword'); expect(screen.getByRole('button', { name: 'Abrir Espada longa' })).toBeTruthy();
    pesquisar('RAÇÕES'); expect(screen.getByRole('button', { name: /Abrir Rações/ })).toBeTruthy();
    pesquisar('zzzz-inexistente'); expect(resultados()).toHaveLength(0); expect(screen.getByTestId('compendio-vazio')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('0 resultados');
  });

  it('filtros por categoria e raridade combinam com a busca; mudar o filtro volta à primeira página', async () => {
    await montar(); await abrirCompendio();
    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: 'armadura' } });
    expect(screen.getByRole('status').textContent).toBe('12 resultados');
    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: 'escudo' } });
    expect(resultados().map(l => l.textContent)).toEqual([expect.stringContaining('Escudo')]);
    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filtrar por raridade'), { target: { value: 'legendary' } });
    expect(screen.getByRole('status').textContent).toBe('42 resultados');
    pesquisar('espada'); expect(resultados().length).toBeGreaterThan(0); expect(resultados().length).toBeLessThan(42);
  });

  it('alterna lista/grade mantendo o mesmo conteúdo', async () => {
    await montar(); await abrirCompendio();
    const lista = screen.getByRole('list', { name: 'Resultados do Compêndio' });
    expect(lista.getAttribute('data-view')).toBe('lista');
    fireEvent.click(screen.getByRole('button', { name: /Grade/ }));
    expect(lista.getAttribute('data-view')).toBe('grade');
    expect(screen.getByRole('button', { name: /Grade/ }).getAttribute('aria-pressed')).toBe('true');
    expect(resultados()).toHaveLength(60);
  });

  it('abrir um item cria a aba com o nome do item e mostra os dados da definição compartilhada', async () => {
    await montar(); await abrirCompendio();
    pesquisar('espada longa'); fireEvent.click(screen.getByRole('button', { name: 'Abrir Espada longa' }));
    expect(await screen.findByRole('heading', { name: 'Espada longa' })).toBeTruthy();
    expect(abas()).toEqual(['Compêndio', 'Espada longa']);
    const fatos = within(document.querySelector('.item-fatos') as HTMLElement);
    expect(fatos.getByText('Dano').nextSibling?.textContent).toBe('1d8 cortante (1d10 com duas mãos)');
    expect(fatos.getByText('Custo').nextSibling?.textContent).toBe('15 po');
    expect(fatos.getByText('Peso').nextSibling?.textContent).toBe('1,5 kg');
    expect(screen.getByText(/Atribuição/)).toBeTruthy();
  });

  it('pacote lista os componentes como links para os itens; clicar abre o item', async () => {
    await montar(); await abrirCompendio();
    pesquisar('pacote de explorador'); fireEvent.click(screen.getByRole('button', { name: 'Abrir Pacote de Explorador' }));
    const pacote = within(await screen.findByRole('region', { name: 'Conteúdo do pacote' }));
    expect(pacote.getAllByRole('listitem')).toHaveLength(8);
    expect(pacote.getAllByRole('listitem').filter(l => l.textContent?.startsWith('10 ×'))).toHaveLength(2);   // 10 tochas e 10 rações
    fireEvent.click(pacote.getByRole('button', { name: 'Mochila' }));
    expect(await screen.findByRole('heading', { name: 'Mochila' })).toBeTruthy();
    expect(abas()).toContain('Mochila');
  });

  it('abas restauradas: item existente ganha o nome certo e item inexistente mostra erro claro (sem quebrar)', async () => {
    localStorage.setItem(storageKey({ user: me.id, campaign: 'ca', device: 'navegador' }), JSON.stringify({ version: 2, layout: { type: 'row', children: [{ type: 'tabset', id: 'grupo-1', weight: 100, active: true, selected: 1, children: [{ type: 'tab', id: 'item:longsword' }, { type: 'tab', id: 'item:nao-existe' }] }] } }));
    await montar();
    expect(await screen.findByText(/Item não encontrado no catálogo desta revisão/)).toBeTruthy();
    expect(abas()).toEqual(['Espada longa', 'Item nao-existe']);
  });

  it('inclui o Compêndio na navegação do jogador e do mestre (sem expor nada além do catálogo público de itens)', async () => {
    await montar(); await waitFor(() => expect(menu().getByRole('button', { name: 'Compêndio' })).toBeTruthy());
    cleanup();
    await renderApp({ api: apiC({ role: 'jogador', campaign: camp }) });
    await waitFor(() => expect(menu().getByRole('button', { name: 'Compêndio' })).toBeTruthy());
    expect(menu().queryByRole('button', { name: 'Iniciativa' })).toBeNull();
  });
});

describe('Compêndio no celular', () => {
  beforeEach(() => { mobile = true; });
  it('barra inferior abre o Compêndio, abrir item troca a tela e Voltar retorna à busca', async () => {
    await montar();
    const barra = () => within(screen.getByRole('navigation', { name: 'Navegação mobile' }));
    await waitFor(() => expect(document.querySelector('.mobile-page-title')?.textContent).toBe(camp.name));
    fireEvent.click(barra().getByRole('button', { name: 'Compêndio' }));
    await screen.findByLabelText('Pesquisar no Compêndio');
    pesquisar('escudo'); fireEvent.click(screen.getByRole('button', { name: 'Abrir Escudo' }));
    expect(await screen.findByRole('heading', { name: 'Escudo' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByLabelText('Pesquisar no Compêndio')).toBeTruthy();
  });
});
