import { defineConfig } from '@playwright/test';

// Destino fixo e local: não aceitar URL de produção nem reutilizar servidor pessoal.
import { origin, appPath } from './e2e/environment';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: origin + appPath,
    browserName: 'chromium',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    storageState: { cookies: [], origins: [] },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-compacto', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'celular', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'celular-estreito', use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4187 --strictPort --mode e2e',
    url: origin + appPath,
    reuseExistingServer: false,
    timeout: 120_000,
    // Valores vazios prevalecem sobre .env.local e impedem criar o cliente real.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
