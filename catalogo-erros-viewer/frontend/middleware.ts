import { NextRequest, NextResponse } from "next/server";
import { validarCookieSessao, SESSION_COOKIE } from "./app/lib/session";

// Gate unico do ITP_TEC. Roda em Edge Runtime (padrao do middleware do
// Next) - por isso session.ts usa WebCrypto, nao o modulo `crypto` do
// Node. Bloqueia TUDO (paginas e /backend-api/*) sem sessao valida,
// exceto login/callback/assets estaticos.
const ROTAS_PUBLICAS = ["/login", "/api/auth/login", "/api/auth/callback"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ROTAS_PUBLICAS.some((r) => pathname.startsWith(r)) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessao = await validarCookieSessao(cookie);

  if (!sessao) {
    if (pathname.startsWith("/backend-api")) {
      return NextResponse.json({ detail: "não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Propaga a sessao pro backend via header - as rotas de escrita
  // (criar/executar tarefa) checam role a partir daqui.
  const headers = new Headers(req.headers);
  headers.set("x-itp-tec-email", sessao.email);
  headers.set("x-itp-tec-role", sessao.role);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
