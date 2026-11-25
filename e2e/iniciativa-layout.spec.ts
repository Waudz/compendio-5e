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

/** O menu "…" do turno e cada texto/ícone dentro dele ficam inteiros dentro do painel, abaixo do botão, sem corte nem rolagem. */
async function medirMenuDoTurno(page: Page) {
  const gatilho = page.getByRole('button', { name: 'Mais ações do combate', exact: true });
  await gatilho.click();
  await expect(page.locator('.ini-menu-turno-opcoes')).toBeVisible();
  await expect.poll(() => page.locator('.ini-menu-turno-opcoes').evaluate(menu => {
    const r = (e: Element) => e.getBoundingClientRect(), m = r(menu), painel = r(menu.closest('.content')!);
    const botao = r(menu.parentElement!.querySelector(':scope > button')!);
    const botoes = [...menu.querySelectorAll('button')];
    const textos = botoes.flatMap(b => {
      const partes: DOMRect[] = [];
      for (const no of b.childNodes) if (no.nodeType === 3 && no.textContent!.trim()) { const faixa = document.createRange(); faixa.selectNodeContents(no); partes.push(...faixa.getClientRects()); }
      return [...partes, ...[...b.querySelectorAll('svg')].map(r)].map(c => ({ c, b: r(b) }));
    });
    const dentro = (c: DOMRect, limite: DOMRect) => c.left >= limite.left - 0.5 && c.right <= limite.right + 0.5;
    return {
      noPainel: dentro(m, painel) && m.left >= 0 && m.right <= window.innerWidth + 0.5,
      abaixoDoBotao: m.top >= botao.bottom - 0.5,
      alinhadoADireita: Math.abs(m.right - botao.right) <= 1.5,
      cresceParaAEsquerda: m.width > botao.width * 2,
      botoesNoMenu: botoes.length === 2 && botoes.every(b => dentro(r(b), m) && r(b).top >= m.top - 0.5 && r(b).bottom <= m.bottom + 0.5),
      textosEIconesNoBotao: textos.length >= 4 && textos.every(x => dentro(x.c, x.b) && dentro(x.c, m)),
      semCorte: [menu, ...botoes].every(e => (e as HTMLElement).scrollWidth <= (e as HTMLElement).clientWidth + 1),
      fundo: getComputedStyle(menu).backgroundColor !== 'rgba(0, 0, 0, 0)',
      vermelho: getComputedStyle(botoes[1]).color === 'rgb(239, 68, 68)',
    };
  })).toEqual({ noPainel: true, abaixoDoBotao: true, alinhadoADireita: true, cresceParaAEsquerda: true, botoesNoMenu: true, textosEIconesNoBotao: true, semCorte: true, fundo: true, vermelho: true });
  await expectNoHorizontalOverflow(page);
}

test('menu de ações do turno cabe no painel (tela cheia e celular) e fecha por fora, Escape e escolha', async ({ page }, info) => {
  await preparar(page);
  const menu = page.locator('.ini-menu-turno-opcoes'), gatilho = page.getByRole('button', { name: 'Mais ações do combate', exact: true });
  await medirMenuDoTurno(page);
  await page.screenshot({ path: info.outputPath('menu-turno.png') });
  await page.getByRole('heading', { name: 'Iniciativa', exact: true }).click(); await expect(menu).toHaveCount(0);
  await gatilho.click(); await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(gatilho).toBeFocused();
  await gatilho.click(); await gatilho.click(); await expect(menu).toHaveCount(0);
  // escolher fecha o menu e preserva a confirmação de finalizar
  await gatilho.click(); await page.getByRole('button', { name: 'Reiniciar rodadas', exact: true }).click(); await expect(menu).toHaveCount(0);
  await gatilho.click(); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Finalizar combate', exact: true }).click();
  await expect(menu).toHaveCount(0); await expect(page.getByRole('button', { name: 'Abrir ficha completa de Goblin', exact: true })).toBeVisible();
});

test('menu de ações do turno em painéis estreitos e em tela dividida', async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Redimensiona e divide o painel no desktop.');
  await preparar(page);
  const painel = (largura: string) => page.locator('.content.iniciativa').evaluate((el, w) => { (el as HTMLElement).style.maxWidth = w; }, largura);
  for (const largura of ['520px', '360px', '240px', '210px']) {
    await painel(largura); await medirMenuDoTurno(page);
    await page.screenshot({ path: info.outputPath(`menu-turno-${largura}.png`) });
    await page.keyboard.press('Escape');
  }
  await painel('');
  await page.getByRole('tab', { name: /^Iniciativa/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Abrir em nova coluna à direita', exact: true }).click();
  await medirControles(page); await medirMenuDoTurno(page);
  await page.screenshot({ path: info.outputPath('menu-turno-dividido.png') });
});
