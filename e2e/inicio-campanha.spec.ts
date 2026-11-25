// Início da campanha no navegador: capa de borda a borda, edição única, enquadramento persistido, personagens e ausência de rolagem/sobreposição.
import { test, expect, openDemo, navigate, campaignName, expectNoHorizontalOverflow } from './fixtures';
import type { Page, TestInfo } from '@playwright/test';

const NOME_LONGO = 'A Sociedade do Véu Negro e as Crônicas Intermináveis de Daggerford do Norte';

/** Imagem de capa fictícia gerada no próprio navegador (clara no topo, para testar a legibilidade do nome). */
const semearCapa = (page: Page) => page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const g = c.getContext('2d')!; const grad = g.createLinearGradient(0, 0, 0, 900); grad.addColorStop(0, '#fff6d8'); grad.addColorStop(.55, '#e8a35a'); grad.addColorStop(1, '#fdf4e3'); g.fillStyle = grad; g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#7a3b2e'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * 190, 900); g.lineTo(i * 190 + 130, 430 - (i % 3) * 90); g.lineTo(i * 190 + 260, 900); g.fill(); }
  g.fillStyle = '#2d6a8a'; g.beginPath(); g.arc(1220, 200, 90, 0, 7); g.fill();
  localStorage.setItem('demo:capa:v1', c.toDataURL('image/jpeg', .85)); localStorage.removeItem('demo:capa:enquadramento:v1');
});

/** Mede o que a captura mostra: largura total do painel, nome dentro da capa, nada cortado nem sobreposto. */
async function medirInicio(page: Page) {
  await expect.poll(() => page.locator('[data-testid="campanha-inicio"]').evaluate(home => {
    const r = (e: Element) => e.getBoundingClientRect();
    const painel = r(home.closest('.content')!), capa = r(home.querySelector('.home-cover')!), nome = r(home.querySelector('.home-name')!);
    const editar = home.querySelector('.home-edit'), cartoes = [...home.querySelectorAll('.home-char')].map(r);
    const sobrepoe = (a: DOMRect, b: DOMRect) => a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
    const dentro = (a: DOMRect, b: DOMRect) => a.left >= b.left - .5 && a.right <= b.right + .5;
    return {
      capaDeBordaABorda: Math.abs(capa.left - painel.left) <= 1 && Math.abs(capa.width - painel.width) <= 1,
      nomeDentroDaCapa: dentro(nome, capa) && nome.bottom <= capa.bottom + .5 && nome.top >= capa.top,
      nomeNaoEncostaNoEditar: !editar || !sobrepoe(nome, r(editar)),
      editarCompacto: !editar || (r(editar).height <= 32 && r(editar).width <= 110),
      cartoesDentro: cartoes.every(c => dentro(c, painel)),
      cartoesSemSobrepor: cartoes.every((a, i) => cartoes.every((b, j) => i === j || !sobrepoe(a, b))),
      retratosQuadrados: [...home.querySelectorAll('.home-char .retrato-q')].every(q => Math.abs(r(q).width - r(q).height) < 1 && parseFloat(getComputedStyle(q).borderRadius) > 0 && parseFloat(getComputedStyle(q).borderRadius) < r(q).width / 3),
      semRolagemNoPainel: (home as HTMLElement).scrollWidth <= (home as HTMLElement).clientWidth + 1,
    };
  })).toEqual({ capaDeBordaABorda: true, nomeDentroDaCapa: true, nomeNaoEncostaNoEditar: true, editarCompacto: true, cartoesDentro: true, cartoesSemSobrepor: true, retratosQuadrados: true, semRolagemNoPainel: true });
  await expectNoHorizontalOverflow(page);
}
const foto = async (page: Page, info: TestInfo, nome: string) => { await page.screenshot({ path: info.outputPath(`${nome}.png`) }); };

