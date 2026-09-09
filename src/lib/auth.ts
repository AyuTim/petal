import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { deleteAuthSession, ensureOwner, getList, ownerForAuthSession } from "./db";

export const OWNER_COOKIE = "little_lists_device";
export const SESSION_COOKIE = "petals_session";

export function newOwnerId() {
  return crypto.randomBytes(24).toString("base64url");
}

export function ownerIdFrom(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) return ownerForAuthSession(session)?.id ?? null;
  return request.cookies.get(OWNER_COOKIE)?.value ?? null;
}

export function ownerFor(request: NextRequest) {
  const id = ownerIdFrom(request);
  return id ? ensureOwner(id) : null;
}

export function ownsList(ownerId: string, listId: string) {
  return getList(listId)?.ownerDeviceId === ownerId;
}

export function signedInOwnerFor(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  return session ? ownerForAuthSession(session) : null;
}

export function clearSessionFor(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) deleteAuthSession(session);
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  };
}
