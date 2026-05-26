export const mockLessons = [
  {
    id: "lesson-fd02",
    code: "BD-FD02",
    title: "Fundamentos de Bancos de Dados",
    subtitle: "Conceitos essenciais de BD e SGBD para concursos",
    position: 2,
    status: "EM_PRODUCAO",
    estimatedHours: 32,
    targetPages: 80,
    priorityBoards: ["CEBRASPE", "FCC", "FGV"],
    scope: "Conceitos de banco de dados e SGBD. A abordagem de banco de dados. Metadados e catálogo. Propriedades das transações. Arquitetura ANSI/SPARC. Modelagem de dados. Principais modelos.",
    outOfScope: "SQL avançado, otimização de queries, administração de banco de dados",
    studentProfile: "Candidatos a cargos de TI em órgãos federais e estaduais. Nível médio a superior.",
    depthLevel: "Intermediário",
    pedagogicalNotes: "Priorizar conceitos cobrados pelo CEBRASPE. Enfatizar diferenças entre BD, SGBD e SBD.",
    discipline: { name: "Banco de Dados", code: "BD", course: { name: "TI TOTAL" } },
    createdAt: new Date("2024-05-01"),
    updatedAt: new Date("2024-05-25"),
    _count: { questions: 187, files: 6 },
    currentStep: 4,
    progress: 42,
  },
  {
    id: "lesson-fd01",
    code: "BD-FD01",
    title: "Introdução à Tecnologia da Informação",
    subtitle: "Hardware, software e conceitos básicos de TI",
    position: 1,
    status: "PUBLICADA",
    estimatedHours: 28,
    targetPages: 60,
    priorityBoards: ["CEBRASPE", "FCC"],
    discipline: { name: "Banco de Dados", code: "BD", course: { name: "TI TOTAL" } },
    createdAt: new Date("2024-03-01"),
    updatedAt: new Date("2024-03-15"),
    _count: { questions: 210, files: 12 },
    currentStep: 11,
    progress: 100,
  },
  {
    id: "lesson-rc01",
    code: "RC-FD01",
    title: "Fundamentos de Redes de Computadores",
    subtitle: "Modelos OSI, TCP/IP e protocolos essenciais",
    position: 1,
    status: "RASCUNHO",
    estimatedHours: 35,
    targetPages: 90,
    priorityBoards: ["CEBRASPE", "FGV", "FCC"],
    discipline: { name: "Redes de Computadores", code: "RC", course: { name: "TI TOTAL" } },
    createdAt: new Date("2024-05-20"),
    updatedAt: new Date("2024-05-20"),
    _count: { questions: 0, files: 0 },
    currentStep: 0,
    progress: 5,
  },
  {
    id: "lesson-so01",
    code: "SO-FD01",
    title: "Sistemas Operacionais",
    subtitle: "Processos, memória e gerenciamento de recursos",
    position: 1,
    status: "EM_PRODUCAO",
    estimatedHours: 30,
    targetPages: 75,
    priorityBoards: ["CEBRASPE", "FCC"],
    discipline: { name: "Sistemas Operacionais", code: "SO", course: { name: "TI TOTAL" } },
    createdAt: new Date("2024-05-10"),
    updatedAt: new Date("2024-05-22"),
    _count: { questions: 95, files: 3 },
    currentStep: 2,
    progress: 22,
  },
  {
    id: "lesson-si01",
    code: "SI-FD01",
    title: "Fundamentos de Segurança da Informação",
    subtitle: "Criptografia, políticas de segurança e gestão de riscos",
    position: 1,
    status: "RASCUNHO",
    estimatedHours: 38,
    targetPages: 95,
    priorityBoards: ["CEBRASPE", "FGV", "FCC"],
    discipline: { name: "Segurança da Informação", code: "SI", course: { name: "TI TOTAL" } },
    createdAt: new Date("2024-05-26"),
    updatedAt: new Date("2024-05-26"),
    _count: { questions: 0, files: 0 },
    currentStep: 0,
    progress: 0,
  },
];

