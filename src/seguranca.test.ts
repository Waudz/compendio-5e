import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const walk = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? (["node_modules", "dist", ".git"].includes(n) ? [] : walk(p)) : [p]; });
const files = [...walk(join(root, "src")), ...walk(join(root, ".github")), join(root, ".env.example")].filter(f => !/seguranca\.test\.ts$/.test(f));
const text = (f: string) => readFileSync(f, "utf8");

describe("segredos no repositório", () => {
  it("nenhum arquivo versionado contém chave sb_secret_ ou JWT com role service_role", () => {
    for (const f of files) {
      const t = text(f);
      expect(t, f).not.toMatch(/sb_secret_[A-Za-z0-9_-]{8,}/);
      for (const jwt of t.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g) ?? []) {
        const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
        expect(payload.role, f).not.toBe("service_role");
      }
    }
  });
  it("service_role só aparece na recusa de configuração, no exemplo e em seus testes", () => {
    const hits = files.filter(f => /service_role/.test(text(f))).map(f => f.replace(root, "").replace(/\\/g, "/"));
    expect(hits.sort()).toEqual(["/.env.example", "/src/auth.test.tsx", "/src/supabase.ts"]);
  });
  it("o build do Pages usa a URL do projeto novo e uma chave publicável", () => {
    const pages = text(join(root, ".github/workflows/pages.yml"));
    expect(pages).toMatch(/VITE_SUPABASE_URL: https:\/\/gwcttjlxzelzjhbuitmi\.supabase\.co\s/);
    expect(pages).toMatch(/VITE_SUPABASE_ANON_KEY: sb_publishable_[A-Za-z0-9_-]+\s/);
    expect(pages).not.toMatch(/rastreador|pdjzahpxjrlbqqtzkfdr/);   // projeto antigo
  });
  it(".env* local nunca é versionado", () => {
    expect(text(join(root, ".gitignore"))).toMatch(/^\.env\.local$/m);
  });
});
