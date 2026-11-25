// O build oficial nunca pode conter o modo experimental nem os dados fictícios da demonstração.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const raiz = process.argv[2] ?? "dist";
let arquivos = 0;
for (const f of readdirSync(raiz, { recursive: true })) {
  const p = join(raiz, String(f));
  if (!statSync(p).isFile()) continue;
  arquivos++;
  assert.doesNotMatch(readFileSync(p, "utf8"), /PREVIEW EXPERIMENTAL|Sociedade do Véu Negro/, "modo de demonstração no build oficial: " + p);
}
assert.ok(arquivos > 0, "build vazio");
console.log("Build oficial sem modo de demonstração (" + arquivos + " arquivos).");
