import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const url = "http://127.0.0.1:4173";
for (let i = 0; ; i++) {
  try { if ((await fetch(url)).ok) break; } catch {}
  if (i >= 60) throw new Error("Preview não iniciou");
  await new Promise(resolve => setTimeout(resolve, 500));
}
// O artefato não pode conter nada do banco oficial, mesmo sem executar.
const raiz = process.env.PREVIEW_DIST ?? "dist";
for (const f of readdirSync(raiz, { recursive: true })) {
  const p = join(raiz, String(f));
  if (!statSync(p).isFile()) continue;
  const c = readFileSync(p, "utf8");
  assert.doesNotMatch(c, /gwcttjlxzelzjhbuitmi|pdjzahpxjrlbqqtzkfdr|sb_publishable_[A-Za-z0-9]{8,}|sb_secret_[A-Za-z0-9]{8,}/, "credencial ou projeto real no artefato: " + p);
}
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) for (const role of ["mestre", "jogador"]) {
    const context = await browser.newContext({ viewport });
    const external = [];
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== url) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    const erros = []; page.on("pageerror", e => erros.push(e.message));
    await page.goto(url + "/?demo=" + role + "&nuvem=1");
    await page.getByText("PREVIEW EXPERIMENTAL", { exact: false }).waitFor();
    await page.getByText("Sociedade do Véu Negro", { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 30000 });
    // nenhuma requisição para fora do próprio preview (Supabase ou qualquer outro serviço)
    assert.deepEqual(external, [], `Preview (${role}, ${viewport.width}px) tentou acessar fora`);
    assert.deepEqual(erros, [], `erros de página (${role}, ${viewport.width}px)`);
    await context.close();
  }
} finally { await browser.close(); }
