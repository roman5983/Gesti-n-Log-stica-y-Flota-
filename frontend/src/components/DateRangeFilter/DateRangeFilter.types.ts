export interface Shortcut {
  label: string;
  range: () => [string, string];
}

export interface DateRangeFilterProps {
  /** 'YYYY-MM-DD' or '' (open-ended). */
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
  size?: 'small' | 'medium';
}
