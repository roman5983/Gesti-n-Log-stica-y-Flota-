import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'error';
  /** Label of the dismiss button; override when "Cancelar" would be ambiguous. */
  cancelLabel?: string;
  loading?: boolean;
  /** Shown as an error Alert inside the dialog (e.g. a rejected business rule). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Reusable confirmation dialog for destructive/irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmColor = 'primary',
  cancelLabel = 'Cancelar',
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={loading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
