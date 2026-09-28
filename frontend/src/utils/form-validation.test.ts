import { afterEach, describe, expect, it } from 'vitest';
import { formValidationError } from './form-validation';

function form(html: string): HTMLFormElement {
  const f = document.createElement('form');
  f.noValidate = true;
  f.innerHTML = html;
  document.body.appendChild(f);
  return f;
}

describe('formValidationError (forms with noValidate)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when every field is valid', () => {
    const f = form('<label for="a">Modelo</label><input id="a" required value="Iveco">');
    expect(formValidationError(f)).toBeNull();
  });

  it('names the first empty required field, without the asterisk', () => {
    const f = form(
      '<label for="a">Patente *</label><input id="a" required>' +
        '<label for="b">Modelo *</label><input id="b" required>',
    );
    expect(formValidationError(f)).toBe('Completá el campo "Patente".');
    expect(document.activeElement?.id).toBe('a');
  });

  it("keeps our own components' message (date / address)", () => {
    const f = form('<label for="d">Destino</label><input id="d" value="Rosar">');
    (f.querySelector('#d') as HTMLInputElement).setCustomValidity('Elegí una dirección de la lista');
    expect(formValidationError(f)).toBe('Destino: Elegí una dirección de la lista');
  });

  it('explains format and range errors', () => {
    expect(formValidationError(form('<label for="e">Email</label><input id="e" type="email" value="abc">'))).toBe(
      '"Email" no tiene un formato válido.',
    );
    document.body.innerHTML = '';
    expect(formValidationError(form('<label for="y">Año</label><input id="y" type="number" min="1950" value="1900">'))).toBe(
      '"Año" tiene que ser como mínimo 1950.',
    );
  });

  it('finds the label of a MUI select through its form control', () => {
    const f = form(
      '<div class="MuiFormControl-root"><label>Vehículo *</label><div role="combobox"></div>' +
        '<input aria-hidden="true" tabindex="-1" required value=""></div>',
    );
    expect(formValidationError(f)).toBe('Completá el campo "Vehículo".');
  });

  it('ignores disabled fields', () => {
    const f = form('<label for="a">Chofer</label><input id="a" required disabled>');
    expect(formValidationError(f)).toBeNull();
  });
});
