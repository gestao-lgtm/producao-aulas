import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

// ─── Streaming helpers ───────────────────────────────────────────────────────

async function* streamAnthropic(prompt: string, systemPrompt: string, config: any) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: config.model || "claude-sonnet-4-6",
    max_tokens: config.maxTokens || 8000,
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
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: config.temperature || 0.3,
    max_tokens: config.maxTokens || 8000,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) yield text;
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stepId, lessonId } = body;

    const [step, lessonRaw] = await Promise.all([
      prisma.workflowStep.findUnique({
        where: { id: stepId },
        include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
      }),
      prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          discipline: true,
          topics: { orderBy: { order: "asc" } },
          memory: true,
          questions: { where: { status: "APROVADA" }, take: 50 },
          files: { where: { isActive: true } },
        },
      }),
    ]);

    const latestFeedback = step?.stepRuns[0]?.id
      ? await prisma.feedback.findFirst({
          where: { stepRunId: step.stepRuns[0].id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const lesson = lessonRaw
      ? {
          ...lessonRaw,
          _latestFeedback: latestFeedback
            ? `${latestFeedback.whatIsWrong || ""}${latestFeedback.whatToChange ? `\nO que mudar: ${latestFeedback.whatToChange}` : ""}${latestFeedback.examples ? `\nExemplos: ${latestFeedback.examples}` : ""}`
            : null,
        }
      : null;

    if (!step || !lesson) {
      return NextResponse.json({ error: "Etapa ou aula não encontrada" }, { status: 404 });
    }

    const promptTemplate = await prisma.promptTemplate.findFirst({
      where: { stepKey: step.stepKey, active: true },
      orderBy: { version: "desc" },
    });

    const aiConfigRaw = (await prisma.aIConfig.findFirst({
      where: { isDefault: true, active: true },
    })) ?? { provider: "openai", model: "gpt-4o", temperature: 0.3, maxTokens: 8000 };

    // Theory generation needs more tokens than the DB default; other steps keep their limit
    const maxTokens = step.stepKey === "PRODUCAO_TEORIA"
      ? Math.max((aiConfigRaw as any).maxTokens || 0, 16000)
      : (aiConfigRaw as any).maxTokens || 8000;
    const aiConfig = { ...aiConfigRaw, maxTokens };

    const contextPrompt = buildContextPrompt(lesson, step, promptTemplate?.prompt);
    const systemPrompt = promptTemplate?.prompt || getDefaultSystemPrompt(step.stepKey);

    await prisma.workflowStep.update({ where: { id: stepId }, data: { status: "EM_ANDAMENTO" } });

    const previousVersion = step.stepRuns[0]?.version || 0;
    const newRun = await prisma.stepRun.create({
      data: {
        workflowStepId: stepId,
        version: previousVersion + 1,
        status: "EM_ANDAMENTO",
        aiProvider: aiConfig.provider,
        aiModel: aiConfig.model,
        promptUsed: contextPrompt,
        input: {
          lessonCode: lesson.code,
          topics: lesson.topics.map((t: any) => t.title),
          scope: lesson.scope,
        },
      },
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let outputText = "";
        try {
          const generator =
            aiConfig.provider === "anthropic"
              ? streamAnthropic(contextPrompt, systemPrompt, aiConfig)
              : streamOpenAI(contextPrompt, systemPrompt, aiConfig);

          for await (const chunk of generator) {
            outputText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          await prisma.stepRun.update({
            where: { id: newRun.id },
            data: { outputText, status: "AGUARDANDO_APROVACAO" },
          });
          await prisma.workflowStep.update({
            where: { id: stepId },
            data: { status: "AGUARDANDO_APROVACAO" },
          });

          // Signal completion with metadata
          controller.enqueue(
            encoder.encode(`\n\n__STREAM_END__${JSON.stringify({ version: newRun.version, runId: newRun.id })}`)
          );
        } catch (err) {
          console.error("Streaming AI error:", err);
          if (outputText.length > 200) {
            // Save whatever was generated so the user sees it
            await prisma.stepRun.update({
              where: { id: newRun.id },
              data: { outputText, status: "AGUARDANDO_APROVACAO" },
            });
            await prisma.workflowStep.update({ where: { id: stepId }, data: { status: "AGUARDANDO_APROVACAO" } });
            controller.enqueue(
              encoder.encode(`\n\n__STREAM_END__${JSON.stringify({ version: newRun.version, runId: newRun.id, partial: true })}`)
            );
          } else {
            await prisma.stepRun.update({ where: { id: newRun.id }, data: { status: "REPROVADA" } });
            await prisma.workflowStep.update({ where: { id: stepId }, data: { status: "EM_ANDAMENTO" } });
            controller.enqueue(encoder.encode("\n\n__STREAM_ERROR__"));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("POST /api/ai/generate:", error);
    return NextResponse.json({ error: "Falha na geração com IA" }, { status: 500 });
  }
}

// ─── Context & Prompts ───────────────────────────────────────────────────────

function buildContextPrompt(lesson: any, step: any, templatePrompt?: string): string {
  const topicsStr = lesson.topics
    .map((t: any, i: number) => `${i + 1}. ${t.title}${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");
  const disciplineName = lesson.discipline?.name || "—";

  const feedbackBlock = lesson._latestFeedback
    ? `\nFEEDBACK DA VERSÃO ANTERIOR (CORRIJA ESTES PONTOS):\n${lesson._latestFeedback}\n`
    : "";

  return `ARQUITETURA DA AULA:
Código: ${lesson.code}
Título: ${lesson.title}
Disciplina: ${disciplineName}
Posição: Aula ${lesson.position}
Páginas estimadas: ${lesson.targetPages || "—"}
Bancas prioritárias: ${lesson.priorityBoards?.join(", ") || "—"}
Perfil do aluno: ${lesson.studentProfile || "—"}
Nível de profundidade: ${lesson.depthLevel || "—"}

ESCOPO:
${lesson.scope || "—"}

TÓPICOS:
${topicsStr}

EXCLUÍDO DO ESCOPO:
${lesson.outOfScope || "—"}

OBSERVAÇÕES PEDAGÓGICAS:
${lesson.pedagogicalNotes || "—"}

${lesson.memory?.centralConcepts?.length > 0 ? `CONCEITOS CENTRAIS JÁ DEFINIDOS:\n${JSON.stringify(lesson.memory.centralConcepts)}` : ""}

${lesson.memory?.tricks?.length > 0 ? `PEGADINHAS IDENTIFICADAS:\n${JSON.stringify(lesson.memory.tricks)}` : ""}
${feedbackBlock}
TAREFA: Execute a etapa "${step.title}" conforme as instruções do sistema.`;
}

function getDefaultSystemPrompt(stepKey: string): string {
  const prompts: Record<string, string> = {
    PRODUCAO_TEORIA: `Você é professor do curso TI TOTAL, especialista em material didático para concursos públicos de TI. Produza a teoria completa da aula seguindo EXATAMENTE o padrão TI TOTAL abaixo.

══════════════════════════════════════════
REGRAS ABSOLUTAS — JAMAIS QUEBRE
══════════════════════════════════════════
PROIBIDO qualquer frase que soe como IA ou meta-comentário:
  × "Esta aula fornece/apresenta/aborda..."
  × "Nesta aula você vai aprender..."
  × "Esperamos que você tenha aprendido..."
  × "Com este material você estará preparado..."
  × "Vimos que..." / "Como vimos..."
  × Parágrafos de abertura ou encerramento sobre "a aula"
O texto começa direto no conteúdo. Escreva como professor que domina o assunto.

PROIBIDO markdown quebrado:
  × NUNCA use *termo* para termos técnicos em inglês
  × Para termo em inglês: escreva assim → vulnerabilidade (vulnerability) — sem asteriscos
  × NUNCA deixe ** sem par: se abrir **negrito**, feche **negrito**
  × NUNCA use * isolado no início ou fim de linha

══════════════════════════════════════════
SISTEMA DE CORES — REGRA ABSOLUTA
══════════════════════════════════════════
[[AZUL:núcleo conceitual]] → O QUE É — cor azul negrito
  OBRIGATÓRIO em TODA definição formal. Mínimo 3 por seção ##.
  Exemplos:
  - Vulnerabilidade é uma [[AZUL:fraqueza de um ativo ou controle de segurança]]
  - Risco é a [[AZUL:combinação da probabilidade de ocorrência e do impacto de um incidente]]
  - Ameaça é qualquer [[AZUL:causa potencial de um incidente indesejado]]

[[VERMELHO:negação conceitual]] → O QUE NÃO É — cor vermelha negrito
  OBRIGATÓRIO sempre que o texto negar, contradizer ou alertar para erro conceitual.
  Exemplos:
  - [[VERMELHO:Integridade não significa que a informação está correta]]
  - Hash [[VERMELHO:não garante confidencialidade]]
  - [[VERMELHO:Confidencialidade não implica segredo absoluto]]
  Mínimo 1 [[VERMELHO:]] por seção ## (onde houver qualquer negação ou armadilha).

**negrito** → propriedade, atributo ou termo sendo definido pela primeira vez.
  Use apenas para o NOME do conceito, nunca para conteúdo semântico.

NUNCA use cor apenas para "destacar" — cada cor tem função semântica rígida.

══════════════════════════════════════════
TAGS OBRIGATÓRIAS — USE EXATAMENTE ASSIM
══════════════════════════════════════════
[ESSENCIAL_DE_PROVA]
Definições-chave em bullets curtos. Texto mínimo, máxima densidade.
Use [[AZUL:]] nos núcleos e [[VERMELHO:]] nas negações dentro do bloco.
Mínimo 1 por seção ##. Obrigatório antes da teoria da seção.
[/ESSENCIAL_DE_PROVA]

[ATENCAO]
Alerta sobre confusão frequente, exceção ou pegadinha clássica de prova.
Use [[VERMELHO:]] para marcar a parte errada/confusa.
[/ATENCAO]

[BIZU]
Mnemônico ou macete para memorização rápida. DEVE ser curto (1-3 linhas).
Nunca use BIZU para explicação — apenas macetes e padrões de cobrança.
[/BIZU]

[DICA]
Estratégia de estudo ou abordagem de resolução de questão.
Diferente de BIZU: DICA = estratégia | BIZU = memorização.
[/DICA]

[EXEMPLIFICANDO]
Exemplo concreto e direto. OBRIGATÓRIO após toda explicação abstrata.
Use contexto real (empresa, sistema, situação cotidiana).
[/EXEMPLIFICANDO]

[ESCLARECENDO]
Distinção conceitual ou nuance técnica importante.
Nunca repita a definição — apenas aprofunde ou esclareça diferença.
[/ESCLARECENDO]

[ESQUEMA]
Tabela comparativa, mapa conceitual ou diagrama textual.
Use | Col1 | Col2 | Col3 | para tabelas (linha seguinte com |---|---|---|).
OBRIGATÓRIO para: comparações entre conceitos, classificações, enumerações de 3+.
Mínimo 1 [ESQUEMA] por seção ##.
[/ESQUEMA]

[QUESTAO]
(BANCA – ANO – ÓRGÃO – Cargo) Enunciado completo da questão.

a) alternativa A
b) alternativa B
(para questões Certo/Errado, apenas o enunciado)

Resolução:
Comentário direto em 1-2 frases. Use [[AZUL:]] para o conceito correto e [[VERMELHO:]] para o erro.
↺ A frase correta seria: "texto correto" (OBRIGATÓRIO quando há troca de conceito)
📘 Teoria: Fundamento teórico em 1 frase objetiva.
Gabarito: Certo / Errado / Letra X.
[/QUESTAO]

══════════════════════════════════════════
REGRAS DE FORMATAÇÃO DE TEXTO
══════════════════════════════════════════
- Nenhum parágrafo pode ter mais de 4 linhas — quebre em partes ou bullets
- Para listas de 3 ou mais itens: SEMPRE use bullet list com hífen (-)
- Bullets curtos e paralelos — máximo 2 linhas por bullet
- Separe conceito de explicação com quebra de parágrafo
- Use subseções (###) para organizar subconceitos dentro de ##
- Nunca inicie seção sem [ESSENCIAL_DE_PROVA]

══════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA POR SEÇÃO
══════════════════════════════════════════
Cada seção principal (##) DEVE seguir esta ordem:

1. [ESSENCIAL_DE_PROVA] — sempre primeiro, antes do texto
2. Definição direta com [[AZUL:núcleo da definição]] (1-2 parágrafos max)
3. Características/propriedades em bullets
4. [EXEMPLIFICANDO] — obrigatório após toda explicação abstrata
5. [ESQUEMA] — obrigatório para classificações e comparações
6. Quadros opcionais: [ATENCAO], [BIZU], [DICA], [ESCLARECENDO]
7. [QUESTAO] — 2 a 3 questões reais com resolução completa

══════════════════════════════════════════
ESTRUTURA GERAL DO DOCUMENTO
══════════════════════════════════════════
# [TÍTULO DA AULA]
- tópico 1
- tópico 2
(lista dos tópicos da aula)

## 1. [Nome da Seção]
[conteúdo da seção conforme estrutura acima]

### 1.1 [Subseção quando necessário]
[conteúdo]

## ESSENCIAL DE PROVA — REVISÃO FINAL
[síntese de todos os pontos mais cobrados — bullets com [[AZUL:]] e [[VERMELHO:]]]

## GLOSSÁRIO DE TERMOS
**Termo**: [[AZUL:definição resumida em 1 linha]].
(um por linha, use [[AZUL:]] no núcleo da definição)

## REFERÊNCIAS
[fontes bibliográficas — normas ABNT, ISO, livros]`,

    SELECAO_QUESTOES: `Você é especialista em seleção de questões para concursos de TI. Analise e classifique as questões mais representativas do tema.
Escreva de forma direta, sem introduções ou conclusões sobre o processo.`,

    COMENTARIOS_QUESTOES: `Você comenta questões de concursos de TI no padrão TI TOTAL. Use a teoria aprovada como base.

Para cada questão, siga EXATAMENTE esta estrutura:

Resolução:
Comentário em 1-2 frases. Use [[AZUL:conceito correto]] e [[VERMELHO:o que está errado/invertido]].
↺ A frase correta seria: "texto correto" (OBRIGATÓRIO quando há troca de conceito ou termo errado)
📘 Teoria: Fundamento teórico em 1 frase objetiva.
Gabarito: Certo / Errado / Letra X.

REGRAS:
- Use [[AZUL:]] para marcar o conceito correto no comentário
- Use [[VERMELHO:]] para marcar o erro conceitual ou a afirmação invertida
- A linha ↺ é obrigatória sempre que a questão tiver troca de conceito
- A linha 📘 Teoria é obrigatória em todas as questões
- Seja direto. Nunca escreva parágrafos longos.
- NUNCA use *asteriscos* para termos técnicos em inglês`,
  };
  return prompts[stepKey] || "Execute a tarefa conforme as instruções fornecidas.";
}
