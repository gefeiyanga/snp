import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageFiles = ['HomePage.vue', 'AssetsPage.vue', 'LiabilitiesPage.vue'];

describe('summary card layout', () => {
  it('keeps top summary cards from collapsing in empty states', () => {
    for (const file of pageFiles) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf-8');
      const heroCardBlock = source.match(/\.hero-card\s*\{(?<styles>[^}]+)\}/)?.groups?.styles ?? '';
      expect(heroCardBlock, file).toMatch(/min-height:\s*\d+px;/);
    }
  });
});
