import type { ChangeKind, FieldChange } from './AuditLogDetailDialog.types';

/** Snapshots are plain JSON objects; anything else is treated as "no fields". */
export function toRecord(data: unknown): Record<string, unknown> | null {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

/** Values come from JSON, so a structural comparison is enough. */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function diffSnapshots(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): FieldChange[] {
  const keys = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})])];

  return keys.map((key) => {
    const inPrevious = previous !== null && key in previous;
    const inNext = next !== null && key in next;
    const before = previous?.[key];
    const after = next?.[key];

    let kind: ChangeKind;
    if (inPrevious && inNext) kind = sameValue(before, after) ? 'unchanged' : 'changed';
    else if (inNext) kind = 'added';
    else kind = 'removed';

    return { key, kind, before, after };
  });
}
