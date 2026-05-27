import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Users
  const admin = await prisma.user.upsert({
    where: { email: "gestao@titotal.com" },
    update: {},
    create: {
      name: "Gestão TI TOTAL",
      email: "gestao@titotal.com",
      role: "ADMIN",
    },
  });

  const coordenadora = await prisma.user.upsert({
    where: { email: "coordenadora@titotal.com" },
    update: {},
    create: {
      name: "Coordenadora de Conteúdo",
      email: "coordenadora@titotal.com",
      role: "COORDENADORA",
    },
  });

  await prisma.user.upsert({
    where: { email: "assistente@titotal.com" },
    update: {},
    create: {
      name: "Assistente Editorial",
      email: "assistente@titotal.com",
      role: "ASSISTENTE_EDITORIAL",
    },
  });

  // Course
  const course = await prisma.course.upsert({
    where: { id: "course-ti-total-main" },
    update: {},
    create: {
      id: "course-ti-total-main",
      name: "TI TOTAL - Tecnologia da Informação para Concursos",
      description: "Curso completo de TI para concursos públicos",
    },
  });

  // Discipline: Banco de Dados
  const disciplineBD = await prisma.discipline.upsert({
    where: { id: "disc-bd-01" },
    update: {},
    create: {
      id: "disc-bd-01",
      courseId: course.id,
      name: "Banco de Dados",
      code: "BD",
      description: "Fundamentos e conceitos avançados de banco de dados",
    },
  });

  // Discipline: Redes
  const disciplineRedes = await prisma.discipline.upsert({
    where: { id: "disc-redes-01" },
    update: {},
    create: {
      id: "disc-redes-01",
      courseId: course.id,
      name: "Redes de Computadores",
      code: "RC",
      description: "Protocolos, topologias e arquiteturas de redes",
    },
  });

  // Discipline: Segurança da Informação
  await prisma.discipline.upsert({
    where: { id: "disc-si-01" },
    update: {},
    create: {
      id: "disc-si-01",
      courseId: course.id,
      name: "Segurança da Informação",
      code: "SI",
      description: "Criptografia, políticas de segurança, gestão de riscos e conformidade",
    },
  });

  // Lesson: FD02 - Fundamentos de Banco de Dados (in progress)
  const lessonFD02 = await prisma.lesson.upsert({
    where: { code: "BD-FD02" },
    update: {},
    create: {
      code: "BD-FD02",
      title: "Fundamentos de Bancos de Dados",
      subtitle: "Conceitos essenciais de BD e SGBD para concursos",
      disciplineId: disciplineBD.id,
      position: 2,
      scope:
        "Conceitos de banco de dados e SGBD. A abordagem de banco de dados. Metadados e catálogo. Propriedades das transações. Arquitetura ANSI/SPARC. Modelagem de dados. Principais modelos.",
      outOfScope:
        "SQL avançado, otimização de queries, administração de banco de dados",
      targetPages: 80,
      priorityBoards: ["CEBRASPE", "FCC", "FGV"],
      studentProfile:
        "Candidatos a cargos de TI em órgãos federais e estaduais. Nível médio a superior. Familiaridade básica com informática.",
      depthLevel: "Intermediário",
      pedagogicalNotes:
        "Priorizar conceitos cobrados pelo CEBRASPE. Enfatizar diferenças entre BD, SGBD e SBD. Destacar propriedades ACID. Arquitetura ANSI/SPARC é recorrente.",
      status: "EM_PRODUCAO",
      estimatedHours: 32,
    },
  });

  // Lesson: FD01 (completed)
  const lessonFD01 = await prisma.lesson.upsert({
    where: { code: "BD-FD01" },
    update: {},
    create: {
      code: "BD-FD01",
      title: "Introdução à Tecnologia da Informação",
      subtitle: "Conceitos básicos de hardware, software e sistemas",
      disciplineId: disciplineBD.id,
      position: 1,
      scope: "Hardware, software, sistemas operacionais, conceitos básicos de TI",
      targetPages: 60,
      priorityBoards: ["CEBRASPE", "FCC"],
      status: "PUBLICADA",
      estimatedHours: 28,
      publishedAt: new Date("2024-03-15"),
    },
  });

  // Lesson: RC01 (draft)
  await prisma.lesson.upsert({
    where: { code: "RC-FD01" },
    update: {},
    create: {
      code: "RC-FD01",
      title: "Fundamentos de Redes de Computadores",
      subtitle: "Modelos OSI, TCP/IP e protocolos essenciais",
      disciplineId: disciplineRedes.id,
      position: 1,
      scope: "Modelo OSI, TCP/IP, protocolos, topologias, equipamentos de rede",
      targetPages: 90,
      priorityBoards: ["CEBRASPE", "FGV", "FCC"],
      status: "RASCUNHO",
      estimatedHours: 35,
    },
  });

  // Topics for FD02
  const topics = [
    { title: "Conceitos de banco de dados e SGBD", order: 1 },
    { title: "A abordagem de banco de dados", order: 2 },
    { title: "Metadados e catálogo", order: 3 },
    { title: "Propriedades das transações (ACID)", order: 4 },
    { title: "Arquitetura ANSI/SPARC", order: 5 },
    { title: "Modelagem de dados", order: 6 },
    { title: "Principais modelos de dados", order: 7 },
  ];

  const createdTopics = [];
  for (const topic of topics) {
    const t = await prisma.lessonTopic.upsert({
      where: { id: `topic-fd02-${topic.order}` },
      update: {},
      create: {
        id: `topic-fd02-${topic.order}`,
        lessonId: lessonFD02.id,
        title: topic.title,
        order: topic.order,
      },
    });
    createdTopics.push(t);
  }

  // Workflow steps for FD02
  const stepDefs = [
    { key: "CADASTRO",             title: "Cadastro da Aula",            order: 0,  isManual: true,  isAiEnabled: false, status: "APROVADA" },
    { key: "PRODUCAO_TEORIA",      title: "Produção da Teoria",          order: 1,  isManual: false, isAiEnabled: true,  status: "AGUARDANDO_APROVACAO" },
    { key: "PADRONIZACAO_EDITORIAL", title: "Padronização Editorial",    order: 2,  isManual: false, isAiEnabled: false, status: "BLOQUEADA" },
    { key: "SELECAO_QUESTOES",     title: "Seleção de Questões",         order: 3,  isManual: false, isAiEnabled: true,  status: "APROVADA" },
    { key: "CADERNOS_QUESTOES",    title: "Cadernos de Questões",        order: 4,  isManual: false, isAiEnabled: true,  status: "APROVADA" },
    { key: "PREPARACAO_EDITORIAL", title: "Preparação Editorial",        order: 5,  isManual: false, isAiEnabled: true,  status: "APROVADA" },
    { key: "COMENTARIOS_QUESTOES", title: "Comentários das Questões",    order: 6,  isManual: false, isAiEnabled: true,  status: "BLOQUEADA" },
    { key: "MONTAGEM_PDFS",        title: "Montagem dos PDFs",           order: 7,  isManual: false, isAiEnabled: true,  status: "BLOQUEADA" },
    { key: "SLIDES",               title: "Slides da Aula",              order: 8,  isManual: false, isAiEnabled: true,  status: "BLOQUEADA" },
    { key: "REVISAO_HUMANA",       title: "Revisão Humana",              order: 9,  isManual: true,  isAiEnabled: false, status: "BLOQUEADA" },
    { key: "GRAVACAO",             title: "Gravação da Aula",            order: 10, isManual: true,  isAiEnabled: false, status: "BLOQUEADA" },
    { key: "PUBLICACAO",           title: "Publicação",                  order: 11, isManual: false, isAiEnabled: false, status: "BLOQUEADA" },
  ];

  const steps: Record<string, { id: string }> = {};
  for (const s of stepDefs) {
    const id = `step-fd02-${s.key.toLowerCase().replace(/_/g, "-")}`;
    const step = await prisma.workflowStep.upsert({
      where: { id },
      update: { status: s.status as any, order: s.order },
      create: {
        id,
        lessonId: lessonFD02.id,
        stepKey: s.key as any,
        title: s.title,
        order: s.order,
        isManual: s.isManual,
        isAiEnabled: s.isAiEnabled,
        status: s.status as any,
        approvedAt: s.status === "APROVADA" ? new Date() : null,
        approvedById: s.status === "APROVADA" ? coordenadora.id : null,
      },
    });
    steps[s.key] = step;
  }

  // Sample questions for FD02
  const sampleQuestions = [
    {
      board: "CEBRASPE",
      year: 2025,
      institution: "FUB",
      role: "Técnico em TI",
      statement: "Um banco de dados representa aspectos do mundo real, é projetado, construído e povoado por dados e atende a uma proposta específica.",
      answerKey: "Certo",
      isStarred: true,
      relevanceScore: 0.95,
      topicId: createdTopics[0].id,
    },
    {
      board: "CEBRASPE",
      year: 2024,
      institution: "TSE",
      role: "Técnico Judiciário",
      statement: "Um SGBD funciona como uma interface entre o banco de dados e seus usuários, concedendo aos usuários permissões para recuperação, atualização e gerenciamento das informações.",
      answerKey: "Certo",
      isStarred: true,
      relevanceScore: 0.92,
      topicId: createdTopics[0].id,
    },
    {
      board: "CEBRASPE",
      year: 2025,
      institution: "PCDF",
      role: "Gestor de Apoio",
      statement: "Um esquema de banco de dados corresponde a um conjunto de registros formado por colunas, entre as quais se inclui a chave primária.",
      answerKey: "Errado",
      isStarred: false,
      relevanceScore: 0.85,
      topicId: createdTopics[0].id,
    },
    {
      board: "CEBRASPE",
      year: 2024,
      institution: "CNPq",
      role: "Analista em C&T",
      statement: "Um SGBD se caracteriza por ser um programa de acesso de dados em formato de entidade e relacionamento.",
      answerKey: "Errado",
      isStarred: false,
      relevanceScore: 0.80,
      topicId: createdTopics[0].id,
    },
  ];

  for (let i = 0; i < sampleQuestions.length; i++) {
    const q = sampleQuestions[i];
    await prisma.question.upsert({
      where: { id: `q-fd02-${i + 1}` },
      update: {},
      create: {
        id: `q-fd02-${i + 1}`,
        lessonId: lessonFD02.id,
        topicId: q.topicId,
        board: q.board as any,
        year: q.year,
        institution: q.institution,
        role: q.role,
        statement: q.statement,
        alternatives: [],
        answerKey: q.answerKey,
        isStarred: q.isStarred,
        relevanceScore: q.relevanceScore,
        status: "APROVADA",
        order: i + 1,
      },
    });
  }

  // StepRun for teoria - aguardando aprovacao
  const stepTeoria = steps["PRODUCAO_TEORIA"];
  if (stepTeoria) {
    await prisma.stepRun.upsert({
      where: { id: "run-fd02-teoria-v1" },
      update: {},
      create: {
        id: "run-fd02-teoria-v1",
        workflowStepId: stepTeoria.id,
        version: 1,
        status: "AGUARDANDO_APROVACAO",
        aiProvider: "openai",
        aiModel: "gpt-4o",
        outputText: `# FUNDAMENTOS DE BANCOS DE DADOS

## 1. Conceitos de Banco de Dados e SGBD

### Essencial de Prova
> Um **banco de dados** é uma coleção de dados relacionados que permite armazenamento estruturado, recuperação e manipulação eficiente de dados.

### Conceito

Um banco de dados não é apenas um depósito de informações. Ele é **planejado para atender a um objetivo** e **refletir um contexto real**.

**Características principais:**
- Representa algum aspecto do mundo real (**minimundo**)
- É uma coleção **logicamente coerente** de dados
- Possui uma **finalidade específica**

> ⚠️ **Atenção:** Uma variedade aleatória de dados não constitui um banco de dados.

### Sistema Gerenciador de Banco de Dados (SGBD)

Um **SGBD** é uma coleção de programas que permite aos usuários criar e manter um banco de dados.

**Funções do SGBD:**
- **Definição:** especificação de tipos e estruturas
- **Construção:** armazenamento controlado
- **Manipulação:** consulta e atualização
- **Compartilhamento:** acesso simultâneo

> 💡 **Bizu:** BD → dados | SGBD → software que gerencia | SBD → BD + SGBD + aplicações`,
        tokensUsed: 2500,
        input: {
          lessonCode: "BD-FD02",
          topics: topics.map((t) => t.title),
        },
      },
    });
  }

  // Lesson memory for FD02
  await prisma.lessonMemory.upsert({
    where: { lessonId: lessonFD02.id },
    update: {},
    create: {
      lessonId: lessonFD02.id,
      approvedTerms: {
        "banco de dados": "coleção de dados relacionados",
        SGBD: "Sistema Gerenciador de Banco de Dados",
        SBD: "Sistema de Banco de Dados",
        esquema: "estrutura do banco sem os dados",
        instância: "dados em um determinado momento",
      },
      centralConcepts: [
        "BD vs SGBD vs SBD",
        "Esquema vs Instância",
        "Propriedades ACID",
        "Arquitetura ANSI/SPARC",
        "Independência de dados",
      ],
      tricks: [
        "SGBD ≠ BD: confusão comum em prova",
        "Esquema NÃO inclui dados",
        "Instância é dinâmica, esquema é estático",
        "SBD = BD + SGBD + aplicações + usuários",
      ],
    },
  });

  // Prompt templates
  const prompts = [
    {
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
6. Marcar com estrela as 30-40 mais importantes

Retorne JSON estruturado com:
- questions: array de questões classificadas
- summary: distribuição por tópico e banca
- discarded: questões descartadas com motivo
- gaps: lacunas identificadas por tópico`,
    },
    {
      stepKey: "PRODUCAO_TEORIA",
      name: "Produção de Teoria TI TOTAL",
      prompt: `Você é um especialista em produção de material didático para concursos públicos de TI, seguindo o padrão TI TOTAL.

PADRÃO TI TOTAL:
- Use "Essencial de Prova" para conteúdos de alta incidência
- Use "Atenção" para armadilhas e pegadinhas
- Use "Bizu" para memorização rápida
- Use "Dica" para estratégia de prova
- Use "Exemplificando" para exemplos práticos
- Use "Esclarecendo" para desfazer confusões
- Use "Esquema" para organizar conceitos

DESTAQUE SEMÂNTICO:
- **negrito** = termo técnico importante
- azul = o que é (núcleo conceitual)
- vermelho = o que NÃO é (limite conceitual, negação, armadilha)

LINGUAGEM:
- Clara, direta, didática
- Foco total em concursos
- Explicar como as bancas cobram
- Apontar pegadinhas recorrentes
- Diferenciar conceitos parecidos

ESTRUTURA OBRIGATÓRIA por seção:
1. Essencial de Prova (box destacado)
2. Contextualização
3. Conceito
4. Explicação detalhada
5. Exemplos quando pertinente
6. Quadros comparativos quando útil
7. Pontos de prova (como cai em prova)

Produza a teoria completa para os tópicos fornecidos.`,
    },
    {
      stepKey: "COMENTARIOS_QUESTOES",
      name: "Comentário de Questões TI TOTAL",
      prompt: `Você é um comentador de questões de concursos de TI no padrão TI TOTAL.

ESTRUTURA OBRIGATÓRIA do comentário:

**Resolução:**
[Explicação direta da questão — por que está certo ou errado]

Quando houver troca de conceito:
↺ [Frase corrigida com o conceito correto]

📘 **Teoria:**
[Apenas o conceito necessário para entender a questão — não copiar a teoria toda]

**Gabarito:** Certo / Errado / Letra X

REGRAS:
- Não usar excesso de texto
- Não copiar grandes blocos da teoria
- Em CEBRASPE, explicar a assertiva diretamente
- Em múltipla escolha, explicar por que as erradas estão erradas
- Sinalizar questão anulável quando houver ambiguidade real
- Manter linguagem didática e objetiva
- Destacar pegadinhas quando existirem`,
    },
  ];

  for (let i = 0; i < prompts.length; i++) {
    await prisma.promptTemplate.upsert({
      where: { id: `prompt-${i + 1}` },
      update: {},
      create: {
        id: `prompt-${i + 1}`,
        stepKey: prompts[i].stepKey as any,
        name: prompts[i].name,
        prompt: prompts[i].prompt,
        version: 1,
        active: true,
      },
    });
  }

  // Editorial standard
  await prisma.editorialStandard.upsert({
    where: { name: "Padrão TI TOTAL" },
    update: {},
    create: {
      name: "Padrão TI TOTAL",
      isDefault: true,
      configJson: {
        fonts: {
          primary: "Montserrat",
          secondary: "Segoe UI",
          bodySize: "12px",
        },
        colors: {
          conceptual: "#1E40AF",
          negation: "#DC2626",
          accent: "#0EA5E9",
          highlight: "#FEF3C7",
        },
        pageFormat: {
          size: "A4",
          margins: "2.5cm",
          spacing: "1.15",
        },
        boxes: [
          { type: "essencial_prova", label: "Essencial de Prova", color: "blue" },
          { type: "atencao", label: "Atenção", color: "red" },
          { type: "bizu", label: "Bizu", color: "green" },
          { type: "dica", label: "Dica", color: "yellow" },
          { type: "exemplificando", label: "Exemplificando", color: "purple" },
          { type: "esclarecendo", label: "Esclarecendo", color: "orange" },
          { type: "esquema", label: "Esquema", color: "blue" },
        ],
        priorityBoards: ["CEBRASPE", "FGV", "FCC", "VUNESP"],
      },
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
