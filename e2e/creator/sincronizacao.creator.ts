// Mestre (Iniciativa) e jogador (ficha) em DUAS abas do mesmo navegador, sobre as fichas de demonstração (`&fichas=1`): a mesma fonte de
// PV, temporários e condições, em tempo real e depois de recarregar. As políticas reais do banco são testadas em `supabase/` e no CI com
// Supabase isolado; aqui se prova a interface de ponta a ponta.
import { test, expect, navigate, abaDaFicha, acaoDoItem, expectNoHorizontalOverflow, evidence, isMobile } from './helpers';
import { campaignName } from '../fixtures';
import type { Page } from '@playwright/test';

const CAMPANHA = '11111111-1111-4111-8111-111111111111';
const ficha = (id: string, nome: string, itens: unknown[] = []) => ({
  id, name: nome, ruleset: '5e-2014', catalogueVersion: 'character-srd-2014-v2', baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  raceId: 'human', backgroundId: 'acolyte', classId: 'fighter', level: 1, decisions: [], currentHp: 12, temporaryHp: 0, spentResources: {}, inventory: itens, currency: { cp: 0, sp: 0, gp: 10 },
});
const nota = (id: string, nome: string) => {
  const real = { mode: 'real' };
  return { id, kind: 'character', campaignId: CAMPANHA, ownerId: 'demo-jogador', title: nome, content: [], visibility: 'campaign', version: 1, createdAt: '2026-11-26T10:00:00Z', updatedAt: '2026-11-26T10:00:00Z',
    meta: { guiado: true, identidadePublica: { settings: { imageUrl: null, title: '', name: real, surname: real, race: real, characterClass: real, level: real, description: '' }, card: { imageUrl: null, title: '', name: nome, surname: null, race: 'Humano', characterClass: 'Guerreiro', level: '1', description: '' } } } };
};
async function abrir(page: Page, papel: 'mestre' | 'jogador') {
  await page.goto(`?demo=${papel}&fichas=1&nuvem=1`);
  await expect(page.getByRole('heading', { name: campaignName, exact: true })).toBeVisible();
}
async function semear(page: Page) {
  const fichas = [
    { id: 'pj-lydia', campaignId: CAMPANHA, ownerId: 'demo-jogador', revision: 1, updatedAt: '2026-11-26T10:00:00Z', draft: ficha('pj-lydia', 'Lydia Sync', [{ id: 'p', itemId: 'potion-of-healing-common', quantity: 2, equipped: false, origin: 'acquired' }, { id: 'f', itemId: 'arrow', quantity: 20, equipped: false, origin: 'acquired' }]) },
    { id: 'pj-toran', campaignId: CAMPANHA, ownerId: 'demo-jogador', revision: 1, updatedAt: '2026-11-26T10:00:00Z', draft: ficha('pj-toran', 'Toran Sync') },
  ];
  await abrir(page, 'jogador');
  await page.evaluate(([f, n]) => {
    localStorage.setItem('demo:fichas:v1', JSON.stringify({ fichas: f }));
    localStorage.setItem('demo:registros:v2', JSON.stringify(n));
    localStorage.setItem('demo:moedas:v1', JSON.stringify(['cp', 'sp', 'gp']));
  }, [fichas, [nota('pj-lydia', 'Lydia Sync'), nota('pj-toran', 'Toran Sync')]] as const);
  await page.reload();
  await expect(page.getByRole('heading', { name: campaignName, exact: true })).toBeVisible();
}
async function abrirFicha(page: Page) {
  await navigate(page, 'Personagens');
  await page.getByRole('button', { name: /^Lydia Sync/ }).first().click();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
}
const guardada = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('demo:fichas:v1')!).fichas[0] as { revision: number; draft: { currentHp: number; temporaryHp: number; play?: { condicoes?: string[] } } });

