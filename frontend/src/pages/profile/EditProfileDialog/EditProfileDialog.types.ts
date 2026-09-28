import type { UserProfile } from '@/api/types';

export interface EditProfileDialogProps {
  open: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaved: () => void;
}
