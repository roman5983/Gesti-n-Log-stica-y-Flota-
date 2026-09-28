type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Visible label of a field, without MUI's required asterisk. */
function fieldLabel(el: Field): string {
  const label =
    el.labels?.[0] ??
    el.closest('.MuiFormControl-root')?.querySelector('label') ??
    null;
  const text = label?.textContent ?? el.getAttribute('aria-label') ?? el.name ?? '';
  return text.replace(/[\s*]+$/, '').trim() || 'este campo';
}

function messageFor(el: Field): string {
  const v = el.validity;
  const label = fieldLabel(el);
  // Our own components (DateField, AddressAutocomplete) put a Spanish message
  // in setCustomValidity: keep it, it's more specific than a generic one.
  if (v.customError) return `${label}: ${el.validationMessage}`;
  if (v.valueMissing) return `Completá el campo "${label}".`;
  if (v.typeMismatch) return `"${label}" no tiene un formato válido.`;
  if (v.rangeUnderflow) return `"${label}" tiene que ser como mínimo ${(el as HTMLInputElement).min}.`;
  if (v.rangeOverflow) return `"${label}" tiene que ser como máximo ${(el as HTMLInputElement).max}.`;
  return `Revisá el campo "${label}".`;
}

/**
 * The forms use `noValidate`, so the browser does not block the submit with
 * its own bubble (other language, other style). The constraints are still
 * there — `required`, `type="email"`, `min`/`max`, and the custom validity of
 * DateField ("fecha incompleta") and AddressAutocomplete ("elegí una
 * dirección de la lista") — and this function checks them in the app's
 * words. Returns the message for the first invalid field (and focuses it),
 * or null if the form can be submitted.
 */
export function formValidationError(form: HTMLFormElement): string | null {
  for (const el of Array.from(form.elements) as Field[]) {
    if (!el.validity || el.validity.valid || el.disabled) continue;
    if (typeof el.focus === 'function' && el.getAttribute('aria-hidden') !== 'true') el.focus();
    return messageFor(el);
  }
  return null;
}
