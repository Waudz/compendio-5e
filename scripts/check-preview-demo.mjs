import { chromium } from "playwright";
import assert from "node:assert/strict";
const url = "http://127.0.0.1:4173";
for (let i = 0; ; i++) {
  try { if ((await fetch(url)).ok) break; } catch {}
  if (i >= 60) throw new Error("Preview não iniciou");
  await new Promise(resolve => setTimeout(resolve, 500));
}
const browser = await chromium.launch();
try {
  for (const role of ["mestre", "jogador"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const external = [];
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== url) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(url + "/?demo=" + role + "&nuvem=1");
    await page.getByText("PREVIEW EXPERIMENTAL", { exact: false }).waitFor();
    await page.getByText("Sociedade do Véu Negro", { exact: false }).first().waitFor({ timeout: 30000 });
    assert.equal(external.filter(u => /supabase/i.test(u)).length, 0, "Preview tentou acessar Supabase");
    await context.close();
  }
} finally { await browser.close(); }
