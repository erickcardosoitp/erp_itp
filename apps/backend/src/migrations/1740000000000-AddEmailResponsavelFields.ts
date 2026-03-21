import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmailResponsavelFields1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adiciona email_responsavel na tabela inscricoes
    await queryRunner.addColumn(
      'inscricoes',
      new TableColumn({
        name: 'email_responsavel',
        type: 'varchar',
        isNullable: true,
      })
    );

    // Adiciona email_responsavel na tabela alunos
    await queryRunner.addColumn(
      'alunos',
      new TableColumn({
        name: 'email_responsavel',
        type: 'varchar',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove email_responsavel da tabela inscricoes
    await queryRunner.dropColumn('inscricoes', 'email_responsavel');

    // Remove email_responsavel da tabela alunos
    await queryRunner.dropColumn('alunos', 'email_responsavel');
  }
}
