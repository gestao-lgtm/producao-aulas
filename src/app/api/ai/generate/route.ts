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

    const [step, lesson] = await Promise.all([
      prisma.workflowStep.findUnique({
        where: { id: stepId },
        include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
      }),
      prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          topics: { orderBy: { order: "asc" } },
          memory: true,
          questions: { where: { status: "APROVADA" }, take: 50 },
          files: { where: { isActive: true } },
        },
      }),
    ]);

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
      output: outputText,
      status: "AGUARDANDO_APROVACAO",
    });

  } catch (error) {
    console.error("POST /api/ai/generate:", error);
    return NextResponse.json({ error: "Falha na geração com IA" }, { status: 500 });
  }
}

function buildContextPrompt(lesson: any, step: any, templatePrompt?: string): string {
  const topicsStr = lesson.topics.map((t: any, i: number) => `${i + 1}. ${t.title}${t.description ? ` — ${t.description}` : ""}`).join("\n");

  return `ARQUITETURA DA AULA:
Código: ${lesson.code}
Título: ${lesson.title}
Disciplina: Banco de Dados
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

TAREFA: Execute a etapa "${step.title}" conforme as instruções do sistema.`;
}

function getDefaultSystemPrompt(stepKey: string): string {
  const prompts: Record<string, string> = {
    PRODUCAO_TEORIA: "Você é um especialista em produção de material didático para concursos públicos de TI, seguindo o padrão TI TOTAL. Produza a teoria completa da aula conforme a arquitetura fornecida.",
    SELECAO_QUESTOES: "Você é um especialista em seleção de questões para concursos de TI. Analise e classifique as questões conforme a arquitetura da aula.",
    COMENTARIOS_QUESTOES: "Você é um comentador de questões de concursos de TI no padrão TI TOTAL. Comente as questões usando a teoria aprovada como base.",
  };
  return prompts[stepKey] || "Execute a tarefa conforme as instruções fornecidas.";
}
