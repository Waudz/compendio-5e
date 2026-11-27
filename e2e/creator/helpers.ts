import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from '../fixtures';
export { test, expect, navigate, expectNoHorizontalOverflow };
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 700;
export const etapasNav = (page: Page) => page.getByRole('navigation', { name: 'Etapas do personagem' });
export const nameField = (page: Page) => page.getByRole('textbox', { name: 'Nome do personagem', exact: true });

/** Vai a uma etapa: pela coluna de etapas (painel largo) ou pelo seletor compacto (painel estreito). */
export async function irEtapa(page: Page, nome: string) {
  const nav = etapasNav(page);
  await expect(nav).toBeVisible();
  const compacto = nav.getByRole('combobox');
  if (await compacto.isVisible()) {
    const rotulo = (await compacto.locator('option').allTextContents()).find(t => t.startsWith(nome));
    expect(rotulo, `etapa ${nome}`).toBeTruthy();
    await compacto.selectOption({ label: rotulo! });
  } else await nav.getByRole('button', { name: new RegExp('^' + nome) }).click();
  await expect(page.locator('.etapas-conteudo').filter({ visible: true }).first()).toBeVisible();
}
export async function startCreator(page: Page) {
  await openDemo(page, 'jogador');
  await navigate(page, 'Personagens');
  await expect(page.getByRole('heading', { name: isMobile(page) ? 'Meus personagens' : 'Personagens', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Criar personagem/ }).click();
  await expect(nameField(page)).toBeVisible();
  await expect(etapasNav(page)).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Armazenamento' })).toContainText('experimental');
}
export async function chooseFighter(page: Page) {
  await nameField(page).fill('Guerreira E2E');
  await irEtapa(page, 'Atributos');
  // Reduzir antes de aumentar: compra de pontos é validada a cada mudança real.
  await page.getByRole('combobox', { name: 'Atributo str', exact: true }).selectOption('14');
  await page.getByRole('combobox', { name: 'Atributo dex', exact: true }).selectOption('13');
  await irEtapa(page, 'Classe');
  const prof = page.getByRole('group', { name: /^Proficiências de Guerreiro/ });
  await prof.getByRole('checkbox', { name: 'Atletismo', exact: true }).check();
  await prof.getByRole('checkbox', { name: 'Percepção', exact: true }).check();
  await page.getByRole('combobox', { name: /Fighting Style|Estilo de luta/i }).selectOption('srd51:feature/fighter-fighting-style-defense');
}
/** Equipamento da classe (alternativa 1 do primeiro grupo e espada longa nas armas marciais). */
export async function equip(page: Page) {
  await irEtapa(page, 'Equipamentos iniciais');
  await page.getByRole('combobox', { name: 'Alternativa do grupo 1', exact: true }).selectOption('1');
  const equipment = page.getByRole('region', { name: 'Equipamento inicial SRD 2014', exact: true });
  for (const select of await equipment.getByRole('combobox').all()) {
    if (await select.inputValue() === '') {
      const values = await select.getByRole('option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value).filter(Boolean));
      await select.selectOption(values.includes('longsword') ? 'longsword' : values[0]);
    }
  }
  await page.getByRole('button', { name: 'Confirmar equipamentos SRD 2014', exact: true }).click();
  await expect(page.getByText('Equipamento inicial da classe já confirmado. Mudanças são feitas no inventário.')).toBeVisible();
}
/** Guerreira anã completa: escolhas de raça e origem, equipamento da classe e da origem. */
export async function completarGuerreira(page: Page) {
  await chooseFighter(page);
  await page.getByRole('textbox', { name: 'Nome do personagem', exact: true }).isVisible().catch(() => false);
  await irEtapa(page, 'Identidade');
  await page.getByRole('textbox', { name: 'Alcunha', exact: true }).fill('Escudo de Pedra');
  await irEtapa(page, 'Raça');
  await page.getByRole('combobox', { name: 'Ferramenta dos anões', exact: true }).selectOption({ index: 1 });
  await irEtapa(page, 'Origem');
  const idiomas = page.getByRole('group', { name: /^Idiomas da origem/ });
  for (const indice of [0, 1]) await idiomas.getByRole('checkbox').nth(indice).check();
  await equip(page);
  await page.getByRole('button', { name: 'Adicionar equipamento da origem', exact: true }).click();
}
export async function salvarParaFicha(page: Page) {
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByTestId('ficha-guiada-leitura')).toBeVisible();
}
export const abaDaFicha = (page: Page, nome: string) => page.getByRole('navigation', { name: 'Seções da ficha' }).getByRole('button', { name: nome, exact: true });
export async function acaoDoItem(page: Page, item: string, acao: string) {
  await page.getByRole('button', { name: `Ações de ${item}`, exact: true }).click();
  await page.getByRole('menuitem', { name: acao, exact: true }).click();
}
export async function leaveCreator(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  else {
    // Menu público da aba; o título continua Novo personagem até salvar.
    const tab = page.getByRole('tab').filter({ hasText: 'Novo personagem' });
    await tab.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Fechar aba', exact: true }).click();
  }
}
/** Um personagem salvo reabre na ficha de jogo; a edição é uma ação explícita. */
export async function openEditor(page: Page) {
  const editar = page.getByRole('button', { name: 'Editar personagem', exact: true });
  await expect(editar.or(etapasNav(page)).first()).toBeVisible();
  if (await editar.isVisible()) await editar.click();
  await expect(etapasNav(page)).toBeVisible();
}
/** Nenhum controle do criador cortado pelas laterais do painel. */
export async function expectInsidePanel(page: Page, seletor = '.criador') {
  await expect.poll(() => page.locator(seletor).filter({ visible: true }).first().evaluate(root => {
    const limite = root.getBoundingClientRect();
    return [...root.querySelectorAll('input:not([type=file]), select, button, fieldset, nav, li')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (r.left < limite.left - 1 || r.right > limite.right + 1);
    }).map(el => ({ tag: el.tagName, text: el.textContent?.slice(0, 50) }));
  }), { message: 'Controles não devem ficar cortados nas laterais do painel' }).toEqual([]);
}
/** Uma única rolagem vertical por grupo: só o conteúdo da aba (ou a tela do celular) rola. */
export async function expectSingleScroll(page: Page) {
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.workspace *, .mobile-screen, .mobile-screen *')].filter(e => {
    if (!e.getClientRects().length || e.matches('textarea, .flexlayout__tabset_tabbar_inner')) return false;
    return /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1;
  }).filter(e => !e.matches('.content, .mobile-screen')).map(e => String(e.className))), { message: 'Sem rolagens verticais aninhadas' }).toEqual([]);
}
export async function evidence(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await info.attach(`${name}-aria`, { body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain' });
}
export async function keyboardActivate(page: Page, target: Locator) {
  await target.focus(); await expect(target).toBeFocused(); await page.keyboard.press('Enter');
}
