import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const resp = NextResponse.redirect(new URL("/login", req.url));
  resp.cookies.delete(SESSION_COOKIE);
  return resp;
}
