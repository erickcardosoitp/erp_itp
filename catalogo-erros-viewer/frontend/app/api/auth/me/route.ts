import { NextRequest, NextResponse } from "next/server";
import { validarCookieSessao, SESSION_COOKIE } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessao = await validarCookieSessao(req.cookies.get(SESSION_COOKIE)?.value);
  if (!sessao) return NextResponse.json({ autenticado: false }, { status: 401 });
  return NextResponse.json({ autenticado: true, email: sessao.email, nome: sessao.nome, role: sessao.role });
}
