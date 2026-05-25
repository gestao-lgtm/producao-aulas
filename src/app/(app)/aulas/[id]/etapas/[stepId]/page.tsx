"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workflow/status-badge";
import { mockWorkflowSteps, mockStepRunOutput, mockLessons } from "@/lib/mock/data";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles, CheckCircle, XCircle, RotateCcw, ChevronLeft,
  FileText, AlertCircle, Star, Check, Loader2, Clock, Download,
  MessageSquare, History
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// Checklist items per step
const STEP_CHECKLISTS: Record<string, string[]> = {
  PRODUCAO_TEORIA: [
    "Está dentro do escopo da aula?",
    "Respeita a arquitetura pedagógica?",
    "Segue o padrão TI TOTAL (boxes, destaques)?",
    "Linguagem clara e direta?",
    "Foco em concursos?",
    "Sem excesso de texto?",
    "Sem lacunas de conteúdo?",
    "Pontos de prova identificados?",
    "Caixas 'Essencial de Prova' presentes?",
    "Armadilhas e pegadinhas apontadas?",
  ],
  SELECAO_QUESTOES: [
    "Questões representam os tópicos da aula?",
    "CEBRASPE priorizado?",
    "Questões recentes incluídas?",
    "Questões duplicadas removidas?",
    "Distribuição por banca equilibrada?",
    "Lacunas identificadas?",
  ],
  COMENTARIOS_QUESTOES: [
    "Resolução direta e objetiva?",
    "Teoria citada de forma sintética?",
    "Gabarito correto em todas as questões?",
    "Pegadinhas sinalizadas?",
    "Padrão TI TOTAL mantido?",
    "Sem excesso de texto?",
  ],
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  PRODUCAO_TEORIA: `Nesta etapa, a IA produz o material teórico completo da aula seguindo o padrão TI TOTAL.

A teoria deve cobrir todos os tópicos definidos na arquitetura pedagógica, com foco em concursos, usando as caixas de destaque padrão (Essencial de Prova, Atenção, Bizu, Dica) e os destaques semânticos em azul (o que é) e vermelho (o que não é).`,
  SELECAO_QUESTOES: `Nesta etapa, a IA analisa e seleciona as questões mais representativas do tema, priorizando bancas como CEBRASPE, FGV, FCC e VUNESP, além de questões mais recentes.`,
  COMENTARIOS_QUESTOES: `Nesta etapa, a IA produz os comentários das questões usando a teoria aprovada como base, seguindo o padrão TI TOTAL de comentários.`,
};

