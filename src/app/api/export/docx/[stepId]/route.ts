import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, TableLayoutType,
  convertMillimetersToTwip, PageNumber, Footer, Header,
  TabStopType, TabStopPosition,
} from "docx";

// ─── Brand palette ───────────────────────────────────────────────────────────
const C = {
  azul:         "1A4F8A",
  vermelho:     "C0392B",
  h1bg:         "1A3A5C",
  h2bg:         "1A4F8A",
  h3:           "2C6FAC",
  body:         "1A202C",
  muted:        "718096",
  // Box themes
  essencialBg:  "E8F0FB", essencialBrd: "1A3A5C",
  atencaoBg:    "FFF8E6", atencaoBrd:   "C47D0E",
  bizuBg:       "EAF5EA", bizuBrd:      "27AE60",
  dicaBg:       "EAF4FB", dicaBrd:      "2980B9",
  exemploBg:    "F0FAF4", exemploBrd:   "1E8449",
  esclareceBg:  "F5F0FB", esclareceBrd: "7D3C98",
  questaoBg:    "F8F9FA", questaoBrd:   "566573",
  esquemaBg:    "E8F0FB", esquemaBrd:   "1A4F8A",
};

const mm = convertMillimetersToTwip;
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: "FFFFFF" });
const allNoBorder = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });

// ─── Typography helpers ───────────────────────────────────────────────────────
function body(text: string, options?: { bold?: boolean; color?: string }): TextRun {
  return new TextRun({ text, font: "Segoe UI", size: 24, color: options?.color ?? C.body, bold: options?.bold });
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(body(text.slice(last, m.index)));
    if (m[1] !== undefined) runs.push(new TextRun({ text: m[1], bold: true, color: C.azul,    size: 24, font: "Segoe UI" }));
    else if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], bold: true, color: C.vermelho, size: 24, font: "Segoe UI" }));
    else if (m[3] !== undefined) runs.push(new TextRun({ text: m[3], bold: true, size: 24, font: "Segoe UI" }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(body(text.slice(last)));
  return runs.length ? runs : [body(text)];
}

function spacer(pts = 80): Paragraph {
  return new Paragraph({ text: "", spacing: { after: pts } });
}

// ─── Section banner (H1 / H2) ─────────────────────────────────────────────────
function makeBanner(text: string, bg: string, fontSize: number): Table {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: bg },
            borders: allNoBorder(),
            margins: { top: mm(3), bottom: mm(3), left: mm(5), right: mm(4) },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: text.toUpperCase(), bold: true, color: "FFFFFF", size: fontSize, font: "Montserrat" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── Content box ──────────────────────────────────────────────────────────────
function makeBox(label: string, content: string, bg: string, brd: string): Table {
  const lines = content.trim().split("\n");
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: label, bold: true, color: brd, size: 20, font: "Montserrat" })],
    }),
  ];
  for (const line of lines) {
    const t = line.trimEnd();
    if (!t) continue;
    const isBullet = /^[-•*]\s/.test(t);
    children.push(new Paragraph({
      children: parseInline(t.replace(/^[-•*]\s*/, "")),
      bullet: isBullet ? { level: 0 } : undefined,
      spacing: { after: 60 },
      alignment: AlignmentType.JUSTIFIED,
    }));
  }
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: bg },
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 8,  color: brd },
              bottom: { style: BorderStyle.SINGLE, size: 4,  color: brd },
              left:   { style: BorderStyle.SINGLE, size: 24, color: brd },
              right:  noBorder(),
            },
            margins: { top: mm(3), bottom: mm(3), left: mm(5), right: mm(3) },
            children,
          }),
        ],
      }),
    ],
  });
}

// ─── Markdown table ───────────────────────────────────────────────────────────
function makeMdTable(rows: string[][]): Table {
  const colCount = rows[0]?.length ?? 1;
  const colW = Math.floor(9000 / colCount);
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, ri) =>
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            width: { size: colW, type: WidthType.DXA },
            shading: {
              type: ShadingType.CLEAR,
              fill: ri === 0 ? C.h2bg : ri % 2 === 0 ? "F0F4FA" : "FFFFFF",
            },
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 4, color: "D0DCF0" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "D0DCF0" },
              left:   { style: BorderStyle.SINGLE, size: 4, color: "D0DCF0" },
              right:  { style: BorderStyle.SINGLE, size: 4, color: "D0DCF0" },
            },
            margins: { top: mm(1.5), bottom: mm(1.5), left: mm(2.5), right: mm(2.5) },
            children: [new Paragraph({
              spacing: { after: 0 },
              alignment: ri === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: ri === 0
                ? [new TextRun({ text: cell.replace(/\*\*/g, ""), bold: true, color: "FFFFFF", size: 20, font: "Segoe UI" })]
                : parseInline(cell),
            })],
          })
        ),
      })
    ),
  });
}

// ─── Block parser ─────────────────────────────────────────────────────────────
type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "bullet"; text: string; level: number }
  | { type: "para"; text: string }
  | { type: "hr" }
  | { type: "mdtable"; rows: string[][] }
  | { type: "essencial" | "atencao" | "bizu" | "dica" | "exemplificando" | "esclarecendo" | "questao" | "esquema"; content: string };

