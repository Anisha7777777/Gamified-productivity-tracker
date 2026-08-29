import jwt, { type SignOptions } from "jsonwebtoken";
import { getJwtExpiry, getJwtSecret } from "../config/env";

export type AuthTokenPayload = {
  userId: string;
  tokenVersion: number;
};

export const createAuthToken = (userId: string, tokenVersion: number) => {
  const options: SignOptions = {
    expiresIn: getJwtExpiry() as Exclude<
      SignOptions["expiresIn"],
      undefined
    >,
  };

  return jwt.sign({ userId, tokenVersion }, getJwtSecret(), options);
};

export const verifyAuthToken = (token: string) => {
  const payload = jwt.verify(token, getJwtSecret());

  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.tokenVersion !== "number"
  ) {
    throw new Error("Invalid token payload");
  }

  return payload as AuthTokenPayload;
};
