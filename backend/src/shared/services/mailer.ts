import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProduction } from '../../config/env';

/**
 * Mailer used to deliver access credentials on user creation (DOC-1).
 *
 * If SMTP is configured (SMTP_HOST set), a real SMTP transport is used.
 * Otherwise the mailer falls back to a JSON transport that does not send
 * anything — it just serializes the message — so development and tests work
 * without an SMTP server. Sending is best-effort at the call site: a mail
 * failure must never roll back the user that was already created.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    // Dev/test: don't send, just build the message (inspectable in logs).
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

interface CredentialsEmailParams {
  to: string;
  name: string;
  email: string;
  password: string;
}

function credentialsHtml(p: CredentialsEmailParams): string {
  return `
    <p>Hola ${p.name},</p>
    <p>Se creó tu cuenta en el Sistema de Gestión Logística. Tus credenciales de acceso son:</p>
    <ul>
      <li><strong>Usuario:</strong> ${p.email}</li>
      <li><strong>Contraseña:</strong> ${p.password}</li>
    </ul>
    <p>Podés ingresar en <a href="${env.APP_URL}">${env.APP_URL}</a>.</p>
    <p>Por seguridad, no compartas este correo.</p>
  `;
}

/**
 * Send the access credentials email. Never throws: on failure it logs and
 * resolves, so the caller (user/driver creation) is unaffected.
 */
export async function sendCredentialsEmail(params: CredentialsEmailParams): Promise<void> {
  try {
    const info = await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: params.to,
      subject: 'Tus credenciales de acceso — Gestión Logística',
      html: credentialsHtml(params),
    });
    if (!isProduction && !env.SMTP_HOST) {
      // Dev mode: surface that the email was built but not actually sent.
      // eslint-disable-next-line no-console
      console.log(`[mailer:dev] credentials email for ${params.to} (not sent — no SMTP configured)`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[mailer] credentials email sent to ${params.to} (id: ${info.messageId})`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[mailer] failed to send credentials email to ${params.to}:`, err);
  }
}
