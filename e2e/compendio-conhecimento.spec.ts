import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  openDemo,
  navigate,
  expectNoHorizontalOverflow,
} from "./fixtures";

test("Compêndio: cartões panorâmicos, regras compartilhadas, filtros persistentes e imagens quadradas", async ({
  page,
}, info) => {
  await openDemo(page, "mestre");
  await navigate(page, "Compêndio");
  await expect(page.locator(".compendio-portal")).toHaveCount(5);
  const cards = await page.locator(".compendio-portal").evaluateAll((xs) =>
    xs.map((x) => {
      const r = x.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  expect(new Set(cards.map((x) => x.x)).size).toBe(1);
  expect(new Set(cards.map((x) => x.h)).size).toBe(1);
  await page.getByRole("button", { name: "Regras", exact: true }).click();
  await expect(page.locator(".compendio-portal")).toHaveCount(7);
  await page.getByRole("button", { name: /^Origens / }).click();
  await page.getByRole("searchbox").fill("acólito");
  await page.getByRole("button", { name: /^Acólito / }).click();
  await expect(page.getByRole("article")).toContainText("SRD 5.1");
  await page
    .getByRole("button", { name: "Voltar às categorias", exact: true })
    .click();
  await page.getByRole("button", { name: /^Itens / }).click();
  const search = page.getByRole("searchbox", {
    name: "Pesquisar no Compêndio",
    exact: true,
  });
  await search.fill("adaga");
  await page.getByRole("button", { name: "Grade", exact: true }).click();
  const portrait = page.locator(".cat-retrato .retrato-q").first();
  const box = await portrait.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
  await page
    .getByRole("button", { name: "Voltar às categorias", exact: true })
    .click();
  await page.getByRole("button", { name: /^Itens / }).click();
  await expect(search).toHaveValue("adaga");
  await expect(
    page.getByRole("button", { name: "Grade", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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
  await page.getByRole("button", { name: /^Locais / }).click();
  await page
    .getByRole("button", { name: "Novo registro", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Editar conhecimento",
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
  await editor
    .getByRole("combobox", { name: "Conhecimento", exact: true })
    .selectOption("4");
  await editor.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(editor).toBeHidden();
  await openDemo(page, "jogador");
  await navigate(page, "Compêndio");
  await page.getByRole("button", { name: /^Locais / }).click();
  await page.getByRole("button", { name: "Porto E2E", exact: true }).click();
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
  await expect(
    page.getByRole("button", { name: "Campanha", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Bestiário / }).click();
  await expect(
    page.getByText("Nenhuma descoberta revelada nesta categoria.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Goblin / })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
