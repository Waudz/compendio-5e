import { defineConfig } from '@playwright/test';
import quality from './playwright.quality.config';

// Mesmas oito larguras e mesmas barreiras de rede de #76/#77; somente novos fluxos.
export default defineConfig({ ...quality, testDir: './e2e/creator',
  testMatch: '**/*.creator.ts', outputDir: 'test-results/creator',
  // No CI, o relator `github` publica o teste e o erro como anotação (visível sem baixar o log).
  reporter: [['list'], ...(process.env.CI ? [['github'] as const] : []), ['html', { open: 'never', outputFolder: 'playwright-report/creator' }]],
});
