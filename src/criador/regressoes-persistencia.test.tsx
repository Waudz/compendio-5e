// @vitest-environment jsdom
// Contratos da main: API de fichas em memória e UI real, sem rede ou contas reais.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { CampaignApi } from '../campaigns';
import { activeKey } from '../CampaignsContext';
import { fichasEmMemoria, novoBancoFichas } from '../fichasMemoria';
import { registrosEmMemoria } from '../registrosMemoria';
import { me, memoryStorage, renderApp } from '../testUtils';
import { defaultPublicIdentity } from '../rules/public-identity';
import type { CharacterDraft } from '../rules/character-domain';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, '', '/');
  localStorage.setItem(activeKey(me.id), 'ca');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function abrirExistente() {
  const banco = novoBancoFichas();
  const api = fichasEmMemoria(me.id, banco);
  const draft: CharacterDraft = {
    id: 'id-provisorio', name: 'Lira', ruleset: '5e-2014', catalogueVersion: 'character-srd-2014-v2',
    classId: 'fighter', raceId: 'human', backgroundId: 'acolyte', level: 3,
    baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
    decisions: [], currentHp: 12, temporaryHp: 2, spentResources: { 'second-wind': 1 },
    currency: { cp: 9, sp: 5, gp: 20 },
    inventory: [
      { id: 'instancia-inicial', itemId: 'dagger', customName: 'Relíquia inicial', quantity: 1, equipped: true, origin: 'starting' },
      { id: 'instancia-adquirida', itemId: 'dagger', customName: 'Relíquia adquirida', quantity: 3, equipped: false, origin: 'acquired' },
    ],
  };
  draft.previousRulesDraft = { ...structuredClone(draft), name: 'Memória privada anterior' };
  const identity = { ...defaultPublicIdentity(), title: 'Rosto conhecido', name: { mode: 'custom' as const, customValue: 'Viajante' }, surname: { mode: 'hidden' as const }, race: { mode: 'hidden' as const }, characterClass: { mode: 'hidden' as const } };
  const criado = await api.criar('ca', draft, { identity, source: { name: draft.name, surname: '', race: 'Humano', characterClass: 'Guerreiro' }, publicar: true });
  if (!criado.ok) throw new Error(criado.error);
  const apiCampanhas = { list: async () => ({ ok: true, data: [{ role: 'jogador', campaign: { id: 'ca', name: 'Mesa de teste', description: '', created_at: '' } }] }) } as unknown as CampaignApi;
  await renderApp({ user: me, api: apiCampanhas, fichas: api, registros: registrosEmMemoria('jogador', me.id, [], banco.registros) });
  const menu = within(await screen.findByRole('navigation', { name: 'Menu principal' }));
  fireEvent.click(menu.getByRole('button', { name: 'Personagens' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir ficha guiada Lira' }));
  const nome = await waitFor(() => {
    const campo = screen.queryByLabelText('Nome do personagem') as HTMLInputElement | null;
    if (campo) return campo;
    const editar = screen.queryByRole('button', { name: 'Editar personagem' });
    if (editar) fireEvent.click(editar);
    return screen.getByLabelText('Nome do personagem') as HTMLInputElement;
  });
  await screen.findByRole('combobox', { name: 'Classe' });
  return { banco, api, nome, id: criado.data.id };
}
const salvar = () => fireEvent.click(screen.getByRole('button', { name: /^Salvar$/ }));
const botaoSalvar = () => screen.getByRole('button', { name: /^Salvar$/ }) as HTMLButtonElement;

it('não apresenta edição como persistida enquanto a requisição de salvar aguarda confirmação', async () => {
  const { banco, api, nome } = await abrirExistente();
  const persistido = structuredClone(banco.fichas[0]);
  const salvarReal = api.salvar.bind(api);
  let concluir!: () => void;
  const pendente = new Promise<void>(resolve => { concluir = resolve; });
  const chamada = vi.spyOn(api, 'salvar').mockImplementationOnce(async (...args) => { await pendente; return salvarReal(...args); });
  try {
    fireEvent.change(nome, { target: { value: 'Lira em edição' } });
    salvar();
    await waitFor(() => expect(chamada).toHaveBeenCalledTimes(1));
    expect(nome.value).toBe('Lira em edição');
    expect((screen.getByRole('button', { name: /^Salvando…$/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Alterações não salvas.')).toBeTruthy();
    expect(banco.fichas[0]).toEqual(persistido);
  } finally {
    await act(async () => { concluir(); });
  }
  await waitFor(() => expect(banco.fichas[0].revision).toBe(2));
  await waitFor(() => expect(botaoSalvar().disabled).toBe(true));
  expect(banco.fichas[0].draft.name).toBe('Lira em edição');
  expect(screen.queryByText('Alterações não salvas.')).toBeNull();
});

it('cancelar a troca de classe não suja a ficha nem reinicia recursos ou inventário', async () => {
  const { banco, api } = await abrirExistente();
  const persistido = structuredClone(banco.fichas[0]);
  const gravar = vi.spyOn(api, 'salvar');
  fireEvent.change(screen.getByRole('combobox', { name: 'Classe' }), { target: { value: 'wizard' } });
  const confirmacao = await screen.findByRole('region', { name: 'Confirmar classe' });
  fireEvent.click(within(confirmacao).getByRole('button', { name: 'Cancelar troca de classe' }));
  expect(screen.queryByRole('region', { name: 'Confirmar classe' })).toBeNull();
  expect((screen.getByRole('combobox', { name: 'Classe' }) as HTMLSelectElement).value).toBe('fighter');
  expect(botaoSalvar().disabled).toBe(true);
  expect(screen.queryByText('Alterações não salvas.')).toBeNull();
  const secoes = within(screen.getByRole('navigation', { name: 'Seções do personagem' }));
  fireEvent.click(secoes.getByRole('button', { name: 'Inventário' }));
  const linhas = within(screen.getByRole('region', { name: 'Inventário' })).getAllByRole('listitem');
  expect(linhas).toHaveLength(2);
  expect(linhas.map(linha => linha.textContent)).toEqual([
    expect.stringContaining('Relíquia inicial · quantidade 1'),
    expect.stringContaining('Relíquia adquirida · quantidade 3'),
  ]);
  expect(gravar).not.toHaveBeenCalled();
  expect(banco.fichas[0]).toEqual(persistido);
});

it('renomear mantém IDs e duas instâncias do mesmo item, sem republicar dados privados ou o histórico de regras', async () => {
  const { banco, nome, id } = await abrirExistente();
  const ficha = structuredClone(banco.fichas[0]);
  const publico = structuredClone(banco.registros.dados[0]);
  fireEvent.change(nome, { target: { value: 'Lira revisada' } });
  salvar();
  await waitFor(() => expect(banco.fichas[0].revision).toBe(2));
  await waitFor(() => expect(botaoSalvar().disabled).toBe(true));
  expect(banco.fichas).toHaveLength(1);
  expect(banco.fichas[0]).toMatchObject({ id, campaignId: ficha.campaignId, ownerId: ficha.ownerId });
  expect(banco.fichas[0].draft).toEqual({ ...ficha.draft, name: 'Lira revisada' });
  expect(banco.fichas[0].draft.inventory.map(item => item.id)).toEqual(['instancia-inicial', 'instancia-adquirida']);
  expect(banco.registros.dados).toHaveLength(1);
  expect(banco.registros.dados[0]).toMatchObject({ id: publico.id, title: publico.title, meta: publico.meta });
  expect(JSON.stringify(banco.registros.dados[0])).not.toMatch(/Relíquia|Memória privada|Lira revisada|previousRulesDraft|baseAbilities|inventory|spentResources|currency/);
});
