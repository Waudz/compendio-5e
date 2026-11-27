import AxeBuilder from '@axe-core/playwright';
import { test, expect, startCreator, completarGuerreira, salvarParaFicha, irEtapa, abaDaFicha, acaoDoItem, openEditor, evidence, navigate,
  expectNoHorizontalOverflow, expectInsidePanel } from './helpers';
import type { Page } from '@playwright/test';

const verificador = (page: Page, info: Parameters<typeof evidence>[1]) => {
  const scans: { screen: string; violations: unknown[] }[] = [];
  return { scans, scan: async (screen: string) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    scans.push({ screen, violations: result.violations });
    await evidence(page, info, screen);
  } };
};

test('WCAG: todas as etapas da criação, a ficha, as janelas do inventário, a subida de nível e o item no Compêndio', async ({ page }, info) => {
  test.setTimeout(90_000);
  await startCreator(page); await completarGuerreira(page);
  const { scans, scan } = verificador(page, info);
  for (const etapa of ['Identidade', 'Raça', 'Classe', 'Origem', 'Atributos', 'Equipamentos iniciais', 'Revisão', 'História']) { await irEtapa(page, etapa); await scan(`etapa-${etapa}`); }
  await salvarParaFicha(page);
  for (const aba of ['Ficha', 'Habilidades', 'Inventário']) { await abaDaFicha(page, aba).click(); await scan(`ficha-${aba}`); }
  await acaoDoItem(page, 'Arco longo', 'Ver detalhes'); await scan('item-detalhes');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();
  await openEditor(page); await scan('edicao');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Subir de nível', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Etapas da subida de nível' })).toBeVisible(); await scan('subir-nivel');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await abaDaFicha(page, 'Inventário').click();
  await acaoDoItem(page, 'Arco longo', 'Ver detalhes');
  await page.getByRole('button', { name: 'Abrir no Compêndio: Arco longo' }).click();
  await expect(page.getByRole('heading', { name: 'Arco longo', exact: true })).toBeVisible(); await scan('item');
  await info.attach('axe-criador', { body: JSON.stringify(scans, null, 2), contentType: 'application/json' });
  expect(scans.flatMap(s => s.violations.map(v => ({ screen: s.screen, violation: v })))).toEqual([]);
});

test('responsividade: controles cabem no painel e o Compêndio alterna lista/grade', async ({ page }, info) => {
  await startCreator(page); await completarGuerreira(page);
  for (const etapa of ['Raça', 'Classe', 'Origem', 'Atributos', 'Equipamentos iniciais', 'Revisão', 'História']) { await irEtapa(page, etapa); await expectInsidePanel(page); }
  await salvarParaFicha(page);
  await abaDaFicha(page, 'Inventário').click();
  await expectInsidePanel(page, '.ficha-jogo'); await expectNoHorizontalOverflow(page); await evidence(page, info, 'inventario-limites');
  await navigate(page, 'Compêndio');
  const regras=page.getByRole('button',{name:'Regras',exact:true});
  if(await regras.count())await regras.click();
  await page.getByRole('button',{name:/^Itens /}).click();
  const search = page.getByRole('searchbox', { name: 'Pesquisar no Compêndio', exact: true });
  await expect(search).toBeVisible(); await search.fill('dagger');
  const cartaoAdaga = page.getByRole('button', { name: /^Adaga/ }).first();
  await expect(cartaoAdaga).toBeVisible();
  await page.getByRole('button', { name: 'Visualizar em grade', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Visualizar em lista', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Resultados do Compêndio' })).toHaveAttribute('data-view', 'grade');
  await cartaoAdaga.click();
  await expect(page.getByRole('article', { name: 'Detalhes de Adaga' })).toBeVisible();
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'compendio-grade');
});
