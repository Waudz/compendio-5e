import { expect, type Page } from '@playwright/test';

/** Mede os retratos renderizados, incluindo escala e transição, sem repetir o cálculo da trilha. */
export async function expectFaixaGeometry(page: Page) {
  const faixa = page.locator('.faixa-turnos');
  await expect.poll(async () => faixa.evaluate(el => {
    const bounds = el.getBoundingClientRect();
    const cards = [...el.querySelectorAll('.faixa-personagem')];
    const active = el.querySelector('[aria-current="step"]')!;
    const portrait = active.querySelector('.retrato-q')!.getBoundingClientRect();
    const large = getComputedStyle(el).getPropertyValue('--faixa-retrato').trim() === '80px';
    const sizes = cards.map(c => c.querySelector('.retrato-q')!.getBoundingClientRect());
    return {
      centered: Math.abs(portrait.x + portrait.width / 2 - bounds.x - bounds.width / 2) < 1,
      size: Math.abs(portrait.width - (large ? 96 : 72)) < 1,
      normal: sizes.every((r, i) => cards[i] === active || Math.abs(r.width - (large ? 80 : 60)) < 1),
      separated: sizes.every((r, i) => i === 0 || r.left - sizes[i - 1].right >= 6),
      contained: sizes.every(r => r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1),
      text: cards.every(c => parseFloat(getComputedStyle(c.querySelector('small')!).fontSize) >= 12 && parseFloat(getComputedStyle(c.querySelector(':scope > span:last-child')!).fontSize) >= 14),
    };
  })).toEqual({ centered: true, size: true, normal: true, separated: true, contained: true, text: true });
}

/** Todos os controles cabem no cabeçalho e seus rótulos cabem no botão. */
export async function expectTurnControls(page: Page) {
  const bar = page.locator('.ini-controles-turno');
  await expect.poll(async () => bar.evaluate(el => {
    const parent = el.closest('.content')!.getBoundingClientRect();
    return [...el.querySelectorAll('button')].every(b => {
      const r = b.getBoundingClientRect();
      return r.left >= parent.left && r.right <= parent.right + 1 && b.scrollWidth <= b.clientWidth + 1;
    });
  })).toBe(true);
}
