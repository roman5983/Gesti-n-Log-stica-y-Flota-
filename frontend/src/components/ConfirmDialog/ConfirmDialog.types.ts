export interface ConfirmDialogProps {
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
