import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const body = await req.json();
    const { userId, feedbackText, whatIsWrong, whatToChange, examples, urgency } = body;

    if (!feedbackText && !whatIsWrong) {
      return NextResponse.json({ error: "Feedback é obrigatório para reprovar" }, { status: 400 });
    }

    const step = await prisma.workflowStep.findUnique({ where: { id: stepId } });
    if (!step) {
      return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
    }

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { status: "REPROVADA" },
    });

    const latestRun = await prisma.stepRun.findFirst({
      where: { workflowStepId: stepId },
      orderBy: { version: "desc" },
    });

    if (latestRun) {
      await prisma.stepRun.update({
        where: { id: latestRun.id },
        data: { status: "REPROVADA" },
      });

      await prisma.feedback.create({
        data: {
          stepRunId: latestRun.id,
          userId: userId || null,
          feedbackText: feedbackText || whatIsWrong,
          whatIsWrong,
          whatToChange,
          examples,
          urgency: urgency ? parseInt(urgency) : 2,
        },
      });
    }

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { status: "EM_CORRECAO" },
    });

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: "REJECT_STEP",
        entity: "WorkflowStep",
        entityId: stepId,
        metadata: { stepKey: step.stepKey, lessonId: step.lessonId, reason: whatIsWrong },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/workflow/[stepId]/reject:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
