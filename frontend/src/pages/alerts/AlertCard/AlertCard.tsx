import { Box, Card, Chip, Stack, Typography } from '@mui/material';
import { IconBadge } from '@/components/IconBadge/IconBadge';
import { toneMain, toneText } from '@/theme/theme.helpers';
import { entityWithId } from '@/pages/audit/auditLabels/auditLabels.helpers';
import { formatDateTime, formatRelativeDay } from '@/utils/datetime';
import { alertPresentation } from './AlertCard.helpers';
import type { AlertCardProps } from './AlertCard.types';

/**
 * One alert as a card: an icon badge in the color of its urgency, the type as
 * a title in that same color, the description, and a footer with the entity
 * and when it was raised. A left border in the tone makes a long list
 * scannable by urgency.
 */
export function AlertCard({ alert, actions }: AlertCardProps) {
  const p = alertPresentation(alert.alertType);
  const Icon = p.icon;
  const resolved = alert.status === 'RESOLVED';

  return (
    <Card
      component="article"
      aria-label={`${p.label}: ${alert.description}`}
      sx={(t) => ({
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
        p: 2,
        borderLeft: `4px solid ${resolved ? t.palette.divider : toneMain(t, p.tone)}`,
      })}
    >
      <IconBadge tone={p.tone} size={44} muted={resolved}>
        <Icon fontSize="inherit" />
      </IconBadge>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography
            component="h3"
            variant="subtitle1"
            sx={(t) => ({ fontWeight: 600, color: resolved ? t.palette.text.primary : toneText(t, p.tone) })}
          >
            {p.label}
          </Typography>
          {!resolved && p.tag && <Chip size="small" label={p.tag} color={p.tone} />}
          {resolved && <Chip size="small" label="Resuelta" color="success" />}
        </Stack>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {alert.description}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {entityWithId(alert.entityType, alert.entityId)}
          {' · '}
          <time dateTime={alert.raisedAt} title={formatDateTime(alert.raisedAt)}>
            {formatRelativeDay(alert.raisedAt)}
          </time>
          {resolved && alert.resolvedAt && ` · resuelta ${formatRelativeDay(alert.resolvedAt).toLowerCase()}`}
        </Typography>
      </Box>

      {actions && (
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          {actions}
        </Stack>
      )}
    </Card>
  );
}
