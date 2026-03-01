import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redireciona automaticamente para a página de matrículas
  redirect('/matriculas');
}