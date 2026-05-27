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
    max_tokens: config.maxTokens || 4000,
  });

  return response.choices[0]?.message?.content || "";
}

async function callAnthropic(prompt: string, systemPrompt: string, config: any): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: config.model || "claude-sonnet-4-6",
    max_tokens: config.maxTokens || 4000,
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
    PRODUCAO_TEORIA: `Você é um professor especialista em TI para concursos públicos. Escreva o material teórico da aula no padrão TI TOTAL.

REGRAS ABSOLUTAS DE ESCRITA — JAMAIS QUEBRE:
- PROIBIDO qualquer frase que soe como IA ou meta-comentário sobre a aula:
  × "Esta aula fornece/apresenta/aborda..."
  × "Nesta aula você vai aprender..."
  × "Ao longo desta aula..."
  × "Esperamos que você tenha aprendido..."
  × "Com este material você estará preparado..."
  × "Esta aula é fundamental para..."
  × "Vimos que..." / "Como vimos..."
  × Qualquer introdução ou conclusão que fale SOBRE a aula em vez de ensinar
- PROIBIDO linguagem acadêmica pomposa ou corporativa
- PROIBIDO parágrafos de abertura do tipo "Olá, alunos!" ou que contextualizam o módulo
- PROIBIDO parágrafos de encerramento que resumem o que foi visto
- O texto começa direto no conteúdo, sem rodeios
- Escreva como um professor que sabe muito sobre o assunto e vai direto ao ponto

FORMATO OBRIGATÓRIO:
- Use headers claros por tópico (##, ###)
- Caixas especiais com prefixo em CAPS seguido de dois pontos e conteúdo:
  ESSENCIAL DE PROVA: [o que cai na prova, direto]
  ATENÇÃO: [armadilha ou confusão comum]
  BIZU: [macete ou associação memorável]
  DICA: [dica prática de aplicação]
- Texto corrido para conceitos
- Listas para enumerações e características
- Foco total em concursos: o que cai, como cai, como não errar
- Destacar em negrito os termos-chave na primeira ocorrência`,

    SELECAO_QUESTOES: `Você é especialista em seleção de questões para concursos de TI. Analise e classifique as questões mais representativas do tema.
Escreva de forma direta, sem introduções ou conclusões sobre o processo.`,

    COMENTARIOS_QUESTOES: `Você comenta questões de concursos de TI no padrão TI TOTAL. Use a teoria aprovada como base.
Seja direto: aponte o erro de cada alternativa errada e justifique o gabarito. Sem rodeios.`,
  };
  return prompts[stepKey] || "Execute a tarefa conforme as instruções fornecidas.";
}
