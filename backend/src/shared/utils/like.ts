/**
 * Escapes the LIKE wildcards (`%`, `_`) and the escape char itself, so a
 * search box matches what the user typed literally. Prisma's `contains`
 * becomes `LIKE CONCAT('%', ?, '%')` without escaping: "50%" would match
 * every row and "_" any character. MySQL's default LIKE escape is `\`.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
