"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Palette, Type, BookOpen, Star } from "lucide-react";
import { toast } from "sonner";

const BOX_TYPES = [
  { type: "essencial_prova", label: "Essencial de Prova", color: "#1E40AF", bg: "#EFF6FF", description: "Conteúdos de alta incidência em prova" },
  { type: "atencao", label: "Atenção", color: "#DC2626", bg: "#FEF2F2", description: "Armadilhas e pegadinhas" },
  { type: "bizu", label: "Bizu", color: "#16A34A", bg: "#F0FDF4", description: "Memorização rápida" },
  { type: "dica", label: "Dica", color: "#D97706", bg: "#FFFBEB", description: "Estratégia de prova" },
  { type: "exemplificando", label: "Exemplificando", color: "#7C3AED", bg: "#F5F3FF", description: "Exemplos práticos" },
  { type: "esclarecendo", label: "Esclarecendo", color: "#EA580C", bg: "#FFF7ED", description: "Desfazer confusões" },
  { type: "esquema", label: "Esquema", color: "#0284C7", bg: "#F0F9FF", description: "Organização de conceitos" },
];

export default function EditorialPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success("Padrão editorial salvo com sucesso!");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="pt-16">
      <Topbar title="Padrão Editorial" />
      <main className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Padrão Editorial TI TOTAL</h2>
            <p className="text-sm text-gray-500">Configure tipografia, cores, caixas e padrões da produção.</p>
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Salvo!" : "Salvar"}
          </Button>
        </div>

        <Tabs defaultValue="typography">
          <TabsList>
            <TabsTrigger value="typography" className="gap-1.5"><Type className="h-3.5 w-3.5" />Tipografia</TabsTrigger>
            <TabsTrigger value="colors" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Cores</TabsTrigger>
            <TabsTrigger value="boxes" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" />Caixas de Destaque</TabsTrigger>
            <TabsTrigger value="boards" className="gap-1.5"><Star className="h-3.5 w-3.5" />Bancas</TabsTrigger>
          </TabsList>

          <TabsContent value="typography" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Fonte Primária (Títulos)</Label>
                    <Input className="mt-1.5" defaultValue="Montserrat" />
                    <p className="text-xs text-gray-400 mt-1">Usada em títulos e subtítulos</p>
                  </div>
                  <div>
                    <Label className="text-xs">Fonte Secundária (Corpo)</Label>
                    <Input className="mt-1.5" defaultValue="Segoe UI" />
                    <p className="text-xs text-gray-400 mt-1">Usada no texto principal</p>
                  </div>
                  <div>
                    <Label className="text-xs">Tamanho do Corpo</Label>
                    <Input className="mt-1.5" defaultValue="12px" />
                  </div>
                  <div>
                    <Label className="text-xs">Espaçamento de Linha</Label>
                    <Input className="mt-1.5" defaultValue="1.15" />
                  </div>
                  <div>
                    <Label className="text-xs">Tamanho da Página</Label>
                    <Input className="mt-1.5" defaultValue="A4" />
                  </div>
                  <div>
                    <Label className="text-xs">Margens</Label>
                    <Input className="mt-1.5" defaultValue="2.5cm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="colors" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Azul — Núcleo Conceitual (O que É)</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input defaultValue="#1E40AF" className="font-mono" />
                      <div className="h-9 w-9 rounded-lg border border-gray-200 shrink-0" style={{ backgroundColor: "#1E40AF" }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Usado para destacar definições e conceitos centrais</p>
                  </div>
                  <div>
                    <Label className="text-xs">Vermelho — Limite Conceitual (O que NÃO É)</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input defaultValue="#DC2626" className="font-mono" />
                      <div className="h-9 w-9 rounded-lg border border-gray-200 shrink-0" style={{ backgroundColor: "#DC2626" }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Usado para negações, armadilhas e limites</p>
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs font-medium text-blue-800 mb-2">Regra de Ouro</p>
                  <p className="text-xs text-blue-700">
                    ✅ Azul = O que é (núcleo conceitual)
                    <br />
                    ❌ Vermelho = O que não é (negação, armadilha, limite)
                    <br /><br />
                    Não usar cores apenas por estética. Cada cor tem função semântica obrigatória.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="boxes" className="mt-4">
            <div className="space-y-3">
              {BOX_TYPES.map(box => (
                <Card key={box.type}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-10 w-32 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                        style={{ backgroundColor: box.bg, color: box.color }}
                      >
                        {box.label}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{box.label}</p>
                        <p className="text-xs text-gray-400">{box.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-gray-500">Cor</Label>
                          <Input defaultValue={box.color} className="w-28 font-mono text-xs" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="boards" className="mt-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-gray-700 mb-3">Bancas Prioritárias (em ordem de prioridade)</p>
                <div className="space-y-2">
                  {["CEBRASPE", "FGV", "FCC", "VUNESP", "CESPE", "OUTROS"].map((board, i) => (
                    <div key={board} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-700">{board}</span>
                      <input type="checkbox" defaultChecked={i < 4} className="h-4 w-4 rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
