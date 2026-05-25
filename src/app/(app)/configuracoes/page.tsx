import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, PenTool, Shield, Database, Sliders, ChevronRight } from "lucide-react";
import Link from "next/link";

const configSections = [
  {
    href: "/configuracoes/editorial",
    icon: PenTool,
    title: "Padrão Editorial",
    description: "Tipografia, cores, caixas de destaque e padrões visuais TI TOTAL",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/configuracoes/prompts",
    icon: Sparkles,
    title: "Prompts de IA",
    description: "Configure os prompts usados pela IA em cada etapa do workflow",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    href: "/configuracoes/ia",
    icon: Sliders,
    title: "Configuração de IA",
    description: "Provedor, modelo, chave de API, temperatura e limites de tokens",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    href: "/configuracoes/usuarios",
    icon: Shield,
    title: "Usuários e Permissões",
    description: "Gerenciar usuários, perfis e permissões de acesso",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    href: "/configuracoes/banco",
    icon: Database,
    title: "Banco de Dados",
    description: "Disciplinas, cursos e configurações gerais",
    color: "text-gray-600",
    bg: "bg-gray-50",
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="pt-16">
      <Topbar title="Configurações" />
      <main className="p-6 max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Configurações</h2>
          <p className="text-sm text-gray-500">Gerencie o padrão editorial, IA e sistema.</p>
        </div>

        <div className="space-y-3">
          {configSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} href={section.href}>
                <Card className="hover:border-blue-200 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${section.bg}`}>
                        <Icon className={`h-5 w-5 ${section.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{section.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
