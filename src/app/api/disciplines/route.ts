import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_DISCIPLINES = [
  { id: "disc-bd-01", name: "Banco de Dados", code: "BD", description: "Fundamentos e conceitos avançados de banco de dados" },
  { id: "disc-redes-01", name: "Redes de Computadores", code: "RC", description: "Protocolos, topologias e arquiteturas de redes" },
  { id: "disc-so-01", name: "Sistemas Operacionais", code: "SO", description: "Processos, memória e gerenciamento de recursos" },
  { id: "disc-si-01", name: "Segurança da Informação", code: "SI", description: "Criptografia, políticas de segurança e gestão de riscos" },
];

export async function GET() {
  try {
    // Ensure course exists
    const course = await prisma.course.upsert({
      where: { id: "course-ti-total-main" },
      update: {},
      create: {
        id: "course-ti-total-main",
        name: "TI TOTAL - Tecnologia da Informação para Concursos",
        description: "Curso completo de TI para concursos públicos",
      },
    });

    // Ensure all default disciplines exist
    for (const d of DEFAULT_DISCIPLINES) {
      await prisma.discipline.upsert({
        where: { id: d.id },
        update: {},
        create: { ...d, courseId: course.id },
      });
    }

    const disciplines = await prisma.discipline.findMany({
      where: { active: true },
      include: { course: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(disciplines);
  } catch (error) {
    console.error("GET /api/disciplines:", error);
    // Return hardcoded fallback so the form still works
    return NextResponse.json(
      DEFAULT_DISCIPLINES.map(d => ({ ...d, courseId: "course-ti-total-main", active: true }))
    );
  }
}
