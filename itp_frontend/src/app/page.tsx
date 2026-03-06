import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirecionamento direto e limpo
  redirect('/dashboard');
  
  // O retorno null é necessário para o TypeScript não reclamar 
  // enquanto o redirecionamento acontece
  return null;
}