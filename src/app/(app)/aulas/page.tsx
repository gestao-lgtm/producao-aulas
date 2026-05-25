import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workflow/status-badge";
import { mockLessons } from "@/lib/mock/data";
import { BookOpen, Plus, Star, ChevronRight, Clock, FileText } from "lucide-react";
import Link from "next/link";

export default function AulasPage() {
  return (
    <div className="pt-16">
      <Topbar title="Aulas" />
      <main className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Todas as Aulas</h2>
            <p className="text-sm text-gray-500">{mockLessons.length} aulas cadastradas</p>
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
          {mockLessons.map((lesson) => (
            <Link key={lesson.id} href={`/aulas/${lesson.id}`}>
              <Card className="hover:border-blue-200 hover:shadow-md transition-all cursor-pointer">
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
                      <p className="text-xs text-gray-400 mt-0.5">{lesson.discipline.name} · {lesson.discipline.course.name}</p>
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
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Etapa {lesson.currentStep + 1} de 12
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
