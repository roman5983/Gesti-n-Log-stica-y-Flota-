import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { Theme } from '@mui/material/styles';
import type { AuditLog } from '../../api/audit-logs.api';
import {
  EMPTY_VALUE,
  actionColor,
  actionLabel,
  entityWithId,
  fieldLabel,
  formatAuditValue,
} from './audit-labels';
import { formatDateTime } from '../../utils/datetime';

/**
 * Audit detail (P-AD-3).
 *
 * The previous version printed the two raw JSON snapshots side by side and
 * left the admin to spot the difference by eye. This one diffs them field by
 * field: what actually changed is listed first with before → after, and
 * everything that stayed the same is collapsed out of the way.
 */

type ChangeKind = 'changed' | 'added' | 'removed' | 'unchanged';

interface FieldChange {
  key: string;
  kind: ChangeKind;
  before: unknown;
  after: unknown;
}

/** Snapshots are plain JSON objects; anything else is treated as "no fields". */
function toRecord(data: unknown): Record<string, unknown> | null {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

/** Values come from JSON, so a structural comparison is enough. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function diffSnapshots(
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

/** A single value, tinted by its role in the comparison. */
function ValueChip({ text, tone }: { text: string; tone: 'before' | 'after' | 'plain' }) {
  const sx =
    tone === 'plain'
      ? { bgcolor: (t: Theme) => alpha(t.palette.text.primary, 0.06), color: 'text.primary' }
      : tone === 'before'
        ? {
            bgcolor: (t: Theme) => alpha(t.palette.error.main, 0.14),
            color: 'error.main',
            textDecoration: 'line-through',
          }
        : {
            bgcolor: (t: Theme) => alpha(t.palette.success.main, 0.16),
            color: 'success.main',
            fontWeight: 600,
          };

  return (
    <Box
      component="span"
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.8125rem',
        wordBreak: 'break-word',
        ...sx,
      }}
    >
      {text}
    </Box>
  );
}

/** One row of the diff: label on the left, value(s) on the right. */
function ChangeRow({ change, entity }: { change: FieldChange; entity: string }) {
  const before = formatAuditValue(change.key, change.before, entity);
  const after = formatAuditValue(change.key, change.after, entity);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0.5, sm: 2 }}
      sx={{ py: 1, alignItems: { sm: 'center' } }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 190, flexShrink: 0 }}>
        {fieldLabel(change.key)}
      </Typography>

      {change.kind === 'changed' ? (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ValueChip text={before} tone="before" />
          <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          <ValueChip text={after} tone="after" />
        </Stack>
      ) : change.kind === 'removed' ? (
        <ValueChip text={before} tone="before" />
      ) : change.kind === 'added' ? (
        <ValueChip text={after} tone="after" />
      ) : (
        <ValueChip text={after !== EMPTY_VALUE ? after : before} tone="plain" />
      )}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      <Divider />
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  );
}

export function AuditLogDetailDialog({
  log,
  onClose,
}: {
  log: AuditLog | null;
  onClose: () => void;
}) {
  const [showUnchanged, setShowUnchanged] = useState(false);

  const previous = toRecord(log?.previousData);
  const next = toRecord(log?.newData);

  const changes = useMemo(() => diffSnapshots(previous, next), [previous, next]);

  const entity = log?.entity ?? '';
  const modified = changes.filter((c) => c.kind !== 'unchanged');
  const unchanged = changes.filter((c) => c.kind === 'unchanged');

  /** A creation only carries the new snapshot, a deletion only the old one:
   *  in both cases there is nothing to compare, so the values are listed flat
   *  instead of being dressed up as additions or removals. */
  const isCreation = previous === null && next !== null;
  const isDeletion = previous !== null && next === null;

  return (
    <Dialog open={log !== null} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Detalle de auditoría</DialogTitle>
      <DialogContent dividers>
        {log && (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 3 }}
              sx={{ mb: 1 }}
              alignItems={{ sm: 'center' }}
            >
              <Chip
                label={actionLabel(log.action)}
                color={actionColor(log.action)}
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              />
              <Typography variant="body2">
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Entidad:{' '}
                </Box>
                {entityWithId(log.entity, log.entityId)}
              </Typography>
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2">
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Realizada por:{' '}
                </Box>
                {log.user.name} ({log.user.email})
              </Typography>
              <Typography variant="body2">
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Fecha y hora:{' '}
                </Box>
                {formatDateTime(log.occurredAt)}
              </Typography>
            </Stack>

            {changes.length === 0 ? (
              <Section title="Datos">
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  Esta acción no registra cambios de datos
                  {log.action === 'VIEW_CREDENTIALS'
                    ? ': es una consulta, queda asentada por tratarse de información sensible.'
                    : '.'}
                </Typography>
              </Section>
            ) : isCreation || isDeletion ? (
              <Section title={isCreation ? 'Datos registrados' : 'Datos al momento de eliminar'}>
                {changes.map((change) => (
                  <ChangeRow
                    key={change.key}
                    entity={entity}
                    change={{ ...change, kind: 'unchanged' }}
                  />
                ))}
              </Section>
            ) : (
              <>
                <Section
                  title={
                    modified.length === 1 ? '1 campo modificado' : `${modified.length} campos modificados`
                  }
                >
                  {modified.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      No hubo diferencias entre el antes y el después.
                    </Typography>
                  ) : (
                    modified.map((change) => (
                      <ChangeRow key={change.key} change={change} entity={entity} />
                    ))
                  )}
                </Section>

                {unchanged.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => setShowUnchanged((v) => !v)}
                      startIcon={
                        <ExpandMoreIcon
                          sx={{
                            transition: 'transform 150ms',
                            transform: showUnchanged ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      }
                      sx={{ color: 'text.secondary' }}
                    >
                      {unchanged.length === 1
                        ? '1 campo sin cambios'
                        : `${unchanged.length} campos sin cambios`}
                    </Button>
                    <Collapse in={showUnchanged} unmountOnExit>
                      <Box sx={{ mt: 0.5 }}>
                        <Divider />
                        {unchanged.map((change) => (
                          <ChangeRow key={change.key} change={change} entity={entity} />
                        ))}
                      </Box>
                    </Collapse>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
