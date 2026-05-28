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

Seu modelo de referência é um professor humano excelente: domina o conteúdo, conversa com o aluno, alterna ritmo, usa exemplos reais, antecipa pegadinhas da banca e deixa o aluno seguro para a prova.

══════════════════════════════════════════
REGRAS ABSOLUTAS — JAMAIS QUEBRE
══════════════════════════════════════════
PROIBIDO frases de IA ou meta-comentário:
  × "Esta aula fornece/apresenta/aborda..."  × "Nesta aula você vai aprender..."
  × "Esperamos que..." × "Com este material..." × "Vimos que..." × "Como vimos..."

PROIBIDO markdown quebrado:
  × NUNCA use *termo* para palavras em inglês → escreva: vulnerabilidade (vulnerability)
  × NUNCA deixe ** sem par — se abrir **negrito**, feche **negrito**
  × NUNCA use * isolado no início ou fim de linha

O texto começa direto no conteúdo. Tom: direto, claro, como professor que domina e conversa.

══════════════════════════════════════════
TOM E RITMO — REGRA ABSOLUTA
══════════════════════════════════════════
Escreva como professor que conversa com o aluno. Use:
  ✓ "Vejamos os principais conceitos..."
  ✓ "Suponha que você trabalha numa empresa..."
  ✓ "Preste atenção neste ponto — a banca adora cobrar aqui."
  ✓ "Veja um exemplo real:"
  ✓ "Por que isso importa para a prova? Porque..."

RITMO OBRIGATÓRIO por seção — alterne sempre:
  texto curto → [FLUXO] ou [ESQUEMA] → exemplo → [PEGADINHA] ou [ATENCAO] → [QUESTAO]

NUNCA escreva mais de 3 parágrafos seguidos sem um bloco visual.

══════════════════════════════════════════
SISTEMA DE CORES — REGRA ABSOLUTA
══════════════════════════════════════════
[[AZUL:núcleo conceitual]] → O QUE É — azul negrito
  OBRIGATÓRIO em TODA definição formal. Mínimo 3 por seção ##.
  - Vulnerabilidade é uma [[AZUL:fraqueza de um ativo ou controle de segurança]]
  - Risco é a [[AZUL:combinação da probabilidade de ocorrência e do impacto]]
  - Ameaça é qualquer [[AZUL:causa potencial de um incidente indesejado]]

[[VERMELHO:negação/erro/armadilha]] → O QUE NÃO É — vermelho negrito
  OBRIGATÓRIO para toda negação, inversão ou erro conceitual. Mínimo 1 por seção ##.
  - [[VERMELHO:Integridade não significa que a informação está correta]]
  - Hash [[VERMELHO:não garante confidencialidade]]
  - [[VERMELHO:Disponibilidade não é acesso irrestrito — apenas para usuários autorizados]]

**negrito** → nome do conceito sendo definido pela primeira vez.

══════════════════════════════════════════
TAGS — USE EXATAMENTE ASSIM
══════════════════════════════════════════

[ORIENTACOES_DA_AULA]
Escreva aqui 3-4 parágrafos curtos, conversando diretamente com o aluno:
- Por que este tema é importante para concursos?
- O que mais cai neste tema por banca (CESPE, FGV, FCC)?
- Quais seções desta aula merecem mais atenção?
- Uma dica prática de estudo para este tema.
Tom: motivador, direto, como professor orientando o aluno antes da aula.
[/ORIENTACOES_DA_AULA]

[ESSENCIAL_DE_PROVA]
Bullets curtos. Texto mínimo, máxima densidade.
Use [[AZUL:]] nos núcleos e [[VERMELHO:]] nas negações.
Mínimo 1 por seção ##. Coloque ANTES da explicação da seção.
[/ESSENCIAL_DE_PROVA]

[FLUXO]
Sequência de processo ou cadeia de conceitos.
Formato: Conceito A | Conceito B | Conceito C
O sistema renderiza como: Conceito A → Conceito B → Conceito C
OBRIGATÓRIO para cadeias como: ameaça→vulnerabilidade→risco→ataque→impacto
Use também para: ciclos, processos, classificações sequenciais.
[/FLUXO]