export const mockWorkflowSteps = [
  { id: "step-0", stepKey: "CADASTRO", title: "Cadastro da Aula", order: 0, isManual: true, isAiEnabled: false, status: "APROVADA", icon: "📋" },
  { id: "step-1", stepKey: "SELECAO_QUESTOES", title: "Seleção de Questões", order: 1, isManual: false, isAiEnabled: true, status: "APROVADA", icon: "🔍" },
  { id: "step-2", stepKey: "CADERNOS_QUESTOES", title: "Cadernos de Questões", order: 2, isManual: false, isAiEnabled: true, status: "APROVADA", icon: "📚" },
  { id: "step-3", stepKey: "PREPARACAO_EDITORIAL", title: "Preparação Editorial", order: 3, isManual: false, isAiEnabled: true, status: "APROVADA", icon: "✏️" },
  { id: "step-4", stepKey: "PRODUCAO_TEORIA", title: "Produção da Teoria", order: 4, isManual: false, isAiEnabled: true, status: "AGUARDANDO_APROVACAO", icon: "📖" },
  { id: "step-5", stepKey: "PADRONIZACAO_EDITORIAL", title: "Padronização Editorial", order: 5, isManual: false, isAiEnabled: true, status: "BLOQUEADA", icon: "🎨" },
  { id: "step-6", stepKey: "COMENTARIOS_QUESTOES", title: "Comentários das Questões", order: 6, isManual: false, isAiEnabled: true, status: "BLOQUEADA", icon: "💬" },
  { id: "step-7", stepKey: "MONTAGEM_PDFS", title: "Montagem dos PDFs", order: 7, isManual: false, isAiEnabled: true, status: "BLOQUEADA", icon: "📄" },
  { id: "step-8", stepKey: "SLIDES", title: "Slides da Aula", order: 8, isManual: false, isAiEnabled: true, status: "BLOQUEADA", icon: "🖥️" },
  { id: "step-9", stepKey: "REVISAO_HUMANA", title: "Revisão Humana", order: 9, isManual: true, isAiEnabled: false, status: "BLOQUEADA", icon: "👁️" },
  { id: "step-10", stepKey: "GRAVACAO", title: "Gravação da Aula", order: 10, isManual: true, isAiEnabled: false, status: "BLOQUEADA", icon: "🎥" },
  { id: "step-11", stepKey: "PUBLICACAO", title: "Publicação", order: 11, isManual: false, isAiEnabled: false, status: "BLOQUEADA", icon: "🚀" },
];

export const mockQuestions = [
  {
    id: "q-1",
    board: "CEBRASPE",
    year: 2025,
    institution: "FUB",
    role: "Técnico em TI",
    topicTitle: "Conceitos de banco de dados e SGBD",
    statement: "Um banco de dados representa aspectos do mundo real, é projetado, construído e povoado por dados e atende a uma proposta específica.",
    answerKey: "Certo",
    isStarred: true,
    relevanceScore: 0.95,
    status: "APROVADA",
  },
  {
    id: "q-2",
    board: "CEBRASPE",
    year: 2024,
    institution: "TSE",
    role: "Técnico Judiciário – Programação",
    topicTitle: "Conceitos de banco de dados e SGBD",
    statement: "Um SGBD funciona como uma interface entre o banco de dados e seus usuários, concedendo aos usuários permissões para recuperação, atualização e gerenciamento das informações.",
    answerKey: "Certo",
    isStarred: true,
    relevanceScore: 0.92,
    status: "APROVADA",
  },
  {
    id: "q-3",
    board: "CEBRASPE",
    year: 2025,
    institution: "PCDF",
    role: "Gestor de Apoio",
    topicTitle: "Conceitos de banco de dados e SGBD",
    statement: "Um esquema de banco de dados corresponde a um conjunto de registros formado por colunas, entre as quais se inclui a chave primária.",
    answerKey: "Errado",
    isStarred: false,
    relevanceScore: 0.85,
    status: "APROVADA",
  },
  {
    id: "q-4",
    board: "FGV",
    year: 2024,
    institution: "MPE-RN",
    role: "Analista de TI",
    topicTitle: "Propriedades das transações (ACID)",
    statement: "A propriedade de atomicidade das transações em bancos de dados garante que todas as operações de uma transação sejam concluídas com sucesso ou nenhuma delas seja aplicada.",
    answerKey: "Certo",
    isStarred: true,
    relevanceScore: 0.90,
    status: "APROVADA",
  },
  {
    id: "q-5",
    board: "FCC",
    year: 2023,
    institution: "TRT-3",
    role: "Analista Judiciário – TI",
    topicTitle: "Arquitetura ANSI/SPARC",
    statement: "A arquitetura de três esquemas (ANSI/SPARC) divide o banco de dados em três níveis: interno, conceitual e externo, promovendo a independência de dados.",
    answerKey: "Certo",
    isStarred: false,
    relevanceScore: 0.88,
    status: "APROVADA",
  },
];

export const mockFiles = [
  { id: "f-1", name: "BD-FD02-Questoes-Bruto.docx", fileType: "QUESTOES_BRUTAS", version: 1, createdAt: new Date("2024-05-05") },
  { id: "f-2", name: "BD-FD02-Questoes-Editorial.docx", fileType: "QUESTOES_EDITORIAL", version: 2, createdAt: new Date("2024-05-08") },
  { id: "f-3", name: "BD-FD02-Teoria-v1.docx", fileType: "TEORIA_BRUTA", version: 1, createdAt: new Date("2024-05-20") },
  { id: "f-4", name: "BD-FD02-Caderno-Geral.docx", fileType: "CADERNO_GERAL", version: 1, createdAt: new Date("2024-05-12") },
  { id: "f-5", name: "BD-FD02-Caderno-CEBRASPE.docx", fileType: "CADERNO_BANCA", version: 1, createdAt: new Date("2024-05-12") },
];

