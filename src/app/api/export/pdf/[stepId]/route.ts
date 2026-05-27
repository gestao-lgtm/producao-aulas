import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── TI TOTAL Brand Colors (RGB) ────────────────────────────────────────────
const C = {
  heading1:     [26,  58,  92],  // #1A3A5C
  heading2:     [26,  79, 138],  // #1A4F8A
  heading3:     [44, 111, 172],  // #2C6FAC
  body:         [26,  32,  44],  // #1A202C
  azul:         [26,  79, 138],  // #1A4F8A
  vermelho:     [192, 57,  43],  // #C0392B
  gray:         [113,128,150],   // #718096
  // Box backgrounds
  essencialBg:  [232,240,251],   // #E8F0FB
  essencialBrd: [26,  79,138],   // #1A4F8A
  atencaoBg:    [255,248,230],   // #FFF8E6
  atencaoBrd:   [212,134, 10],   // #D4860A
  bizuBg:       [234,245,234],   // #EAF5EA
  bizuBrd:      [39, 174, 96],   // #27AE60
  dicaBg:       [234,244,251],   // #EAF4FB
  dicaBrd:      [41, 128,185],   // #2980B9
  exemploBg:    [240,250,244],   // #F0FAF4
  exemploBrd:   [30, 132, 73],   // #1E8449
  esclareceBg:  [245,245,245],   // #F5F5F5
  esclareceBrd: [127,140,141],   // #7F8C8D
  questaoBg:    [250,250,250],   // #FAFAFA
  questaoBrd:   [86,  101,115],  // #566573
};

type RGB = [number, number, number];

// ─── Parser ──────────────────────────────────────────────────────────────────
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks.push({ type: tagMap[m[1].toUpperCase()], content: m[2].trim() } as any);
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return blocks;
}

// ─── Inline segment type ──────────────────────────────────────────────────────
type Segment = { text: string; bold: boolean; color: readonly number[] };

function parseInlineSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      segments.push({ text: line.slice(last, m.index), bold: false, color: C.body });
    }
    if (m[1] !== undefined) {
      segments.push({ text: m[1], bold: true, color: C.azul });
    } else if (m[2] !== undefined) {
      segments.push({ text: m[2], bold: true, color: C.vermelho });
    } else if (m[3] !== undefined) {
      segments.push({ text: m[3], bold: true, color: C.body });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    segments.push({ text: line.slice(last), bold: false, color: C.body });
  }
  return segments.length ? segments : [{ text: line, bold: false, color: C.body }];
}

// ─── PDF Renderer ─────────────────────────────────────────────────────────────
function rgbArr(col: readonly number[]): RGB {
  return [col[0], col[1], col[2]];
}

interface PdfDoc {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function buildPdf(
  blocks: Block[],
  lessonCode: string,
  disciplineName: string,
): Buffer {
  // jsPDF uses CommonJS require in Next.js server context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { jsPDF } = require("jspdf");

  const PAGE_W = 210;        // A4 width mm
  const PAGE_H = 297;        // A4 height mm
  const MARGIN = 20;         // mm all sides
  const CONTENT_W = PAGE_W - MARGIN * 2;  // 170mm
  const FOOTER_H = 10;       // mm reserved at bottom
  const BODY_FONT_SIZE = 11; // pt
  const LINE_SPACING = 1.15;
  const PARA_GAP = 2;        // mm between paragraphs

  const doc: PdfDoc = new jsPDF({ unit: "mm", format: "a4" });

  let currentY = MARGIN;
  let pageNum = 1;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function ptToMm(pt: number): number {
    return pt * 0.352778;
  }

  function lineHeightMm(fontSize: number): number {
    return ptToMm(fontSize) * LINE_SPACING;
  }

  function checkPageBreak(needed: number) {
    const bottomLimit = PAGE_H - MARGIN - FOOTER_H;
    if (currentY + needed > bottomLimit) {
      doc.addPage();
      pageNum++;
      currentY = MARGIN;
      drawFooter();
    }
  }

  function drawFooter() {
    const footerY = PAGE_H - MARGIN + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...rgbArr(C.gray));
    doc.text(
      "TI TOTAL — Tecnologia da Informação para Concursos",
      PAGE_W / 2,
      footerY,
      { align: "center" }
    );
    doc.text(String(pageNum), PAGE_W - MARGIN, footerY, { align: "right" });
  }

  // ── Header (first page) ───────────────────────────────────────────────────

