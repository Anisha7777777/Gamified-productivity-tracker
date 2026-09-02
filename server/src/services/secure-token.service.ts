import { createHash, randomBytes } from "node:crypto";

// Raw tokens are emailed once; only this SHA-256 hash is stored in MongoDB.
export const createSecureToken = () => randomBytes(32).toString("hex");

export const hashSecureToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