export const mockStepRunOutput = `# FUNDAMENTOS DE BANCOS DE DADOS

## 1. Conceitos de Banco de Dados e SGBD

### Essencial de Prova

> Um **banco de dados** é uma coleção de dados relacionados que permite armazenamento estruturado, recuperação e manipulação eficiente de dados.

Um banco de dados não é apenas um depósito de informações. Ele é **planejado para atender a um objetivo** e **refletir um contexto real**.

**Características principais:**
- Representa algum aspecto do mundo real (**minimundo**)
- É uma coleção **logicamente coerente** de dados
- Possui uma **finalidade específica**

> ⚠️ **Atenção:** Uma variedade aleatória de dados **não** constitui um banco de dados.

---

### Esquema e Instância

Um **esquema** (ou intenção) é a descrição da **estrutura** do banco de dados, sem incluir os dados. Funciona como um *projeto* do banco, definindo a organização.

> 💡 **Bizu:** Esquema = estrutura (estático) | Instância = dados (dinâmico)

Uma **instância** (estado ou extensão) representa os dados armazenados em um determinado momento. Funciona como uma "fotografia" do banco.

---

## 2. Sistema Gerenciador de Banco de Dados (SGBD)

### Essencial de Prova

> Um **SGBD** é uma coleção de programas que permite aos usuários criar e manter um banco de dados.

**Funções do SGBD:**
- **Definição:** especificação de tipos, estruturas e restrições
- **Construção:** armazenamento em meio controlado
- **Manipulação:** consulta, atualização e relatórios
- **Compartilhamento:** acesso simultâneo

> 📌 **Atenção:** O acesso ao banco de dados **não** é realizado diretamente pelas aplicações. As aplicações interagem com o SGBD, que atua como **intermediário**.

---

### Sistema de Banco de Dados (SBD)

> 💡 **Bizu:** SBD = BD + SGBD + aplicações + usuários

> ⚠️ **Atenção:** Confusão clássica de prova: SGBD ≠ Sistema de Banco de Dados. O SGBD é apenas o **software de gerenciamento**, enquanto o SBD é o conjunto completo.

---

## 3. Propriedades das Transações (ACID)

### Essencial de Prova

As propriedades **ACID** garantem a confiabilidade das transações em banco de dados:

| Propriedade | Significado |
|-------------|-------------|
| **A**tomicidade | "Tudo ou nada" — a transação é indivisível |
| **C**onsistência | O BD sai de um estado válido para outro estado válido |
| **I**solamento | Transações paralelas não se interferem |
| **D**urabilidade | Dados confirmados persistem mesmo após falha |

> ⚠️ **Atenção:** A **atomicidade** é a propriedade que garante rollback em caso de falha — se uma parte falha, todas as operações são desfeitas.`;

export const mockPrompts = [
  {
    id: "p-1",
    stepKey: "SELECAO_QUESTOES",
    name: "Seleção e Classificação de Questões",
    prompt: `Você é um especialista em produção de material para concursos públicos da área de TI.

Receberá a arquitetura pedagógica de uma aula e uma lista de questões.

Sua tarefa é:
1. Classificar cada questão por tópico da aula
2. Avaliar relevância (0-1) com base em incidência e representatividade
3. Priorizar CEBRASPE, FGV, FCC, VUNESP e questões recentes
4. Identificar questões duplicadas, fracas ou fora do escopo
5. Sugerir entre 200-250 questões quando houver base suficiente

Retorne JSON estruturado com questions, summary, discarded e gaps.`,
    version: 1,
    active: true,
  },
  {
    id: "p-2",
    stepKey: "PRODUCAO_TEORIA",
    name: "Produção de Teoria TI TOTAL",
    prompt: `Você é um especialista em produção de material didático para concursos públicos de TI.

PADRÃO TI TOTAL:
- Use "Essencial de Prova" para conteúdos de alta incidência
- Use "Atenção" para armadilhas e pegadinhas
- Use "Bizu" para memorização rápida
- Use "Dica" para estratégia de prova

DESTAQUE SEMÂNTICO:
- **negrito** = termo técnico importante
- azul = núcleo conceitual (o que é)
- vermelho = limite conceitual (o que não é)

Produza a teoria completa para os tópicos fornecidos.`,
    version: 1,
    active: true,
  },
  {
    id: "p-3",
    stepKey: "COMENTARIOS_QUESTOES",
    name: "Comentário de Questões TI TOTAL",
    prompt: `Você é um comentador de questões de concursos de TI no padrão TI TOTAL.

ESTRUTURA OBRIGATÓRIA:

**Resolução:**
[Explicação direta da questão]

Quando houver troca de conceito:
↺ [Frase corrigida com o conceito correto]

📘 **Teoria:**
[Apenas o conceito necessário]

**Gabarito:** Certo / Errado / Letra X`,
    version: 1,
    active: true,
  },
];