  // "TI TOTAL" large bold blue
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...rgbArr(C.heading1));
  doc.text("TI TOTAL", MARGIN, currentY + ptToMm(22));
  currentY += ptToMm(22) + 4;

  // Code | Discipline | TEORIA line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...rgbArr(C.gray));
  const headerLine = `${lessonCode}  |  ${disciplineName}  |  `;
  doc.text(headerLine, MARGIN, currentY + ptToMm(10));
  const headerLineWidth = doc.getTextWidth(headerLine);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...rgbArr(C.heading2));
  doc.text("TEORIA", MARGIN + headerLineWidth, currentY + ptToMm(10));
  currentY += ptToMm(10) + 3;

  // Blue rule
  doc.setDrawColor(...rgbArr(C.heading2));
  doc.setLineWidth(0.5);
  doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
  currentY += 6;

  drawFooter();

  // ── Block renderers ───────────────────────────────────────────────────────

  function renderText(
    text: string,
    fontSize: number,
    bold: boolean,
    color: readonly number[],
    spaceBefore = 0,
    spaceAfter = PARA_GAP,
    indent = 0,
  ) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...rgbArr(color));
    const maxW = CONTENT_W - indent;
    const lines: string[] = doc.splitTextToSize(text, maxW);
    const lh = lineHeightMm(fontSize);
    const totalH = lines.length * lh + spaceBefore + spaceAfter;
    checkPageBreak(totalH);
    currentY += spaceBefore;
    for (const line of lines) {
      doc.text(line, MARGIN + indent, currentY + lh * 0.8);
      currentY += lh;
    }
    currentY += spaceAfter;
  }

  function renderInlineLine(
    line: string,
    fontSize: number,
    spaceAfter = PARA_GAP,
    indent = 0,
  ) {
    const segments = parseInlineSegments(line);
    const lh = lineHeightMm(fontSize);
    // Measure total and split if needed (simplified: render word-wrapped per segment)
    // For simplicity, collect all text then render with color runs via manual X tracking
    checkPageBreak(lh + spaceAfter);
    let x = MARGIN + indent;
    const y = currentY + lh * 0.8;
    for (const seg of segments) {
      if (!seg.text) continue;
      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(...rgbArr(seg.color));
      // Check if this segment fits on the line, otherwise wrap
      const words = seg.text.split(/(\s+)/);
      for (const word of words) {
        const w = doc.getTextWidth(word);
        if (x + w > PAGE_W - MARGIN && word.trim()) {
          currentY += lh;
          checkPageBreak(lh);
          x = MARGIN + indent;
        }
        doc.text(word, x, currentY + lh * 0.8);
        x += w;
      }
    }
    currentY += lh + spaceAfter;
  }

  function renderBullet(text: string) {
    const bullet = "•  ";
    const indent = 4;
    const fontSize = BODY_FONT_SIZE;
    const lh = lineHeightMm(fontSize);
    const segments = parseInlineSegments(text);

    // measure total wrapped height
    const plainText = bullet + text.replace(/\[\[(?:AZUL|VERMELHO):(.*?)\]\]|\*\*(.*?)\*\*/g, "$1$2");
    const lines: string[] = doc.splitTextToSize(plainText, CONTENT_W - indent);
    const totalH = lines.length * lh + PARA_GAP;
    checkPageBreak(totalH);

    // render bullet character
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...rgbArr(C.body));
    doc.text("•", MARGIN + indent, currentY + lh * 0.8);

    // render inline text after bullet
    let x = MARGIN + indent + doc.getTextWidth("•  ");
    const baseY = currentY;
    let localY = 0;

    for (const seg of segments) {
      if (!seg.text) continue;
      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(...rgbArr(seg.color));
      const words = seg.text.split(/(\s+)/);
      for (const word of words) {
        const w = doc.getTextWidth(word);
        if (x + w > PAGE_W - MARGIN && word.trim()) {
          localY += lh;
          x = MARGIN + indent + doc.getTextWidth("   ");
        }
        doc.text(word, x, baseY + localY + lh * 0.8);
        x += w;
      }
    }
    currentY += Math.max(1, Math.ceil(localY / lh) + 1) * lh + PARA_GAP;
  }

  function renderBox(
    label: string,
    content: string,
    bg: readonly number[],
    borderColor: readonly number[],
  ) {
    const fontSize = BODY_FONT_SIZE;
    const lh = lineHeightMm(fontSize);
    const labelH = lineHeightMm(9) + 2;
    const paddingV = 3;
    const paddingH = 5;
    const borderW = 3;
    const innerW = CONTENT_W - borderW - paddingH * 2;

    // Calculate content height
    const lines = content.trim().split("\n").filter(l => l.trim());
    let contentH = labelH;
    for (const line of lines) {
      const isBullet = /^[-•*]\s/.test(line);
      const text = (isBullet ? "•  " : "") + line.replace(/^[-•*]\s*/, "");
      const plain = text.replace(/\[\[(?:AZUL|VERMELHO):(.*?)\]\]|\*\*(.*?)\*\*/g, "$1$2");
      const wrapped: string[] = doc.splitTextToSize(plain, innerW - (isBullet ? 4 : 0));
      contentH += wrapped.length * lh + PARA_GAP;
    }
    const boxH = paddingV * 2 + contentH;

    checkPageBreak(boxH + 4);

    const boxX = MARGIN;
    const boxY = currentY;

    // Background
    doc.setFillColor(...rgbArr(bg));
    doc.rect(boxX + borderW, boxY, CONTENT_W - borderW, boxH, "F");

    // Left border
    doc.setFillColor(...rgbArr(borderColor));
    doc.rect(boxX, boxY, borderW, boxH, "F");

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...rgbArr(borderColor));
    const labelY = boxY + paddingV + lineHeightMm(9) * 0.8;
    doc.text(label, boxX + borderW + paddingH, labelY);

    let innerY = boxY + paddingV + labelH;

    // Content lines
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      const isBullet = /^[-•*]\s/.test(trimmed);
      const lineText = trimmed.replace(/^[-•*]\s*/, "");
      const bulletIndent = isBullet ? 4 : 0;
      const segments = parseInlineSegments(lineText);

      if (isBullet) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...rgbArr(C.body));
        doc.text("•", boxX + borderW + paddingH + bulletIndent, innerY + lh * 0.8);
      }

      let x = boxX + borderW + paddingH + bulletIndent + (isBullet ? doc.getTextWidth("•  ") : 0);
      const startX = x;
      const maxLineX = boxX + CONTENT_W - paddingH;

      for (const seg of segments) {
        if (!seg.text) continue;
        doc.setFont("helvetica", seg.bold ? "bold" : "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...rgbArr(seg.color));
        const words = seg.text.split(/(\s+)/);
        for (const word of words) {
          const w = doc.getTextWidth(word);
          if (x + w > maxLineX && word.trim()) {
            innerY += lh;
            x = startX;
          }
          doc.text(word, x, innerY + lh * 0.8);
          x += w;
        }
      }
      innerY += lh + PARA_GAP;
    }

    currentY += boxH + 4;
  }

  // ── Render all blocks ─────────────────────────────────────────────────────

  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        renderText(b.text, 18, true, C.heading1, 6, 3);
        break;
      case "h2":
        renderText(b.text, 14, true, C.heading2, 4, 2);
        break;
      case "h3":
        renderText(b.text, 12, true, C.heading3, 3, 1.5);
        break;
      case "bullet":
        renderBullet(b.text);
        break;
      case "para":
        if (b.text) renderInlineLine(b.text, BODY_FONT_SIZE);
        break;
      case "essencial":
        renderBox("★ ESSENCIAL DE PROVA", b.content, C.essencialBg, C.essencialBrd);
        break;
      case "atencao":
        renderBox("⚠ ATENÇÃO", b.content, C.atencaoBg, C.atencaoBrd);
        break;
      case "bizu":
        renderBox("👉 BIZU", b.content, C.bizuBg, C.bizuBrd);
        break;
      case "dica":
        renderBox("💡 DICA", b.content, C.dicaBg, C.dicaBrd);
        break;
      case "exemplificando":
        renderBox("EXEMPLIFICANDO", b.content, C.exemploBg, C.exemploBrd);
        break;
      case "esclarecendo":
        renderBox("ESCLARECENDO", b.content, C.esclareceBg, C.esclareceBrd);
        break;
      case "questao":
        renderBox("📝 QUESTÃO DE PROVA", b.content, C.questaoBg, C.questaoBrd);
        break;
    }
  }

  const arrayBuffer: ArrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
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

    if (!step) {
      return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
    }

    // For PADRONIZACAO_EDITORIAL, ALWAYS use PRODUCAO_TEORIA output
    let outputText = "";
    if (step.stepKey === "PADRONIZACAO_EDITORIAL") {
      const teoriaStep = await prisma.workflowStep.findFirst({
        where: { lessonId: step.lessonId, stepKey: "PRODUCAO_TEORIA" },
        include: { stepRuns: { orderBy: { version: "desc" }, take: 1 } },
      });
      outputText = teoriaStep?.stepRuns[0]?.outputText ?? "";
    } else {
      outputText = step.stepRuns[0]?.outputText ?? "";
    }

    if (!outputText) {
      return NextResponse.json({ error: "Nenhum conteúdo para exportar" }, { status: 404 });
    }

    const lesson = step.lesson;
    const lessonCode = lesson?.code ?? "teoria";
    const disciplineName = lesson?.discipline?.name ?? "";

    const blocks = parseBlocks(outputText);
    const buffer = buildPdf(blocks, lessonCode, disciplineName);
    const filename = `${lessonCode}-teoria.pdf`;
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/export/pdf/[stepId]:", error);
    return NextResponse.json({ error: "Erro ao gerar PDF" }, { status: 500 });
  }
}
