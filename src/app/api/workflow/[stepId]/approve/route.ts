import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const body = await req.json();
    const { userId } = body;

    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: { lesson: { include: { workflowSteps: { orderBy: { order: "asc" } } } } },
    });

    if (!step) {
      return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
    }

    if (!["AGUARDANDO_APROVACAO", "EM_ANDAMENTO", "NAO_INICIADA"].includes(step.status)) {
      return NextResponse.json({ error: "Etapa não pode ser aprovada no estado atual: " + step.status }, { status: 400 });
    }

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        status: "APROVADA",
        approvedAt: new Date(),
        approvedById: userId || null,
      },
    });

    const latestRun = await prisma.stepRun.findFirst({
      where: { workflowStepId: stepId },
      orderBy: { version: "desc" },
    });
    if (latestRun) {
      await prisma.stepRun.update({
        where: { id: latestRun.id },
        data: { status: "APROVADA" },
      });
    }

    const nextStep = step.lesson.workflowSteps.find((s) => s.order === step.order + 1);
    if (nextStep && nextStep.status === "BLOQUEADA") {
      await prisma.workflowStep.update({
        where: { id: nextStep.id },
        data: { status: "NAO_INICIADA" },
      });
    }

    const allSteps = step.lesson.workflowSteps;
    const remainingSteps = allSteps.filter(
      (s) => s.id !== stepId && s.status !== "APROVADA"
    );
    if (remainingSteps.length === 0) {
      await prisma.lesson.update({
        where: { id: step.lessonId },
        data: { status: "CONCLUIDA" },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: "APPROVE_STEP",
        entity: "WorkflowStep",
        entityId: stepId,
        metadata: { stepKey: step.stepKey, lessonId: step.lessonId },
      },
    });

    return NextResponse.json({ success: true, nextStepId: nextStep?.id });
  } catch (error) {
    console.error("POST /api/workflow/[stepId]/approve:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
