import AxeBuilder from '@axe-core/playwright';
import { test, expect, startCreator, chooseFighter, showSection, equip, evidence, navigate,
  expectNoHorizontalOverflow } from './helpers';

test('WCAG: nomes acessíveis e semântica do criador, equipamento, inventário e Compêndio', async ({ page }, info) => {
  await startCreator(page); await chooseFighter(page);
  const scans: { screen: string; violations: unknown[] }[] = [];
  const scan = async (screen: string) => {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    scans.push({ screen, violations: result.violations });
    await evidence(page, info, screen);
  };
  await scan('ficha'); await showSection(page, 'Equipamento inicial'); await scan('equipamento');
  await equip(page); await showSection(page, 'Inventário'); await scan('inventario');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar no Compêndio: Arco longo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Arco longo', exact: true })).toBeVisible(); await scan('item');
  await info.attach('axe-criador', { body: JSON.stringify(scans, null, 2), contentType: 'application/json' });
  expect(scans.flatMap(s => s.violations.map(v => ({ screen: s.screen, violation: v })))).toEqual([]);
});

test('responsividade: controles úteis cabem no painel e Compêndio alterna lista/grade', async ({ page }, info) => {
  await startCreator(page); await chooseFighter(page); await equip(page); await showSection(page, 'Inventário');
  // Root scrollWidth sozinho não detecta conteúdo cortado por overflow:hidden no workspace.
  const inventory = page.getByRole('region', { name: 'Inventário', exact: true });
  const right = await inventory.evaluate(el => el.getBoundingClientRect().right);
  for (const control of await inventory.getByRole('button').all()) {
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox(); expect(box).not.toBeNull();
    expect.soft(box!.x, 'controle não deve sair pela esquerda').toBeGreaterThanOrEqual(0);
    expect.soft(box!.x + box!.width, 'controle não deve ultrapassar o painel').toBeLessThanOrEqual(right + 1);
  }
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'inventario-limites');
  // Salvar antes de trocar de seção evita misturar este teste de layout com o guard.
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await navigate(page, 'Compêndio');
  const search = page.getByRole('searchbox', { name: 'Pesquisar no Compêndio', exact: true });
  await expect(search).toBeVisible(); await search.fill('dagger');
  const cartaoAdaga = page.getByRole('button', { name: /^Adaga/ }).first();
  await expect(cartaoAdaga).toBeVisible();
  await page.getByRole('button', { name: 'Grade', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Grade', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('list', { name: 'Resultados do Compêndio' })).toHaveAttribute('data-view', 'grade');
  await cartaoAdaga.click();
  await expect(page.getByRole('article', { name: 'Detalhes de Adaga' })).toBeVisible();
  await expectNoHorizontalOverflow(page); await evidence(page, info, 'compendio-grade');
});
