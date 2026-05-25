"use client";

import { Bell, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface TopbarProps {
  title?: string;
  action?: React.ReactNode;
}

export function Topbar({ title, action }: TopbarProps) {
  return (
    <header className="fixed left-60 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {title && (
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      )}
      <div className="flex items-center gap-3 ml-auto">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar aulas..."
            className="w-56 pl-8 h-8 text-xs"
          />
        </div>
        <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
        </button>
        {action || (
          <Link href="/aulas/nova">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova Aula
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
