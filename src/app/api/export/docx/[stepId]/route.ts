import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, TableLayoutType,
  convertMillimetersToTwip,
  PageNumber, Footer,
} from "docx";

// ─── TI TOTAL Brand Colors ──────────────────────────────────────────────────
const C = {
  azul:         "1A4F8A", // núcleo conceitual (azul)
  vermelho:     "C0392B", // negação conceitual (vermelho)
  heading1:     "1A3A5C",
  heading2:     "1A4F8A",
  heading3:     "2C6FAC",
  body:         "1A202C",
  // Box backgrounds & borders
  essencialBg:  "E8F0FB",
  essencialBrd: "1A4F8A",
  atencaoBg:    "FFF8E6",
  atencaoBrd:   "D4860A",
  bizuBg:       "EAF5EA",
  bizuBrd:      "27AE60",
  dicaBg:       "EAF4FB",
  dicaBrd:      "2980B9",
  exemploBg:    "F0FAF4",
  exemploBrd:   "1E8449",
  esclareceBg:  "F5F5F5",
  esclareceBrd: "7F8C8D",
  questaoBg:    "FAFAFA",
  questaoBrd:   "566573",
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: "FFFFFF" });

function cellBorder(color: string) {
  return {
    top:    { style: BorderStyle.SINGLE, size: 12, color },
    bottom: { style: BorderStyle.SINGLE, size: 4,  color },
    left:   { style: BorderStyle.SINGLE, size: 20, color },
    right:  noBorder(),
  };
}

// Parse inline markers: [[AZUL:text]], [[VERMELHO:text]], **text**
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Combined regex for all inline markers
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), size: 22, color: C.body, font: "Segoe UI" }));
    }
    if (m[1] !== undefined) {
      runs.push(new TextRun({ text: m[1], bold: true, color: C.azul, size: 22, font: "Segoe UI" }));
    } else if (m[2] !== undefined) {
      runs.push(new TextRun({ text: m[2], bold: true, color: C.vermelho, size: 22, font: "Segoe UI" }));
    } else if (m[3] !== undefined) {
      runs.push(new TextRun({ text: m[3], bold: true, size: 22, font: "Segoe UI" }));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), size: 22, color: C.body, font: "Segoe UI" }));
  }
  return runs.length ? runs : [new TextRun({ text, size: 22, color: C.body, font: "Segoe UI" })];
}

function spacer(pts = 100): Paragraph {
  return new Paragraph({ text: "", spacing: { after: pts } });
}

function makeBox(
  label: string,
  content: string,
  bg: string,
  border: string,
): Table {
  const lines = content.trim().split("\n");
  const children: Paragraph[] = [];

  // Label row
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: label, bold: true, color: border, size: 20, font: "Montserrat" })],
    })
  );

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;
    const isBullet = /^[-•*]\s/.test(trimmed);
    const text = trimmed.replace(/^[-•*]\s*/, "");
    const runs = parseInline(text);
    children.push(
      new Paragraph({
        children: runs,
        bullet: isBullet ? { level: 0 } : undefined,
        spacing: { after: 60 },
      })
    );
  }

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: bg },
            borders: cellBorder(border),
            margins: {
              top:    convertMillimetersToTwip(3),
              bottom: convertMillimetersToTwip(3),
              left:   convertMillimetersToTwip(5),
              right:  convertMillimetersToTwip(3),
            },
            children,
          }),
        ],
      }),
    ],
  });
}

// ─── Parser ─────────────────────────────────────────────────────────────────
type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "bullet"; text: string; level: number }
  | { type: "para"; text: string }
  | { type: "essencial" | "atencao" | "bizu" | "dica" | "exemplificando" | "esclarecendo" | "questao"; content: string };

