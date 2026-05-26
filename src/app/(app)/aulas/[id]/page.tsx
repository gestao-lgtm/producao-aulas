import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workflow/status-badge";
import { WorkflowTimeline } from "@/components/workflow/workflow-timeline";
import { mockLessons, mockWorkflowSteps, mockFiles } from "@/lib/mock/data";
import {
  BookOpen, Target, Users, FileText, ChevronRight,
  AlertCircle, Play
} from "lucide-react";
import Link from "next/link";

async function getLesson(id: string) {
  try {
    return await prisma.lesson.findUnique({
      where: { id },
      include: {
        discipline: { include: { course: true } },
        topics: { orderBy: { order: "asc" } },
        workflowSteps: { orderBy: { order: "asc" } },
        files: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 4,
        },
        _count: { select: { questions: true, files: true } },
      },
    });
  } catch {
    return null;
  }
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dbLesson = await getLesson(id);

  // Resolve data — real DB or mock fallback
  let lesson: any;
  let steps: any[];
  let files: any[];

  if (dbLesson) {
    const approvedCount = dbLesson.workflowSteps.filter((s) => s.status === "APROVADA").length;
    lesson = {
      ...dbLesson,
      progress: Math.round((approvedCount / 12) * 100),
    };
    steps = dbLesson.workflowSteps;
    files = dbLesson.files;
  } else {
    // Fall back to mock (handles demo IDs like "lesson-fd02")
    const mock = mockLessons.find((l) => l.id === id);
    if (!mock) notFound();
    lesson = mock;
    steps = mockWorkflowSteps;
    files = mockFiles;
  }

  const currentStep = steps.find(
    (s) => s.status === "AGUARDANDO_APROVACAO" || s.status === "EM_ANDAMENTO"
  );
  const approvedCount = steps.filter((s) => s.status === "APROVADA").length;

  return (
    <div className="pt-16">
      <Topbar
        title={lesson.code}
        action={
          currentStep ? (
            <Link href={`/aulas/${lesson.id}/etapas/${currentStep.id}`}>
              <Button className="gap-2">
                <Play className="h-4 w-4" />
                Continuar Produção
              </Button>
            </Link>
          ) : undefined
        }
      />
      <main className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={lesson.status} />
                <span className="text-xs text-gray-400">{lesson.discipline.name}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
              {lesson.subtitle && (
                <p className="text-sm text-gray-500 mt-1">{lesson.subtitle}</p>
              )}
            </div>

            {/* Progress Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progresso da Produção</span>
                  <span className="text-sm font-bold text-gray-900">{lesson.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${lesson.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{approvedCount} de 12 etapas concluídas</span>
                  <span>Etapa atual: {currentStep?.title || "—"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Current step alert */}
            {currentStep?.status === "AGUARDANDO_APROVACAO" && (
              <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-800">Etapa aguardando sua aprovação</p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    A etapa <strong>{currentStep.title}</strong> foi concluída pela IA e está aguardando aprovação.
                  </p>
                </div>
                <Link href={`/aulas/${lesson.id}/etapas/${currentStep.id}`}>
                  <Button size="sm" variant="warning" className="shrink-0">
                    Revisar
                  </Button>
                </Link>
              </div>
            )}

            {/* Lesson Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Arquitetura Pedagógica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <Target className="h-3.5 w-3.5" /> Escopo
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">{lesson.scope || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Perfil do Aluno
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">{lesson.studentProfile || "—"}</p>
                  </div>
                </div>
                {lesson.priorityBoards?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Bancas Prioritárias</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {lesson.priorityBoards.map((b: string) => (
                        <span key={b} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Posição</p>
                    <p className="text-sm font-semibold text-gray-900">Aula {lesson.position}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Páginas estimadas</p>
                    <p className="text-sm font-semibold text-gray-900">{lesson.targetPages ?? "—"}p</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Questões</p>
                    <p className="text-sm font-semibold text-gray-900">{lesson._count.questions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Files */}
            {files.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">Arquivos Gerados</CardTitle>
                  <Link href={`/aulas/${lesson.id}/arquivos`}>
                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                      Ver todos <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {files.slice(0, 4).map((file: any) => (
                      <div key={file.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                          <p className="text-[10px] text-gray-400">v{file.version}</p>
                        </div>
                        {file.url && (
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-6 text-xs shrink-0">
                              Baixar
                            </Button>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Topics */}
            {lesson.topics?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Tópicos ({lesson.topics.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-1.5">
                    {lesson.topics.map((t: any, i: number) => (
                      <li key={t.id} className="flex gap-2 text-xs text-gray-700">
                        <span className="font-semibold text-blue-600 shrink-0">{i + 1}.</span>
                        <span>{t.title}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Workflow */}
          <div>
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Workflow de Produção</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <WorkflowTimeline
                  steps={steps}
                  lessonId={lesson.id}
                  currentStepId={currentStep?.id}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
