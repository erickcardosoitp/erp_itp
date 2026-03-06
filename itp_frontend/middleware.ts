import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Extração do Token com verificação de conteúdo
  const token = request.cookies.get('@ITP:token')?.value;
  const hasValidToken = token && token.length > 0; //
  const { pathname } = request.nextUrl; //

  // 2. Redirecionamento da Raiz (Otimizado)
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = hasValidToken ? '/dashboard' : '/login'; //
    return NextResponse.redirect(url);
  }

  // 3. Proteção de Rotas Privadas
  const privateRoutes = ['/dashboard', '/matriculas', '/academico', '/financeiro'];
  const isPrivateRoute = privateRoutes.some(route => pathname.startsWith(route)); //

  if (isPrivateRoute && !hasValidToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname); //
    return NextResponse.redirect(loginUrl);
  }

  // 4. Impedir usuário logado de acessar a página de Login
  if (pathname.startsWith('/login') && hasValidToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url)); //
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