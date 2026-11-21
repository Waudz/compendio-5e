import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** Etapa 2: depende da infraestrutura do PR #76, sem copiá-la. */
export default defineConfig({
  ...base,
  testDir: './e2e/quality',
  outputDir: 'test-results/quality',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/quality' }]],
  testMatch: '**/*.quality.ts',
  projects: [320, 360, 390, 700, 701, 768, 1024, 1440].map(width => ({
    name: `qualidade-${width}`,
    use: { viewport: { width, height: width <= 390 ? 844 : 900 }, isMobile: width <= 700, hasTouch: width <= 700 },
  })),
});
