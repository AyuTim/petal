import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, clearSessionFor, OWNER_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  clearSessionFor(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", authCookieOptions(0));
  response.cookies.set(OWNER_COOKIE, "", authCookieOptions(0));
  return response;
}
