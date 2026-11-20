import { expect, type Page, type Locator, type TestInfo } from '@playwright/test';
export { test, expect, openDemo, navigate, expectNoHorizontalOverflow } from '../fixtures';
export const mobile = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 700;
export async function evidence(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
  await info.attach(`${name}-aria`, { body: await page.getByRole('main').ariaSnapshot(), contentType: 'text/plain' });
}
export async function insideFocus(locator: Locator) {
  await expect.poll(() => locator.evaluate(el => el.contains(document.activeElement)),
    { message: 'O foco deve permanecer dentro do diálogo aberto' }).toBe(true);
}
export async function splitWorkspace(page: Page) {
  await page.getByRole('button', { name: 'Recolher menu', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Menu principal' });
  await nav.getByRole('button', { name: 'Anotações', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anotações', exact: true })).toBeVisible();
  await nav.getByRole('button', { name: 'Diário', exact: true }).click({ modifiers: ['Control'] });
  const tab = page.getByRole('tab', { name: /^Diário/ });
  await tab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Abrir em nova coluna à direita', exact: true }).click();
  const notes = page.getByRole('tabpanel').filter({ has: page.getByRole('heading', { name: 'Anotações', exact: true }) });
  const diary = page.getByRole('tabpanel').filter({ has: page.getByRole('heading', { name: 'Diário', exact: true }) });
  await expect(notes).toBeVisible(); await expect(diary).toBeVisible();
  return { notes, diary, separator: page.getByRole('separator', { name: 'Resize', exact: true }) };
}
