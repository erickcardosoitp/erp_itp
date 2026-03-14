require('dotenv').config();
const { Client } = require('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });

db.connect().then(async () => {
  console.log('✅ Conectado ao banco.');

  // ── 0. Torna email nullable (migration) ──────────────────────────────────
  await db.query(`ALTER TABLE IF EXISTS usuarios ALTER COLUMN email DROP NOT NULL`);
  console.log('✅ email agora é nullable');

  // ── 1. Limpa email do ADM (ITP-ADM-202602-001) ───────────────────────────
  const r1 = await db.query(
    `UPDATE usuarios SET email = NULL WHERE matricula = 'ITP-ADM-202602-001' RETURNING id, nome, matricula`
  );
  console.log('🔑 ADM email removido:', r1.rows[0]);

  // ── 2. Transfere email para ITP-USR-202603-002 ────────────────────────────
  const r2 = await db.query(
    `UPDATE usuarios SET email = 'goncalvecardoso@gmail.com' WHERE matricula = 'ITP-USR-202603-002' RETURNING id, nome, matricula, email`
  );
  console.log('📧 Email transferido para ITP-USR-202603-002:', r2.rows[0]);

  // ── 3. Atualiza matricula da Gabriela (DRT): FUNC → DRT ──────────────────
  const r3 = await db.query(
    `UPDATE usuarios SET matricula = 'ITP-DRT-202603-001' WHERE matricula = 'ITP-FUNC-202603-004' RETURNING id, nome, matricula`
  );
  console.log('🎓 Matricula da Gabriela (DRT) atualizada:', r3.rows[0]);

  // ── 4. Backfill matriculas para funcionários sem matrícula ────────────────
  const semMat = await db.query(
    `SELECT id, nome, created_at FROM funcionarios WHERE matricula IS NULL ORDER BY created_at`
  );
  console.log(`\n📋 Funcionários sem matrícula: ${semMat.rows.length}`);
  for (let i = 0; i < semMat.rows.length; i++) {
    const f = semMat.rows[i];
    const d = f.created_at ? new Date(f.created_at) : new Date();
    const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const seq = String(i + 1).padStart(3, '0');
    const matricula = `ITP-FUNC-${yyyymm}-${seq}`;
    await db.query(`UPDATE funcionarios SET matricula = $1 WHERE id = $2`, [matricula, f.id]);
    console.log(`  ✅ ${f.nome} → ${matricula}`);
  }

  // ── 5. Verificação final ──────────────────────────────────────────────────
  console.log('\n=== ESTADO FINAL DOS USUÁRIOS ===');
  const users = await db.query(
    `SELECT nome, email, matricula, role FROM usuarios ORDER BY role DESC`
  );
  users.rows.forEach(u => console.log(
    u.nome.padEnd(35),
    (u.matricula ?? '(sem mat)').padEnd(25),
    (u.email ?? '(sem email)').padEnd(35),
    u.role
  ));

  await db.end();
  console.log('\n✅ Concluído.');
}).catch(e => { console.error('❌', e.message); process.exit(1); });