test('mestre sem capa e com capa: visão geral, personagens e navegação até a ficha', async ({ page }, info) => {
  await openDemo(page); await medirInicio(page);
  await expect(page.getByText('Sem capa')).toBeVisible();
  await expect(page.locator('.home-char')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Editar informações' })).toHaveCount(1);
  await expect(page.locator('[data-testid="campanha-inicio"] input[type=file], [data-testid="campanha-inicio"] input[type=range]')).toHaveCount(0);
  await foto(page, info, 'inicio-sem-capa');
  await semearCapa(page); await page.reload();
  await expect(page.getByRole('img', { name: 'Capa da campanha' })).toBeVisible();
  await medirInicio(page); await foto(page, info, 'inicio-com-capa');
  await page.getByRole('region', { name: 'Aventureiros' }).getByRole('button', { name: /Lydia Valenmoor/ }).click();
  await expect(page.getByRole('heading', { name: 'Lydia Valenmoor' }).first()).toBeVisible();
  await foto(page, info, 'ficha-aberta');
});

test('edição única: nome longo, zoom e enquadramento persistem ao recarregar e valem para o jogador', async ({ page }, info) => {
  await openDemo(page); await semearCapa(page); await page.reload();
  await page.getByRole('button', { name: 'Editar informações' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Editar campanha' });
  for (const secao of ['Informações da campanha', 'Imagem e enquadramento', 'Participantes e convites']) await expect(dialogo.getByRole('region', { name: secao })).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Criar convite' })).toBeAttached();
  await dialogo.getByLabel('Zoom').fill('1.6'); await dialogo.getByLabel('Posição horizontal').fill('78'); await dialogo.getByLabel('Posição vertical').fill('22');
  await foto(page, info, 'editar-campanha');
  await expect.poll(() => dialogo.evaluate(d => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(1);
  await dialogo.getByRole('button', { name: 'Salvar enquadramento' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('demo:capa:enquadramento:v1'))).toBe('{"zoom":1.6,"x":78,"y":22}');
  await dialogo.getByLabel('Nome', { exact: true }).fill(NOME_LONGO);
  await dialogo.getByRole('button', { name: 'Salvar informações' }).click();
  await expect(dialogo).toHaveCount(0);
  await page.reload();
  const capa = page.getByRole('img', { name: 'Capa da campanha' });
  await expect(capa).toHaveCSS('object-position', '78% 22%');
  expect(await capa.evaluate(e => (e as HTMLElement).style.transform)).toBe('scale(1.6)');
  await expect(page.getByRole('heading', { name: NOME_LONGO, exact: true }).first()).toBeVisible();
  await medirInicio(page); await foto(page, info, 'nome-longo-enquadrada');

  await page.goto('?demo=jogador');
  await expect(page.getByRole('img', { name: 'Capa da campanha' })).toHaveCSS('object-position', '78% 22%');
  await expect(page.getByRole('button', { name: 'Editar informações' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar convite' })).toHaveCount(0);
  await expect(page.getByText('Segredo do mestre')).toHaveCount(0);
  await medirInicio(page); await foto(page, info, 'jogador');
});

test('sem personagens: estado vazio sem buracos nem rolagem', async ({ page }, info) => {
  await openDemo(page);
  await page.evaluate(() => { const k = 'demo:registros:v2', d = JSON.parse(localStorage.getItem(k) ?? 'null'); if (d) localStorage.setItem(k, JSON.stringify(d.filter((r: { kind: string }) => r.kind !== 'character'))); });
  const semeado = await page.evaluate(() => !!localStorage.getItem('demo:registros:v2'));
  if (!semeado) await page.evaluate(() => localStorage.setItem('demo:registros:v2', JSON.stringify([{ id: 'd1', kind: 'diary', campaignId: '11111111-1111-4111-8111-111111111111', ownerId: 'demo-mestre', title: 'Sessão', content: [], meta: {}, visibility: 'campaign', version: 1, createdAt: '2026-11-19T12:00:00Z', updatedAt: '2026-11-19T12:00:00Z' }])));
  await page.reload();
  await expect(page.getByTestId('aventureiros-vazio')).toBeVisible();
  await medirInicio(page); await foto(page, info, 'sem-personagens');
});

test('larguras de painel, tela dividida e histórico', async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Redimensiona e divide o painel no desktop.');
  await openDemo(page); await semearCapa(page); await page.reload();
  const painel = (largura: string) => page.locator('.content:has(>.home)').evaluate((el, w) => { (el as HTMLElement).style.maxWidth = w; }, largura);
  for (const largura of ['720px', '480px', '340px', '260px']) { await painel(largura); await medirInicio(page); await foto(page, info, `painel-${largura}`); }
  await painel('');
  await navigate(page, 'Diário');   // duas abas, para poder dividir
  await page.getByRole('tab', { name: new RegExp(`^${campaignName}`) }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Abrir em nova coluna à direita', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toHaveCount(2);
  await medirInicio(page); await foto(page, info, 'tela-dividida');
  await navigate(page, 'Compêndio'); await page.goBack();
  await expect(page.getByRole('heading', { name: campaignName, exact: true }).first()).toBeVisible();
});
