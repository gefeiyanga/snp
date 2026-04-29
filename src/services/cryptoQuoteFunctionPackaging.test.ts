import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const quoteFilePath = fileURLToPath(
  new URL('../../api/crypto/quote.ts', import.meta.url)
);

describe('crypto quote function packaging', () => {
  it('keeps the Vercel function self-contained', () => {
    const source = readFileSync(quoteFilePath, 'utf8');

    expect(source).not.toMatch(/from\s+['"]\.\.?\//);
  });
});
