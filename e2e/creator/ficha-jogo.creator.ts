import AxeBuilder from '@axe-core/playwright';
import { test, expect, startCreator, completarGuerreira, salvarParaFicha, acaoDoItem, expectSingleScroll, navigate, evidence, expectNoHorizontalOverflow, isMobile } from './helpers';
import type { Page } from '@playwright/test';

/** Guerreira anã completa → salvar → ficha de jogo. */
async function abrirFichaDeJogo(page: Page) {
  await startCreator(page); await completarGuerreira(page); await salvarParaFicha(page);
}
const abas = (page: Page) => page.getByRole('navigation', { name: 'Seções da ficha' });
const aba = (page: Page, nome: string) => abas(page).getByRole('button', { name: nome, exact: true });
/** Arrasto com um dedo, do jeito que o navegador entrega (eventos de toque reais). */
async function arrastar(page: Page, dx: number) {
  await page.locator('.ficha-conteudo').evaluate((el, delta) => {
    const alvo = el.querySelector('h2')!, r = alvo.getBoundingClientRect(), x = window.innerWidth / 2 - delta / 2, y = r.top + 4;
    const toque = (px: number) => new Touch({ identifier: 1, target: alvo, clientX: px, clientY: y });
    alvo.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [toque(x)], changedTouches: [toque(x)] }));
    alvo.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [toque(x + delta)] }));
  }, dx);
}

test('ficha de jogo: quatro abas, inventário na CA, sem estouro horizontal e com nomes acessíveis', async ({ page }, info) => {
  await abrirFichaDeJogo(page);
  await expect(abas(page).getByRole('button')).toHaveText(['Ficha', 'Habilidades', 'Inventário', 'Identidade']);
  const topo = page.getByRole('region', { name: 'Resumo do personagem' });
  await expect(topo).toContainText('Escudo de Pedra');
  await expect(page.getByTestId('ficha-pv')).toContainText('/');
  const violacoes: unknown[] = [];
  for (const nome of ['Ficha', 'Habilidades', 'Inventário', 'Identidade']) {
    await aba(page, nome).click();
    await expect(aba(page, nome)).toHaveAttribute('aria-current', 'true');
    await expectNoHorizontalOverflow(page); await expectSingleScroll(page);
    // nada cortado pelo painel (estouro horizontal dentro da própria ficha)
    expect(await page.getByTestId('ficha-guiada-leitura').evaluate(el => { const lim = el.getBoundingClientRect().right + 1; return [...el.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > lim).slice(0, 8).map(n => n.tagName + '.' + n.className + ' ' + Math.round(n.getBoundingClientRect().width)); })).toEqual([]);
    violacoes.push(...(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(v => ({ nome, v })));
    await page.screenshot({ path: info.outputPath(`ficha-${nome}.png`) });
    await evidence(page, info, `ficha-${nome}`);
  }
  expect(violacoes).toEqual([]);
  await aba(page, 'Inventário').click();
  const armadura = (await page.getByRole('listitem', { name: /^(Cota de malha|Armadura de couro)$/ }).first().getAttribute('aria-label'))!;
  const ca = topo.locator('.ficha-numero').filter({ has: page.getByText('CA', { exact: true }) }).locator('strong');
  const equipada = (await page.getByRole('listitem', { name: armadura, exact: true }).getAttribute('class'))!.includes('equipado');
  const antes = await ca.textContent();
  await acaoDoItem(page, armadura, equipada ? 'Desequipar' : 'Equipar');
  await expect(ca).not.toHaveText(antes!);
  await acaoDoItem(page, armadura, equipada ? 'Equipar' : 'Desequipar');
  await expect(ca).toHaveText(antes!);
  await expect(page.getByTestId('estado-salvamento')).toHaveText('Tudo salvo.');
});

test('ficha de jogo: arrasto no celular e estado preservado ao trocar de menu', async ({ page }) => {
  await abrirFichaDeJogo(page);
  if (isMobile(page)) {
    await arrastar(page, -160); await expect(aba(page, 'Habilidades')).toHaveAttribute('aria-current', 'true');
    await arrastar(page, -160); await expect(aba(page, 'Inventário')).toHaveAttribute('aria-current', 'true');
    await arrastar(page, 160); await expect(aba(page, 'Habilidades')).toHaveAttribute('aria-current', 'true');
  }
  await aba(page, 'Inventário').click();
  await page.getByRole('button', { name: 'Ver em grade', exact: true }).click();
  await navigate(page, 'Diário');
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeHidden();
  await navigate(page, 'Personagens');
  const naLista = page.getByRole('button', { name: /^Guerreira E2E/ });
  if (await naLista.count()) await naLista.first().click();
  await expect(aba(page, 'Inventário')).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('button', { name: 'Ver em grade', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
