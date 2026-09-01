import { useEffect, useRef } from 'react';
import { GlobalStyles, TextField } from '@mui/material';
import { loadGoogleMaps } from '../lib/google-maps';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface Props {
  label: string;
  value: string;
  /** Called with the free text while typing and with the validated address on select. */
  onChange: (value: string) => void;
  required?: boolean;
}

/**
 * Address field with Google Places autocomplete (validates against real
 * addresses). With VITE_GOOGLE_MAPS_API_KEY it attaches a Places Autocomplete
 * to the input; on selection it stores the formatted address. Without a key
 * it degrades to a plain free-text field.
 */
export function AddressAutocomplete({ label, value, onChange, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep the latest onChange in a ref so the Places listener never goes stale.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!MAPS_KEY || !inputRef.current) return;
    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | undefined;

    loadGoogleMaps(MAPS_KEY)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'name', 'geometry'],
          componentRestrictions: { country: 'ar' },
        });
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
        onChange={(e) => onChange(e.target.value)}
        inputRef={inputRef}
        required={required}
        fullWidth
        placeholder={MAPS_KEY ? 'Empezá a escribir una dirección…' : undefined}
        helperText={MAPS_KEY ? 'Elegí una dirección de la lista' : 'Ingresá la dirección de destino'}
      />
    </>
  );
}
