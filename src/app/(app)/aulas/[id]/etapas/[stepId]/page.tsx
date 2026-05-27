"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workflow/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles, CheckCircle, XCircle, RotateCcw, ChevronLeft,
  FileText, Check, Loader2, Clock, Download, MessageSquare, History, FileDown
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const STEP_ICONS: Record<string, string> = {
  CADASTRO: "📋", SELECAO_QUESTOES: "🔍", CADERNOS_QUESTOES: "📚",
  PREPARACAO_EDITORIAL: "✏️", PRODUCAO_TEORIA: "📖", PADRONIZACAO_EDITORIAL: "🎨",
  COMENTARIOS_QUESTOES: "💬", MONTAGEM_PDFS: "📄", SLIDES: "🖥️",
  REVISAO_HUMANA: "👁️", GRAVACAO: "🎥", PUBLICACAO: "🚀",
};

const STEP_CHECKLISTS: Record<string, string[]> = {
  PRODUCAO_TEORIA: [
    "Está dentro do escopo da aula?", "Respeita a arquitetura pedagógica?",
    "Segue o padrão TI TOTAL (boxes, destaques)?", "Linguagem clara e direta?",
    "Foco em concursos?", "Sem excesso de texto?", "Sem lacunas de conteúdo?",
    "Pontos de prova identificados?", "Caixas 'Essencial de Prova' presentes?",
    "Armadilhas e pegadinhas apontadas?",
  ],
  SELECAO_QUESTOES: [
    "Questões representam os tópicos da aula?", "CEBRASPE priorizado?",
    "Questões recentes incluídas?", "Questões duplicadas removidas?",
    "Distribuição por banca equilibrada?", "Lacunas identificadas?",
  ],
  COMENTARIOS_QUESTOES: [
    "Resolução direta e objetiva?", "Teoria citada de forma sintética?",
    "Gabarito correto em todas as questões?", "Pegadinhas sinalizadas?",
    "Padrão TI TOTAL mantido?", "Sem excesso de texto?",
  ],
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  CADASTRO: "Etapa manual de cadastro da arquitetura pedagógica da aula. Revise os dados e aprove para liberar a produção.",
  PRODUCAO_TEORIA: "A IA produz o material teórico completo da aula seguindo o padrão TI TOTAL, com caixas de destaque (Essencial de Prova, Atenção, Bizu, Dica) e destaques semânticos em azul (o que é) e vermelho (o que não é).",
  SELECAO_QUESTOES: "A IA analisa e seleciona as questões mais representativas do tema, priorizando bancas como CEBRASPE, FGV, FCC e VUNESP, além de questões recentes.",
  COMENTARIOS_QUESTOES: "A IA produz os comentários das questões usando a teoria aprovada como base, seguindo o padrão TI TOTAL.",
  REVISAO_HUMANA: "Etapa de revisão manual completa do material produzido. Verifique teoria, questões, comentários e PDFs.",
  GRAVACAO: "Etapa de gravação da aula. Registre quando a gravação for concluída.",
  PUBLICACAO: "Etapa final de publicação do material na plataforma.",
};

