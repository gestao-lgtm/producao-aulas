import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/workflow/status-badge";
import { mockLessons } from "@/lib/mock/data";
import {
  BookOpen, Clock, CheckCircle, AlertTriangle, TrendingUp, Plus, ArrowRight, Sparkles, FileText, Users
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const stats = [
    { label: "Total de Aulas", value: mockLessons.length, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Em Produção", value: mockLessons.filter(l => l.status === "EM_PRODUCAO").length, icon: TrendingUp, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Aguardando Aprovação", value: 1, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Publicadas", value: mockLessons.filter(l => l.status === "PUBLICADA").length, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="pt-16">
      <Topbar title="Dashboard" />
      <main className="p-6 space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bom dia, Gestão TI TOTAL 👋</h2>
            <p className="text-sm text-gray-500 mt-1">Você tem 1 etapa aguardando aprovação e 2 aulas em produção.</p>
          </div>
          <Link href="/aulas/nova">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Nova Aula
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Lessons Table */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Aulas em Produção</CardTitle>
                <Link href="/aulas">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Código / Título</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Progresso</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {mockLessons.slice(0, 4).map((lesson) => (
                      <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-xs font-mono text-gray-400">{lesson.code}</p>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">{lesson.title}</p>
                          <p className="text-xs text-gray-400">{lesson.discipline.name}</p>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={lesson.status} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                              <div
                                className="h-1.5 rounded-full bg-blue-500"
                                style={{ width: `${lesson.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{lesson.progress}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/aulas/${lesson.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              Abrir
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações Pendentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-yellow-800">Aprovar teoria</p>
                    <p className="text-xs text-yellow-600 mt-0.5 truncate">BD-FD02 · Etapa 4</p>
                    <Link href="/aulas/lesson-fd02/etapas/step-4">
                      <Button variant="warning" size="sm" className="mt-2 h-6 text-xs">
                        Revisar agora
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo de Hoje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { icon: FileText, label: "Arquivos gerados", value: "6" },
                  { icon: Sparkles, label: "Execuções de IA", value: "4" },
                  { icon: Users, label: "Questões catalogadas", value: "187" },
                  { icon: Clock, label: "Horas estimadas restantes", value: "19h" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">{item.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
