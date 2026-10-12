import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pillSource = readFileSync(new URL('./pill.tsx', import.meta.url), 'utf8');

describe('pill', () => {
  it('only uses theme colors for its tones', () => {
    expect(pillSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });

  it('defaults to the neutral tone', () => {
    expect(pillSource).toContain("tone = 'neutral'");
  });
});
