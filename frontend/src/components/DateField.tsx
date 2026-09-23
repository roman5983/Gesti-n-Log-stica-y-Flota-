import { useEffect, useRef, useState } from 'react';
import type { SxProps, Theme } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import type { Dayjs } from 'dayjs';
import {
  DISPLAY_FORMAT,
  MAX_YEAR,
  MIN_YEAR,
  dateInputError,
  parseDateInput,
  serializeDateInput,
  type DateInputKind,
} from '../utils/date-input';

/**
 * The app's only way to enter a date (P-UX): the same control in every form
 * and filter, instead of the browser's native <input type="date">, whose
 * look and order (dd/mm vs mm/dd) change with the browser and the OS.
 *
 * Two ways to fill it, both always available:
 *  - type the digits: dd/mm/aaaa (hh:mm); each part jumps to the next when
 *    complete, and a whole date can be pasted;
 *  - the calendar button: pick the year, then the month, then the day
 *    (then hour and minutes in DateTimeField).
 *
 * Values in and out are strings — see utils/date-input.ts.
 */

interface BaseProps {
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

/**
 * The picker keeps its own copy of what is on screen. The parent only hears
 * about finished dates, so a half-typed "15/03/20" is never overwritten by a
 * re-render; the copy is replaced only when the parent's value really changes
 * (a shortcut chip, a form reset).
 *
 * "Finished" depends on how the date is entered:
 *  - typing: when every part is filled in with a plausible year;
 *  - calendar: when the calendar closes (onAccept). Each step — year, then
 *    month — already changes the value; reporting those would make a filter
 *    fetch three times for one choice.
 */
function useDateInput({ value, onChange, required, minDate, maxDate }: BaseProps, kind: DateInputKind) {
  const [shown, setShown] = useState<Dayjs | null>(() => parseDateInput(value, kind));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setShown(parseDateInput(value, kind));
  }

  const [open, setOpen] = useState(false);

  function commit(next: Dayjs | null) {
    const out = serializeDateInput(next, kind);
    if (out !== undefined && out !== synced) {
      setSynced(out);
      onChange(out);
    }
  }

  function handleChange(next: Dayjs | null) {
    setShown(next);
    if (!open) commit(next);
  }

  const error = dateInputError(shown, kind, { required, minDate, maxDate });

  // Inside a <form>, an unfinished or out-of-range date blocks the submit with
  // the same message, like any other invalid field (native form validation).
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? '');
  }, [error]);

  // Errors show once the user leaves the field — not while typing — and an
  // empty required field is reported on submit, not before touching it.
  const [focused, setFocused] = useState(false);
  const visibleError = !focused && shown !== null ? error : null;

  return { shown, handleChange, commit, setOpen, inputRef, visibleError, setFocused };
}

function pickerProps(props: BaseProps, kind: DateInputKind) {
  const min = parseDateInput(props.minDate ?? '', 'date');
  const max = parseDateInput(props.maxDate ?? '', 'date');
  return {
    format: DISPLAY_FORMAT[kind],
    openTo: 'year' as const,
    minDate: min ?? parseDateInput(`${MIN_YEAR}-01-01`, 'date')!,
    maxDate: max ?? parseDateInput(`${MAX_YEAR}-12-31`, 'date')!,
    disabled: props.disabled,
    sx: props.sx,
  };
}

function slotPropsFor(props: BaseProps, state: ReturnType<typeof useDateInput>) {
  return {
    field: { clearable: !props.required },
    textField: {
      required: props.required,
      size: props.size,
      fullWidth: props.fullWidth,
      error: state.visibleError !== null,
      helperText: state.visibleError ?? props.helperText,
      onFocus: () => state.setFocused(true),
      onBlur: () => state.setFocused(false),
    },
  };
}

/** Calendar day: dd/mm/aaaa. Value 'YYYY-MM-DD'. */
export function DateField(props: BaseProps) {
  const state = useDateInput(props, 'date');
  return (
    <DatePicker
      label={props.label}
      value={state.shown}
      onChange={state.handleChange}
      onAccept={state.commit}
      onOpen={() => state.setOpen(true)}
      onClose={() => state.setOpen(false)}
      inputRef={state.inputRef}
      views={['year', 'month', 'day']}
      {...pickerProps(props, 'date')}
      slotProps={slotPropsFor(props, state)}
    />
  );
}

/** Date and time: dd/mm/aaaa hh:mm (24 h). Value 'YYYY-MM-DDTHH:mm' in local time. */
export function DateTimeField(props: BaseProps) {
  const state = useDateInput(props, 'dateTime');
  return (
    <DateTimePicker
      label={props.label}
      value={state.shown}
      onChange={state.handleChange}
      onAccept={state.commit}
      onOpen={() => state.setOpen(true)}
      onClose={() => state.setOpen(false)}
      inputRef={state.inputRef}
      views={['year', 'month', 'day', 'hours', 'minutes']}
      ampm={false}
      {...pickerProps(props, 'dateTime')}
      slotProps={slotPropsFor(props, state)}
    />
  );
}
