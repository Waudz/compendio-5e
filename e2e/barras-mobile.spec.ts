// Barras do celular: sem oscilar em rolagem rápida ou no fim da página, e sem conteúdo preso atrás delas.
import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';

const medida = (page: Page) => page.evaluate(() => {
  const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
  const tela = document.querySelector('.mobile-screen') as HTMLElement;
  return { altura: tela.clientHeight, max: tela.scrollHeight - tela.clientHeight, top: tela.scrollTop, topo: r('.mobile-topbar'), baixo: r('.mobile-bottom-nav'), ocultas: document.querySelector('.app')!.classList.contains('chrome-hidden') };
});
/** Conta quantas vezes as barras mudaram de estado. */
const vigiar = (page: Page) => page.evaluate(() => {
  const app = document.querySelector('.app')!; const w = window as unknown as { trocas: number }; w.trocas = 0; let antes = app.classList.contains('chrome-hidden');
  new MutationObserver(() => { const agora = app.classList.contains('chrome-hidden'); if (agora !== antes) { antes = agora; w.trocas++; } }).observe(app, { attributes: true, attributeFilter: ['class'] });
});
const trocas = (page: Page) => page.evaluate(() => (window as unknown as { trocas: number }).trocas);
const rolarAte = (page: Page, destino: 'fim' | 'inicio', passos: number) => page.evaluate(async ({ destino, passos }) => {
  const t = document.querySelector('.mobile-screen') as HTMLElement, ini = t.scrollTop, fim = destino === 'fim' ? t.scrollHeight : 0;
  for (let i = 1; i <= passos; i++) { t.scrollTop = ini + (fim - ini) * i / passos; await new Promise(r => requestAnimationFrame(r)); }
}, { destino, passos });

test('rolagem rápida até o fim: as barras mudam uma única vez, a área não muda de tamanho e o fim do conteúdo fica acessível', async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 700, 'Navegação do celular.');
  await openDemo(page); await navigate(page, 'Compêndio');
  await expect.poll(async () => (await medida(page)).max).toBeGreaterThan(300);
  const inicio = await medida(page);
  expect(inicio.ocultas).toBe(false); expect(inicio.topo.bottom).toBeGreaterThan(0);
  await vigiar(page);
  await rolarAte(page, 'fim', 6);
  await expect.poll(async () => (await medida(page)).ocultas).toBe(true);
  await page.waitForTimeout(900);   // tempo de sobra para qualquer ciclo de oscilação aparecer
  expect(await trocas(page)).toBe(1);
  const noFim = await medida(page);
  expect(noFim.altura).toBeGreaterThan(inicio.altura);   // ocultas: a área ocupa a tela toda...
  expect(Math.abs(noFim.max - inicio.max)).toBeLessThanOrEqual(1);   // ...sem mudar o limite da rolagem (era a causa da oscilação)
  expect(noFim.ocultas).toBe(true);
  // subir um pouco mostra as barras; voltar ao fim com elas visíveis deixa o último elemento acima da barra inferior
  await page.locator('.mobile-screen').evaluate(t => { t.scrollTop -= 60; });
  await expect.poll(async () => (await medida(page)).ocultas).toBe(false);
  await page.waitForTimeout(400);
  const livre = await page.evaluate(() => {
    const t = document.querySelector('.mobile-screen') as HTMLElement; t.scrollTop = t.scrollHeight;
    document.querySelector('.app')!.classList.remove('chrome-hidden');
    const fundo = Math.max(...[...t.querySelectorAll('.content *')].filter(e => (e as HTMLElement).offsetParent).map(e => e.getBoundingClientRect().bottom));
    const barra = document.querySelector('.mobile-bottom-nav') as HTMLElement; barra.style.transition = 'none';
    return fundo <= barra.getBoundingClientRect().top + 1;
  });
  expect(livre).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath('fim-da-pagina.png') });
});

test('no topo as barras aparecem e o começo do conteúdo não fica atrás do cabeçalho', async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 700, 'Navegação do celular.');
  await openDemo(page); await navigate(page, 'Compêndio');
  await expect.poll(async () => (await medida(page)).max).toBeGreaterThan(300);
  await rolarAte(page, 'fim', 4); await rolarAte(page, 'inicio', 4);
  await expect.poll(async () => (await medida(page)).ocultas).toBe(false);
  await page.waitForTimeout(400);
  const ok = await page.evaluate(() => {
    const cabecalho = document.querySelector('.mobile-topbar')!.getBoundingClientRect();
    return document.querySelector('.mobile-screen h1')!.getBoundingClientRect().top >= cabecalho.bottom - 1 && cabecalho.top >= 0;
  });
  expect(ok).toBe(true);
  await page.screenshot({ path: info.outputPath('topo.png') });
});
