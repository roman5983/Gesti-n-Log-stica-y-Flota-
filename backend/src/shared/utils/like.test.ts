import { describe, expect, it } from 'vitest';
import { escapeLike } from './like';

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape char', () => {
    expect(escapeLike('50%')).toBe('50\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c:\\x')).toBe('c:\\\\x');
  });

  it('leaves normal text (accents included) untouched', () => {
    expect(escapeLike('Pérez')).toBe('Pérez');
  });
});
