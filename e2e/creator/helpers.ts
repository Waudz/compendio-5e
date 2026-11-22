import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from '../fixtures';
export { test, expect, navigate, expectNoHorizontalOverflow };
export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 700;
export const sections = (page: Page) => page.getByRole('navigation', { name: 'Seções do personagem' });
export const nameField = (page: Page) => page.getByRole('textbox', { name: 'Nome do personagem', exact: true });
export async function startCreator(page: Page) {
  await openDemo(page, 'jogador');
  await navigate(page, 'Personagens');
  await expect(page.getByRole('heading', { name: 'Personagens', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Criar personagem/ }).click();
  await expect(nameField(page)).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: 'Armazenamento' })).toContainText('experimental');
}
export async function chooseFighter(page: Page) {
  await nameField(page).fill('Guerreira E2E');
  // Reduzir antes de aumentar: compra de pontos é validada a cada mudança real.
  await page.getByRole('combobox', { name: 'Atributo str', exact: true }).selectOption('14');
  await page.getByRole('combobox', { name: 'Atributo dex', exact: true }).selectOption('13');
  await page.getByRole('checkbox', { name: 'Perícia athletics', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Perícia perception', exact: true }).check();
  await page.getByRole('combobox', { name: 'fighter-style-1', exact: true }).selectOption('defense');
  await expect(page.getByRole('region', { name: 'Ficha calculada' })).toContainText('Atletismo, Percepção');
}
export async function showSection(page: Page, name: string) {
  await sections(page).getByRole('button', { name, exact: true }).click();
  await expect(sections(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'true');
}
export async function equip(page: Page) {
  await showSection(page, 'Equipamento inicial');
  await page.getByRole('combobox', { name: 'Equipamento armor', exact: true }).selectOption('leather-bow');
  await expect(page.getByRole('list', { name: 'Prévia de Armadura', exact: true })).toContainText('Arco longo ×1');
  await page.getByRole('button', { name: 'Confirmar equipamentos iniciais', exact: true }).click();
  await expect(page.getByText(/Equipamentos iniciais aplicados ao inventário/)).toBeVisible();
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
export async function returnToCreator(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  else await page.getByRole('tab').filter({ hasText: 'Guerreira E2E' }).click();
  // Mobile remonta a ficha salva; desktop mantém a seção em memória.
  await showSection(page, 'Inventário');
  await expect(page.getByRole('region', { name: 'Inventário', exact: true })).toBeVisible();
}
export async function evidence(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await info.attach(`${name}-aria`, { body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain' });
}
export async function keyboardActivate(page: Page, target: Locator) {
  await target.focus(); await expect(target).toBeFocused(); await page.keyboard.press('Enter');
}
