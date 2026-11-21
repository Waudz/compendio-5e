import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// Os testes de banco criam um Postgres em memória (PGlite) por arquivo; em máquinas lentas ou em paralelo 10 s não bastam.
export default defineConfig({ plugins: [react()], base: "/compendio-5e/", test: { exclude: [...configDefaults.exclude, "e2e/**"], hookTimeout: 90000, testTimeout: 60000 } });
