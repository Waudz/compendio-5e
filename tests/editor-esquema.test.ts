// O editor rico não oferece mídia: o servidor (migração 0005) só aceita imagem em storage:campaign-assets/..., ainda sem upload no editor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");

describe("esquema do editor", () => {
  it("exclui imagem, vídeo, áudio e arquivo e fixa a versão do BlockNote", () => {
    expect(src("PageEditor.tsx")).toContain("const { image, video, audio, file, ...permitidos } = defaultBlockSpecs");
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    for (const d of ["@blocknote/core", "@blocknote/react", "@blocknote/mantine"]) expect(pkg.dependencies[d]).toBe("0.57.0");
  });
  it("o editor é carregado sob demanda (fora do pacote inicial)", () => {
    expect(src("EditorLazy.tsx")).toContain('lazy(() => import("./PageEditor"))');
    for (const f of ["Diario.tsx", "Planning.tsx", "Panel.tsx", "App.tsx"]) expect(src(f), f).not.toContain('from "./PageEditor"');
  });
});
