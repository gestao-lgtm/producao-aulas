"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  NAO_INICIADA: { label: "Não Iniciada", className: "bg-gray-100 text-gray-600" },
  EM_ANDAMENTO: { label: "Em Andamento", className: "bg-blue-100 text-blue-700" },
  AGUARDANDO_APROVACAO: { label: "Aguardando Aprovação", className: "bg-yellow-100 text-yellow-700" },
  REPROVADA: { label: "Reprovada", className: "bg-red-100 text-red-700" },
  EM_CORRECAO: { label: "Em Correção", className: "bg-orange-100 text-orange-700" },
  APROVADA: { label: "Aprovada", className: "bg-green-100 text-green-700" },
  BLOQUEADA: { label: "Bloqueada", className: "bg-gray-200 text-gray-500" },
  // Lesson statuses
  RASCUNHO: { label: "Rascunho", className: "bg-gray-100 text-gray-600" },
  EM_PRODUCAO: { label: "Em Produção", className: "bg-blue-100 text-blue-700" },
  AGUARDANDO_REVISAO: { label: "Aguardando Revisão", className: "bg-yellow-100 text-yellow-700" },
  REVISANDO: { label: "Revisando", className: "bg-orange-100 text-orange-700" },
  CONCLUIDA: { label: "Concluída", className: "bg-green-100 text-green-700" },
  PUBLICADA: { label: "Publicada", className: "bg-purple-100 text-purple-700" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className, className)}>
      {config.label}
    </span>
  );
}
