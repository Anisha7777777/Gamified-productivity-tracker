export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  return secret;
};

export const getJwtExpiry = () => process.env.JWT_EXPIRES_IN || "7d";

const durationUnits = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export const getAuthCookieMaxAge = () => {
  const expiry = getJwtExpiry();
  const match = /^(\d+)([smhd])$/.exec(expiry);

  if (!match) {
    throw new Error(
      "JWT_EXPIRES_IN must use a value such as 30m, 12h, or 7d"
    );
  }

  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof durationUnits;
  return amount * durationUnits[unit];
};

export const getClientOrigin = () => {
  const origin = process.env.CLIENT_ORIGIN;

  if (!origin) {
    throw new Error("CLIENT_ORIGIN is missing");
  }

  return origin;
};

export const getAuthRateLimit = () =>
  Number(process.env.AUTH_RATE_LIMIT_MAX || 20);

export const getApiRateLimit = () =>
  Number(process.env.API_RATE_LIMIT_MAX || 300);

export const getPasswordResetRateLimit = () =>
  Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 5);

export const getPasswordResetExpiryMs = () => {
  const minutes = Number(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES || 15);

  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
    throw new Error(
      "PASSWORD_RESET_EXPIRES_IN_MINUTES must be a whole number from 1 to 60"
    );
  }

  return minutes * 60_000;
};

export const getEmailVerificationExpiryMs = () => {
  const hours = Number(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || 24);

  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    throw new Error(
      "EMAIL_VERIFICATION_EXPIRES_HOURS must be a whole number from 1 to 168"
    );
  }

  return hours * 3_600_000;
};

export const getVerificationResendRateLimit = () =>
  Number(process.env.VERIFICATION_RESEND_RATE_LIMIT_MAX || 5);

export const validateEnvironment = () => {
  getJwtSecret();
  getAuthCookieMaxAge();
  getClientOrigin();
};
