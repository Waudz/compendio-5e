import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  openDemo,
  navigate,
  expectNoHorizontalOverflow,
} from "./fixtures";
import type { Page } from "@playwright/test";

const celular = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 700;
/** Mostra a área pedida: em painel largo as duas já estão lado a lado; no estreito há as abas. */
async function area(page: Page, nome: "Campanha" | "Regras") {
  await expect(page.locator(".cd-home")).toBeVisible();
  const aba = page.getByRole("group", { name: "Áreas do Compêndio" }).getByRole("button", { name: nome, exact: true });
  if (await aba.count()) await aba.click();
  await expect(page.getByRole("region", { name: nome, exact: true })).toBeVisible();
}
/** Do catálogo (ou de uma página aberta por ele) de volta à página inicial do Compêndio. */
async function inicio(page: Page) {
  // no celular a página aberta ocupa a tela; no computador a carta fecha sobre a lista
  if (celular(page)) await page.getByRole("button", { name: "Voltar", exact: true }).click();
  else await page.getByRole("button", { name: "Fechar consulta", exact: true }).click();
  await page.getByRole("button",{name:celular(page)?"Voltar":"Voltar na aba",exact:true}).click();
}

test("Compêndio: cartões panorâmicos, regras compartilhadas, filtros persistentes e imagens quadradas", async ({
  page,
}, info) => {
  await openDemo(page, "mestre");
  await navigate(page, "Compêndio");
  // cada área é uma coluna de cartões panorâmicos de mesma altura
  for (const [nome, total] of [["Campanha", 5], ["Regras", 7]] as const) {
    await area(page, nome);
    const portais = page.getByRole("region", { name: nome, exact: true }).locator(".compendio-portal");
    await expect(portais).toHaveCount(total);
    const cards = await portais.evaluateAll((xs) => xs.map((x) => { const r = x.getBoundingClientRect(); return { x: Math.round(r.x), h: Math.round(r.height), w: r.width }; }));
    expect(new Set(cards.map((x) => x.x)).size).toBe(1);
    expect(new Set(cards.map((x) => x.h)).size).toBe(1);
    expect(cards.every((x) => x.w > x.h * 2)).toBe(true);
  }
  await page.getByRole("button", { name: /^Origens / }).click();
  await page.getByRole("searchbox").fill("acólito");
  await page.getByRole("button", { name: /^Acólito / }).click();
  await expect(page.getByRole("article", { name: "Detalhes de Acólito" })).toBeVisible();
  await expect(page.locator(".cd-rule-page")).toContainText("SRD 5.1");
  await inicio(page);
  await area(page, "Regras");
  await page.getByRole("button", { name: /^Itens / }).click();
  const search = page.getByRole("searchbox", {
    name: "Pesquisar no Compêndio",
    exact: true,
  });
  await search.fill("adaga");
  await page.getByRole("button", { name: "Visualizar em grade", exact: true }).click();
  const portrait = page.locator(".cd-cards.grade .retrato-q").first();
  const box = await portrait.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
  await page.getByRole("button",{name:celular(page)?"Voltar":"Voltar na aba",exact:true}).click();
  await area(page, "Regras");
  await page.getByRole("button", { name: /^Itens / }).click();
  await expect(search).toHaveValue("adaga");
  await expect(
    page.getByRole("button", { name: "Visualizar em lista", exact: true }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await info.attach("compendio-grade", {
    body: await page.screenshot({ path: info.outputPath("compendio.png") }),
    contentType: "image/png",
  });
});

test("Compêndio: mestre cria local e revela somente a descrição autorizada ao jogador", async ({
  page,
}, info) => {
  await openDemo(page, "mestre");
  await navigate(page, "Compêndio");
  await area(page, "Campanha");
  await page.getByRole("button", { name: /^Locais / }).click();
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Novo registro",
    exact: true,
  });
  await editor
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Porto E2E");
  await editor
    .getByRole("textbox", { name: "Descrição compartilhada", exact: true })
    .fill("Um porto autorizado.");
  await editor
    .getByRole("textbox", { name: "Notas privadas do mestre", exact: true })
    .fill("SEGREDO NÃO PUBLICÁVEL");
  await editor.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("heading", { name: "Porto E2E", exact: true })).toBeVisible();
  // consulta limpa; o registro nasce secreto; "Revelar tudo" + salvar publica sem as notas privadas
  await expect(page.locator(".cd-record-page .cd-eye")).toHaveCount(0);
  await page.getByRole("button", { name: "Mais ações do registro", exact: true }).click();
  await page.getByRole("menuitem", { name: "Gerenciar conhecimento", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Registro conhecido" })).not.toBeChecked();
  await page.getByRole("button", { name: "Revelar tudo", exact: true }).click();
  await expectNoHorizontalOverflow(page);
  const manageAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(manageAxe.violations).toEqual([]);
  await page.getByRole("button", { name: "Salvar conhecimento", exact: true }).click();
  await page.getByRole('button',{name:celular(page)?'Menu':'Abrir menu global',exact:true}).click();
  await page.getByRole('button',{name:'Ver como jogador',exact:true}).click();
  await navigate(page,'Compêndio');await area(page,'Campanha');await page.getByRole('button',{name:/^Locais /}).click();
  await page.locator('.cd-card-main').filter({hasText:'Porto E2E',visible:true}).click();
  const preview=page.getByRole('article',{name:'Detalhes de Porto E2E'});
  await expect(preview).toContainText('Um porto autorizado.');await expect(preview).not.toContainText('SEGREDO NÃO PUBLICÁVEL');
  await page.getByRole('button',{name:celular(page)?'Menu':'Abrir menu global',exact:true}).click();
  await page.getByRole('button',{name:'Voltar à visão de mestre'}).click();
  await expectNoHorizontalOverflow(page);
  const masterAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(masterAxe.violations).toEqual([]);
  await info.attach("conhecimento-mestre", { body: await page.screenshot({ path: info.outputPath("mestre.png") }), contentType: "image/png" });
  await openDemo(page, "jogador");
  await navigate(page, "Compêndio");
  await area(page, "Campanha");
  await page.getByRole("button", { name: /^Locais / }).click();
  await page.getByRole("button", { name: /^Porto E2E(?: |$)/ }).click();
  await expect(
    page.getByText("Um porto autorizado.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("SEGREDO NÃO PUBLICÁVEL", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Novo registro", exact: true }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await info.attach("conhecimento-jogador", {
    body: await page.screenshot({ path: info.outputPath("compendio.png") }),
    contentType: "image/png",
  });
});

test("Compêndio: jogador não recebe catálogo completo de criaturas; gesto vertical preserva a área", async ({
  page,
}) => {
  await openDemo(page, "jogador");
  await navigate(page, "Compêndio");
  await page.locator(".compendio-inicio").dispatchEvent("touchstart", {
    touches: [{ identifier: 0, clientX: 150, clientY: 100 }],
  });
  await page.locator(".compendio-inicio").dispatchEvent("touchend", {
    changedTouches: [{ identifier: 0, clientX: 155, clientY: 250 }],
  });
  // o gesto vertical é rolagem: não troca de área (no painel largo as duas ficam visíveis)
  const abas = page.getByRole("group", { name: "Áreas do Compêndio" });
  if (await abas.count()) await expect(abas.getByRole("button", { name: "Campanha", exact: true })).toHaveAttribute("aria-pressed", "true");
  else await expect(page.getByRole("region", { name: "Campanha", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Bestiário / }).click();
  await expect(
    page.getByText("Nenhum registro disponível nesta categoria.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Goblin / })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
