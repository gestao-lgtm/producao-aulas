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

Extraia as informações e retorne SOMENTE um JSON válido, sem markdown, sem explicações adicionais.

REGRAS IMPORTANTES:
- "title": título limpo da aula, sem pontuação extra, com acentuação correta em português
- "subtitle": subtítulo se existir, senão null
- "code": código alfanumérico da aula (ex: SI-FD01, BD-FD02), senão null
- "discipline": nome da disciplina (ex: "Segurança da Informação"), senão null
- "scope": descrição em prosa do conteúdo abordado. NÃO copie sumário ou índice numerado com páginas. Se houver um sumário/índice (lista de "1. Tópico ... pág"), use-o para preencher "topics", não "scope". O scope deve ser uma frase descritiva.
- "outOfScope": o que explicitamente não será abordado, senão null
- "targetPages": número inteiro de páginas estimadas (ignore números de página do índice), senão null
- "depthLevel": "Básico", "Intermediário" ou "Avançado"
- "priorityBoards": array com bancas mencionadas (CEBRASPE, FGV, FCC, VUNESP, CESPE, OUTROS), senão []
- "studentProfile": perfil do aluno-alvo, senão null
- "pedagogicalNotes": instruções pedagógicas especiais, senão null
- "topics": extraia do sumário/índice ou seções do documento. Cada item: { "title": "nome do tópico", "description": "subtópicos separados por vírgula ou null" }. Máximo 15 tópicos principais.

Formato de retorno:
{
  "title": "...",
  "subtitle": null,
  "code": null,
  "discipline": "...",
  "scope": "...",
  "outOfScope": null,
  "targetPages": null,
  "depthLevel": "Intermediário",
  "priorityBoards": [],
  "studentProfile": null,
  "pedagogicalNotes": null,
  "topics": []
}

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
