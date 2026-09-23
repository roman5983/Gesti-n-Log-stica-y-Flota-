import type { SxProps, Theme } from '@mui/material';

export interface BaseProps {
  label: string;
  /** '' = empty. 'YYYY-MM-DD' (DateField) or 'YYYY-MM-DDTHH:mm' local (DateTimeField). */
  value: string;
  /**
   * Called with a complete date or '' (cleared) — never with a half-typed
   * year. (In DateTimeField, a minute typed digit by digit reports 14:03
   * before 14:30: both are valid times, and forms read the value on submit.)
   */
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Earliest / latest allowed calendar day, 'YYYY-MM-DD' (inclusive). */
  minDate?: string;
  maxDate?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  /** Shown under the field when there is no validation message. */
  helperText?: string;
  sx?: SxProps<Theme>;
}
