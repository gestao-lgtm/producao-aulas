import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { stepId, lessonId, outputText } = await req.json();

    if (!stepId || !outputText) {
      return NextResponse.json({ error: "stepId e outputText são obrigatórios" }, { status: 400 });
    }

    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!step) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });

    const previousVersion = step.stepRuns[0]?.version || 0;

    const aiConfig = (await prisma.aIConfig.findFirst({ where: { isDefault: true, active: true } }))
      ?? { provider: "openai", model: "gpt-4o" };

    const newRun = await prisma.stepRun.create({
      data: {
        workflowStepId: stepId,
        version: previousVersion + 1,
        status: "AGUARDANDO_APROVACAO",
        aiProvider: aiConfig.provider,
        aiModel: aiConfig.model,
        outputText,
        input: { lessonId },
      },
    });

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { status: "AGUARDANDO_APROVACAO" },
    });

    return NextResponse.json({ runId: newRun.id, version: newRun.version });
  } catch (err) {
    console.error("POST /api/ai/save-generation:", err);
    return NextResponse.json({ error: "Erro ao salvar geração" }, { status: 500 });
  }
}
