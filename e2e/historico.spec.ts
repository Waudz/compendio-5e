import { test, expect, openDemo, navigate, campaignName } from './fixtures';

// Voltar e Avançar do navegador dentro do aplicativo (desktop: seleção de abas; celular: telas). Não sai do app nem perde abas.
test('Voltar e Avançar do navegador percorrem as telas visitadas e não saem do aplicativo', async ({ page }, info) => {
  await openDemo(page);
  const inicio = page.getByRole('heading', { name: campaignName, exact: true });
  await navigate(page, 'Diário');
  await expect(page.getByRole('heading', { name: 'Diário', exact: true })).toBeVisible();
  await navigate(page, 'Compêndio');
  await expect(page.getByRole('heading', { name: 'Compêndio', exact: true })).toBeVisible();
  const url = page.url();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Diário', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Compêndio', exact: true })).toBeHidden();
  await page.goBack();
  await expect(inicio).toBeVisible();
  expect(page.url().split('?')[0]).toBe(url.split('?')[0]);   // continua no aplicativo
  // No celular só existe o gesto Voltar (o app consome o histórico interno e não oferece Avançar): Avançar é verificado só no desktop.
  if (info.project.name === 'celular') return;
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Diário', exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Compêndio', exact: true })).toBeVisible();
});
