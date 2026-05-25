# TI TOTAL — Produção de Aulas com IA

Plataforma completa para gerenciar e executar o processo de produção de aulas do TI TOTAL com suporte a IA.

## Arquitetura

### Stack
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Banco**: Supabase (PostgreSQL) + Prisma ORM v5
- **IA**: Configurável (OpenAI / Anthropic Claude)
- **Storage**: Supabase Storage
- **Deploy**: Vercel + Supabase

### Entidades Principais
```
Course → Discipline → Lesson → LessonTopic
                            → WorkflowStep (12 etapas)
                                → StepRun (versioned)
                                    → Feedback
                            → Question → QuestionComment
                            → File
                            → LessonMemory
```

### Workflow (12 Etapas)
```
0. Cadastro (Manual)
1. Seleção de Questões (IA)
2. Cadernos de Questões (IA)
3. Preparação Editorial (IA)
4. Produção da Teoria (IA)
5. Padronização Editorial (IA)
6. Comentários das Questões (IA)
7. Montagem dos PDFs (IA)
8. Slides da Aula (IA)
9. Revisão Humana (Manual)
10. Gravação da Aula (Manual)
11. Publicação (Assistida)
```

**Regra de Gates**: Uma etapa só pode iniciar se a anterior estiver `APROVADA`.

---

## Instalação e Setup

### Pré-requisitos
- Node.js 18+
- Conta Supabase (banco + storage)
- Chave de API OpenAI ou Anthropic

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:

```env
# Supabase
DATABASE_URL="postgresql://postgres:[SENHA]@[HOST]:5432/postgres?schema=public"
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"

# IA (configure pelo menos um)
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Auth
NEXTAUTH_SECRET="gere-uma-string-aleatoria-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Criar banco de dados
```bash
# Aplicar o schema no banco
npm run db:push

# Popular com dados de exemplo
npm run db:seed
```

### 4. Rodar em desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:3000

### 5. Deploy na Vercel
```bash
# Via CLI
vercel deploy --prod

# Ou conecte o repositório GitHub em vercel.com
```

Configure as mesmas variáveis de ambiente no painel da Vercel.

---

## Configuração do Supabase

### 1. Criar projeto
- Acesse [supabase.com](https://supabase.com)
- Crie um novo projeto
- Copie a URL e as chaves para `.env.local`

### 2. Banco de dados
A URL do banco está em: **Settings → Database → Connection string**

Use a "URI" no formato:
```
postgresql://postgres:[senha]@[host]:5432/postgres
```

### 3. Storage (para arquivos)
- Crie um bucket chamado `producao-aulas`
- Defina política de acesso conforme necessário

---

## Configuração de IA

### Pela interface
1. Acesse `/configuracoes/ia`
2. Selecione o provedor (OpenAI ou Anthropic)
3. Escolha o modelo
4. Insira a chave de API
5. Ajuste temperatura e limite de tokens
6. Clique em "Testar" e depois "Salvar"

### Prompts por etapa
1. Acesse `/configuracoes/prompts`
2. Selecione a etapa
3. Edite o prompt
4. Salve (cria nova versão automaticamente)

---

## Uso do Sistema

### Criando uma nova aula
1. Acesse `/aulas/nova`
2. Preencha a arquitetura pedagógica (título, código, tópicos, bancas, etc.)
3. Clique em "Salvar e Iniciar Produção"

### Executando uma etapa com IA
1. Abra a aula → clique na etapa
2. Revise o briefing e contexto
3. Clique em **"Gerar com IA"**
4. Aguarde a geração
5. Marque todos os itens do checklist de qualidade
6. Clique em **"Aprovar Etapa"** ou **"Reprovar e Enviar Feedback"**

### Gate de aprovação
- `APROVADA` → próxima etapa desbloqueada automaticamente
- `REPROVADA` → IA recebe feedback e refaz somente aquela etapa
- Nunca se avança sem aprovação

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── (app)/                    # Layout principal
│   │   ├── dashboard/            # Dashboard geral
│   │   ├── aulas/
│   │   │   ├── page.tsx          # Lista de aulas
│   │   │   ├── nova/             # Cadastrar aula
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Workflow da aula
│   │   │       ├── etapas/[stepId]/  # Execução de etapa
│   │   │       └── publicacao/   # Checklist de publicação
│   │   ├── biblioteca/           # Biblioteca de arquivos
│   │   └── configuracoes/
│   │       ├── editorial/        # Padrão editorial
│   │       ├── prompts/          # Templates de prompts
│   │       └── ia/               # Config de IA
│   └── api/
│       ├── aulas/                # CRUD de aulas
│       ├── workflow/             # Approve/reject
│       ├── ai/generate/          # Geração com IA
│       └── questions/            # Gestão de questões
├── components/
│   ├── ui/                       # Componentes base
│   ├── layout/                   # Sidebar, Topbar
│   └── workflow/                 # StatusBadge, Timeline
├── lib/
│   ├── prisma.ts                 # Cliente Prisma
│   ├── utils.ts                  # Helpers
│   └── mock/data.ts              # Dados de exemplo
└── types/index.ts                # Tipos e constantes
```

---

## Perfis de Acesso

| Perfil | Permissões |
|--------|-----------|
| Admin | Tudo |
| Coordenadora | Aprovar, reprovar, editar, configurar |
| Assistente Editorial | Executar etapas, anexar arquivos |
| Revisor | Revisão manual e feedback |
| Visualizador | Somente leitura |

---

## Próximas Integrações (Planejadas)

- [ ] TEC Concursos (importar questões automaticamente)
- [ ] Google Drive (backup e compartilhamento)
- [ ] ClickUp (gestão de tarefas)
- [ ] Plataforma de cursos (publicação direta)
- [ ] Múltiplos professores / equipes
- [ ] Analytics de produtividade
- [ ] Exportação DOCX / PDF / PPTX
- [ ] Fila de produção