const TAG_RE = /\[(ESSENCIAL_DE_PROVA|ATENCAO|BIZU|DICA|EXEMPLIFICANDO|ESCLARECENDO|QUESTAO)\]([\s\S]*?)\[\/\1\]/gi;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  const pushText = (chunk: string) => {
    for (const line of chunk.split("\n")) {
      const l = line.trimEnd();
      if (!l) continue;
      if (l.startsWith("#### ")) blocks.push({ type: "h3", text: l.slice(5).trim() });
      else if (l.startsWith("### "))  blocks.push({ type: "h3", text: l.slice(4).trim() });
      else if (l.startsWith("## "))   blocks.push({ type: "h2", text: l.slice(3).trim() });
      else if (l.startsWith("# "))    blocks.push({ type: "h1", text: l.slice(2).trim() });
      else if (/^[-•*]\s/.test(l))    blocks.push({ type: "bullet", text: l.replace(/^[-•*]\s*/, "").trim(), level: 0 });
      else                            blocks.push({ type: "para", text: l.trim() });
    }
  };

  const tagMap: Record<string, Block["type"]> = {
    ESSENCIAL_DE_PROVA: "essencial",
    ATENCAO:            "atencao",
    BIZU:               "bizu",
    DICA:               "dica",
    EXEMPLIFICANDO:     "exemplificando",
    ESCLARECENDO:       "esclarecendo",
    QUESTAO:            "questao",
  };

  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    blocks.push({ type: tagMap[m[1].toUpperCase()] as any, content: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return blocks;
}

// ─── Render blocks to DOCX elements ─────────────────────────────────────────
function renderBlocks(blocks: Block[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        out.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 480, after: 160 },
          children: [new TextRun({ text: b.text, bold: true, color: C.heading1, size: 40, font: "Montserrat" })],
        }));
        break;
      case "h2":
        out.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 120 },
          children: [new TextRun({ text: b.text, bold: true, color: C.heading2, size: 30, font: "Montserrat" })],
        }));
        break;
      case "h3":
        out.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: b.text, bold: true, color: C.heading3, size: 24, font: "Montserrat" })],
        }));
        break;
      case "bullet":
        out.push(new Paragraph({
          children: parseInline(b.text),
          bullet: { level: b.level },
          spacing: { after: 60 },
        }));
        break;
      case "para":
        if (b.text) {
          out.push(new Paragraph({
            children: parseInline(b.text),
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED,
          }));
        }
        break;
      case "essencial":
        out.push(makeBox("★ ESSENCIAL DE PROVA", b.content, C.essencialBg, C.essencialBrd));
        out.push(spacer());
        break;
      case "atencao":
        out.push(makeBox("⚠ ATENÇÃO", b.content, C.atencaoBg, C.atencaoBrd));
        out.push(spacer());
        break;
      case "bizu":
        out.push(makeBox("👉 BIZU", b.content, C.bizuBg, C.bizuBrd));
        out.push(spacer());
        break;
      case "dica":
        out.push(makeBox("💡 DICA", b.content, C.dicaBg, C.dicaBrd));
        out.push(spacer());
        break;
      case "exemplificando":
        out.push(makeBox("EXEMPLIFICANDO", b.content, C.exemploBg, C.exemploBrd));
        out.push(spacer());
        break;
      case "esclarecendo":
        out.push(makeBox("ESCLARECENDO", b.content, C.esclareceBg, C.esclareceBrd));
        out.push(spacer());
        break;
      case "questao":
        out.push(makeBox("📝 QUESTÃO DE PROVA", b.content, C.questaoBg, C.questaoBrd));
        out.push(spacer());
        break;
    }
  }

  return out;
}

// ─── Route ──────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params;

    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        stepRuns: { orderBy: { version: "desc" }, take: 1 },
        lesson: { include: { discipline: true } },
      },
    });

    let outputText = "";

    // For PADRONIZACAO_EDITORIAL, ALWAYS use PRODUCAO_TEORIA output
    if (step?.stepKey === "PADRONIZACAO_EDITORIAL") {
      const teoriaStep = await prisma.workflowStep.findFirst({
        where: { lessonId: step.lessonId, stepKey: "PRODUCAO_TEORIA" },
        include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
      });
      outputText = teoriaStep?.stepRuns[0]?.outputText ?? "";
    } else {
      outputText = step?.stepRuns[0]?.outputText ?? "";
    }

    if (!outputText) {
      return NextResponse.json({ error: "Nenhum conteúdo para exportar" }, { status: 404 });
    }

    const lesson = step?.lesson;
    const blocks = parseBlocks(outputText);
    const content = renderBlocks(blocks);

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Segoe UI", size: 22, color: C.body },
            paragraph: { spacing: { line: 276, after: 120 } }, // 1.15 line spacing, 6pt after
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) }, // A4
              margin: {
                top:    convertMillimetersToTwip(25),
                bottom: convertMillimetersToTwip(25),
                left:   convertMillimetersToTwip(25),
                right:  convertMillimetersToTwip(25),
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: "TI TOTAL — Tecnologia da Informação para Concursos", size: 16, color: "718096", font: "Segoe UI" }),
                    new TextRun({ text: "    Página ", size: 16, color: "718096" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "718096" }),
                  ],
                }),
              ],
            }),
          },
          children: [
            // Apresentação header (page 2 style)
            new Paragraph({
              spacing: { after: 40 },
              children: [new TextRun({ text: "TI TOTAL", bold: true, size: 28, color: C.heading1, font: "Montserrat" })],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({ text: `${lesson?.code ?? ""}  |  `, size: 22, color: "718096", font: "Segoe UI" }),
                new TextRun({ text: lesson?.discipline?.name ?? "", size: 22, color: "718096", font: "Segoe UI" }),
                new TextRun({ text: "  |  TEORIA", bold: true, size: 22, color: C.heading2, font: "Segoe UI" }),
              ],
            }),
            new Paragraph({
              spacing: { after: 400 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.essencialBrd } },
              children: [new TextRun({ text: "" })],
            }),
            ...content,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${lesson?.code ?? "teoria"}-teoria.docx`;
    // Slice to a plain ArrayBuffer so TypeScript's BodyInit types are satisfied
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    return new NextResponse(arrayBuffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/export/docx/[stepId]:", error);
    return NextResponse.json({ error: "Erro ao gerar DOCX" }, { status: 500 });
  }
}