test('ficha e iniciativa são o mesmo estado: dano, cura, temporários e condições nos dois sentidos, sem recarregar', async ({ page, context }, info) => {
  test.skip(isMobile(page), 'A Iniciativa do mestre é validada no computador; o celular do jogador é coberto abaixo.');
  await semear(page); await abrirFicha(page);
  const mestre = await context.newPage();
  await abrir(mestre, 'mestre');
  await navigate(mestre, 'Início');
  await mestre.getByRole('button', { name: /Iniciativa/ }).first().click();
  const busca = mestre.getByLabel('Buscar combatentes');
  await mestre.getByRole('group', { name: 'Fontes de combatentes' }).getByRole('button', { name: 'Personagens' }).click();
  await busca.focus();
  await mestre.getByRole('button', { name: 'Adicionar Lydia Sync (personagem)' }).click();
  const pvMestre = mestre.getByLabel('PV de Lydia Sync', { exact: true });
  await expect(pvMestre).toHaveText('PV 12/12');
  await expect(mestre.getByRole('button', { name: 'Definir PV temporários de Lydia Sync' })).toBeVisible();

  // mestre → jogador
  const quantia = mestre.getByLabel('Quantidade de dano ou cura de Lydia Sync');
  await quantia.fill('4'); await mestre.getByRole('button', { name: 'Definir PV temporários de Lydia Sync' }).click();
  await expect(page.getByTestId('ficha-pv-temp')).toHaveText('+4 temporários');
  await quantia.fill('7'); await mestre.getByRole('button', { name: 'Causar dano a Lydia Sync' }).click();   // 4 temporários + 3 PV
  await expect(page.getByTestId('ficha-pv')).toHaveText('9 / 12');
  await expect(page.getByTestId('ficha-pv-temp')).toHaveCount(0);
  await mestre.getByLabel('Adicionar condição a Lydia Sync').selectOption('Envenenado');
  await expect(page.getByRole('button', { name: 'Remover condição Envenenado' })).toBeVisible();
  await expect(page.getByText(/Estado em combate|PV em combate/)).toHaveCount(0);

  // jogador → mestre
  await page.getByRole('spinbutton', { name: 'Quantidade de pontos de vida' }).fill('2');
  await page.getByRole('button', { name: 'Curar', exact: true }).click();
  await expect(pvMestre).toHaveText('PV 11/12');
  await page.getByRole('button', { name: 'Remover condição Envenenado' }).click();
  await expect(mestre.getByRole('button', { name: 'Remover condição Envenenado de Lydia Sync' })).toHaveCount(0);

  // alterações quase simultâneas se somam
  await quantia.fill('3');
  await page.getByRole('spinbutton', { name: 'Quantidade de pontos de vida' }).fill('1');
  await Promise.all([mestre.getByRole('button', { name: 'Causar dano a Lydia Sync' }).click(), page.getByRole('button', { name: 'Aplicar dano' }).click()]);
  await expect(pvMestre).toHaveText('PV 7/12');
  await expect(page.getByTestId('ficha-pv')).toHaveText('7 / 12');
  expect(await guardada(page)).toMatchObject({ revision: 1, draft: { currentHp: 7, temporaryHp: 0 } });

  await evidence(mestre, info, 'iniciativa-sincronizada'); await evidence(page, info, 'ficha-sincronizada');
  // recarregar o jogador e finalizar o combate não mudam nada
  await page.reload();   // o aplicativo reabre onde estava, já com o estado do servidor
  await expect(page.getByTestId('ficha-pv')).toHaveText('7 / 12');
  mestre.once('dialog', d => void d.accept());
  await mestre.getByRole('button', { name: 'Mais ações do combate' }).click();
  await mestre.getByRole('button', { name: /Finalizar combate/ }).click();
  await expect(mestre.getByText('Nenhum combatente ainda')).toBeVisible();
  await expect(page.getByTestId('ficha-pv')).toHaveText('7 / 12');
  await expectNoHorizontalOverflow(mestre);
  // o jogador não tem acesso à iniciativa
  await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Iniciativa' })).toHaveCount(0);
});

test('poção e transferência: curam, baixam a quantidade, vão para o outro personagem e ficam no histórico', async ({ page }, info) => {
  await semear(page);
  await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('demo:fichas:v1')!); g.fichas[0].draft.currentHp = 3; localStorage.setItem('demo:fichas:v1', JSON.stringify(g)); });
  await page.reload(); await expect(page.getByRole('heading', { name: campaignName, exact: true })).toBeVisible();
  if (isMobile(page)) { await navigate(page, 'Personagens'); await page.getByRole('button', { name: /^Lydia Sync/ }).first().click(); await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible(); }
  else await abrirFicha(page);
  await abaDaFicha(page, 'Inventário').click();
  await expect(page.getByTestId('saldo-desativado')).toHaveCount(0);
  await expect(page.getByLabel('Moedas de platina (PL)')).toHaveCount(0);
  const pocao = (await page.getByRole('listitem', { name: /^poção de cura$/i }).getAttribute('aria-label'))!;
  await acaoDoItem(page, pocao, 'Usar');
  await page.getByRole('dialog').getByRole('spinbutton').fill('5');
  await page.getByRole('dialog').getByRole('button', { name: /^Curar Lydia Sync em 5 PV/ }).dblclick();
  await expect(page.getByTestId('ficha-pv')).toHaveText('8 / 12');
  await expect(page.getByRole('listitem', { name: pocao, exact: true })).toContainText('×1');
  await acaoDoItem(page, 'Flecha', 'Transferir');
  const janela = page.getByRole('dialog', { name: 'Transferir Flecha' });
  await janela.getByRole('radio', { name: 'Toran Sync' }).check();
  await janela.getByRole('spinbutton').fill('5');
  await evidence(page, info, 'transferir');
  await janela.getByRole('button', { name: 'Transferir 5 para Toran Sync' }).click();
  await expect(page.getByRole('listitem', { name: 'Flecha', exact: true })).toContainText('×15');
  await page.getByText(/Histórico de movimentações/).click();
  await expect(page.getByRole('region', { name: 'Histórico de movimentações' })).toContainText('Enviou 5× Flecha para Toran Sync');
  const destino = await page.evaluate(() => JSON.parse(localStorage.getItem('demo:fichas:v1')!).fichas[1].draft.inventory as { itemId: string; quantity: number }[]);
  expect(destino).toEqual([expect.objectContaining({ itemId: 'arrow', quantity: 5 })]);
  await expectNoHorizontalOverflow(page);
});
