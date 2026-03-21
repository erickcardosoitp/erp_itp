# 🎯 Fluxo - Matrícula Direta com Cursos Ativos

```
┌─────────────────────────────────────────────────────────────────┐
│        FRONTEND - Formulário de Matrícula Direta               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣ Page Load                                                   │
│  └─> GET /api/matriculas/cursos-ativos-academico                │
│      ↓                                                          │
│  ┌─────────────────────────────────────────┐                   │
│  │ Response: Array de Cursos com Turmas    │                   │
│  │                                         │                   │
│  │ [                                       │                   │
│  │   {                                     │                   │
│  │     id: "uuid-1",                       │                   │
│  │     nome: "Inglês",                     │                   │
│  │     sigla: "ING",                       │                   │
│  │     turmas: [                           │                   │
│  │       { id: "T1", nome: "Turma A" },    │                   │
│  │       { id: "T2", nome: "Turma B" }     │                   │
│  │     ]                                   │                   │
│  │   },                                    │                   │
│  │   ...                                   │                   │
│  │ ]                                       │                   │
│  └─────────────────────────────────────────┘                   │
│      ↓                                                          │
│  2️⃣ Renderizar Checkboxes/Multiselect                          │
│     [✓] Inglês - Turma A                                       │
│     [✓] Inglês - Turma B                                       │
│     [✓] Informática - Turma C                                  │
│     ...                                                        │
│                                                                 │
│  3️⃣ Preencher Dados do Aluno                                    │
│     Nome: João Silva                                           │
│     CPF: 123.456.789-00                                        │
│     Email: joao@example.com                                    │
│     ...                                                        │
│                                                                 │
│  4️⃣ Submeter Formulário                                        │
│  └─> POST /api/matriculas/aluno-direto                         │
│      payload: {                                                │
│        nome_completo: "João Silva",                            │
│        cpf: "123.456.789-00",                                  │
│        email: "joao@example.com",                              │
│        curso_ids: ["uuid-1", "uuid-2"], ← NOVO!               │
│        ...                                                     │
│      }                                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓ HTTP POST
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND - Processar Matrícula Direta               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MatriculasService.criarAlunoDireto()                          │
│  ├─ Validação de campos obrigatórios ✅                        │
│  ├─ Verifica CPF duplicado ✅                                  │
│  ├─ Para cada curso_id:                                        │
│  │  ├─ Busca curso no banco                                    │
│  │  ├─ Busca turma ativa desse curso                          │
│  │  ├─ Cria TurmaAluno com status 'ativo'                     │
│  │  └─ Log: ✅ Aluno adicionado à turma                       │
│  ├─ Cria Aluno no banco                                        │
│  ├─ Gera número de matrícula ITP-2026-03211                   │
│  ├─ Cria notificação                                           │
│  └─ Return: Aluno criado                                       │
│                                                                 │
│  Database:                                                     │
│  ├─ INSERT INTO alunos (numero_matricula, ...)                │
│  └─ INSERT INTO turma_alunos (aluno_id, turma_id, status)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓ HTTP Response (201)
┌─────────────────────────────────────────────────────────────────┐
│               FRONTEND - Sucesso ou Erro                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Sucesso (HTTP 201):                                         │
│  {                                                              │
│    id: "uuid-aluno",                                            │
│    numero_matricula: "ITP-2026-03211",                          │
│    nome_completo: "João Silva",                                │
│    cursos_matriculados: "Inglês, Informática",                 │
│    ativo: true,                                                │
│    data_matricula: "2026-03-21T..."                            │
│  }                                                              │
│                                                                 │
│  ❌ Erro:                                                       │
│  {                                                              │
│    statusCode: 400,                                            │
│    message: "CPF 123.456.789-00 já possui matrícula ativa."    │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Alterações Principais

| Arquivo | O quê | Impacto |
|---------|-------|--------|
| **matriculas.service.ts** | Método `criarAlunoDireto()` agora processa `curso_ids` | Matrícula direta com cursos real |
| **matriculas.service.ts** | Novo método `obterCursosAtivosComTurmas()` | Busca no BD, não hardcoded |
| **matriculas.controller.ts** | Novo endpoint `GET /cursos-ativos-academico` | Frontend consegue listar |
| **academico.service.ts** | Novo método `listarCursosAtivos()` | Reutilizável |
| **academico.controller.ts** | Novo endpoint `GET /cursos/ativos` | Alternative curta |
| **package.json** | Scripts TypeORM + Jest | Pronto para migrations |

---

## 🚀 Para Testar

### 1️⃣ **No Postman/Insomnia:**

```
GET http://localhost:3000/api/matriculas/cursos-ativos-academico

Response:
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nome": "Inglês",
    "sigla": "ING",
    "turmas": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "nome": "Turma A - Matutino",
        "codigo": "TRM-ING-202603"
      }
    ]
  }
]
```

### 2️⃣ **Criar Aluno Direto:**

```
POST http://localhost:3000/api/matriculas/aluno-direto
Header: Authorization: Bearer <JWT_DRT>
Body:
{
  "nome_completo": "Maria Santos",
  "cpf": "987.654.321-00",
  "email": "maria@example.com",
  "celular": "21988888888",
  "curso_ids": ["550e8400-e29b-41d4-a716-446655440000"]
}

Response (201):
{
  "id": "uuid-novo-aluno",
  "numero_matricula": "ITP-2026-03211",
  "nome_completo": "Maria Santos",
  "cursos_matriculados": "Inglês",
  "ativo": true
}
```

---

## ⚠️ Casos Especiais

| Cenário | Comportamento |
|---------|---------------|
| `curso_ids` vazio | Aluno adicionado ao backlog |
| Curso não existe | Query retorna vazio, aluno ao backlog |
| Turma não ativa | Aluno ao backlog com log de aviso |
| CPF duplicado | BadRequestException (400) |
| Sem autenticação DRT | UnauthorizedException (401) |

---

**Status:** ✅ Pronto para usar  
**Última atualização:** 21/03/2026
