import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host');
  const token = request.cookies.get('@ITP:token')?.value;

  // --- LOGICA DE DOMÍNIO (SAAS) ---
  // Se o usuário acessar o subdomínio itp. e estiver na raiz, 
  // mandamos direto para o dashboard/grade (ou login se não houver token)
  if (hostname === 'itp.institutotiapretinha.org' && pathname === '/') {
    const target = token ? '/academico' : '/login';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // --- LOGICA DE AUTENTICAÇÃO ---
  // Adicionei todas as rotas operacionais do sistema ao controle
  const privateRoutes = ['/matriculas', '/dashboard', '/academico', '/estoque', '/financeiro', '/doacoes'];
  const isPrivateRoute = privateRoutes.some(route => pathname.startsWith(route));

  if (isPrivateRoute && !token) {
    // Importante: salva a URL que ele tentou acessar para redirecionar após o login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // O matcher agora deve cobrir todas as rotas que queremos proteger
  matcher: [
    '/',
    '/matriculas/:path*', 
    '/dashboard/:path*', 
    '/academico/:path*', 
    '/estoque/:path*', 
    '/financeiro/:path*', 
    '/doacoes/:path*'
  ],
};