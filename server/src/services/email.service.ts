import nodemailer from "nodemailer";

type SmtpSettings = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

const readSmtpSettings = (): SmtpSettings | null => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM?.trim();

  if (!host || !Number.isInteger(port) || port < 1 || port > 65_535 || !user || !password || !from) {
    return null;
  }

  return { host, port, user, password, from };
};

export const isEmailDeliveryConfigured = () => readSmtpSettings() !== null;

export const sendPasswordResetEmail = async ({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) => {
  const settings = readSmtpSettings();

  if (!settings) {
    throw new Error("Email delivery is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  });

  await transporter.sendMail({
    from: settings.from,
    to: email,
    subject: "Reset your Questly password",
    text: `Use this link to reset your Questly password. It expires in 15 minutes: ${resetUrl}`,
    html: `<p>Use this link to reset your Questly password. It expires in 15 minutes:</p><p><a href="${resetUrl}">Reset password</a></p>`,
  });
};

export const sendEmailVerificationEmail = async ({
  email,
  verificationUrl,
  expiresInHours,
}: {
  email: string;
  verificationUrl: string;
  expiresInHours: number;
}) => {
  const settings = readSmtpSettings();

  if (!settings) {
    throw new Error("Email delivery is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.password },
  });

  await transporter.sendMail({
    from: settings.from,
    to: email,
    subject: "Verify your Questly email",
    text: `Verify your Questly email address. This link expires in ${expiresInHours} hours: ${verificationUrl}`,
    html: `<p>Verify your Questly email address. This link expires in ${expiresInHours} hours:</p><p><a href="${verificationUrl}">Verify email</a></p>`,
  });
};
