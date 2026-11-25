import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// Os testes de banco criam um Postgres em memória (PGlite) por arquivo; em máquinas lentas ou em paralelo 10 s não bastam.
export default defineConfig(({ mode }) => ({ plugins: [react()], base: mode === "preview-demo" ? "/" : "/compendio-5e/", define: { __PREVIEW_DEMO__: JSON.stringify(mode === "preview-demo") }, test: { exclude: [...configDefaults.exclude, "e2e/**", "scripts/alpha/**"], hookTimeout: 90000, testTimeout: 60000, setupFiles: ["./vitest.setup.ts"] } }));
