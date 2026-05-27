import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function callOpenAI(prompt: string, systemPrompt: string, config: any): Promise<string> {
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.apiKey || process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: config.model || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: config.temperature || 0.3,
    max_tokens: config.maxTokens || 8000,
  });

  return response.choices[0]?.message?.content || "";
}

async function callAnthropic(prompt: string, systemPrompt: string, config: any): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: config.model || "claude-sonnet-4-6",
    max_tokens: config.maxTokens || 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0]?.type === "text" ? response.content[0].text : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stepId, lessonId } = body;

    const [step, lessonRaw] = await Promise.all([
      prisma.workflowStep.findUnique({
        where: { id: stepId },
        include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
      }),
      prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          discipline: true,
          topics: { orderBy: { order: "asc" } },
          memory: true,
          questions: { where: { status: "APROVADA" }, take: 50 },
          files: { where: { isActive: true } },
        },
      }),
    ]);

    // Load latest feedback for this step (if rejecting and regenerating)
    const latestFeedback = step?.stepRuns[0]?.id
      ? await prisma.feedback.findFirst({
          where: { stepRunId: step.stepRuns[0].id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const lesson = lessonRaw
      ? { ...lessonRaw, _latestFeedback: latestFeedback ? `${latestFeedback.whatIsWrong || ""}${latestFeedback.whatToChange ? `\nO que mudar: ${latestFeedback.whatToChange}` : ""}${latestFeedback.examples ? `\nExemplos: ${latestFeedback.examples}` : ""}` : null }
      : null;

    if (!step || !lesson) {
      return NextResponse.json({ error: "Etapa ou aula não encontrada" }, { status: 404 });
    }

    // Get prompt template for this step
    const promptTemplate = await prisma.promptTemplate.findFirst({
      where: { stepKey: step.stepKey, active: true },
      orderBy: { version: "desc" },
    });

    // Get AI config
    const aiConfig = await prisma.aIConfig.findFirst({
      where: { isDefault: true, active: true },
    }) || { provider: "openai", model: "gpt-4o", temperature: 0.3, maxTokens: 4000 };

    // Build context prompt
    const contextPrompt = buildContextPrompt(lesson, step, promptTemplate?.prompt);

    // Update step status
    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { status: "EM_ANDAMENTO" },
    });

    // Create new step run
    const previousVersion = step.stepRuns[0]?.version || 0;
    const newRun = await prisma.stepRun.create({
      data: {
        workflowStepId: stepId,
        version: previousVersion + 1,
        status: "EM_ANDAMENTO",
        aiProvider: aiConfig.provider,
        aiModel: aiConfig.model,
        promptUsed: contextPrompt,
        input: {
          lessonCode: lesson.code,
          topics: lesson.topics.map(t => t.title),
          scope: lesson.scope,
        },
      },
    });

    let outputText = "";
    let tokensUsed = 0;

    try {
      const systemPrompt = promptTemplate?.prompt || getDefaultSystemPrompt(step.stepKey);

      if (aiConfig.provider === "anthropic") {
        outputText = await callAnthropic(contextPrompt, systemPrompt, aiConfig);
      } else {
        outputText = await callOpenAI(contextPrompt, systemPrompt, aiConfig);
      }

      // Update run with output
      await prisma.stepRun.update({
        where: { id: newRun.id },
        data: {
          outputText,
          status: "AGUARDANDO_APROVACAO",
          tokensUsed,
        },
      });

      // Update step status
      await prisma.workflowStep.update({
        where: { id: stepId },
        data: { status: "AGUARDANDO_APROVACAO" },
      });

    } catch (aiError) {
      await prisma.stepRun.update({
        where: { id: newRun.id },
        data: { status: "REPROVADA" },
      });
      await prisma.workflowStep.update({
        where: { id: stepId },
        data: { status: "EM_ANDAMENTO" },
      });
      throw aiError;
    }

    return NextResponse.json({
      runId: newRun.id,
      version: newRun.version,
      outputText,
      status: "AGUARDANDO_APROVACAO",
    });

  } catch (error) {
    console.error("POST /api/ai/generate:", error);
    return NextResponse.json({ error: "Falha na geração com IA" }, { status: 500 });
  }
}

function buildContextPrompt(lesson: any, step: any, templatePrompt?: string): string {
  const topicsStr = lesson.topics.map((t: any, i: number) => `${i + 1}. ${t.title}${t.description ? ` — ${t.description}` : ""}`).join("\n");
  const disciplineName = lesson.discipline?.name || "—";

  const feedbackBlock = lesson._latestFeedback
    ? `\nFEEDBACK DA VERSÃO ANTERIOR (CORRIJA ESTES PONTOS):\n${lesson._latestFeedback}\n`
    : "";

  return `ARQUITETURA DA AULA:
Código: ${lesson.code}
Título: ${lesson.title}
Disciplina: ${disciplineName}
Posição: Aula ${lesson.position}
Páginas estimadas: ${lesson.targetPages || "—"}
Bancas prioritárias: ${lesson.priorityBoards?.join(", ") || "—"}
Perfil do aluno: ${lesson.studentProfile || "—"}
Nível de profundidade: ${lesson.depthLevel || "—"}

ESCOPO:
${lesson.scope || "—"}

TÓPICOS:
${topicsStr}

EXCLUÍDO DO ESCOPO:
${lesson.outOfScope || "—"}

OBSERVAÇÕES PEDAGÓGICAS:
${lesson.pedagogicalNotes || "—"}

${lesson.memory?.centralConcepts?.length > 0 ? `CONCEITOS CENTRAIS JÁ DEFINIDOS:\n${JSON.stringify(lesson.memory.centralConcepts)}` : ""}

${lesson.memory?.tricks?.length > 0 ? `PEGADINHAS IDENTIFICADAS:\n${JSON.stringify(lesson.memory.tricks)}` : ""}
${feedbackBlock}
TAREFA: Execute a etapa "${step.title}" conforme as instruções do sistema.`;
}

