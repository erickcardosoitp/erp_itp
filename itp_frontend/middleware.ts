import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('@ITP:token')?.value;
  const { pathname } = request.nextUrl;

  // Redireciona raiz para dashboard ou login
  if (pathname === '/') {
    return NextResponse.redirect(new URL(token ? '/dashboard' : '/login', request.url));
  }

  // Proteção de rotas privadas
  const isPrivateRoute = ['/dashboard', '/matriculas', '/academico', '/financeiro'].some(r => pathname.startsWith(r));
  if (isPrivateRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Impede logado de ir para login
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/login'],
};