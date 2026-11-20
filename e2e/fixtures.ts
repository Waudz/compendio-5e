import { test as base, expect, type Page } from '@playwright/test';
import { origin } from './environment';

export type DemoRole = 'mestre' | 'jogador';
export const campaignName = 'Sociedade do Véu Negro';

/** Contexto descartável por teste; qualquer saída para outra origem falha fechada.
 * Não usar request/APIRequestContext, contas, tokens ou storageState de usuários aqui.
 */
export const test = base.extend<{ safety: void }>({
  safety: [async ({ context }, use) => {
    const external: string[] = [];
    const errors: string[] = [];
    context.on('weberror', event => errors.push(event.error().message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) {
        await route.continue();
      } else {
        external.push(url.origin + url.pathname); // sem query strings/tokens nos relatórios
        await route.abort('blockedbyclient');
      }
    });
    await context.routeWebSocket(/.*/, socket => {
      const url = new URL(socket.url());
      if (url.host === new URL(origin).host && url.protocol === 'ws:') socket.connectToServer();
      else { external.push(url.origin + url.pathname); socket.close(); }
    });
    await use();
    expect(external, 'O teste tentou acessar uma origem externa (requisição bloqueada)').toEqual([]);
    expect(errors, 'Exceções não tratadas no navegador').toEqual([]);
  }, { auto: true }],
});

export { expect };

export async function openDemo(page: Page, role: DemoRole = 'mestre') {
  await page.goto(`?demo=${role}`);
  await expect(page.getByRole('heading', { name: campaignName, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Diário', exact: true })).toContainText('3ª Sessão');
}

export async function navigate(page: Page, name: string) {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 700;
  if (mobile) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Menu de navegação' }).getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toBeHidden();
  } else {
    await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('button', { name, exact: true }).click();
  }
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  }), { message: 'A página não deve ultrapassar horizontalmente a janela' }).toBeLessThanOrEqual(1);
}
