"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Plus, X, Save, Rocket, Upload, FileText, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const BOARDS = ["CEBRASPE", "FGV", "FCC", "VUNESP", "CESPE", "OUTROS"];
const DEPTH_LEVELS = ["Básico", "Intermediário", "Avançado"];
const DISCIPLINE_SUGGESTIONS = [
  "Banco de Dados",
  "Redes de Computadores",
  "Segurança da Informação",
  "Sistemas Operacionais",
  "Engenharia de Software",
  "Governança de TI",
  "Programação",
  "Infraestrutura",
  "Legislação de TI",
];

export default function NovaAulaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedBoards, setSelectedBoards] = useState<string[]>(["CEBRASPE", "FCC"]);
  const [topics, setTopics] = useState([{ title: "", description: "", order: 1 }]);

  const [form, setForm] = useState({
    disciplineName: "",
    code: "",
    title: "",
    subtitle: "",
    position: "",
    scope: "",
    outOfScope: "",
    targetPages: "",
    studentProfile: "",
    depthLevel: "Intermediário",
    pedagogicalNotes: "",
  });

  const addTopic = () => {
    setTopics(t => [...t, { title: "", description: "", order: t.length + 1 }]);
  };

  const removeTopic = (index: number) => {
    setTopics(t => t.filter((_, i) => i !== index));
  };

  const toggleBoard = (board: string) => {
    setSelectedBoards(b =>
      b.includes(board) ? b.filter(x => x !== board) : [...b, board]
    );
  };

  const handleFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "txt") {
      toast.error("Formato não suportado. Use arquivos .docx ou .txt");
      return;
    }
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleExtract = async () => {
    if (!uploadedFile) return;
    setExtracting(true);

    try {
      const fd = new FormData();
      fd.append("file", uploadedFile);

      const res = await fetch("/api/ai/extract-lesson", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Erro ao extrair campos.");
        return;
      }

      const d = json.data;

      setForm(f => ({
        ...f,
        disciplineName: d.discipline ?? f.disciplineName,
        code: d.code ?? f.code,
        title: d.title ?? f.title,
        subtitle: d.subtitle ?? f.subtitle,
        scope: d.scope ?? f.scope,
        outOfScope: d.outOfScope ?? f.outOfScope,
        targetPages: d.targetPages != null ? String(d.targetPages) : f.targetPages,
        depthLevel: d.depthLevel ?? f.depthLevel,
        studentProfile: d.studentProfile ?? f.studentProfile,
        pedagogicalNotes: d.pedagogicalNotes ?? f.pedagogicalNotes,
      }));

      if (Array.isArray(d.priorityBoards) && d.priorityBoards.length > 0) {
        setSelectedBoards(d.priorityBoards as string[]);
      }

      if (Array.isArray(d.topics) && d.topics.length > 0) {
        setTopics(
          (d.topics as { title: string; description: string }[]).map((t, i) => ({
            title: t.title ?? "",
            description: t.description ?? "",
            order: i + 1,
          }))
        );
      }

      toast.success("Campos preenchidos com sucesso! Revise e ajuste conforme necessário.");
    } catch {
      toast.error("Erro de conexão ao extrair campos.");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (startProduction = false) => {
    if (!form.code || !form.title) {
      toast.error("Código e título são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/aulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          priorityBoards: selectedBoards,
          topics: topics.filter(t => t.title.trim()),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao criar aula.");
        return;
      }
      toast.success("Aula criada com sucesso!");
      router.push(`/aulas/${json.id}`);
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-16">
      <Topbar
        title="Nova Aula"
        action={
          <Link href="/aulas">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ChevronLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
          </Link>
        }
      />
      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cadastrar Nova Aula</h2>
          <p className="text-sm text-gray-500 mt-1">
            Preencha os campos manualmente ou suba o arquivo da arquitetura e deixe a IA extrair tudo automaticamente.
          </p>
        </div>

        {/* File Upload — AI Extraction */}
        <Card className="border-2 border-dashed border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
              <Sparkles className="h-4 w-4" />
              Preencher com IA — suba o arquivo da arquitetura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                dragging
                  ? "border-blue-500 bg-blue-100"
                  : uploadedFile
                  ? "border-green-400 bg-green-50"
                  : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {uploadedFile ? (
                <div className="flex items-center gap-3 text-green-700">
                  <FileText className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(uploadedFile.size / 1024).toFixed(0)} KB · clique para trocar
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setUploadedFile(null); }}
                    className="ml-4 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                  <p className="text-xs mt-1 text-gray-400">Aceita .docx e .txt — a IA vai extrair todos os campos</p>
                </div>
              )}
            </div>

            {uploadedFile && (
              <Button
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleExtract}
                disabled={extracting}
              >
                {extracting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Extraindo campos com IA...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Extrair Campos com IA</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Disciplina</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Ex: Segurança da Informação"
                  list="discipline-suggestions"
                  value={form.disciplineName}
                  onChange={e => setForm(f => ({ ...f, disciplineName: e.target.value }))}
                />
                <datalist id="discipline-suggestions">
                  {DISCIPLINE_SUGGESTIONS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Código da Aula *</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Ex: SI-FD01"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Título da Aula *</Label>
              <Input
                className="mt-1.5"
                placeholder="Ex: Fundamentos de Segurança da Informação"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Subtítulo (opcional)</Label>
              <Input
                className="mt-1.5"
                placeholder="Ex: Criptografia, políticas e gestão de riscos"
                value={form.subtitle}
                onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Posição no Curso</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  placeholder="Ex: 1"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Páginas Estimadas</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  placeholder="Ex: 80"
                  value={form.targetPages}
                  onChange={e => setForm(f => ({ ...f, targetPages: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Nível de Profundidade</Label>
                <Select
                  value={form.depthLevel}
                  onValueChange={v => setForm(f => ({ ...f, depthLevel: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPTH_LEVELS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Escopo e Conteúdo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Escopo da Aula</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Descreva o que será abordado nesta aula..."
                rows={4}
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Tópicos Excluídos</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Descreva o que NÃO será abordado (reservado para outras aulas)..."
                rows={2}
                value={form.outOfScope}
                onChange={e => setForm(f => ({ ...f, outOfScope: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Topics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">Tópicos e Subtópicos</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={addTopic}>
              <Plus className="h-3 w-3" />
              Adicionar Tópico
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {topics.map((topic, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold mt-1.5">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder={`Tópico ${index + 1}`}
                    className="h-8"
                    value={topic.title}
                    onChange={e => setTopics(t => t.map((tp, i) => i === index ? { ...tp, title: e.target.value } : tp))}
                  />
                  <Input
                    placeholder="Descrição ou subtópicos (opcional)"
                    className="h-8 text-xs"
                    value={topic.description}
                    onChange={e => setTopics(t => t.map((tp, i) => i === index ? { ...tp, description: e.target.value } : tp))}
                  />
                </div>
                {topics.length > 1 && (
                  <button onClick={() => removeTopic(index)} className="text-gray-400 hover:text-red-500 mt-1.5">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Boards */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Prioridade de Bancas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {BOARDS.map(board => (
                <button
                  key={board}
                  onClick={() => toggleBoard(board)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                    selectedBoards.includes(board)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {board}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Profile & Notes */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Perfil e Observações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Perfil do Aluno</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Descreva o perfil do aluno-alvo desta aula..."
                rows={2}
                value={form.studentProfile}
                onChange={e => setForm(f => ({ ...f, studentProfile: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Observações Pedagógicas</Label>
              <Textarea
                className="mt-1.5"
                placeholder="Orientações especiais para a IA e equipe de produção..."
                rows={3}
                value={form.pedagogicalNotes}
                onChange={e => setForm(f => ({ ...f, pedagogicalNotes: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link href="/aulas">
            <Button variant="outline">Cancelar</Button>
          </Link>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar como Rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2">
            <Rocket className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar e Iniciar Produção"}
          </Button>
        </div>
      </main>
    </div>
  );
}