export default function StepExecutionPage() {
  const params = useParams<{ id: string; stepId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<any>(null);
  const [step, setStep] = useState<any>(null);
  const [output, setOutput] = useState("");
  const [runVersion, setRunVersion] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState({ whatIsWrong: "", whatToChange: "", examples: "" });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [aiConfig, setAiConfig] = useState<{ provider: string; model: string; temperature: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then(r => r.json())
      .then((configs: any[]) => {
        const def = configs.find((c: any) => c.isDefault) ?? configs[0];
        if (def) setAiConfig({ provider: def.provider, model: def.model, temperature: def.temperature });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/aulas/${params.id}`)
      .then(r => r.json())
      .then(data => {
        setLesson(data);
        const s = (data.workflowSteps ?? []).find((s: any) => s.id === params.stepId);
        if (s) {
          setStep(s);
          // For PADRONIZACAO_EDITORIAL, always show PRODUCAO_TEORIA output
          if (s.stepKey === "PADRONIZACAO_EDITORIAL") {
            const teoriaStep = (data.workflowSteps ?? []).find((ws: any) => ws.stepKey === "PRODUCAO_TEORIA");
            const teoriaRun = (teoriaStep?.stepRuns ?? [])[0];
            if (teoriaRun?.outputText) {
              setOutput(teoriaRun.outputText);
              setRunVersion(teoriaRun.version ?? 1);
            }
          } else {
            const latestRun = (s.stepRuns ?? [])[0];
            if (latestRun?.outputText) {
              setOutput(latestRun.outputText);
              setRunVersion(latestRun.version ?? 1);
            }
          }
        }
      })
      .catch(() => toast.error("Erro ao carregar dados da etapa."))
      .finally(() => setLoading(false));
  }, [params.id, params.stepId]);

  const reloadStep = async () => {
    const res = await fetch(`/api/aulas/${params.id}`);
    const data = await res.json();
    setLesson(data);
    const s = (data.workflowSteps ?? []).find((s: any) => s.id === params.stepId);
    if (s) {
      setStep(s);
      const latestRun = (s.stepRuns ?? [])[0];
      if (latestRun?.outputText) {
        setOutput(latestRun.outputText);
        setRunVersion(latestRun.version ?? 1);
      }
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setOutput("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: params.stepId, lessonId: params.id }),
      });
      let json: any = {};
      try { json = await res.json(); } catch { /* non-JSON response (e.g. 504 timeout) */ }
      if (!res.ok) {
        if (res.status === 504 || res.status === 408) {
          toast.error("Tempo limite excedido. A geração está em andamento — aguarde 30s e recarregue a página.");
        } else {
          toast.error(json.error ?? "Erro ao gerar conteúdo.");
        }
        return;
      }
      if (json.outputText) setOutput(json.outputText);
      if (json.version) setRunVersion(json.version);
      await reloadStep();
      toast.success("Conteúdo gerado com sucesso!");
    } catch {
      toast.error("Erro de conexão — verifique sua internet e tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/workflow/${params.stepId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao aprovar etapa.");
        return;
      }
      toast.success(`Etapa "${step?.title}" aprovada! Próxima etapa desbloqueada.`);
      router.push(`/aulas/${params.id}`);
    } catch {
      toast.error("Erro de conexão.");
    }
  };

  const handleReject = async () => {
    if (!feedback.whatIsWrong && !feedback.whatToChange) {
      toast.error("Descreva o que está errado e o que deve mudar.");
      return;
    }
    try {
      const res = await fetch(`/api/workflow/${params.stepId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackText: feedback.whatIsWrong,
          whatIsWrong: feedback.whatIsWrong,
          whatToChange: feedback.whatToChange,
          examples: feedback.examples,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Erro ao enviar feedback.");
        return;
      }
      toast.info("Feedback enviado. Regenerando com as correções...");
      setShowFeedbackForm(false);
      setFeedback({ whatIsWrong: "", whatToChange: "", examples: "" });
      await handleGenerate();
    } catch {
      toast.error("Erro de conexão.");
    }
  };

  if (loading) {
    return (
      <div className="pt-16 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!step || !lesson) {
    return (
      <div className="pt-16 p-6 text-center text-gray-500">
        <p>Etapa não encontrada.</p>
        <Link href={`/aulas/${params.id}`}>
          <Button variant="outline" className="mt-4">Voltar para a aula</Button>
        </Link>
      </div>
    );
  }

  const checklistItems = STEP_CHECKLISTS[step.stepKey] ?? [];
  const allChecked = checklistItems.length === 0 || checklistItems.every(item => checklist[item]);
  const canApprove = true; // always allow approve/skip

  return (
    <div className="pt-16">
      <Topbar
        title={`${lesson.code} · ${step.title}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={step.status} />
            <Link href={`/aulas/${params.id}`}>
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
                  <span className="text-xl">{STEP_ICONS[step.stepKey] ?? "📋"}</span>
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
                  {STEP_DESCRIPTIONS[step.stepKey] ?? step.description ?? step.title}
                </p>
                {!step.isManual && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Versão atual: v{runVersion}</span>
                    <span className="mx-1">·</span>
                    <History className="h-3.5 w-3.5" />
                    <span>{runVersion} versão(ões) gerada(s)</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Padronização Editorial: DOCX download panel */}
            {step.stepKey === "PADRONIZACAO_EDITORIAL" && !output && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 py-12 gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <FileDown className="h-7 w-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Padronização Editorial</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Gera o documento Word formatado no padrão TI TOTAL a partir da teoria aprovada.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `/api/export/pdf/${params.stepId}`;
                    a.download = `${lesson.code}-teoria.pdf`;
                    a.click();
                  }}
                >
                  <FileDown className="h-4 w-4" />
                  Baixar PDF — Padrão TI TOTAL
                </Button>
              </div>
            )}

            {/* Manual step: just show approve */}
            {step.isManual && step.stepKey !== "PADRONIZACAO_EDITORIAL" && !output && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-green-200 bg-green-50/50 py-12 gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">Etapa manual</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Revise os dados da aula e clique em Aprovar para liberar a próxima etapa.
                  </p>
                </div>
              </div>
            )}

            {/* AI step: generate button — hidden for PADRONIZACAO_EDITORIAL */}
            {!step.isManual && step.stepKey !== "PADRONIZACAO_EDITORIAL" && !output && !isGenerating && (
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
                <Button variant="outline" size="sm" className="text-gray-500 gap-1.5" onClick={handleApprove}>
                  <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
                  Pular esta etapa
                </Button>
              </div>
            )}

            {/* Generating spinner */}
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
                    <CardTitle className="text-sm">
                      {step.stepKey === "PADRONIZACAO_EDITORIAL"
                        ? "Teoria Gerada — Produção da Teoria"
                        : `Output Gerado — v${runVersion}`}
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    {step.stepKey !== "PADRONIZACAO_EDITORIAL" && (
                      <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleGenerate}>
                        <RotateCcw className="h-3 w-3" />
                        Regenerar
                      </Button>
                    )}
                    {step.stepKey !== "PADRONIZACAO_EDITORIAL" && (
                      <Button
                        variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                        onClick={() => {
                          const blob = new Blob([output], { type: "text/plain" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `${lesson.code}-${step.stepKey}.txt`;
                          a.click();
                        }}
                      >
                        <Download className="h-3 w-3" />
                        Exportar .txt
                      </Button>
                    )}
                    {step.stepKey === "PADRONIZACAO_EDITORIAL" && (
                      <Button
                        size="sm" className="gap-1.5 h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = `/api/export/pdf/${params.stepId}`;
                          a.download = `${lesson.code}-teoria.pdf`;
                          a.click();
                        }}
                      >
                        <FileDown className="h-3 w-3" />
                        Baixar PDF
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-5 max-h-[500px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">
                      {output}
                    </pre>
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
                      className="mt-1.5 text-sm" rows={3}
                      value={feedback.whatIsWrong}
                      onChange={e => setFeedback(f => ({ ...f, whatIsWrong: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">O que deve mudar? *</Label>
                    <Textarea
                      placeholder="Especifique o que a IA deve fazer diferente..."
                      className="mt-1.5 text-sm" rows={3}
                      value={feedback.whatToChange}
                      onChange={e => setFeedback(f => ({ ...f, whatToChange: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Exemplos (opcional)</Label>
                    <Textarea
                      placeholder="Dê exemplos do que seria ideal..."
                      className="mt-1.5 text-sm" rows={2}
                      value={feedback.examples}
                      onChange={e => setFeedback(f => ({ ...f, examples: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleReject} variant="destructive" size="sm" className="gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Confirmar Reprovação
                    </Button>
                    <Button onClick={() => setShowFeedbackForm(false)} variant="outline" size="sm">
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approval Buttons */}
            {!showFeedbackForm && step.status !== "APROVADA" && (
              <div className="flex items-center gap-3 justify-end pt-2">
                {!step.isManual && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-gray-400 hover:text-gray-600 text-xs"
                    onClick={handleApprove}
                  >
                    Pular esta etapa
                  </Button>
                )}
                {output && !step.isManual && step.stepKey !== "PADRONIZACAO_EDITORIAL" && (
                  <Button
                    variant="outline"
                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setShowFeedbackForm(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    Reprovar e Enviar Feedback
                  </Button>
                )}
                <Button
                  variant="success"
                  className="gap-2"
                  onClick={handleApprove}
                  disabled={output ? (checklistItems.length > 0 && !allChecked) : false}
                >
                  <CheckCircle className="h-4 w-4" />
                  {step.isManual ? "Marcar como Concluído" : output ? "Aprovar Etapa" : "Pular e Aprovar"}
                </Button>
              </div>
            )}

            {step.status === "APROVADA" && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">Etapa aprovada com sucesso.</p>
                <Link href={`/aulas/${params.id}`} className="ml-auto">
                  <Button size="sm" variant="outline">Ver aula</Button>
                </Link>
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
                  <p className="text-xs text-gray-400">Marque todos os itens antes de aprovar</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {checklistItems.map(item => (
                    <label key={item} className="flex items-start gap-2.5 cursor-pointer group">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border mt-0.5 transition-colors ${
                          checklist[item] ? "bg-blue-600 border-blue-600" : "border-gray-300 group-hover:border-blue-400"
                        }`}
                        onClick={() => setChecklist(c => ({ ...c, [item]: !c[item] }))}
                      >
                        {checklist[item] && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className={`text-xs leading-relaxed ${checklist[item] ? "line-through text-gray-400" : "text-gray-600"}`}>
                        {item}
                      </span>
                    </label>
                  ))}
                  <div className="pt-2 mt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                    <span>{Object.values(checklist).filter(Boolean).length}/{checklistItems.length} marcados</span>
                    {allChecked && <span className="text-green-600 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Pronto</span>}
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
                <div><span className="font-medium text-gray-700">Código:</span> {lesson.code}</div>
                <div><span className="font-medium text-gray-700">Título:</span> {lesson.title}</div>
                {lesson.priorityBoards?.length > 0 && (
                  <div><span className="font-medium text-gray-700">Bancas:</span> {lesson.priorityBoards.join(", ")}</div>
                )}
                {lesson.targetPages && (
                  <div><span className="font-medium text-gray-700">Páginas:</span> {lesson.targetPages}p</div>
                )}
                {lesson.discipline?.name && (
                  <div><span className="font-medium text-gray-700">Disciplina:</span> {lesson.discipline.name}</div>
                )}
              </CardContent>
            </Card>

            {/* AI Config */}
            {!step.isManual && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    Configuração de IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-500">Provedor</span><span className="font-medium capitalize">{aiConfig?.provider ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Modelo</span><span className="font-medium">{aiConfig?.model ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Temperatura</span><span className="font-medium">{aiConfig?.temperature ?? "—"}</span></div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
