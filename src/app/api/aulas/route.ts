import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { STEP_DEFINITIONS } from "@/types";

const COURSE_ID = "course-ti-total-main";

async function ensureDiscipline(disciplineName: string): Promise<string> {
  // Ensure course exists
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {},
    create: {
      id: COURSE_ID,
      name: "TI TOTAL - Tecnologia da Informação para Concursos",
      description: "Curso completo de TI para concursos públicos",
    },
  });

  // Find by name (case-insensitive) or create
  const name = disciplineName.trim();
  const existing = await prisma.discipline.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing.id;

  const created = await prisma.discipline.create({
    data: { courseId: COURSE_ID, name },
  });
  return created.id;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const disciplineId = searchParams.get("disciplineId");
    const status = searchParams.get("status");

    const lessons = await prisma.lesson.findMany({
      where: {
        ...(disciplineId && { disciplineId }),
        ...(status && { status: status as any }),
      },
      include: {
        discipline: { include: { course: true } },
        topics: { orderBy: { order: "asc" } },
        workflowSteps: { orderBy: { order: "asc" } },
        _count: { select: { questions: true, files: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error("GET /api/aulas:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      disciplineName, code, title, subtitle, position, scope, outOfScope,
      targetPages, priorityBoards, studentProfile, depthLevel, pedagogicalNotes, topics,
    } = body;

    if (!code || !title) {
      return NextResponse.json({ error: "Código e título são obrigatórios." }, { status: 400 });
    }

    const name = (disciplineName ?? "Geral").trim() || "Geral";
    const disciplineId = await ensureDiscipline(name);

    const lesson = await prisma.lesson.create({
      data: {
        disciplineId,
        code,
        title,
        subtitle,
        position: parseInt(position) || 1,
        scope,
        outOfScope,
        targetPages: targetPages ? parseInt(targetPages) : null,
        priorityBoards: priorityBoards || [],
        studentProfile,
        depthLevel,
        pedagogicalNotes,
        status: "RASCUNHO",
        topics: {
          create: (topics || []).map((t: any, i: number) => ({
            title: t.title,
            order: i + 1,
            description: t.description || null,
          })),
        },
        workflowSteps: {
          create: STEP_DEFINITIONS.map((def) => ({
            stepKey: def.key,
            title: def.title,
            description: def.description,
            order: def.order,
            isManual: def.isManual,
            isAiEnabled: def.isAiEnabled,
            status: def.order === 0 ? "EM_ANDAMENTO" : "BLOQUEADA",
          })),
        },
        memory: {
          create: {
            approvedTerms: {},
            centralConcepts: [],
            sensitiveTopics: [],
            tricks: [],
            appliedFeedbacks: [],
            problematicQs: [],
            specificRules: [],
          },
        },
      },
      include: {
        discipline: { include: { course: true } },
        topics: true,
        workflowSteps: true,
      },
    });

    revalidatePath("/aulas");
    return NextResponse.json(lesson, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma aula com esse código." }, { status: 409 });
    }
    console.error("POST /api/aulas:", error);
    return NextResponse.json({ error: "Erro ao salvar: " + (error.message ?? "erro desconhecido") }, { status: 500 });
  }
}
