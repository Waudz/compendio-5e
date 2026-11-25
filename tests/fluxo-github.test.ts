// Garantias do fluxo do GitHub (PR A): o deploy depende da validação, sem permissões de escrita desnecessárias, e os modelos existem.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const pages = read(".github/workflows/pages.yml"), validar = read(".github/workflows/validar.yml");
/** Trecho de um job (do cabeçalho `  nome:` até o próximo job de mesmo nível). */
const job = (txt: string, name: string) => { const m = txt.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [\\w-]+:\\n|(?![\\s\\S]))`, "m")); return m ? m[1] : ""; };

describe("publicação só depois da validação", () => {
  it("o deploy depende de testes e build bem-sucedidos no mesmo job", () => {
    expect(job(pages, "deploy")).toMatch(/^    needs: compilar$/m);
    const compilar = job(pages, "compilar");
    const testes = compilar.indexOf("run: npm test");
    const build = compilar.indexOf("run: npm run build");
    const upload = compilar.indexOf("uses: actions/upload-pages-artifact@");
    expect(testes).toBeGreaterThanOrEqual(0);
    expect(build).toBeGreaterThan(testes);
    expect(upload).toBeGreaterThan(build);
    expect(compilar).not.toMatch(/^\s+if:/m);
    expect(job(pages, "deploy")).not.toMatch(/^\s+if:/m);
    expect(pages.match(/npm ci/g)).toHaveLength(1);
    expect(pages.match(/run: npm run build/g)).toHaveLength(1);
  });
  it("validar.yml é reutilizável e roda em pull_request; build e testes são obrigatórios nele", () => {
    expect(validar).toMatch(/^  workflow_call:$/m); expect(validar).toMatch(/^  pull_request:$/m);
    expect(validar).toMatch(/run: npm run build/); expect(validar).toMatch(/run: npm test/);
    expect(validar).not.toMatch(/continue-on-error/);
  });
  it("nenhuma etapa de validação ou publicação ignora falhas", () => {
    expect(pages + validar).not.toMatch(/continue-on-error|\|\| true|if: always\(\)/);
  });
  it("o deploy não roda em pull_request nem em branches que não sejam a main", () => {
    expect(pages).toMatch(/push:\n    branches: \[main\]/); expect(pages).not.toMatch(/pull_request/);
  });
});

describe("permissões mínimas", () => {
  it("nenhum fluxo pede escrita no repositório; só o deploy tem pages/id-token: write", () => {
    for (const f of ["pages.yml", "validar.yml"]) expect(read(`.github/workflows/${f}`), f).not.toMatch(/(contents|pull-requests|issues|actions|checks|statuses|packages): write|write-all/);
    expect(pages.match(/pages: write/g) ?? []).toHaveLength(1); expect(job(pages, "deploy")).toMatch(/pages: write/); expect(job(pages, "deploy")).toMatch(/id-token: write/);
    expect(pages).toMatch(/^permissions:\n  contents: read$/m); expect(validar).toMatch(/^permissions:\n  contents: read$/m);
  });
  it("o checkout não deixa credenciais gravadas", () => {
    expect((pages + validar).match(/persist-credentials: false/g)?.length).toBe(2);   // validar (1) + deploy (1): todo checkout
  });
  it("o build de produção continua usando só URL e chave publicável do projeto novo", () => {
    expect(pages).toMatch(/VITE_SUPABASE_ANON_KEY: sb_publishable_/); expect(pages).not.toMatch(/service_role|sb_secret_/);
  });
});

describe("modelos e automações", () => {
  it("modelos de PR, de migração e de issues existem; issues em branco desligadas", () => {
    for (const f of [".github/PULL_REQUEST_TEMPLATE.md", ".github/PULL_REQUEST_TEMPLATE/migracao.md", ".github/ISSUE_TEMPLATE/bug.yml", ".github/ISSUE_TEMPLATE/funcionalidade.yml", ".github/ISSUE_TEMPLATE/tarefa.yml", ".github/CODEOWNERS"]) expect(existsSync(join(root, f)), f).toBe(true);
    expect(read(".github/ISSUE_TEMPLATE/config.yml")).toMatch(/blank_issues_enabled: false/);
    expect(read(".github/PULL_REQUEST_TEMPLATE.md")).toMatch(/não autoriza merge, publicação nem alteração do Supabase/i);
    expect(read(".github/PULL_REQUEST_TEMPLATE/migracao.md")).toMatch(/NÃO foi aplicada/);
  });
  it("Dependabot cobre npm e github-actions e não ativa atualização maior das bibliotecas sensíveis", () => {
    const d = read(".github/dependabot.yml");
    expect(d).toMatch(/package-ecosystem: npm/); expect(d).toMatch(/package-ecosystem: github-actions/);
    for (const dep of ["react", "flexlayout-react", '"@blocknote/*"', '"@mantine/*"']) expect(d).toContain(`dependency-name: ${dep}`);
    expect(d).not.toMatch(/auto-?merge/i);
  });
  it("nada configura merge automático", () => {
    for (const f of [".github/dependabot.yml", ".github/workflows/pages.yml", ".github/workflows/validar.yml"]) expect(read(f)).not.toMatch(/auto-?merge|enable-pull-request-automerge|gh pr merge/i);
  });
});
