type WelcomeEmailArgs = {
  to: string;
  username: string;
};

type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
};

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'support@nightrespawn.local';

const getMailConfig = (): MailConfig | null => {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.FROM_EMAIL;

  if (!host || !portRaw || !user || !pass || !fromEmail) {
    return null;
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    fromEmail
  };
};

const loadNodemailer = async () => {
  const moduleName = process.env.MAILER_MODULE || 'nodemailer';
  return import(moduleName);
};

export async function sendWelcomeEmail({ to, username }: WelcomeEmailArgs) {
  const config = getMailConfig();
  if (!config) {
    throw new Error('Mailer is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and FROM_EMAIL.');
  }

  const nodemailerModule: any = await loadNodemailer();
  const nodemailer = nodemailerModule.default ?? nodemailerModule;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  const subject = 'Welcome to NightRespawn!';
  const text = [
    `Hi ${username},`,
    '',
    'Welcome to NightRespawn! We are excited to have you in the community.',
    'If you need help, reach us anytime at ' + SUPPORT_EMAIL + '.',
    '',
    '— NightRespawn Team'
  ].join('\n');

  await transporter.sendMail({
    from: config.fromEmail,
    to,
    subject,
    text
  });
}
