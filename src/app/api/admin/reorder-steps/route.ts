import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STEP_ORDER: Record<string, number> = {
  CADASTRO:               0,
  PRODUCAO_TEORIA:        1,
  PADRONIZACAO_EDITORIAL: 2,
  SELECAO_QUESTOES:       3,
  CADERNOS_QUESTOES:      4,
  PREPARACAO_EDITORIAL:   5,
  COMENTARIOS_QUESTOES:   6,
  MONTAGEM_PDFS:          7,
  SLIDES:                 8,
  REVISAO_HUMANA:         9,
  GRAVACAO:               10,
  PUBLICACAO:             11,
};

export async function POST() {
  try {
    const steps = await prisma.workflowStep.findMany({
      select: { id: true, stepKey: true, order: true, lessonId: true },
    });

    let updated = 0;
    for (const step of steps) {
      const newOrder = STEP_ORDER[step.stepKey];
      if (newOrder !== undefined && newOrder !== step.order) {
        await prisma.workflowStep.update({
          where: { id: step.id },
          data: { order: newOrder },
        });
        updated++;
      }
    }

    return NextResponse.json({
      message: `Reordenação concluída. ${updated} etapa(s) atualizadas de ${steps.length} total.`,
      updated,
      total: steps.length,
    });
  } catch (error) {
    console.error("POST /api/admin/reorder-steps:", error);
    return NextResponse.json({ error: "Erro ao reordenar etapas" }, { status: 500 });
  }
}
