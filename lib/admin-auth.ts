import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "image_poll_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

export function isAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(candidate: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export function createAdminSessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return "";

  return createHmac("sha256", password)
    .update("image-poll-admin-session-v1")
    .digest("hex");
}

export function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;
  const expected = createAdminSessionToken();
  if (!expected) return false;

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return (
    tokenBuffer.length === expectedBuffer.length &&
    timingSafeEqual(tokenBuffer, expectedBuffer)
  );
}
