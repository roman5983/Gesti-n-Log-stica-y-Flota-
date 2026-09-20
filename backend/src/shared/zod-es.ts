import { z } from 'zod';

/** Spanish defaults for Zod's built-in issues; custom messages set on a schema still win. */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'Campo obligatorio' };
      if (issue.expected === 'number') return { message: 'Debe ser un número' };
      return { message: `Tipo inválido: se esperaba ${issue.expected}` };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: `Debe tener al menos ${issue.minimum} caracteres` };
      }
      if (issue.type === 'number') {
        return { message: `Debe ser mayor${issue.inclusive ? ' o igual' : ''} a ${issue.minimum}` };
      }
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Debe tener como máximo ${issue.maximum} caracteres` };
      }
      if (issue.type === 'number') {
        return { message: `Debe ser menor${issue.inclusive ? ' o igual' : ''} a ${issue.maximum}` };
      }
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Email inválido' };
      if (issue.validation === 'url') return { message: 'URL inválida' };
      return { message: 'Formato inválido' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Valor inválido. Opciones: ${issue.options.join(', ')}` };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Fecha inválida' };
    default:
      break;
  }
  return { message: ctx.defaultError };
});