const TAG_RE = /\[(ESSENCIAL_DE_PROVA|ATENCAO|BIZU|DICA|EXEMPLIFICANDO|ESCLARECENDO|QUESTAO|ESQUEMA)\]([\s\S]*?)\[\/\1\]/gi;

const TAG_MAP: Record<string, Block["type"]> = {
  ESSENCIAL_DE_PROVA: "essencial", ATENCAO: "atencao", BIZU: "bizu",
  DICA: "dica", EXEMPLIFICANDO: "exemplificando", ESCLARECENDO: "esclarecendo",
  QUESTAO: "questao", ESQUEMA: "esquema",
};

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  const pushText = (chunk: string) => {
    const lines = chunk.split("\n");
    let i = 0;
    while (i < lines.length) {
      const l = lines[i].trimEnd();
      if (l.startsWith("|") && i + 1 < lines.length && /^\|[-| :]+\|/.test(lines[i + 1])) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i++]); }
        const rows = tableLines
          .filter(r => !/^\|[-| :]+\|/.test(r.trim()))
          .map(r => r.split("|").slice(1, -1).map(c => c.trim()));
        if (rows.length > 0) blocks.push({ type: "mdtable", rows });
        continue;
      }
      if (!l) { i++; continue; }
      if (l === "---" || l === "***" || l === "___") blocks.push({ type: "hr" });
      else if (l.startsWith("#### ") || l.startsWith("### ")) blocks.push({ type: "h3", text: l.replace(/^#{3,4}\s/, "").trim() });
      else if (l.startsWith("## ")) blocks.push({ type: "h2", text: l.slice(3).trim() });
      else if (l.startsWith("# "))  blocks.push({ type: "h1", text: l.slice(2).trim() });
      else if (/^[-•*]\s/.test(l))  blocks.push({ type: "bullet", text: l.replace(/^[-•*]\s*/, "").trim(), level: 0 });
      else                          blocks.push({ type: "para", text: l.trim() });
      i++;
    }
  };

  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    blocks.push({ type: TAG_MAP[m[1].toUpperCase()] as any, content: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return blocks;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderBlocks(blocks: Block[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        out.push(spacer(200));
        out.push(makeBanner(b.text, C.h1bg, 40));
        out.push(spacer(160));
        break;
      case "h2":
        out.push(spacer(200));
        out.push(makeBanner(b.text, C.h2bg, 28));
        out.push(spacer(120));
        break;
      case "h3":
        out.push(new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: b.text, bold: true, color: C.h3, size: 24, font: "Montserrat" })],
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
      case "hr":
        out.push(new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D0DCF0" } },
          children: [new TextRun({ text: "" })],
        }));
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
        out.push(makeBox("📌 EXEMPLIFICANDO", b.content, C.exemploBg, C.exemploBrd));
        out.push(spacer());
        break;
      case "esclarecendo":
        out.push(makeBox("🔎 ESCLARECENDO", b.content, C.esclareceBg, C.esclareceBrd));
        out.push(spacer());
        break;
      case "questao":
        out.push(makeBox("📝 QUESTÃO DE PROVA", b.content, C.questaoBg, C.questaoBrd));
        out.push(spacer());
        break;
      case "esquema":
        out.push(makeBox("📊 ESQUEMA", b.content, C.esquemaBg, C.esquemaBrd));
        out.push(spacer());
        break;
      case "mdtable":
        out.push(makeMdTable(b.rows));
        out.push(spacer());
        break;
    }
  }

  return out;
}

// ─── Route ───────────────────────────────────────────────────────────────────
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
            run: { font: "Segoe UI", size: 24, color: C.body },
            paragraph: {
              spacing: { line: 276, after: 120 }, // 1.15 × line, 6pt after
              alignment: AlignmentType.JUSTIFIED,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: mm(210), height: mm(297) },
              margin: { top: mm(25), bottom: mm(25), left: mm(25), right: mm(25) },
            },
          },

          // ── Header: thin blue line ──
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.h2bg } },
                  spacing: { after: 80 },
                  children: [
                    new TextRun({ text: "TI TOTAL", bold: true, size: 18, color: C.h2bg, font: "Montserrat" }),
                    new TextRun({ text: "  ·  ", size: 18, color: C.muted, font: "Segoe UI" }),
                    new TextRun({ text: `${lesson?.code ?? ""}  —  ${lesson?.title ?? ""}`, size: 18, color: C.muted, font: "Segoe UI" }),
                  ],
                }),
              ],
            }),
          },

          // ── Footer: text left + page number right ──
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D0DCF0" } },
                  tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                  spacing: { before: 60 },
                  children: [
                    new TextRun({ text: "TI TOTAL — TI para Concursos", size: 16, color: C.muted, font: "Segoe UI" }),
                    new TextRun({ text: "\t", size: 16 }),
                    new TextRun({ text: "Pág. ", size: 16, color: C.muted, font: "Segoe UI" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.muted, font: "Segoe UI" }),
                  ],
                }),
              ],
            }),
          },

          children: content,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${lesson?.code ?? "teoria"}-teoria.docx`;
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
