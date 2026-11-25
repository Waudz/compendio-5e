import { describe, expect, it } from "vitest";
// @ts-expect-error script Node ESM sem declaração TypeScript
import { classify } from "../scripts/ci-impact.mjs";
const limpo = () => "export function Selo() { return <span/>; }";

describe("classificação de impacto", () => {
  it("documentação exclusivamente é rápida", () => expect(classify(["README.md", "DECISOES-E-ARQUITETURA.md", "docs/guia.md", "docs/a/b.md"])).toBe("quick"));
  it("CSS e componentes isolados são funcionais", () => {
    expect(classify(["src/style.css", "src/ui/panel.css"])).toBe("functional");
    expect(classify(["src/Selo.tsx", "e2e/visual.spec.ts", "docs/guia.md"], limpo)).toBe("functional");
  });
  it.each([
    [[]], [["src/AuthContext.tsx"]], [["src/Iniciativa.tsx"]], [["src/combate.ts"]], [["src/loot.ts"]], [["src/App.tsx"]], [["src/main.tsx"]], [["src/Personagens.tsx"]],
    [["supabase/migrations/0012.sql"]], [["docs/sql/x.sql"]], [["package-lock.json"]], [["package.json"]], [["vite.config.ts"]], [["tsconfig.json"]],
    [[".github/workflows/e2e.yml"]], [[".github/PULL_REQUEST_TEMPLATE.md"]], [["scripts/ci-impact.mjs"]], [["tests/ci-impact.test.ts"]], [["playwright.config.ts"]],
    [["docs/guia.md", "src/supabase.ts"]], [["src/style.css", "src/regras.ts"]], [["docs/script.js"]], [["e2e/fixtures.ts"]], [["arquivo-novo"]],
  ])("falha fechada: %j", (paths: string[]) => expect(classify(paths, limpo)).toBe("full"));
  it.each([
    'import { supabase } from "./supabase";', 'import x from "../AuthContext";', "localStorage.setItem('a','b')", "await client.rpc('x')", "await fetch(url)", 'import { createClient } from "@supabase/supabase-js";',
  ])("componente de nome inocente que toca dados exige validação completa: %s", codigo => expect(classify(["src/Selo.tsx"], () => codigo)).toBe("full"));
  it("arquivo ilegível (removido) exige validação completa", () => expect(classify(["src/Selo.tsx"], () => { throw new Error("removido"); })).toBe("full"));
});
