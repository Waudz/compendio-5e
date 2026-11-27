import { test as base, expect, type Page } from '@playwright/test';
import { origin } from './environment';

export type DemoRole = 'mestre' | 'jogador';
export const campaignName = 'Sociedade do Véu Negro';

/** Imagens cadastradas no Compêndio 1.0: o teste as responde localmente (nada sai da máquina). Qualquer outro endereço continua bloqueado. */
const IMAGENS_DO_1_0 = /^(https:\/\/pdjzahpxjrlbqqtzkfdr\.supabase\.co\/storage\/v1\/object\/public\/catalogos\/(itens|monstros)\/[0-9a-f-]{36}\.(jpg|png|webp)|https:\/\/waudz\.github\.io\/rastreador-dnd\/fotos\/srd_[a-z-]+\.jpg)$/;
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

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
      } else if (route.request().method() === 'GET' && route.request().resourceType() === 'image' && IMAGENS_DO_1_0.test(url.href)) {
        await route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
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
  await expect(page.getByRole('region', { name: 'Diário', exact: true }).getByRole('button', { name: 'Ver registro completo', exact: true })).toBeVisible();
}

export async function navigate(page: Page, name: string) {
  const mobile = (page.viewportSize()?.width ?? 1440) <= 700;
  if (mobile) {
    if (await page.locator('.app.chrome-hidden').count()) {
      await page.locator('.mobile-screen').evaluate(tela => { tela.scrollTop = Math.max(0, tela.scrollTop - 80); });
      await expect(page.locator('.app.chrome-hidden')).toHaveCount(0);
    }
    const nav = page.getByRole('navigation', {name:'Navegação mobile'});
    const direct = nav.getByRole('button', {name, exact:true});
    if (await direct.count()) { await direct.click(); return; }
    await nav.getByRole('button', {name:'Menu', exact:true}).click();
    const menu = page.getByRole('dialog', {name:'Menu de navegação'});
    const label = name === 'Conta' ? 'Minha conta' : name === 'Personagens' ? /^(Meus personagens|Personagens)$/ : name === 'Campanhas' || name === 'Gerenciar campanhas' ? /^(Minhas|Gerenciar) campanhas$/ : name;
    await menu.getByRole('button', {name:label, exact:true}).click();
    await expect(menu).toBeHidden();
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

/** Escolhe uma categoria de combatentes: direto se estiver na barra; pelo menu "Mais categorias" quando o painel é estreito. */
export async function escolherCategoria(page: Page, nome: string) {
  const barra = page.getByRole('group', { name: 'Fontes de combatentes', exact: true });
  const direto = barra.locator(':scope > .barra-item', { hasText: nome });
  const mais = barra.getByRole('button', { name: /^Mais categorias/ });
  await expect(direto.or(mais).first()).toBeVisible();
  if (await direto.count()) { await direto.click(); return; }
  await mais.click();
  await barra.getByRole('group', { name: 'Categorias restantes' }).getByRole('button', { name: nome, exact: true }).click();
}
