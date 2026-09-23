export interface SearchFieldProps {
  /** Applied search (what the list is currently filtered by). */
  value: string;
  /** Called with the trimmed text once the user stops typing, or at once on Enter / clear. */
  onSearch: (text: string) => void;
  label?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  minWidth?: number;
}
