import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
          include: {
            stepRuns: { orderBy: { version: "desc" }, take: 1 },
          },
        },
        questions: { orderBy: { order: "asc" } },
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
    const lesson = await prisma.lesson.update({ where: { id }, data: body });
    return NextResponse.json(lesson);
  } catch (error) {
    console.error("PATCH /api/aulas/[id]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
