import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from './fixtures';

for (const role of ['mestre', 'jogador'] as const) {
  test(`responsividade ${role}: início, menu e Diário`, async ({ page }, testInfo) => {
    await openDemo(page, role);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('main')).toBeInViewport();
    if ((page.viewportSize()?.width ?? 1440) <= 700) {
      const nav = page.getByRole('navigation', { name: 'Navegação mobile' });
      await expect(nav).toBeInViewport({ ratio: 1 });
      await expect(nav.getByRole('button', { name: 'Menu', exact: true })).toBeInViewport({ ratio: 1 });
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Menu de navegação' });
      await expect(menu).toBeInViewport({ ratio: 1 });
      const close = menu.getByRole('button', { name: 'Fechar menu' });
      await expect(close).toBeInViewport({ ratio: 1 });
      await close.click();
    } else {
      await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeInViewport({ ratio: 1 });
    }
    await testInfo.attach('inicio', { body: await page.screenshot(), contentType: 'image/png' });
    await navigate(page, 'Diário');
    await expect(page.getByRole('heading', { name: 'Diário', exact: true })).toBeVisible();
    await expect(page.getByText('3ª Sessão — O Festival', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await testInfo.attach('diario', { body: await page.screenshot(), contentType: 'image/png' });
  });
}

test('troca de layout no limite de 700/701 px mantém a navegação acessível', async ({ page }) => {
  await openDemo(page);
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 701, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação mobile' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
