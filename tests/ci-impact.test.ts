import { describe, expect, it } from "vitest";
// @ts-expect-error script Node ESM sem declaração TypeScript
import { classify } from "../scripts/ci-impact.mjs";
describe("classificação de impacto", () => {
  it("documentação exclusivamente", () => expect(classify(["README.md", "docs/guia.md"])).toBe("quick"));
  it("CSS exclusivamente", () => expect(classify(["src/style.css", "src/ui/panel.css"])).toBe("functional"));
  it.each([[], ["src/AuthContext.tsx"], ["supabase/migrations/0012.sql"], ["package-lock.json"], [".github/workflows/e2e.yml"], ["docs/guia.md", "src/App.tsx"], ["src/style.css", "src/supabase.ts"], ["docs/script.js"]])("falha fechada: %j", (...paths) => {
    // it.each expande arrays; cada caso é normalizado para lista de caminhos.
    expect(classify(paths.filter(p => typeof p === "string"))).toBe("full");
  });
});
