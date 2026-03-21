#!/usr/bin/env node

/**
 * VALIDAÇÃO: Email do Responsável - Workflow de Matrícula
 * 
 * Este script verifica se todas as mudanças foram aplicadas corretamente:
 * # 1. Campo email_responsavel em Inscricao e Aluno
 * # 2. Script Forms capturando email_responsavel
 * # 3. EmailService enviar LGPD ao responsável
 * # 4. Novo endpoint para criar aluno diretamente
 */

const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    file: 'apps/backend/src/matriculas/inscricao.entity.ts',
    pattern: /email_responsavel.*varchar/,
    description: '✓ Campo email_responsavel em Inscricao'
  },
  {
    file: 'apps/backend/src/alunos/aluno.entity.ts',
    pattern: /email_responsavel.*varchar/,
    description: '✓ Campo email_responsavel em Aluno'
  },
  {
    file: 'google-apps-script/formulario-candidato.gs',
    pattern: /email_responsavel.*campo_\(r,/,
    description: '✓ Script Forms capturando email_responsavel'
  },
  {
    file: 'google-apps-script/formulario-candidato.gs',
    pattern: /email_responsavel.*dados\.email_responsavel/,
    description: '✓ Script Forms enviando email_responsavel no payload'
  },
  {
    file: 'apps/backend/src/email.service.ts',
    pattern: /enviarTermoLGPDResponsavel/,
    description: '✓ EmailService com método enviarTermoLGPDResponsavel'
  },
  {
    file: 'apps/backend/src/matriculas/matriculas.service.ts',
    pattern: /marcarComoAguardandoLGPD.*email_responsavel/s,
    description: '✓ marcarComoAguardandoLGPD enviando ao responsável'
  },
  {
    file: 'apps/backend/src/matriculas/matriculas.service.ts',
    pattern: /criarAlunoDireto/,
    description: '✓ Método criarAlunoDireto implementado'
  },
  {
    file: 'apps/backend/src/matriculas/matriculas.controller.ts',
    pattern: /@Post\('aluno-direto'\)/,
    description: '✓ Endpoint POST /matriculas/aluno-direto criado'
  },
  {
    file: 'apps/backend/src/migrations/1740000000000-AddEmailResponsavelFields.ts',
    pattern: /email_responsavel/,
    description: '✓ Migration para adicionar email_responsavel'
  }
];

let passed = 0;
let failed = 0;

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  VALIDAÇÃO: Email do Responsável - Workflow de Matrícula');
console.log('═══════════════════════════════════════════════════════════════\n');

CHECKS.forEach((check) => {
  const filePath = path.join(process.cwd(), check.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ARQUIVO NÃO ENCONTRADO: ${check.file}`);
    failed++;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  
  if (check.pattern.test(content)) {
    console.log(check.description);
    passed++;
  } else {
    console.log(`❌ ${check.description}`);
    failed++;
  }
});

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`✅ Validações Passaram: ${passed}/${CHECKS.length}`);
if (failed > 0) {
  console.log(`❌ Validações Falharam: ${failed}/${CHECKS.length}`);
}
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
}

console.log('📋 PRÓXIMOS PASSOS:');
console.log('───────────────────────────────────────────────────────────────');
console.log('1. Execute a migration:');
console.log('   npm run typeorm migration:run');
console.log('');
console.log('2. Verifique se o campo foi adicionado ao banco:');
console.log('   SELECT column_name FROM information_schema.columns WHERE table_name=\"inscricoes\" AND column_name=\"email_responsavel\";');
console.log('');
console.log('3. Teste o novo endpoint:');
console.log('   POST /api/matriculas/aluno-direto');
console.log('   Body: { nome_completo, cpf, email, celular, cursos_matriculados, ... }');
console.log('');
console.log('4. Integre o campo no formulário Google Forms se ainda não estiver');
console.log('');
console.log('═══════════════════════════════════════════════════════════════\n');
