import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// Os testes de banco criam um Postgres em memória (PGlite) por arquivo; em máquinas lentas ou em paralelo 10 s não bastam.
export default defineConfig(({ mode }) => ({ plugins: [react(), ...(mode === "preview-demo" ? [{
  name: "preview-sem-imagens-remotas-v1",
  enforce: "pre" as const,
  load(id: string) {
    if (id.replace(/\\/g, "/").endsWith("/src/catalogue/data/imagens-v1.json")) {
      return JSON.stringify({ base: "", itens: {}, monstros: {} });
    }
  },
}] : [])], base: mode === "preview-demo" ? "/" : "/compendio-5e/", define: {
  __PREVIEW_DEMO__: JSON.stringify(mode === "preview-demo"),
  // No preview, as credenciais são apagadas na compilação (mesmo que exista .env ou variável no ambiente): o artefato não pode levar nada do banco oficial.
  ...(mode === "preview-demo" ? { "import.meta.env.VITE_SUPABASE_URL": '""', "import.meta.env.VITE_SUPABASE_ANON_KEY": '""', "import.meta.env.VITE_COMBATE_REMOTO": '""' } : {}),
}, test: { exclude: [...configDefaults.exclude, "e2e/**", "scripts/alpha/**"], hookTimeout: 90000, testTimeout: 60000, setupFiles: ["./vitest.setup.ts"] } }));
