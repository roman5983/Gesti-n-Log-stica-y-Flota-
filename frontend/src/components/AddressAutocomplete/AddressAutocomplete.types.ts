export interface AddressAutocompleteProps {
  label: string;
  value: string;
  /** Called with the free text while typing and with the validated address on select. */
  onChange: (value: string) => void;
  required?: boolean;
}
