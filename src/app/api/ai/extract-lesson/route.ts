import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // txt or any other text file
  return buffer.toString("utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".docx") && !file.name.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Formato não suportado. Use .docx ou .txt" },
        { status: 400 }
      );
    }

    const text = await extractTextFromFile(file);
    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Não foi possível extrair texto do arquivo." },
        { status: 422 }
      );
    }

    // Try to get AI config from DB, fall back to env vars
    let provider = "openai";
    let model = "gpt-4o";
    let apiKey = process.env.OPENAI_API_KEY;

    try {
      const aiConfig = await prisma.aIConfig.findFirst({
        where: { isDefault: true, active: true },
      });
      if (aiConfig) {
        provider = aiConfig.provider;
        model = aiConfig.model;
        apiKey = aiConfig.apiKey ?? (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ?? undefined;
      }
    } catch {
      // DB not configured, use env
    }

    const prompt = `Você receberá o texto de um documento de arquitetura pedagógica de uma aula para concursos públicos de TI.

Extraia as seguintes informações e retorne SOMENTE um JSON válido, sem markdown, sem explicações adicionais:

{
  "title": "Título da aula",
  "subtitle": "Subtítulo (se houver)",
  "code": "Código da aula (ex: BD-FD01)",
  "discipline": "Nome da disciplina",
  "scope": "Escopo — o que a aula abrange",
  "outOfScope": "O que NÃO está no escopo (se informado)",
  "targetPages": número_de_páginas_ou_null,
  "depthLevel": "Básico|Intermediário|Avançado",
  "priorityBoards": ["CEBRASPE","FGV","FCC","VUNESP","CESPE","OUTROS"],
  "studentProfile": "Perfil do aluno-alvo",
  "pedagogicalNotes": "Observações pedagógicas ou instruções especiais",
  "topics": [
    { "title": "Nome do tópico", "description": "Descrição ou subtópicos" }
  ]
}

Se um campo não estiver presente no documento, use null para strings e [] para arrays.
Para priorityBoards, inclua apenas bancas explicitamente mencionadas.
Para topics, liste apenas os tópicos/capítulos principais encontrados (máx 15).

DOCUMENTO:
${text.slice(0, 8000)}`;

    let extracted: Record<string, unknown> = {};

    if (provider === "anthropic") {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: model || "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      const content = response.content[0];
      if (content.type === "text") {
        extracted = JSON.parse(content.text.trim());
      }
    } else {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: model || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      const raw = response.choices[0].message.content ?? "{}";
      extracted = JSON.parse(raw);
    }

    return NextResponse.json({ success: true, data: extracted });
  } catch (error) {
    console.error("extract-lesson error:", error);
    const message = error instanceof Error ? error.message : "Erro ao processar arquivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
