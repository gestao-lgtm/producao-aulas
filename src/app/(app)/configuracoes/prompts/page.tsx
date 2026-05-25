"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockPrompts } from "@/lib/mock/data";
import { Sparkles, Save, ChevronRight, Edit3, Check } from "lucide-react";
import { toast } from "sonner";

const STEP_LABELS: Record<string, string> = {
  SELECAO_QUESTOES: "Seleção de Questões",
  CADERNOS_QUESTOES: "Cadernos de Questões",
  PREPARACAO_EDITORIAL: "Preparação Editorial",
  PRODUCAO_TEORIA: "Produção da Teoria",
  PADRONIZACAO_EDITORIAL: "Padronização Editorial",
  COMENTARIOS_QUESTOES: "Comentários das Questões",
  MONTAGEM_PDFS: "Montagem dos PDFs",
  SLIDES: "Slides da Aula",
};

export default function PromptsPage() {
  const [selectedPrompt, setSelectedPrompt] = useState(mockPrompts[0]);
  const [editMode, setEditMode] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(selectedPrompt.prompt);
  const [editedName, setEditedName] = useState(selectedPrompt.name);

  const handleSelect = (p: typeof mockPrompts[0]) => {
    setSelectedPrompt(p);
    setEditedPrompt(p.prompt);
    setEditedName(p.name);
    setEditMode(false);
  };

  const handleSave = () => {
    toast.success("Prompt salvo! Nova versão criada.");
    setEditMode(false);
  };

  return (
    <div className="pt-16">
      <Topbar title="Prompts de IA" />
      <main className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Templates de Prompts</h2>
            <p className="text-sm text-gray-500">Configure os prompts usados pela IA em cada etapa do workflow.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Prompt list */}
          <div className="space-y-2">
            {mockPrompts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-all ${
                  selectedPrompt.id === p.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{STEP_LABELS[p.stepKey] || p.stepKey}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-gray-400">v{p.version}</span>
                  {p.active && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Ativo</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{editedName}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {STEP_LABELS[selectedPrompt.stepKey] || selectedPrompt.stepKey} · v{selectedPrompt.version}
                  </p>
                </div>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSave} className="gap-1.5">
                        <Save className="h-3.5 w-3.5" />
                        Salvar
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="gap-1.5">
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editMode && (
                  <div>
                    <Label className="text-xs">Nome do Template</Label>
                    <Input
                      className="mt-1.5"
                      value={editedName}
                      onChange={e => setEditedName(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Prompt</Label>
                  <Textarea
                    className="mt-1.5 font-mono text-xs"
                    rows={20}
                    value={editedPrompt}
                    onChange={e => setEditedPrompt(e.target.value)}
                    readOnly={!editMode}
                  />
                </div>
                {!editMode && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    <span>
                      Este prompt é injetado automaticamente quando a IA executa a etapa{" "}
                      <strong>{STEP_LABELS[selectedPrompt.stepKey]}</strong>.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
