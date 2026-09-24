import type { DocumentType } from '@/api/documents.api';

export const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'LICENSE', label: 'Licencia' },
  { value: 'ART', label: 'ART' },
  { value: 'PSYCHOPHYSICAL', label: 'Psicofísico' },
];
