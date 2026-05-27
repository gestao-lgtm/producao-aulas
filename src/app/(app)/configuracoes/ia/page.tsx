"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Sparkles, Eye, EyeOff, CheckCircle, RefreshCw, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { value: "openai",    label: "OpenAI (GPT)",        models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "anthropic", label: "Anthropic (Claude)",  models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
];

export default function IAConfigPage() {
  const [showKey, setShowKey]         = useState(false);
  const [provider, setProvider]       = useState("anthropic");
  const [model, setModel]             = useState("claude-sonnet-4-6");
  const [temperature, setTemperature] = useState("0.3");
  const [maxTokens, setMaxTokens]     = useState("8000");
  const [saving, setSaving]           = useState(false);
  const [reordering, setReordering]   = useState(false);
  const [loaded, setLoaded]           = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then(r => r.json())
      .then((configs: any[]) => {
        const def = configs.find(c => c.isDefault) ?? configs[0];
        if (def) {
          setProvider(def.provider);
          setModel(def.model);
          setTemperature(String(def.temperature ?? 0.3));
          setMaxTokens(String(def.maxTokens ?? 8000));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const currentProvider = PROVIDERS.find(p => p.value === provider);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: provider === "anthropic" ? "Anthropic Claude" : "OpenAI GPT-4o",
          provider,
          model,
          isDefault: true,
          temperature: parseFloat(temperature),
          maxTokens: parseInt(maxTokens),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Configuração salva! Próximas gerações usarão este modelo.");
    } catch {
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  const handleReorder = async () => {
    setReordering(true);
    try {
      const res = await fetch("/api/admin/reorder-steps", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast.success(data.message ?? "Etapas reordenadas com sucesso!");
    } catch {
      toast.error("Erro ao reordenar etapas.");
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="pt-16">
      <Topbar title="Configuração de IA" />
      <main className="p-6 max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Configuração de IA</h2>
          <p className="text-sm text-gray-500">Configure o provedor e modelo de IA utilizado nas gerações.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Provedor de IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loaded ? (
              <p className="text-sm text-gray-400">Carregando configuração atual...</p>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Provedor *</Label>
                  <Select
                    value={provider}
                    onValueChange={v => {
                      setProvider(v);
                      setModel(PROVIDERS.find(p => p.value === v)?.models[0] ?? "");
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Modelo *</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProvider?.models.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <strong>Chave de API:</strong> configure a variável de ambiente{" "}
                  <code className="font-mono bg-amber-100 px-1 rounded">
                    {provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}
                  </code>{" "}
                  no Vercel (Settings → Environment Variables).
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Temperatura (0.0 – 1.0)</Label>
                    <Input
                      className="mt-1.5"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={e => setTemperature(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1">Menor = mais determinístico</p>
                  </div>
                  <div>
                    <Label className="text-xs">Máximo de Tokens</Label>
                    <Input
                      className="mt-1.5"
                      type="number"
                      value={maxTokens}
                      onChange={e => setMaxTokens(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-orange-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-orange-500" />
              Manutenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Reordenar Etapas das Aulas</p>
                <p className="text-xs text-gray-500">
                  Atualiza a ordem das etapas de todas as aulas para o padrão atual:<br />
                  Cadastro → Teoria → Padronização Editorial → Questões…
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReorder}
                disabled={reordering}
                className="ml-4 shrink-0 gap-2"
              >
                {reordering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {reordering ? "Aplicando..." : "Aplicar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Como a IA é usada</p>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>• A IA sempre recebe a arquitetura completa da aula como contexto</li>
              <li>• Cada etapa usa um prompt específico configurável</li>
              <li>• O output é salvo e versionado antes de ser apresentado para aprovação</li>
              <li>• Feedbacks de reprovações são incorporados na próxima geração</li>
              <li>• A memória da aula é mantida entre etapas</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
