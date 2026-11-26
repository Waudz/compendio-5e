import AxeBuilder from '@axe-core/playwright';
import { test, expect, openDemo, navigate, mobile, evidence, insideFocus } from './helpers';

test('semântica WCAG da campanha e do Diário (axe + árvore acessível)', async ({ page }, info) => {
  await openDemo(page, 'jogador');
  const findings = [];
  for (const screen of ['Início', 'Diário']) {
    if (screen !== 'Início') await navigate(page, screen);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    findings.push({ screen, violations: result.violations });
    await evidence(page, info, `a11y-${screen}`);
  }
  await info.attach('axe', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
  expect(findings.flatMap(r => r.violations.map(v => ({ screen: r.screen, id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
});

test('ordem de Tab, Shift+Tab, Enter e indicador de foco no menu desktop', async ({ page }, info) => {
  test.skip(mobile(page), 'O menu desktop não é o menu mobile.');
  await openDemo(page);
  const nav = page.getByRole('navigation', { name: 'Menu principal' });
  const start = nav.getByRole('button', { name: 'Início', exact: true });
  await start.focus(); await page.keyboard.press('Tab');
  const notes = nav.getByRole('button', { name: 'Anotações', exact: true });
  await expect(notes).toBeFocused();
  const indicator = await notes.evaluate(el => { const s = getComputedStyle(el); return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow }; });
  expect((indicator.outline !== 'none' && indicator.width > 0) || indicator.shadow !== 'none').toBe(true);
  await page.keyboard.press('Shift+Tab'); await expect(start).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Anotações', exact: true })).toBeVisible();
  await evidence(page, info, 'foco-teclado');
});

test('menu contextual abre por teclado e oferece setas para navegar', async ({ page }) => {
  test.skip(mobile(page), 'Menu contextual de navegação desktop.');
  await openDemo(page);
  const trigger = page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Diário', exact: true });
  await trigger.focus(); await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu'); await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Abrir nesta aba', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Abrir em nova aba', exact: true })).toBeFocused();
});

test('Escape fecha o menu contextual e devolve foco ao acionador', async ({ page }) => {
  test.skip(mobile(page), 'Menu contextual de navegação desktop.');
  await openDemo(page);
  const trigger = page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name: 'Diário', exact: true });
  await trigger.focus(); await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('diálogo do menu mobile recebe foco, contém Tab e fecha com Escape', async ({ page }, info) => {
  test.skip(!mobile(page), 'Menu mobile não existe no desktop.');
  await openDemo(page);
  const trigger = page.getByRole('button', { name: 'Abrir menu', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Menu de navegação' });
  await expect(dialog).toBeVisible(); await evidence(page, info, 'menu-mobile');
  await insideFocus(dialog);
  const buttons = dialog.getByRole('button');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(buttons.first()).toBeFocused();
  const count = await dialog.getByRole('button').count();
  for (let i = 0; i <= count; i++) { await page.keyboard.press('Tab'); await insideFocus(dialog); }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('confirmação real de exclusão de seção permite cancelar sem perder dados', async ({ page }, info) => {
  await openDemo(page); await navigate(page, 'Anotações');
  const remove = page.getByRole('button', { name: 'Excluir seção Sessão 5', exact: true });
  await page.getByRole('textbox', { name: 'Nome da seção Sessão 5', exact: true }).focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await expect(remove).toBeFocused(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Excluir seção?' });
  await expect(dialog).toBeVisible(); await evidence(page, info, 'confirmacao-secao');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nome da seção Sessão 5', exact: true })).toBeVisible();
});


test('nomes acessíveis acompanham texto visível e títulos não entram na persistência', async ({ page }) => {
  await openDemo(page, 'jogador');
  const hero = page.getByRole('region', {name:'Aventureiros',exact:true}).getByRole('button', {name:'Lydia Valenmoor Clériga · nível 3',exact:true});
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute('title','Abrir ficha de Lydia Valenmoor');
  if (!mobile(page)) {
    await expect(page.getByRole('button', {name:'Campanha ativa: Sociedade do Véu Negro',exact:true})).toBeVisible();
    await expect(page.getByRole('tab', {name:'Sociedade do Véu Negro',exact:true})).toBeVisible();
  }
  await navigate(page,'Conta'); await navigate(page,'Início');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Sociedade do Véu Negro',exact:true})).toBeVisible();
  if (!mobile(page)) {
    await expect(page.getByRole('tab',{name:'Sociedade do Véu Negro',exact:true})).toBeVisible();
    const layouts = await page.evaluate(() => Object.keys(localStorage).filter(k=>k.startsWith('compendio5e:workspace:')).map(k=>localStorage.getItem(k)));
    expect(layouts.length).toBeGreaterThan(0);
    expect(JSON.stringify(layouts)).not.toContain('Sociedade do Véu Negro');
    expect(JSON.stringify(layouts)).not.toContain('Lydia');
  }
});
