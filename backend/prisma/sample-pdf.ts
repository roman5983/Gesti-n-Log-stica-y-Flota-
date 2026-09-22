/**
 * Minimal one-page PDF with plain text lines, for the seed's sample
 * documents: with files stored in the database, the demo documents can be
 * real, downloadable files instead of rows pointing at nothing.
 *
 * Hand-built (no dependency): a PDF is a few numbered objects plus a
 * cross-reference table with the byte offset of each one. Text uses the
 * standard Helvetica font with WinAnsi encoding, so Spanish characters
 * (á, é, ñ, …) are written as single Latin-1 bytes.
 */

/** Escape the characters that delimit a PDF string literal. */
function pdfString(text: string): string {
  return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

export function samplePdf(title: string, lines: string[]): Uint8Array<ArrayBuffer> {
  const body = [
    'BT',
    '/F1 18 Tf 72 770 Td',
    `${pdfString(title)} Tj`,
    '/F1 11 Tf 0 -32 Td',
    ...lines.flatMap((line) => [`${pdfString(line)} Tj`, '0 -18 Td']),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((content, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}