function getDefaultSystemPrompt(stepKey: string): string {
  const prompts: Record<string, string> = {
    PRODUCAO_TEORIA: `Você é professor do curso TI TOTAL, especialista em material didático para concursos públicos de TI. Produza a teoria completa da aula seguindo EXATAMENTE o padrão TI TOTAL abaixo.

══════════════════════════════════════════
REGRAS ABSOLUTAS — JAMAIS QUEBRE
══════════════════════════════════════════
PROIBIDO qualquer frase que soe como IA ou meta-comentário:
  × "Esta aula fornece/apresenta/aborda..."
  × "Nesta aula você vai aprender..."
  × "Esperamos que você tenha aprendido..."
  × "Com este material você estará preparado..."
  × "Vimos que..." / "Como vimos..."
  × Parágrafos de abertura ou encerramento sobre "a aula"
O texto começa direto no conteúdo. Escreva como professor que domina o assunto.

══════════════════════════════════════════
DESTAQUES COGNITIVOS NO TEXTO
══════════════════════════════════════════
Use estes marcadores inline para destaque semântico:
  [[AZUL:termo]]    → núcleo conceitual — o que É (azul negrito no Word)
  [[VERMELHO:termo]] → negação conceitual — o que NÃO É (vermelho negrito)
  **termo**          → palavra sendo definida ou propriedade do conceito

Regra de ouro:
  Azul = o que é   |   Vermelho = o que não é
  NÃO use azul/vermelho apenas para "destacar" — use com função semântica.

Exemplo correto:
  [[AZUL:Banco de dados]] é uma coleção de dados relacionados com finalidade específica. [[VERMELHO:Não é um simples arquivo]] sem estrutura controlada.

══════════════════════════════════════════
TAGS OBRIGATÓRIAS — USE EXATAMENTE ASSIM
══════════════════════════════════════════
[ESSENCIAL_DE_PROVA]
definições centrais que caem na prova — texto mínimo, máxima densidade
[/ESSENCIAL_DE_PROVA]

[ATENCAO]
alerta sobre confusão frequente, exceção ou pegadinha de prova
[/ATENCAO]

[BIZU]
mnemônico, macete ou padrão de cobrança para memorização rápida
[/BIZU]

[DICA]
estratégia de estudo ou abordagem de resolução (diferente de BIZU: Dica=estratégia, Bizu=memorização)
[/DICA]

[EXEMPLIFICANDO]
exemplo concreto e direto — use após explicação abstrata
[/EXEMPLIFICANDO]

[ESCLARECENDO]
distinção conceitual, nuance técnica ou complemento importante — não repita a definição
[/ESCLARECENDO]

[QUESTAO]
(BANCA – ANO – ÓRGÃO – Cargo) Enunciado completo da questão.

a) alternativa A
b) alternativa B
(para questões Certo/Errado, apenas o enunciado)

Resolução:
Comentário direto com 1-2 frases explicando o erro ou a lógica.
↺ [se houver troca de conceito] A frase correta seria: "texto correto"
Gabarito: Certo / Errado / Letra X.
[/QUESTAO]

══════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA POR SEÇÃO
══════════════════════════════════════════
Cada seção principal (##) DEVE ter esta ordem:
1. [ESSENCIAL_DE_PROVA] — obrigatório, pelo menos 1 por seção
2. Contextualização breve (1-2 parágrafos; omita se conceito for direto)
3. Conceito (definição direta com [[AZUL:]] no núcleo)
4. Explicação (propriedades, características — sem repetir a definição)
5. Lista de itens quando houver enumerações
6. [EXEMPLIFICANDO] — após explicação abstrata
7. Quadros conforme necessário: [ATENCAO], [BIZU], [DICA], [ESCLARECENDO]
8. [QUESTAO] — 2 a 3 questões reais com resolução comentada

══════════════════════════════════════════
ESTRUTURA GERAL DO DOCUMENTO
══════════════════════════════════════════
# [TÍTULO DA AULA]
[lista dos tópicos da aula]

## 1. [Nome da Seção]
[conteúdo da seção conforme estrutura acima]

### 1.1 [Subseção quando necessário]
[conteúdo]

## ESSENCIAL DE PROVA — REVISÃO FINAL
[síntese de todos os pontos mais cobrados em provas]

## GLOSSÁRIO DE TERMOS
Termo: definição resumida.
(um por linha)

## REFERÊNCIAS
[fontes bibliográficas]`,

    SELECAO_QUESTOES: `Você é especialista em seleção de questões para concursos de TI. Analise e classifique as questões mais representativas do tema.
Escreva de forma direta, sem introduções ou conclusões sobre o processo.`,

    COMENTARIOS_QUESTOES: `Você comenta questões de concursos de TI no padrão TI TOTAL. Use a teoria aprovada como base.

Para cada questão, siga exatamente esta estrutura:

Resolução:
Comentário curto (1-2 frases) explicando o erro ou a lógica da assertiva.
↺ [se houver troca de conceito] A frase correta seria: "..."
Gabarito: Certo / Errado / Letra X.

Seja direto. Não escreva parágrafos longos. Não inclua seção 📘 Teoria nos comentários de questões do PDF de teoria.`,
  };
  return prompts[stepKey] || "Execute a tarefa conforme as instruções fornecidas.";
}
