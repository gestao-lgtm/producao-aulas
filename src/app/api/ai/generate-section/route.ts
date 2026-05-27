import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

async function* streamAnthropic(prompt: string, systemPrompt: string, config: any) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY });
  const stream = client.messages.stream({
    model: config.model || "claude-sonnet-4-6",
    max_tokens: config.maxTokens || 6000,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
    temperature: config.temperature || 0.3,
  });
  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      yield chunk.delta.text;
    }
  }
}

async function* streamOpenAI(prompt: string, systemPrompt: string, config: any) {
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.apiKey || process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model: config.model || "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    temperature: config.temperature || 0.3,
    max_tokens: config.maxTokens || 6000,
    stream: true,
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { stepId, lessonId, topicIndex, topicTitle, totalTopics, isFirst, isLast } = await req.json();

    const [lesson, aiConfig] = await Promise.all([
      prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          discipline: true,
          topics: { orderBy: { order: "asc" } },
          memory: true,
        },
      }),
      prisma.aIConfig.findFirst({ where: { isDefault: true, active: true } }),
    ]);

    if (!lesson) return new Response("Aula não encontrada", { status: 404 });

    const config = aiConfig ?? { provider: "openai", model: "gpt-4o", temperature: 0.3, maxTokens: 6000 };
    const allTopics = lesson.topics.map((t: any) => t.title);
    const sectionNum = topicIndex + 1;

    let sectionPrompt = `AULA: ${lesson.code} — ${lesson.title}
DISCIPLINA: ${lesson.discipline?.name || "—"}
BANCAS: ${(lesson as any).priorityBoards?.join(", ") || "—"}
PERFIL: ${(lesson as any).studentProfile || "—"}
TODOS OS TÓPICOS DA AULA: ${allTopics.join(" | ")}

${(lesson.memory as any)?.centralConcepts?.length > 0 ? `CONCEITOS CENTRAIS: ${JSON.stringify((lesson.memory as any).centralConcepts)}` : ""}
${(lesson.memory as any)?.tricks?.length > 0 ? `PEGADINHAS: ${JSON.stringify((lesson.memory as any).tricks)}` : ""}

TAREFA: Gere APENAS o conteúdo da seção ${sectionNum} desta aula.`;

    if (isFirst) {
      sectionPrompt += `

Comece o documento com:
# ${lesson.title}

${allTopics.map((t: string, i: number) => `- ${t}`).join("\n")}

---

## ${sectionNum}. ${topicTitle}

[conteúdo completo da seção seguindo o padrão TI TOTAL]`;
    } else if (isLast) {
      sectionPrompt += `

Gere:
## ${sectionNum}. ${topicTitle}

[conteúdo completo da seção]

---

## ESSENCIAL DE PROVA — REVISÃO FINAL
[síntese dos pontos mais cobrados em provas de toda a aula]

## GLOSSÁRIO DE TERMOS
[termos principais com definições resumidas, um por linha]

## REFERÊNCIAS
[fontes bibliográficas]`;
    } else {
      sectionPrompt += `

Gere apenas:
## ${sectionNum}. ${topicTitle}

[conteúdo completo da seção seguindo o padrão TI TOTAL]

Termine sua resposta imediatamente após o conteúdo desta seção.`;
    }

    const systemPrompt = getSectionSystemPrompt();
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const generator =
            config.provider === "anthropic"
              ? streamAnthropic(sectionPrompt, systemPrompt, config)
              : streamOpenAI(sectionPrompt, systemPrompt, config);

          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.enqueue(encoder.encode("\n\n__SECTION_DONE__"));
        } catch (err) {
          console.error("Section stream error:", err);
          controller.enqueue(encoder.encode("\n\n__SECTION_ERROR__"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    console.error("POST /api/ai/generate-section:", err);
    return new Response("Erro interno", { status: 500 });
  }
}

function getSectionSystemPrompt(): string {
  return `Você é professor do curso TI TOTAL, especialista em material didático para concursos públicos de TI.

REGRAS ABSOLUTAS:
- PROIBIDO meta-comentários: "Esta seção aborda...", "Vimos que...", "Nesta parte..."
- Comece direto no conteúdo
- NÃO repita tópicos de outras seções

DESTAQUES COGNITIVOS:
[[AZUL:termo]] → núcleo conceitual (o que É)
[[VERMELHO:termo]] → negação conceitual (o que NÃO É)
**termo** → palavra sendo definida

TAGS OBRIGATÓRIAS (use exatamente assim):
[ESSENCIAL_DE_PROVA]texto[/ESSENCIAL_DE_PROVA]
[ATENCAO]texto[/ATENCAO]
[BIZU]texto[/BIZU]
[DICA]texto[/DICA]
[EXEMPLIFICANDO]texto[/EXEMPLIFICANDO]
[ESCLARECENDO]texto[/ESCLARECENDO]
[ESQUEMA]tabela ou diagrama comparativo[/ESQUEMA]
[QUESTAO](BANCA – ANO – ÓRGÃO) Enunciado.\nResolução:\nComentário.\nGabarito: X.[/QUESTAO]

ESTRUTURA DE CADA SEÇÃO:
1. [ESSENCIAL_DE_PROVA] — obrigatório
2. Conceito com [[AZUL:]] no núcleo
3. Explicação com propriedades e características
4. [EXEMPLIFICANDO] após explicação abstrata
5. [ESQUEMA] quando houver comparação ou classificação
6. [ATENCAO], [BIZU], [DICA] conforme necessário
7. 2-3 [QUESTAO] com questões reais de concurso`;
}
