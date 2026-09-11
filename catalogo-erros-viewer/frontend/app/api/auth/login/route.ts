import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Sem isso, o Next.js otimiza essa rota como estatica no build (nao
// detecta os process.env/crypto.randomBytes como motivo pra ser dinamica)
// e cacheia a resposta pra sempre - achado real, 2026-09-11: servia
// "undefined" nas env vars porque cacheou a resposta do build, antes das
// env vars de runtime existirem.
export const dynamic = "force-dynamic";

// Authorization Code flow contra o Entra ID - mesmo tenant/app do resto
// do parque (MS_TENANT_ID/MS_CLIENT_ID reaproveitados do erp_itp, ja que
// signInAudience=AzureADMyOrg ja restringe por tenant sozinho).
export async function GET(req: NextRequest) {
  const tenantId = process.env.MS_TENANT_ID!;
  const clientId = process.env.MS_CLIENT_ID!;
  const redirectUri = process.env.MS_REDIRECT_URI!;

  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);

  const resp = NextResponse.redirect(url.toString());
  resp.cookies.set("itp_tec_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return resp;
}
