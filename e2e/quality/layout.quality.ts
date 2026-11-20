import { test, expect, openDemo, navigate, mobile, evidence, expectNoHorizontalOverflow, splitWorkspace } from './helpers';

test('largura da janela preserva início, Anotações e controles de navegação', async ({ page }, info) => {
  await openDemo(page); await expectNoHorizontalOverflow(page);
  await navigate(page, 'Anotações');
  await expect(page.getByRole('textbox', { name: 'Nome da seção Sessão 5', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const heading = page.getByRole('heading', { name: 'Anotações', exact: true });
  const bounds = await heading.boundingBox(); const width = page.viewportSize()!.width;
  expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  if (mobile(page)) await expect(page.getByRole('button', { name: 'Abrir menu', exact: true })).toBeInViewport({ ratio: 1 });
  await evidence(page, info, 'anotacoes-largura');
});

for (const ratio of [0.5, 0.3]) {
  test(`divisão real ${ratio === 0.5 ? '50/50' : '30/70'} não sobrepõe painéis e restaura após reload`, async ({ page }, info) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Divisões proporcionais reais a partir de 1024 px; o produto impõe mínimo de 220 px por grupo.');
    await openDemo(page);
    const { notes, diary, separator } = await splitWorkspace(page);
    const bar = await separator.boundingBox(); const a = await notes.boundingBox(); const b = await diary.boundingBox();
    expect(bar).not.toBeNull(); expect(a).not.toBeNull(); expect(b).not.toBeNull();
    const left = Math.min(a!.x, b!.x), total = Math.max(a!.x+a!.width,b!.x+b!.width)-left;
    await page.mouse.move(bar!.x + bar!.width/2, bar!.y + bar!.height/2);
    await page.mouse.down(); await page.mouse.move(left+total*ratio, bar!.y+bar!.height/2, { steps: 8 }); await page.mouse.up();
    const measure = async () => {
      const x = (await notes.boundingBox())!, y = (await diary.boundingBox())!;
      return { overlap: x.x+x.width-y.x, ratio: x.width/(x.width+y.width) };
    };
    await expect.poll(async () => Math.abs((await measure()).ratio-ratio)).toBeLessThan(0.04);
    expect((await measure()).overlap).toBeLessThanOrEqual(1); await expectNoHorizontalOverflow(page);
    await evidence(page, info, `colunas-${ratio}`);
    await page.reload(); await expect(notes).toBeVisible(); await expect(diary).toBeVisible();
    await expect.poll(async () => Math.abs((await measure()).ratio-ratio)).toBeLessThan(0.04);
    await expectNoHorizontalOverflow(page);
  });
}
