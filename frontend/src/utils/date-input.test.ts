import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { dateInputError, parseDateInput, serializeDateInput } from './date-input';

describe('date-input', () => {
  it('parses stored values strictly, in local time', () => {
    expect(parseDateInput('2027-03-15', 'date')?.format('DD/MM/YYYY')).toBe('15/03/2027');
    expect(parseDateInput('2027-03-15T14:30', 'dateTime')?.hour()).toBe(14);
    expect(parseDateInput('', 'date')).toBeNull();
    expect(parseDateInput('2027-02-30', 'date')).toBeNull(); // no rollover to March
    expect(parseDateInput('15/03/2027', 'date')).toBeNull();
  });

  it('reports cleared as "", finished dates as strings, and nothing while typing', () => {
    expect(serializeDateInput(null, 'date')).toBe('');
    expect(serializeDateInput(dayjs('2027-03-15'), 'date')).toBe('2027-03-15');
    expect(serializeDateInput(dayjs('2027-03-15T14:30'), 'dateTime')).toBe('2027-03-15T14:30');
    // Year typed digit by digit: valid dates, but not finished.
    expect(serializeDateInput(dayjs('0202-03-15'), 'date')).toBeUndefined();
    expect(serializeDateInput(dayjs('invalid'), 'date')).toBeUndefined();
  });

  it('explains what is wrong, in Spanish', () => {
    const d = dayjs('2026-12-31');
    expect(dateInputError(null, 'date', { required: true })).toBe('Completá la fecha');
    expect(dateInputError(null, 'date', {})).toBeNull();
    expect(dateInputError(dayjs('invalid'), 'dateTime', {})).toBe('Fecha incompleta o inválida (dd/mm/aaaa hh:mm)');
    expect(dateInputError(d, 'date', { minDate: '2027-01-01' })).toBe('No puede ser anterior al 01/01/2027');
    expect(dateInputError(d, 'date', { maxDate: '2026-12-30' })).toBe('No puede ser posterior al 30/12/2026');
    // Limits are whole days: any time on the minimum day is allowed.
    expect(dateInputError(dayjs('2027-01-01T00:05'), 'dateTime', { minDate: '2027-01-01' })).toBeNull();
  });
});
