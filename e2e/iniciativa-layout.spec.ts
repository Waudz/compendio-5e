// Layout da Iniciativa medido no navegador: controles de turno no extremo direito do PAINEL e categorias sem rolagem horizontal.
import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';

async function medirControles(page: Page) {
  await expect.poll(() => page.locator('.ini-controles-turno').evaluate(bar => {
    const r = (e: Element) => e.getBoundingClientRect();
    const barra = r(bar), rodada = r(bar.querySelector('.ini-rodada')!), grupo = bar.querySelector('.ini-acoes-compactas')!;
    const botoes = [...grupo.querySelectorAll(':scope > button, :scope > .ini-menu-turno > button')];
    const caixas = botoes.map(r), vaos = caixas.slice(1).map((c, i) => c.left - caixas[i].right);
    const meio = (c: DOMRect) => c.top + c.height / 2;
    const proximo = botoes[1], rotulo = proximo.querySelector('svg')!;
    const faixa = r(document.querySelector('.faixa-turnos')!);
    return {
      noExtremoDireito: Math.abs(caixas[2].right - barra.right) <= 1.5,
      rodadaAEsquerda: Math.abs(rodada.left - barra.left) <= 1.5,
      mesmaLinha: caixas.every(c => Math.abs(meio(c) - meio(rodada)) <= 1.5),
      semSobrepor: rodada.right <= caixas[0].left + 0.5,
      mesmaAltura: caixas.every(c => Math.abs(c.height - 36) < 1),
      vaoIgual: Math.abs(vaos[0] - vaos[1]) < 1,
      setaCentrada: getComputedStyle(rotulo).display === 'none' || Math.abs(meio(r(rotulo)) - meio(caixas[1])) <= 1,
      azul: getComputedStyle(proximo).backgroundColor === 'rgb(37, 99, 235)',
      semCorte: botoes.every(b => (b as HTMLElement).scrollWidth <= (b as HTMLElement).clientWidth + 1),
      ordem: botoes.map(b => b.getAttribute('aria-label')).join('|') === 'Turno anterior|Próximo turno|Mais ações do combate',
      larguraDoPainel: Math.abs(barra.width - faixa.width) <= 1.5,
    };
  })).toEqual({ noExtremoDireito: true, rodadaAEsquerda: true, mesmaLinha: true, semSobrepor: true, mesmaAltura: true, vaoIgual: true, setaCentrada: true, azul: true, semCorte: true, ordem: true, larguraDoPainel: true });
}

async function medirCategorias(page: Page) {
  await expect.poll(() => page.locator('.ini-fontes').evaluate(el => {
    const r = (e: Element) => e.getBoundingClientRect(), caixa = r(el);
    const itens = [...el.querySelectorAll(':scope > .barra-item')], cx = itens.map(r), vaos = cx.slice(1).map((c, i) => c.left - cx[i].right);
    const estilo = getComputedStyle(el);
    return {
      semRolagem: el.scrollWidth <= el.clientWidth + 1 && !['auto', 'scroll', 'hidden'].includes(estilo.overflowX),
      umaLinha: cx.every(c => Math.abs(c.top - cx[0].top) < 1),
      inteiros: cx.every(c => c.left >= caixa.left - 0.5 && c.right <= caixa.right + 0.5) && itens.every(b => (b as HTMLElement).scrollWidth <= (b as HTMLElement).clientWidth + 1),
      vaoIgual: vaos.every(v => Math.abs(v - 4) < 1),
      algumVisivel: itens.length >= 1,
    };
  })).toEqual({ semRolagem: true, umaLinha: true, inteiros: true, vaoIgual: true, algumVisivel: true });
}

async function preparar(page: Page) {
  await openDemo(page); await navigate(page, 'Iniciativa');
  await page.getByLabel('Buscar combatentes', { exact: true }).fill('goblin');
  await page.getByRole('button', { name: 'Adicionar Goblin do Bestiário', exact: true }).click();
  await page.getByLabel('Buscar combatentes', { exact: true }).press('Escape');
}

test('controles de turno no extremo direito e categorias sem rolagem na largura da janela', async ({ page }, info) => {
  await preparar(page);
  await medirControles(page); await medirCategorias(page); await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: info.outputPath('iniciativa-layout.png') });
});

test('larguras de painel: todas cabem sem reticências; estreitas usam o menu, preservam a seleção e fecham', async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Redimensiona o painel no desktop.');
  await preparar(page);
  const painel = (largura: string) => page.locator('.content.iniciativa').evaluate((el, w) => { (el as HTMLElement).style.maxWidth = w; }, largura);
  await painel('900px'); await medirControles(page); await medirCategorias(page);
  await expect(page.getByRole('button', { name: /Mais categorias/ })).toHaveCount(0);
  for (const largura of ['520px', '420px', '360px', '300px', '240px']) {
    await painel(largura); await medirControles(page); await medirCategorias(page);
    await page.screenshot({ path: info.outputPath(`painel-${largura}.png`) });
  }
  await painel('360px');
  const mais = page.getByRole('button', { name: /Mais categorias/ });
  await mais.click();
  const menu = page.getByRole('group', { name: 'Categorias restantes' });
  const caixa = (await menu.boundingBox())!, barra = (await page.locator('.ini-fontes').boundingBox())!;
  expect(caixa.x).toBeGreaterThanOrEqual(barra.x - 1); expect(caixa.x + caixa.width).toBeLessThanOrEqual(barra.x + barra.width + 1);
  await menu.getByRole('button', { name: 'Combatente avulso', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Adicionar combatente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mais categorias (selecionada: Combatente avulso)' })).toBeVisible();
  await painel('900px');
  await expect(page.getByRole('button', { name: 'Combatente avulso', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await painel('300px');
  await mais.click(); await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0);
  await mais.click(); await page.getByRole('heading', { name: 'Iniciativa', exact: true }).click(); await expect(menu).toHaveCount(0);
});

test('em divisão real do workspace os controles seguem a largura do painel', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Divisão real no desktop.');
  await preparar(page);
  await page.getByRole('tab', { name: /^Iniciativa/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Abrir em nova coluna à direita', exact: true }).click();
  await medirControles(page); await medirCategorias(page); await expectNoHorizontalOverflow(page);
});
