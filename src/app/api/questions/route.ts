import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get("lessonId");
    const board = searchParams.get("board");
    const status = searchParams.get("status");
    const starred = searchParams.get("starred");

    if (!lessonId) {
      return NextResponse.json({ error: "lessonId é obrigatório" }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: {
        lessonId,
        ...(board && { board: board as any }),
        ...(status && { status: status as any }),
        ...(starred === "true" && { isStarred: true }),
      },
      include: {
        topic: true,
        comments: { where: { isActive: true }, take: 1 },
      },
      orderBy: [{ isStarred: "desc" }, { relevanceScore: "desc" }, { year: "desc" }],
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("GET /api/questions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questions, lessonId } = body;

    if (!lessonId || !Array.isArray(questions)) {
      return NextResponse.json({ error: "lessonId e questions são obrigatórios" }, { status: 400 });
    }

    const created = await prisma.$transaction(
      questions.map((q: any, i: number) =>
        prisma.question.create({
          data: {
            lessonId,
            topicId: q.topicId || null,
            board: q.board || "OUTROS",
            year: q.year ? parseInt(q.year) : null,
            institution: q.institution,
            role: q.role,
            statement: q.statement,
            alternatives: q.alternatives || [],
            answerKey: q.answerKey,
            source: q.source,
            relevanceScore: q.relevanceScore || 0,
            isStarred: q.isStarred || false,
            order: i + 1,
          },
        })
      )
    );

    return NextResponse.json({ created: created.length }, { status: 201 });
  } catch (error) {
    console.error("POST /api/questions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
