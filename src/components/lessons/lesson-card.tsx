"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/workflow/status-badge";
import { BookOpen, Star, FileText, Clock, ChevronRight, Trash2 } from "lucide-react";

interface LessonCardProps {
  lesson: {
    id: string;
    code: string;
    title: string;
    status: string;
    discipline: { name: string; course: { name: string } };
    _count: { questions: number; files: number };
    estimatedHours: number;
    progress: number;
    currentStep: number;
  };
}

export function LessonCard({ lesson }: LessonCardProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/aulas/${lesson.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <Card
      className="hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => router.push(`/aulas/${lesson.id}`)}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <BookOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">{lesson.code}</span>
              <StatusBadge status={lesson.status} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mt-0.5">{lesson.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {lesson.discipline.name} · {lesson.discipline.course.name}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-500" />
              <span>{lesson._count.questions} questões</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>{lesson._count.files} arquivos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{lesson.estimatedHours}h est.</span>
            </div>
            <div className="w-24">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${lesson.progress}%` }} />
                </div>
                <span className="text-xs font-medium">{lesson.progress}%</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Etapa {lesson.currentStep} de 12</p>
            </div>
          </div>

          {/* Delete action */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {confirming ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                >
                  {deleting ? "Excluindo..." : "Confirmar"}
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                title="Excluir aula"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
