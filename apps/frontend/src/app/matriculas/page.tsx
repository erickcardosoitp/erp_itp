import { redirect } from 'next/navigation';

export default function MatriculasRedirect() {
  redirect('/academico?tab=matriculas');
}
