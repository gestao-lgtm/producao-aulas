"use client";

import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockLessons, mockFiles, mockWorkflowSteps } from "@/lib/mock/data";
import { CheckCircle, XCircle, AlertCircle, Download, Package, ArrowLeft } from "lucide-react";
import Link from "next/link";

const REQUIRED_FILES = [
  { type: "TEORIA_PDF", label: "PDF de Teoria", icon: "📖" },
  { type: "QUESTOES_COMENTADAS", label: "PDF de Questões Comentadas", icon: "💬" },
  { type: "LISTA_QUESTOES", label: "PDF de Lista de Questões", icon: "📋" },
  { type: "REVISAO", label: "PDF de Revisão", icon: "🔁" },
  { type: "GABARITO", label: "Gabarito", icon: "✅" },
  { type: "SLIDES", label: "Slides da Aula", icon: "🖥️" },
];

const REQUIRED_STEPS = [
  "CADASTRO", "SELECAO_QUESTOES", "CADERNOS_QUESTOES",
  "PREPARACAO_EDITORIAL", "PRODUCAO_TEORIA", "PADRONIZACAO_EDITORIAL",
  "COMENTARIOS_QUESTOES", "MONTAGEM_PDFS", "SLIDES",
  "REVISAO_HUMANA", "GRAVACAO",
];

export default function PublicacaoPage({ params }: { params: { id: string } }) {
  const lesson = mockLessons.find(l => l.id === params.id) || mockLessons[0];
  const steps = mockWorkflowSteps;
  const files = mockFiles;

  const approvedSteps = steps.filter(s => s.status === "APROVADA");
  const blockedSteps = REQUIRED_STEPS.filter(key =>
    !approvedSteps.some(s => s.stepKey === key)
  );

  const canPublish = blockedSteps.length === 0;
  const completionPct = Math.round((approvedSteps.length / REQUIRED_STEPS.length) * 100);

  return (
    <div className="pt-16">
      <Topbar
        title={`${lesson.code} · Publicação`}
        action={
          <Link href={`/aulas/${lesson.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
          </Link>
        }
      />
      <main className="p-6 max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Checklist de Publicação</h2>
          <p className="text-sm text-gray-500">Todos os itens devem estar completos antes de publicar a aula.</p>
        </div>

        {/* Overall Status */}
        <Card className={canPublish ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              {canPublish ? (
                <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="h-10 w-10 text-yellow-600 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-base font-semibold text-gray-900">
                  {canPublish ? "Aula pronta para publicação!" : "Checklist incompleto"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {canPublish
                    ? "Todos os materiais foram produzidos e aprovados."
                    : `${blockedSteps.length} etapa(s) obrigatória(s) ainda pendente(s).`}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-white/60 rounded-full h-2 max-w-xs">
                    <div className="h-2 rounded-full bg-green-500" style={{ width: `${completionPct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{completionPct}%</span>
                </div>
              </div>
              {canPublish && (
                <Button className="shrink-0 gap-2 bg-green-600 hover:bg-green-700">
                  <Package className="h-4 w-4" />
                  Publicar Aula
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-5">
          {/* Step Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Etapas do Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.slice(0, 11).map(step => (
                <div key={step.id} className="flex items-center gap-3 py-1">
                  {step.status === "APROVADA" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <span className={`text-xs ${step.status === "APROVADA" ? "text-gray-600" : "text-red-600 font-medium"}`}>
                    {step.icon} {step.title}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Files Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Materiais Necessários</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {REQUIRED_FILES.map(required => {
                const hasFile = files.some(f => f.fileType === required.type);
                return (
                  <div key={required.type} className="flex items-center gap-3 py-1">
                    {hasFile ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <span className={`text-xs ${hasFile ? "text-gray-600" : "text-red-600 font-medium"}`}>
                      {required.icon} {required.label}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Package Download */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pacote de Publicação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {mockFiles.map(file => (
                <div key={file.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-sm">📄</span>
                  <span className="flex-1 text-xs font-medium text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-400">v{file.version}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              Baixar Pacote Completo (.zip)
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
