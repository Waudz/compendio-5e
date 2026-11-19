// Garantias estáticas da proteção local de rascunhos: sem rede, sem Supabase, sem tokens, sem ligação com o aplicativo (ainda).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const dir = join(root, "src", "drafts");
const arquivos = readdirSync(dir).filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
const codigo = arquivos.map(f => readFileSync(join(dir, f), "utf8")).join("\n");

describe("rascunhos locais: isolamento da infraestrutura", () => {
  it("não importa Supabase nem autenticação e não faz requisições de rede", () => {
    expect(codigo).not.toMatch(/@supabase|from "\.\.\/supabase"|from "\.\.\/auth"|AuthContext|fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/);
  });
  it("não usa localStorage/sessionStorage nem cookies (só IndexedDB ou memória)", () => {
    expect(codigo).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
  it("não lê sessão, token ou chave: nenhuma referência a getSession, access_token em código de gravação", () => {
    expect(codigo).not.toMatch(/getSession|\.auth\./);
    expect(codigo.match(/access_token/g)?.length ?? 0).toBeLessThanOrEqual(1);       // só na lista de recusa de segredos
  });
  it("ainda não está ligada ao aplicativo principal (nenhum arquivo fora de src/drafts importa o módulo)", () => {
    const fora = readdirSync(join(root, "src")).filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
    for (const f of fora) expect(readFileSync(join(root, "src", f), "utf8"), f).not.toMatch(/from "\.\/drafts/);
  });
  it("fake-indexeddb é só dependência de desenvolvimento (não entra no pacote)", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.devDependencies["fake-indexeddb"]).toMatch(/^\d+\.\d+\.\d+$/); expect(pkg.dependencies["fake-indexeddb"]).toBeUndefined();
  });
});
