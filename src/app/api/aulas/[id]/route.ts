import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const COURSE_ID = "course-ti-total-main";

async function ensureDiscipline(name: string): Promise<string> {
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {},
    create: { id: COURSE_ID, name: "TI TOTAL - Tecnologia da Informação para Concursos" },
  });
  const trimmed = name.trim();
  const existing = await prisma.discipline.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing.id;
  const created = await prisma.discipline.create({ data: { courseId: COURSE_ID, name: trimmed } });
  return created.id;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        discipline: { include: { course: true } },
        topics: { orderBy: { order: "asc" } },
        workflowSteps: {
          orderBy: { order: "asc" },
          include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
        },
        files: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
        memory: true,
        _count: { select: { questions: true, files: true } },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error("GET /api/aulas/[id]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      disciplineName, code, title, subtitle, position, scope, outOfScope,
      targetPages, priorityBoards, studentProfile, depthLevel, pedagogicalNotes, topics,
    } = body;

    const disciplineId = disciplineName?.trim()
      ? await ensureDiscipline(disciplineName)
      : undefined;

    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(disciplineId && { disciplineId }),
        ...(code && { code }),
        ...(title && { title }),
        subtitle: subtitle ?? undefined,
        position: position ? parseInt(position) : undefined,
        scope: scope ?? undefined,
        outOfScope: outOfScope ?? undefined,
        targetPages: targetPages ? parseInt(targetPages) : null,
        priorityBoards: priorityBoards ?? undefined,
        studentProfile: studentProfile ?? undefined,
        depthLevel: depthLevel ?? undefined,
        pedagogicalNotes: pedagogicalNotes ?? undefined,
        ...(Array.isArray(topics) && {
          topics: {
            deleteMany: {},
            create: topics
              .filter((t: any) => t.title?.trim())
              .map((t: any, i: number) => ({
                title: t.title,
                order: i + 1,
                description: t.description || null,
              })),
          },
        }),
      },
      include: {
        discipline: true,
        topics: { orderBy: { order: "asc" } },
      },
    });

    revalidatePath(`/aulas/${id}`);
    revalidatePath("/aulas");
    return NextResponse.json(lesson);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Esse código de aula já está em uso." }, { status: 409 });
    }
    console.error("PATCH /api/aulas/[id]:", error);
    return NextResponse.json({ error: "Erro ao salvar: " + (error.message ?? "") }, { status: 500 });
  }
}
