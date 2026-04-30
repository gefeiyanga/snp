import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cryptoQuoteFilePath = fileURLToPath(
  new URL('../../api/crypto/quote.ts', import.meta.url)
);
const eastMoneyQuoteFilePath = fileURLToPath(
  new URL('../../api/eastmoney/quote.ts', import.meta.url)
);

describe('crypto quote function packaging', () => {
  it('keeps the Vercel function self-contained', () => {
    const source = readFileSync(cryptoQuoteFilePath, 'utf8');

    expect(source).not.toMatch(/from\s+['"]\.\.?\//);
  });
});

describe('Eastmoney quote function packaging', () => {
  it('keeps the Vercel function self-contained', () => {
    const source = readFileSync(eastMoneyQuoteFilePath, 'utf8');

    expect(source).not.toMatch(/from\s+['"]\.\.?\//);
  });
});
