import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Nome do cookie sincronizado com o backend (auth.controller.ts)
  const token = request.cookies.get('itp_token')?.value;
  const hasValidToken = !!token;
  const { pathname } = request.nextUrl;

  // Redirecionamento da Raiz
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = hasValidToken ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  // Proteção de Rotas Privadas
  const privateRoutes = [
    '/dashboard',
    '/matriculas',
    '/academico',
    '/financeiro',
    '/cadastro',
    '/config',
    '/doacoes',
    '/estoque',
    '/relatorios',
  ];
  // Rota pública do coletor — não exige autenticação
  if (pathname.startsWith('/estoque/coletor')) return NextResponse.next();

  const isPrivateRoute = privateRoutes.some(route => pathname.startsWith(route));

  if (isPrivateRoute && !hasValidToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Impedir usuário logado de acessar a página de Login
  if (pathname.startsWith('/login') && hasValidToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Matcher focado em rotas de páginas. 
     * Exclui explicitamente arquivos internos do Next.js e estáticos.
     */
    '/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js).*)',
  ],
};