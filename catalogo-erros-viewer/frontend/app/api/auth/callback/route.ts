import { NextRequest, NextResponse } from "next/server";
import { criarCookieSessao, determinarRole, SESSION_COOKIE } from "../../../lib/session";

// Troca o code pelo token direto com o Microsoft (server-to-server, TLS +
// client_secret) - o id_token que volta ja e' confiavel sem precisar
// verificar assinatura JWS/JWKS (diferente do implicit flow, onde o token
// chega via redirect do browser e PRECISARIA de verificacao).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = req.cookies.get("itp_tec_oauth_state")?.value;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(new URL("/login?erro=state_invalido", req.url));
  }

  const tenantId = process.env.MS_TENANT_ID!;
  const clientId = process.env.MS_CLIENT_ID!;
  const clientSecret = process.env.MS_CLIENT_SECRET!;
  const redirectUri = process.env.MS_REDIRECT_URI!;

  const tokenResp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      scope: "openid profile email",
    }),
  });

  if (!tokenResp.ok) {
    return NextResponse.redirect(new URL("/login?erro=token_falhou", req.url));
  }

  const dados = await tokenResp.json();
  const idToken: string = dados.id_token;
  const payloadBase64 = idToken.split(".")[1];
  const claims = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));

  if (claims.tid !== tenantId) {
    return NextResponse.redirect(new URL("/login?erro=tenant_invalido", req.url));
  }

  const email: string = claims.preferred_username || claims.email || claims.upn;
  const nome: string = claims.name || email;
  const role = await determinarRole(claims.oid);

  const cookieValor = await criarCookieSessao({ email, nome, role });
  const resp = NextResponse.redirect(new URL("/", req.url));
  resp.cookies.set(SESSION_COOKIE, cookieValor, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 8 * 60 * 60, path: "/",
  });
  resp.cookies.delete("itp_tec_oauth_state");
  return resp;
}
