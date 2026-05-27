import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: list all AI configs
export async function GET() {
  const configs = await prisma.aIConfig.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(configs);
}

// POST: set default provider by name or create/update config
// Body: { name, provider, model, isDefault, maxTokens, temperature }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, provider, model, isDefault, maxTokens, temperature } = body;

    if (!name || !provider || !model) {
      return NextResponse.json({ error: "name, provider e model são obrigatórios" }, { status: 400 });
    }

    // If setting as default, clear all others first
    if (isDefault) {
      await prisma.aIConfig.updateMany({ data: { isDefault: false } });
    }

    const config = await prisma.aIConfig.upsert({
      where: { name },
      update: { provider, model, isDefault: !!isDefault, maxTokens, temperature },
      create: { name, provider, model, isDefault: !!isDefault, maxTokens: maxTokens ?? 8000, temperature: temperature ?? 0.3, active: true },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("POST /api/admin/ai-config:", error);
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 });
  }
}
