"use client";
import { cn } from "@/lib/utils";
import { Check, Lock, Clock, AlertCircle, RefreshCw, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";

const STATUS_ICONS = {
  NAO_INICIADA: Clock,
  EM_ANDAMENTO: Loader2,
  AGUARDANDO_APROVACAO: AlertCircle,
  REPROVADA: AlertCircle,
  EM_CORRECAO: RefreshCw,
  APROVADA: Check,
  BLOQUEADA: Lock,
};

const STATUS_STYLES = {
  NAO_INICIADA: "border-gray-200 bg-white text-gray-400",
  EM_ANDAMENTO: "border-blue-300 bg-blue-50 text-blue-600",
  AGUARDANDO_APROVACAO: "border-yellow-400 bg-yellow-50 text-yellow-600",
  REPROVADA: "border-red-400 bg-red-50 text-red-600",
  EM_CORRECAO: "border-orange-400 bg-orange-50 text-orange-600",
  APROVADA: "border-green-400 bg-green-100 text-green-700",
  BLOQUEADA: "border-gray-100 bg-gray-50 text-gray-300",
};

interface Step {
  id: string;
  stepKey: string;
  title: string;
  order: number;
  isManual: boolean;
  isAiEnabled: boolean;
  status: string;
  icon: string;
}

interface WorkflowTimelineProps {
  steps: Step[];
  lessonId: string;
  currentStepId?: string;
}

export function WorkflowTimeline({ steps, lessonId, currentStepId }: WorkflowTimelineProps) {
  return (
    <div className="relative">
      <div className="space-y-1">
        {steps.map((step, index) => {
          const Icon = STATUS_ICONS[step.status as keyof typeof STATUS_ICONS] || Clock;
          const isActive = step.id === currentStepId;
          const isClickable = step.status !== "BLOQUEADA" && step.status !== "NAO_INICIADA";
          const style = STATUS_STYLES[step.status as keyof typeof STATUS_STYLES];

          const content = (
            <div className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
              style,
              isActive && "ring-2 ring-blue-500 ring-offset-1",
              isClickable && "cursor-pointer hover:opacity-80",
              step.status === "BLOQUEADA" && "opacity-50"
            )}>
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm",
                step.status === "APROVADA" ? "border-green-500 bg-green-500 text-white" :
                step.status === "AGUARDANDO_APROVACAO" ? "border-yellow-500 bg-yellow-500 text-white" :
                step.status === "REPROVADA" ? "border-red-500 bg-red-500 text-white" :
                step.status === "EM_ANDAMENTO" ? "border-blue-500 bg-blue-500 text-white" :
                "border-gray-300 bg-white text-gray-400"
              )}>
                {step.status === "APROVADA" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : step.status === "BLOQUEADA" ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <span className="text-xs font-bold">{step.order}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{step.icon}</span>
                  <p className={cn(
                    "text-xs font-medium truncate",
                    step.status === "BLOQUEADA" ? "text-gray-400" : "text-gray-800"
                  )}>
                    {step.title}
                  </p>
                </div>
                {step.isManual && (
                  <span className="text-[10px] text-gray-400">Manual</span>
                )}
              </div>
              {isClickable && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
            </div>
          );

          return (
            <div key={step.id} className="relative">
              {index < steps.length - 1 && (
                <div className={cn(
                  "absolute left-[22px] top-[42px] w-0.5 h-1 z-10",
                  step.status === "APROVADA" ? "bg-green-400" : "bg-gray-200"
                )} />
              )}
              {isClickable ? (
                <Link href={`/aulas/${lessonId}/etapas/${step.id}`}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
