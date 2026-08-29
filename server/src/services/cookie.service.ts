import type { Response } from "express";
import { getAuthCookieMaxAge } from "../config/env";

export const AUTH_COOKIE_NAME = "auth_token";

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: getAuthCookieMaxAge(),
  });
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
};
