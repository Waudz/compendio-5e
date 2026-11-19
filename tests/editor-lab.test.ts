// Isolamento do protótipo do editor (PR 2): verificações estáticas dos arquivos (fora de src/, como tests/seguranca.test.ts).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("isolamento do laboratório", () => {
  const main = readFileSync("src/main.tsx", "utf8");
  it("só é carregado em desenvolvimento (ou com VITE_EDITOR_LAB=1) e com ?lab=editor, por import dinâmico", () => {
    expect(main).toMatch(/import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_EDITOR_LAB === "1"/);
    expect(main).toMatch(/import\("\.\/lab\/mount"\)/); expect(main).toContain('get("lab") === "editor"');
    expect(main).not.toMatch(/^import .*lab/m);
  });
  it("nada do aplicativo importa o laboratório e o laboratório não toca no Supabase nem em armazenamento", () => {
    const app = ["App.tsx", "Panel.tsx", "Mobile.tsx", "workspace.ts", "navigation.ts", "persistence.ts"].map(f => readFileSync(`src/${f}`, "utf8")).join("\n");
    expect(app).not.toMatch(/from "\.\/lab/);
    const lab = ["Lab.tsx", "Board.tsx", "EditorBench.tsx", "Preview.tsx", "model.ts", "schema.tsx", "mount.tsx"].map(f => readFileSync(`src/lab/${f}`, "utf8")).join("\n");
    expect(lab).not.toMatch(/@supabase|\.\.\/supabase|localStorage|sessionStorage|indexedDB|fetch\(/);
  });
  it("sem pacotes xl-*, proprietários ou GPL entre as dependências", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")); const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter(d => /^@blocknote\//.test(d)).sort()).toEqual(["@blocknote/core", "@blocknote/mantine", "@blocknote/react"]);
    expect(deps.some(d => /xl-|tiptap-pro|@y\/|yjs/.test(d))).toBe(false);
    for (const d of ["@blocknote/core", "@blocknote/react", "@blocknote/mantine", "@mantine/core", "@mantine/hooks"]) expect(pkg.dependencies[d]).toMatch(/^\d+\.\d+\.\d+$/);   // versões fixadas
  });
});

describe("ajustes do quadro (PR D): aparência, cartões altos e controles", () => {
  const css = readFileSync("src/lab/lab.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const board = readFileSync("src/lab/Board.tsx", "utf8");
  it("cartão expandido não tem borda, brilho nem fundo próprios: expandir muda só altura e conteúdo", () => {
    expect(css).not.toMatch(/\.lab-card\.expanded\s*\{/);
    expect(css).not.toMatch(/\.lab-card[^{}]*\{[^}]*box-shadow/);            // nenhum brilho em cartões (só no cartão flutuante do arrasto)
    expect(css).not.toMatch(/\.lab-card\.expanded[^{}]*\{[^}]*(border|background|box-shadow|outline)/);
  });
  it("feedback do arrasto discreto: espaço tracejado fino, sem preenchimento azul; foco visível por teclado preservado", () => {
    expect(css).toMatch(/\.lab-ghost\{[^}]*border:1px dashed var\(--muted\)[^}]*background:transparent/);
    expect(css).not.toMatch(/\.lab-ghost\{[^}]*accent-faint/);
    expect(css).toMatch(/\.lab-card button:focus-visible\{outline:2px solid var\(--accent\)/);
    expect(css).toMatch(/\.lab-ghost\{max-height:72px/);                       // cartão alto: espaço reservado compacto
  });
  it("destino do arrasto = o que está sob o ponteiro, com cantos como reserva (cartões altos, teclado)", () => {
    expect(board).toMatch(/pointerWithin\(args\)/); expect(board).toMatch(/hits\.length \? hits : closestCorners\(args\)/); expect(board).toMatch(/collisionDetection=\{collision\}/);
  });
  it("o quadro (candidato à interface final) não carrega controles de teste do laboratório", () => {
    for (const proibido of ["Medir", "Documento de 500", "Exportar JSON", "Carregar JSON", "Ida e volta", "Inserir tabela", "performance.now", "manyCards", "data-lab"]) expect(board, proibido).not.toContain(proibido);
    expect(board).not.toMatch(/from "\.\/(Lab|EditorBench|mount)"/);
  });
});
