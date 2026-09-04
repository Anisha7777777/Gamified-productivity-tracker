type CapturedEmail = {
  kind: "verification" | "password-reset";
  recipient: string;
  url: string;
};

const outbox: CapturedEmail[] = [];

export const clearTestOutbox = () => {
  outbox.length = 0;
};

export const getLatestTestEmail = (
  kind: CapturedEmail["kind"],
  recipient: string
) => {
  const email = [...outbox]
    .reverse()
    .find((item) => item.kind === kind && item.recipient === recipient);

  if (!email) {
    throw new Error(`No ${kind} email was captured for this test user`);
  }

  return email;
};

export const isEmailDeliveryConfigured = () => true;

export const sendPasswordResetEmail = async ({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) => {
  outbox.push({ kind: "password-reset", recipient: email, url: resetUrl });
};

export const sendEmailVerificationEmail = async ({
  email,
  verificationUrl,
}: {
  email: string;
  verificationUrl: string;
  expiresInHours: number;
}) => {
  outbox.push({ kind: "verification", recipient: email, url: verificationUrl });
};
