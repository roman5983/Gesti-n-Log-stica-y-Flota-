import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppLocalizationProvider } from '@/components/AppLocalizationProvider/AppLocalizationProvider';
import { DateField, DateTimeField } from './DateField';

/**
 * The date input as the user drives it: typing dd/mm/aaaa, or the calendar
 * (year → month → day). What matters is what reaches the parent — forms and
 * filters must only ever see finished dates.
 */

const tick = () => act(() => new Promise((r) => setTimeout(r, 20)));

/** A parent that stores the string, like every form and filter does. */
function Harness({
  initial = '',
  withTime = false,
  onChange,
  ...rest
}: {
  initial?: string;
  withTime?: boolean;
  onChange: (v: string) => void;
  minDate?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const Field = withTime ? DateTimeField : DateField;
  return (
    <AppLocalizationProvider>
      <Field label="Fecha" value={value} onChange={(v) => { onChange(v); setValue(v); }} {...rest} />
      <button type="button" onClick={() => setValue('2030-01-02')}>externo</button>
    </AppLocalizationProvider>
  );
}

function input(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

/** Types one character into the selected part, the way the browser reports it. */
async function type(text: string) {
  for (const ch of text) {
    const el = input();
    const { value, selectionStart: a, selectionEnd: b } = el;
    fireEvent.change(el, { target: { value: value.slice(0, a!) + ch + value.slice(b!) } });
    await tick();
  }
}

async function focusField() {
  act(() => input().focus());
  await tick();
}

describe('DateField', () => {
  it('shows the dd/mm/aaaa placeholder in Spanish and existing values as dd/mm/aaaa', async () => {
    const { unmount } = render(<Harness onChange={() => {}} />);
    await focusField();
    expect(input().value).toBe('DD/MM/AAAA');
    unmount();

    render(<Harness initial="2027-03-15" onChange={() => {}} />);
    expect(input().value).toBe('15/03/2027');
  });

  it('reports a typed date once, when it is complete — never the half-typed years', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await focusField();

    await type('150320');
    expect(input().value).toBe('15/03/0020');
    expect(onChange).not.toHaveBeenCalled(); // not 0002-03-15, not 0020-03-15

    await type('27');
    expect(input().value).toBe('15/03/2027');
    expect(onChange.mock.calls).toEqual([['2027-03-15']]);
  });

  it('keeps what is being typed on screen and flags it once the user leaves the field', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await focusField();
    await type('1503');

    act(() => input().blur());
    await tick();

    expect(input().value).toBe('15/03/AAAA');
    expect(screen.getByText('Fecha incompleta o inválida (dd/mm/aaaa)')).toBeTruthy();
    expect(input().validationMessage || input().validity.customError).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens the calendar on the years, then months, then days, and reports only the final choice', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /elige fecha/i }));
    await tick();
    fireEvent.click(screen.getByRole('radio', { name: '2027' }));
    await tick();
    fireEvent.click(screen.getByRole('radio', { name: /^mar/i }));
    await tick();
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    await tick();

    expect(onChange.mock.calls).toEqual([['2027-03-15']]);
    expect(input().value).toBe('15/03/2027');
  });

  it('follows the parent when its value changes (shortcuts, form resets)', async () => {
    render(<Harness initial="2027-03-15" onChange={() => {}} />);
    fireEvent.click(screen.getByText('externo'));
    await tick();
    expect(input().value).toBe('02/01/2030');
  });

  it('reports dates outside the allowed range but marks them, and blocks the form', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} minDate="2027-01-01" />);
    await focusField();
    await type('31122026');
    act(() => input().blur());
    await tick();

    expect(onChange.mock.calls).toEqual([['2026-12-31']]);
    expect(screen.getByText('No puede ser anterior al 01/01/2027')).toBeTruthy();
    expect(input().validity.customError).toBe(true);
  });

  it('blocks the form while a required date is empty', async () => {
    render(<Harness onChange={() => {}} required />);
    await tick();
    expect(input().validity.customError).toBe(true);
    expect(input().validationMessage).toBe('Completá la fecha');
  });
});

describe('DateTimeField', () => {
  it('takes dd/mm/aaaa hh:mm (24 h) and reports local wall-clock time', async () => {
    const onChange = vi.fn();
    render(<Harness withTime onChange={onChange} />);
    await focusField();
    expect(input().value).toBe('DD/MM/AAAA hh:mm');

    await type('150320271430');

    expect(input().value).toBe('15/03/2027 14:30');
    expect(onChange).toHaveBeenLastCalledWith('2027-03-15T14:30');
    // Nothing before the year was complete (14:03 on the way to 14:30 is fine).
    expect(onChange.mock.calls.every(([v]) => v.startsWith('2027-03-15T14:'))).toBe(true);
  });
});