export default function StepExecutionPage({
  params,
}: {
  params: { id: string; stepId: string };
}) {
  const lesson = mockLessons.find((l) => l.id === params.id) || mockLessons[0];
  const step = mockWorkflowSteps.find((s) => s.id === params.stepId) || mockWorkflowSteps[4];

  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState(
    step.status === "AGUARDANDO_APROVACAO" ? mockStepRunOutput : ""
  );
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState({ whatIsWrong: "", whatToChange: "", examples: "", urgency: "2" });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [version, setVersion] = useState(1);

  const checklistItems = STEP_CHECKLISTS[step.stepKey] || [];
  const allChecked = checklistItems.every((item) => checklist[item]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setOutput("");

    // Simulate streaming AI generation
    await new Promise((r) => setTimeout(r, 2000));
    setOutput(mockStepRunOutput);
    setIsGenerating(false);
    setVersion(v => v + 1);
    toast.success("Conteúdo gerado pela IA com sucesso!");
  };

  const handleApprove = () => {
    toast.success(`Etapa "${step.title}" aprovada! Próxima etapa desbloqueada.`);
  };

  const handleReject = () => {
    if (!feedback.whatIsWrong && !feedback.whatToChange) {
      toast.error("Descreva o que está errado e o que deve mudar.");
      return;
    }
    toast.info("Feedback enviado. A IA irá corrigir esta etapa.");
    setShowFeedbackForm(false);
    setOutput("");
    setFeedback({ whatIsWrong: "", whatToChange: "", examples: "", urgency: "2" });
  };

  return (
    <div className="pt-16">
      <Topbar
        title={`${lesson.code} · ${step.title}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={step.status} />
            <Link href={`/aulas/${lesson.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                Voltar
              </Button>
            </Link>
          </div>
        }
      />

      <main className="p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-5">
            {/* Step Briefing */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{step.icon}</span>
                  <div>
                    <CardTitle className="text-base">
                      Etapa {step.order} — {step.title}
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {step.isManual ? "Etapa Manual" : "Etapa com IA"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {STEP_DESCRIPTIONS[step.stepKey] || step.title}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Versão atual: v{version}</span>
                  <span className="mx-1">·</span>
                  <History className="h-3.5 w-3.5" />
                  <span>{version} versão(ões) gerada(s)</span>
                </div>
              </CardContent>
            </Card>

            {/* Generation Button */}
            {!output && !isGenerating && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 py-12 gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <Sparkles className="h-7 w-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Pronto para gerar com IA</p>
                  <p className="text-xs text-gray-500 mt-1">
                    A IA usará a arquitetura da aula e os padrões TI TOTAL
                  </p>
                </div>
                <Button onClick={handleGenerate} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Gerar com IA
                </Button>
              </div>
            )}

            {/* Generating */}
            {isGenerating && (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Gerando conteúdo com IA...</p>
                  <p className="text-xs text-gray-400">Isso pode levar alguns segundos</p>
                </CardContent>
              </Card>
            )}

            {/* Output */}
            {output && !isGenerating && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <CardTitle className="text-sm">Output Gerado — v{version}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleGenerate}>
                      <RotateCcw className="h-3 w-3" />
                      Regenerar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                      <Download className="h-3 w-3" />
                      Exportar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-5 max-h-[500px] overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">
                        {output}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feedback Form */}
            {showFeedbackForm && (
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-red-500" />
                    <CardTitle className="text-sm text-red-700">Enviar Feedback de Reprovação</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">O que está errado? *</Label>
                    <Textarea
                      placeholder="Descreva o que está incorreto ou não atende ao padrão..."
                      className="mt-1.5 text-sm"
                      rows={3}
                      value={feedback.whatIsWrong}
                      onChange={(e) => setFeedback(f => ({ ...f, whatIsWrong: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">O que deve mudar? *</Label>
                    <Textarea
                      placeholder="Especifique o que a IA deve fazer diferente..."
                      className="mt-1.5 text-sm"
                      rows={3}
                      value={feedback.whatToChange}
                      onChange={(e) => setFeedback(f => ({ ...f, whatToChange: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Exemplos (opcional)</Label>
                    <Textarea
                      placeholder="Dê exemplos do que seria ideal..."
                      className="mt-1.5 text-sm"
                      rows={2}
                      value={feedback.examples}
                      onChange={(e) => setFeedback(f => ({ ...f, examples: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleReject} variant="destructive" size="sm" className="gap-1.5">
                      <XCircle className="h-3.5 w-3.5" />
                      Confirmar Reprovação
                    </Button>
                    <Button onClick={() => setShowFeedbackForm(false)} variant="outline" size="sm">
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approval Buttons */}
            {output && !showFeedbackForm && (
              <div className="flex items-center gap-3 justify-end pt-2">
                <Button
                  variant="outline"
                  className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setShowFeedbackForm(true)}
                >
                  <XCircle className="h-4 w-4" />
                  Reprovar e Enviar Feedback
                </Button>
                <Button
                  variant="success"
                  className="gap-2"
                  onClick={handleApprove}
                  disabled={checklistItems.length > 0 && !allChecked}
                >
                  <CheckCircle className="h-4 w-4" />
                  Aprovar Etapa
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Checklist */}
            {checklistItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Checklist de Qualidade</CardTitle>
                  <p className="text-xs text-gray-400">
                    Marque todos os itens antes de aprovar
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checklistItems.map((item) => (
                    <label
                      key={item}
                      className="flex items-start gap-2.5 cursor-pointer group"
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border mt-0.5 transition-colors ${
                          checklist[item]
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 group-hover:border-blue-400"
                        }`}
                        onClick={() =>
                          setChecklist((c) => ({ ...c, [item]: !c[item] }))
                        }
                      >
                        {checklist[item] && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </div>
                      <span
                        className={`text-xs leading-relaxed ${
                          checklist[item] ? "line-through text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {item}
                      </span>
                    </label>
                  ))}
                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {Object.values(checklist).filter(Boolean).length}/{checklistItems.length} marcados
                      </span>
                      {allChecked && (
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" /> Pronto
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lesson Context */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Contexto da Aula</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-gray-600">
                <div>
                  <span className="font-medium text-gray-700">Código:</span> {lesson.code}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Título:</span> {lesson.title}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Bancas:</span>{" "}
                  {lesson.priorityBoards.join(", ")}
                </div>
                <div>
                  <span className="font-medium text-gray-700">Páginas:</span>{" "}
                  {lesson.targetPages}p
                </div>
              </CardContent>
            </Card>

            {/* AI Config */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  Configuração de IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-500">Provedor</span>
                  <span className="font-medium">OpenAI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Modelo</span>
                  <span className="font-medium">GPT-4o</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Temperatura</span>
                  <span className="font-medium">0.3</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs mt-1">
                  Editar configuração
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
