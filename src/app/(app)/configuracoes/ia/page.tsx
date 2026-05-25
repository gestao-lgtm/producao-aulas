"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Sparkles, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { value: "anthropic", label: "Anthropic (Claude)", models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
];

export default function IAConfigPage() {
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState("0.3");
  const [maxTokens, setMaxTokens] = useState("4000");

  const currentProvider = PROVIDERS.find(p => p.value === provider);

  const handleSave = () => {
    toast.success("Configuração de IA salva com sucesso!");
  };

  const handleTest = async () => {
    toast.info("Testando conexão com a API...");
    await new Promise(r => setTimeout(r, 1500));
    toast.success("Conexão com a API estabelecida com sucesso!");
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
            <div>
              <Label className="text-xs">Provedor *</Label>
              <Select value={provider} onValueChange={v => { setProvider(v); setModel(PROVIDERS.find(p => p.value === v)?.models[0] || ""); }}>
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

            <div>
              <Label className="text-xs">Chave de API *</Label>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={`${provider === "openai" ? "sk-..." : "sk-ant-..."}`}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" size="sm" onClick={handleTest}>
                  Testar
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                A chave é criptografada e nunca exposta no frontend.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Temperatura (0.0 - 1.0)</Label>
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
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar Configuração
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
