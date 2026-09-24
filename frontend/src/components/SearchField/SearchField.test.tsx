import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SearchField } from './SearchField';
import { SEARCH_DEBOUNCE_MS } from './SearchField.const';

describe('SearchField (magnifier search box)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(value = '') {
    const onSearch = vi.fn();
    render(<SearchField value={value} onSearch={onSearch} placeholder="Chofer o destino" />);
    const input = screen.getByPlaceholderText('Chofer o destino') as HTMLInputElement;
    return { onSearch, input };
  }

  it('searches once, only after the user stops typing', () => {
    const { onSearch, input } = setup();
    fireEvent.change(input, { target: { value: 'Ro' } });
    fireEvent.change(input, { target: { value: 'Rosa' } });
    fireEvent.change(input, { target: { value: 'Rosario ' } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('Rosario');
  });

  it('Enter searches right away', () => {
    const { onSearch, input } = setup();
    fireEvent.change(input, { target: { value: 'Pérez' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('Pérez');
  });

  it('the ✕ button clears the search', () => {
    const { onSearch, input } = setup('Rosario');
    expect(input.value).toBe('Rosario');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(input.value).toBe('');
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
