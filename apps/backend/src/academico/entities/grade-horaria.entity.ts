import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('grade_horaria')
export class GradeHoraria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab */
  @Column({ name: 'dia_semana', type: 'int', nullable: true })
  dia_semana: number;

  @Column({ name: 'horario_inicio', type: 'time' })
  horario_inicio: string;

  @Column({ name: 'horario_fim', type: 'time' })
  horario_fim: string;

  @Column({ name: 'materia_id', nullable: true })
  materia_id: string;

  @Column({ name: 'nome_curso', nullable: true })
  nome_curso: string;

  @Column({ name: 'professor_id', nullable: true })
  professor_id: string;

  @Column({ name: 'nome_professor', nullable: true })
  nome_professor: string;

  @Column({ name: 'turma_id', nullable: true })
  turma_id: string;

  @Column({ nullable: true })
  sala: string;

  @Column({ default: '#7c3aed' })
  cor: string;
}
