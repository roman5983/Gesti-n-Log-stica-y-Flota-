import type { User } from '@/api/users.api';

export interface UserFormDialogProps {
  open: boolean;
  /** null → create mode; a user → edit mode. */
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}
