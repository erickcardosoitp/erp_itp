// Shared TypeScript interfaces for the Academico module

export interface Curso { id: string; nome: string; sigla: string; status: string; periodo?: string; }
export interface Professor { id: string; nome: string; especialidade?: string; email?: string; ativo?: boolean; }
export interface Turma { id: string; nome: string; curso_id?: string; professor_id?: string; turno?: string; ano?: string; max_alunos?: number; ativo?: boolean; cor?: string; total_alunos?: number; }
export interface TurmaAlunoRecord { id: string; turma_id: string | null; aluno_id: string; status: string; created_at: string; }
export interface GradeCard { id: string; dia_semana: number; horario_inicio: string; horario_fim: string; nome_turma?: string; nome_curso?: string; nome_professor?: string; turma_id?: string; sala?: string; cor?: string; }
export interface DiarioEntry { id: string; tipo: string; titulo?: string; descricao?: string; aluno_id?: string; aluno_nome?: string; turma_id?: string; data: string; usuario_nome?: string; created_at: string; }
export interface TurmaAluno { id: string; nome: string; cor?: string; status: string; }
export interface Aluno {
  id: string; nome_completo: string; numero_matricula?: string; cpf?: string; celular?: string; email?: string;
  sexo?: string; data_nascimento?: string; idade?: number; escolaridade?: string; turno_escolar?: string;
  cidade?: string; bairro?: string; logradouro?: string; numero?: string; complemento?: string; estado_uf?: string; cep?: string;
  cursos_matriculados?: string; ativo?: boolean; data_matricula?: string; lgpd_aceito?: boolean; autoriza_imagem?: boolean;
  maior_18_anos?: boolean; nome_responsavel?: string; email_responsavel?: string; grau_parentesco?: string; cpf_responsavel?: string; telefone_alternativo?: string;
  possui_alergias?: string; cuidado_especial?: string; detalhes_cuidado?: string; uso_medicamento?: string;
  turmas?: TurmaAluno[]; foto_url?: string | null; tem_foto?: boolean;
  turma_nome?: string | null; turma_status?: string;
}
export interface PresencaSessao { id: string; turma_id: string; turma_nome?: string; data: string; tema_aula?: string; conteudo_abordado?: string; usuario_nome?: string; total_presentes: number; total_ausentes: number; created_at: string; }
