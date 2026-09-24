import { useEffect, useRef, useState } from 'react';
import { GlobalStyles, TextField } from '@mui/material';
import { GOOGLE_MAPS_KEY, loadGoogleMaps } from '@/lib/google-maps';
import type { AddressAutocompleteProps } from './AddressAutocomplete.types';


/**
 * Address field with Google Places autocomplete (validates against real
 * addresses). With VITE_GOOGLE_MAPS_API_KEY it attaches a Places Autocomplete
 * to the input; on selection it stores the formatted address. Without a key
 * it degrades to a plain free-text field.
 */
export function AddressAutocomplete({ label, value, onChange, required }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep the latest onChange in a ref so the Places listener never goes stale.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Strict mode (only with a Maps key): the value must come from the Places
  // list, or be set by the parent (e.g. an already-saved address when editing).
  // Anything the user typed by hand and did not pick is rejected.
  const lastTyped = useRef<string | null>(null);
  const trusted = useRef('');
  const [touched, setTouched] = useState(false);
  // Strictness only applies once the Places SDK is actually attached; if it
  // fails to load, the field degrades to free text instead of blocking saves.
  const [sdkReady, setSdkReady] = useState(false);
  if (value !== lastTyped.current) trusted.current = value;
  const invalid = sdkReady && value !== '' && value !== trusted.current;

  useEffect(() => {
    inputRef.current?.setCustomValidity(invalid ? 'Elegí una dirección de la lista' : '');
  }, [invalid]);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !inputRef.current) return;
    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | undefined;

    loadGoogleMaps(GOOGLE_MAPS_KEY)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'name', 'geometry'],
          componentRestrictions: { country: 'ar' },
        });
        setSdkReady(true);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete!.getPlace();
          const address = place.formatted_address ?? place.name ?? '';
          if (address) onChangeRef.current(address);
        });
      })
      .catch(() => {
        /* SDK failed to load — the field stays usable as free text. */
      });

    return () => {
      cancelled = true;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, []);

  return (
    <>
      {/* The Places dropdown (.pac-container) renders on document.body; lift it
          above MUI dialogs (z-index 1300). */}
      <GlobalStyles styles={{ '.pac-container': { zIndex: 1400 } }} />
      <TextField
        label={label}
        value={value}
        onChange={(e) => { lastTyped.current = e.target.value; onChange(e.target.value); }}
        onBlur={() => setTouched(true)}
        error={touched && invalid}
        inputRef={inputRef}
        required={required}
        fullWidth
        placeholder={GOOGLE_MAPS_KEY ? 'Empezá a escribir una dirección…' : undefined}
        helperText={GOOGLE_MAPS_KEY ? (touched && invalid ? 'Elegí una dirección de la lista, no alcanza con escribirla' : 'Elegí una dirección de la lista') : 'Ingresá la dirección de destino'}
      />
    </>
  );
}
