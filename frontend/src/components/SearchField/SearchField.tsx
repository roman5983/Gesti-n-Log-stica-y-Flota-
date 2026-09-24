import { useEffect, useRef, useState } from 'react';
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import type { SearchFieldProps } from './SearchField.types';
import { SEARCH_DEBOUNCE_MS } from './SearchField.const';

/**
 * Search box with a magnifier icon (P-OP-3 "buscador tipo lupa").
 *
 * It keeps its own draft while the user types and reports it after a short
 * pause, so the list is not re-queried on every keystroke. Enter applies the
 * search immediately and the ✕ button clears it.
 */
export function SearchField({
  value,
  onSearch,
  label = 'Buscar',
  placeholder,
  size = 'small',
  minWidth = 280,
}: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // An external change of the applied search (e.g. a reset) replaces the
  // draft. Adjusted during render, as React recommends for derived state.
  const [appliedValue, setAppliedValue] = useState(value);
  if (value !== appliedValue) {
    setAppliedValue(value);
    if (draft.trim() !== value) setDraft(value);
  }

  useEffect(() => {
    const text = draft.trim();
    if (text === value) return undefined;
    const id = setTimeout(() => onSearchRef.current(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, value]);

  return (
    <TextField
      type="search"
      label={label}
      placeholder={placeholder}
      size={size}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch(draft.trim());
        if (e.key === 'Escape' && draft) {
          setDraft('');
          onSearch('');
        }
      }}
      sx={{ minWidth, '& input[type=search]::-webkit-search-cancel-button': { display: 'none' } }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: draft ? (
          <InputAdornment position="end">
            <Tooltip title="Limpiar búsqueda">
              <IconButton
                size="small"
                edge="end"
                aria-label="Limpiar búsqueda"
                onClick={() => {
                  setDraft('');
                  onSearch('');
                }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
}