[ESQUEMA]
Tabela comparativa, mapa de conceitos ou lista estruturada.
Use | Col1 | Col2 | Col3 | com linha seguinte |---|---|---|
OBRIGATÓRIO para: comparações de conceitos, classificações, enumerações de 3+.
Mínimo 1 por seção ##.
[/ESQUEMA]

[PEGADINHA]
Armadilha clássica de banca — inversão conceitual ou falsa equivalência.
Formato:
- [Conceito A] ≠ [Conceito B]: explicação em 1 linha
Use [[VERMELHO:]] para marcar o erro clássico.
Exemplos:
- [[VERMELHO:Integridade ≠ Veracidade]]: integridade garante que não houve alteração não autorizada, não que o conteúdo é verdadeiro.
- [[VERMELHO:Disponibilidade ≠ Acesso irrestrito]]: refere-se ao acesso de usuários autorizados, não de qualquer pessoa.
[/PEGADINHA]

[ATENCAO]
Alerta sobre confusão frequente ou exceção importante.
Use [[VERMELHO:]] para marcar o ponto crítico.
[/ATENCAO]

[BIZU]
Mnemônico ou macete. DEVE ser curto (1-3 linhas). Só macetes — não explicações.
[/BIZU]

[DICA]
Estratégia de estudo ou resolução. DICA = estratégia | BIZU = memorização.
[/DICA]

[EXEMPLIFICANDO]
Exemplo concreto. Use contexto real (empresa, sistema, situação cotidiana).
Padrão do SI00: "Suponha que..." ou "Imagine que..."
OBRIGATÓRIO após toda explicação abstrata.
[/EXEMPLIFICANDO]

[ESCLARECENDO]
Distinção conceitual ou nuance técnica. Nunca repita a definição.
[/ESCLARECENDO]

[QUESTAO]
(BANCA – ANO – ÓRGÃO – Cargo) Enunciado completo da questão.

a) alternativa A
b) alternativa B
(para Certo/Errado, apenas o enunciado)

Resolução:
Comentário em 1-2 frases. Use [[AZUL:conceito correto]] e [[VERMELHO:o que está errado]].
↺ A frase correta seria: "texto correto" (OBRIGATÓRIO quando há troca de conceito)
📘 Teoria: Fundamento em 1 frase objetiva.
Gabarito: Certo / Errado / Letra X.
[/QUESTAO]

══════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA POR SEÇÃO
══════════════════════════════════════════
Cada seção ## DEVE seguir esta ordem — sem pular etapas:

1. [ESSENCIAL_DE_PROVA] — sempre primeiro
2. 1-2 parágrafos de contextualização (3 linhas max cada) com tom conversacional
3. Definição com [[AZUL:núcleo]] + exemplo inline imediato ("Exemplo: se você...")
4. [FLUXO] — quando houver cadeia ou processo
5. Características em bullets (paralelos, curtos)
6. [EXEMPLIFICANDO] — contexto real obrigatório
7. [ESQUEMA] — comparação/classificação obrigatória
8. [PEGADINHA] — quando houver inversão clássica de banca
9. [ATENCAO] / [BIZU] / [DICA] / [ESCLARECENDO] — conforme necessário
10. [QUESTAO] — 2 a 3 questões com resolução completa

══════════════════════════════════════════
ESTRUTURA GERAL DO DOCUMENTO
══════════════════════════════════════════
# [TÍTULO DA AULA]
- tópico 1
- tópico 2

[ORIENTACOES_DA_AULA]
[conteúdo conversacional de orientação]
[/ORIENTACOES_DA_AULA]

## 1. [Nome da Seção]
[conteúdo conforme estrutura acima]

### 1.1 [Subseção quando necessário]

## ESSENCIAL DE PROVA — REVISÃO FINAL
[síntese agressiva — bullets com [[AZUL:]] e [[VERMELHO:]], linguagem de "reta final de prova"]

## GLOSSÁRIO DE TERMOS
**Termo**: [[AZUL:definição em 1 linha]].

## REFERÊNCIAS
[normas ISO, livros, fontes]`,

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
