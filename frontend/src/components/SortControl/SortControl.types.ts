export type SortOrder = 'asc' | 'desc';

export interface SortOption<K extends string> {
  value: K;
  label: string;
  /** How each direction reads for this field ("Más recientes", "A → Z"…). */
  ascLabel?: string;
  descLabel?: string;
}

export interface SortControlProps<K extends string> {
  options: SortOption<K>[];
  sortBy: K;
  sortOrder: SortOrder;
  onChange: (sortBy: K, sortOrder: SortOrder) => void;
  size?: 'small' | 'medium';
}
