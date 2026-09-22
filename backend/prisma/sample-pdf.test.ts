import { describe, expect, it } from 'vitest';
import { samplePdf } from './sample-pdf';

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('samplePdf', () => {
  const pdf = latin1(samplePdf('Licencia de conducir', ['Titular: María Núñez (C)', 'a\\b']));

  it('is a complete PDF document', () => {
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF\n')).toBe(true);
  });

  it('has a cross-reference table whose offsets point at each object', () => {
    // A reader jumps straight to these byte offsets: if one is off, the
    // file opens as damaged (or not at all).
    const startxref = Number(pdf.match(/startxref\n(\d+)\n/)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');

    const entries = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((offset, i) => expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true));
  });

  it('declares the exact length of the content stream', () => {
    const [, length, stream] = pdf.match(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/)!;
    expect(Buffer.byteLength(stream!, 'latin1')).toBe(Number(length));
  });

  it('writes Spanish characters as Latin-1 and escapes string delimiters', () => {
    expect(pdf).toContain('(Titular: María Núñez \\(C\\)) Tj');
    expect(pdf).toContain('(a\\\\b) Tj');
    // One byte per character (WinAnsi), not UTF-8's two.
    expect(Buffer.from(samplePdf('ñ', [])).includes(0xf1)).toBe(true);
  });
});
