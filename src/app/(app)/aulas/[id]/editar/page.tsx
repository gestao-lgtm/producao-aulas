"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Plus, X, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const BOARDS = ["CEBRASPE", "FGV", "FCC", "VUNESP", "CESPE", "OUTROS"];
const DEPTH_LEVELS = ["Básico", "Intermediário", "Avançado"];

export default function EditarAulaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [topics, setTopics] = useState<{ id?: string; title: string; description: string; order: number }[]>([]);

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

  useEffect(() => {
    fetch(`/api/aulas/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          disciplineName: data.discipline?.name ?? "",
          code: data.code ?? "",
          title: data.title ?? "",
          subtitle: data.subtitle ?? "",
          position: data.position != null ? String(data.position) : "",
          scope: data.scope ?? "",
          outOfScope: data.outOfScope ?? "",
          targetPages: data.targetPages != null ? String(data.targetPages) : "",
          studentProfile: data.studentProfile ?? "",
          depthLevel: data.depthLevel ?? "Intermediário",
          pedagogicalNotes: data.pedagogicalNotes ?? "",
        });
        setSelectedBoards(data.priorityBoards ?? []);
        setTopics(
          (data.topics ?? []).map((t: any) => ({
            id: t.id,
            title: t.title ?? "",
            description: t.description ?? "",
            order: t.order,
          }))
        );
      })
      .catch(() => toast.error("Erro ao carregar dados da aula."))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleBoard = (board: string) => {
    setSelectedBoards(b => b.includes(board) ? b.filter(x => x !== board) : [...b, board]);
  };

  const handleSave = async () => {
    if (!form.code || !form.title) {
      toast.error("Código e título são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/aulas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          priorityBoards: selectedBoards,
          topics: topics.filter(t => t.title.trim()),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao salvar.");
        return;
      }
      toast.success("Aula atualizada!");
      router.push(`/aulas/${id}`);
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-16 flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="pt-16">
      <Topbar
        title="Editar Aula"
        action={
          <Link href={`/aulas/${id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ChevronLeft className="h-3.5 w-3.5" />
              Voltar
            </Button>
          </Link>
        }
      />
      <main className="p-6 max-w-4xl mx-auto space-y-6">

        <Card>
          <CardHeader><CardTitle className="text-sm">Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Disciplina</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Ex: Segurança da Informação"
                  value={form.disciplineName}
                  onChange={e => setForm(f => ({ ...f, disciplineName: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Código da Aula *</Label>
                <Input
                  className="mt-1.5"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Título da Aula *</Label>
              <Input
                className="mt-1.5"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Subtítulo</Label>
              <Input
                className="mt-1.5"
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
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Páginas Estimadas</Label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.targetPages}
                  onChange={e => setForm(f => ({ ...f, targetPages: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Nível de Profundidade</Label>
                <Select value={form.depthLevel} onValueChange={v => setForm(f => ({ ...f, depthLevel: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPTH_LEVELS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Escopo e Conteúdo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Escopo da Aula</Label>
              <Textarea
                className="mt-1.5"
                rows={4}
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Tópicos Excluídos</Label>
              <Textarea
                className="mt-1.5"
                rows={2}
                value={form.outOfScope}
                onChange={e => setForm(f => ({ ...f, outOfScope: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">Tópicos</CardTitle>
            <Button
              variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
              onClick={() => setTopics(t => [...t, { title: "", description: "", order: t.length + 1 }])}
            >
              <Plus className="h-3 w-3" /> Adicionar
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
                    placeholder="Subtópicos (opcional)"
                    className="h-8 text-xs"
                    value={topic.description}
                    onChange={e => setTopics(t => t.map((tp, i) => i === index ? { ...tp, description: e.target.value } : tp))}
                  />
                </div>
                {topics.length > 1 && (
                  <button onClick={() => setTopics(t => t.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 mt-1.5">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader><CardTitle className="text-sm">Perfil e Observações</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Perfil do Aluno</Label>
              <Textarea
                className="mt-1.5"
                rows={2}
                value={form.studentProfile}
                onChange={e => setForm(f => ({ ...f, studentProfile: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Observações Pedagógicas</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={form.pedagogicalNotes}
                onChange={e => setForm(f => ({ ...f, pedagogicalNotes: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-6">
          <Link href={`/aulas/${id}`}>
            <Button variant="outline">Cancelar</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </main>
    </div>
  );
}
