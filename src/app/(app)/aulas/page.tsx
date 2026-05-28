export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockLessons } from "@/lib/mock/data";
import { Plus } from "lucide-react";
import Link from "next/link";
import { LessonCard } from "@/components/lessons/lesson-card";

async function getLessons() {
  try {
    const lessons = await prisma.lesson.findMany({
      include: {
        discipline: { include: { course: true } },
        workflowSteps: { orderBy: { order: "asc" } },
        _count: { select: { questions: true, files: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return lessons.map((l) => ({
      ...l,
      progress: Math.round(
        (l.workflowSteps.filter((s) => s.status === "APROVADA").length / 12) * 100
      ),
      currentStep:
        l.workflowSteps.findIndex(
          (s) => s.status === "AGUARDANDO_APROVACAO" || s.status === "EM_ANDAMENTO"
        ) + 1 || 0,
      estimatedHours: l.estimatedHours ?? 0,
    }));
  } catch {
    return null;
  }
}

export default async function AulasPage() {
  const dbLessons = await getLessons();
  const lessons = dbLessons && dbLessons.length > 0 ? dbLessons : mockLessons;

  return (
    <div className="pt-16">
      <Topbar title="Aulas" />
      <main className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Todas as Aulas</h2>
            <p className="text-sm text-gray-500">{lessons.length} aulas cadastradas</p>
          </div>
          <Link href="/aulas/nova">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Aula
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {["Todas", "Em Produção", "Aguardando Aprovação", "Publicadas", "Rascunho"].map((filter) => (
            <button
              key={filter}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === "Todas"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Lessons Grid */}
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </main>
    </div>
  );
}
