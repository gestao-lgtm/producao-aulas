"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Plus, X, Save, Rocket } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const BOARDS = ["CEBRASPE", "FGV", "FCC", "VUNESP", "CESPE", "OUTROS"];
const DEPTH_LEVELS = ["Básico", "Intermediário", "Avançado"];

export default function NovaAulaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedBoards, setSelectedBoards] = useState<string[]>(["CEBRASPE", "FCC"]);
  const [topics, setTopics] = useState([{ title: "", description: "", order: 1 }]);

  const [form, setForm] = useState({
    disciplineId: "disc-bd-01",
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

  const handleSave = async (startProduction = false) => {
    if (!form.code || !form.title) {
      toast.error("Código e título são obrigatórios.");
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    toast.success("Aula criada com sucesso!");
    router.push("/aulas/lesson-fd02");
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
            Preencha a arquitetura pedagógica da aula. Esta etapa é feita pela equipe, não pela IA.
          </p>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Disciplina *</Label>
                <Select defaultValue="disc-bd-01">
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disc-bd-01">Banco de Dados</SelectItem>
                    <SelectItem value="disc-redes-01">Redes de Computadores</SelectItem>
                    <SelectItem value="disc-so-01">Sistemas Operacionais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Código da Aula *</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Ex: BD-FD03"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Título da Aula *</Label>
              <Input
                className="mt-1.5"
                placeholder="Ex: Modelagem Entidade-Relacionamento"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Subtítulo (opcional)</Label>
              <Input
                className="mt-1.5"
                placeholder="Ex: Conceitos, notações e casos práticos"
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
                  placeholder="Ex: 3"
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
                <Select defaultValue="Intermediário" onValueChange={v => setForm(f => ({ ...f, depthLevel: v }))}>
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
