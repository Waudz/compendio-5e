import AxeBuilder from '@axe-core/playwright';
import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from './fixtures';
import type { Page, Locator } from '@playwright/test';

const celular = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 700;
/** Retrato do Goblin (criatura com arte no catálogo): o clique no Bestiário do mestre abre a ficha, maximizada no computador. */
async function cartaDoGoblin(page: Page) {
  await openDemo(page, 'mestre');
  await navigate(page, 'Compêndio');
  await page.getByRole('button', { name: /^Bestiário / }).click();
  await page.getByRole('searchbox', { name: 'Pesquisar no Compêndio', exact: true }).fill('goblin');
  await page.getByRole('button', { name: /^Goblin /, exact: false }).first().click();
  if (!celular(page)) await page.getByRole('button', { name: 'Maximizar', exact: true }).click();
  return page.getByRole('region', { name: 'Resumo da criatura' });
}
const escala = (img: Locator) => img.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
const posicao = (img: Locator) => img.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return [Math.round(m.e), Math.round(m.f)]; });
/** Dois dedos sintéticos sobre a área do visualizador, afastando-se do centro. */
const pinca = (area: Locator, de: number, ate: number) => area.evaluate((el, [de, ate]) => {
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const dedo = (tipo: string, id: number, dx: number) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x + dx, clientY: y }));
  dedo('pointerdown', 11, -de); dedo('pointerdown', 12, de);
  for (let i = 1; i <= 5; i++) { const d = de + ((ate - de) * i) / 5; dedo('pointermove', 11, -d); dedo('pointermove', 12, d); }
  dedo('pointerup', 11, -ate); dedo('pointerup', 12, ate);
}, [de, ate]);

test('retrato em destaque e visualizador: zoom, arraste, pinça, restaurar, Esc e Voltar', async ({ page }, info) => {
  const carta = await cartaDoGoblin(page);
  const retrato = carta.getByRole('button', { name: 'Ampliar imagem de Goblin' });
  const caixa = (await retrato.boundingBox())!, disponivel = (await carta.boundingBox())!.width;
  expect(Math.abs(caixa.width - caixa.height)).toBeLessThan(3);
  expect(caixa.width).toBeLessThanOrEqual(disponivel);
  expect(caixa.width).toBeGreaterThanOrEqual(64);
  await expectNoHorizontalOverflow(page);

  await retrato.click();
  const janela = page.getByRole('dialog', { name: 'Imagem ampliada: Goblin' });
  const imagem = janela.getByRole('img', { name: 'Goblin', exact: true }), area = janela.locator('.visualizador-area');
  await expect(imagem).toBeVisible();
  expect(await imagem.evaluate(el => getComputedStyle(el).objectFit)).toBe('contain');
  const tela = page.viewportSize()!, j = (await janela.boundingBox())!;
  expect(j.width).toBeGreaterThanOrEqual(tela.width - 1); expect(j.height).toBeGreaterThanOrEqual(tela.height - 1);
  const axe = await new AxeBuilder({ page }).include('.visualizador').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);

  await janela.getByRole('button', { name: 'Ampliar', exact: true }).click();
  await expect.poll(() => escala(imagem)).toBeGreaterThan(1.3);
  await janela.getByRole('button', { name: 'Restaurar zoom' }).click();
  await expect.poll(() => escala(imagem)).toBe(1);
  if (!celular(page)) {
    const a = (await area.boundingBox())!, x = a.x + a.width / 2, y = a.y + a.height / 2;
    await page.mouse.move(x, y); await page.mouse.wheel(0, -400); await page.mouse.wheel(0, -400); await page.mouse.wheel(0, -400);
    await expect.poll(() => escala(imagem)).toBeGreaterThan(1.5);
    const antes = await posicao(imagem);
    await page.mouse.down(); await page.mouse.move(x + 90, y + 50, { steps: 5 }); await page.mouse.up();
    const depois = await posicao(imagem);
    expect(depois[0]).toBeGreaterThan(antes[0] + 40);
    await janela.getByRole('button', { name: 'Restaurar zoom' }).click();
  }
  await pinca(area, 40, 140);
  await expect.poll(() => escala(imagem)).toBeGreaterThan(2);
  await pinca(area, 140, 20);
  await expect.poll(() => escala(imagem)).toBe(1);
  await info.attach('visualizador', { body: await page.screenshot(), contentType: 'image/png' });

  // Esc fecha só o visualizador; a carta continua
  await page.keyboard.press('Escape');
  await expect(janela).toBeHidden();
  await expect(carta).toBeVisible();
  // Voltar do navegador com o visualizador aberto também só o fecha
  await retrato.click(); await expect(janela).toBeVisible();
  await page.goBack();
  await expect(janela).toBeHidden();
  await expect(carta).toBeVisible();
  // fechar pelo botão não deixa um passo morto: o Voltar seguinte sai da consulta
  await retrato.click(); await janela.getByRole('button', { name: 'Fechar imagem' }).click(); await expect(janela).toBeHidden();
  await expect(carta).toBeVisible();
  // a retirada do histórico é assíncrona: espera terminar antes de pedir o próximo Voltar
  await expect.poll(() => page.evaluate(() => !!(history.state as { compendioImagem?: boolean } | null)?.compendioImagem)).toBe(false);
  await page.goBack();
  await expect(carta).toBeHidden();
  await expect(page.getByRole('searchbox', { name: 'Pesquisar no Compêndio', exact: true })).toHaveValue('goblin');
});
