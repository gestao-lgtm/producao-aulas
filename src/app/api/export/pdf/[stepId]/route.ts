import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Brand palette (RGB) ──────────────────────────────────────────────────────
const C = {
  h1bg:         [26,  58,  92] as RGB,  // #1A3A5C
  h2bg:         [26,  79, 138] as RGB,  // #1A4F8A
  h3:           [44, 111, 172] as RGB,  // #2C6FAC
  body:         [26,  32,  44] as RGB,  // #1A202C
  azul:         [26,  79, 138] as RGB,  // #1A4F8A
  vermelho:     [192, 57,  43] as RGB,  // #C0392B
  gray:         [113,128,150] as RGB,
  rule:         [208,220,240] as RGB,
  essencialBg:  [232,240,251] as RGB, essencialBrd: [26,  79,138] as RGB,
  atencaoBg:    [255,248,230] as RGB, atencaoBrd:   [196,125, 14] as RGB,
  bizuBg:       [234,245,234] as RGB, bizuBrd:      [39, 174, 96] as RGB,
  dicaBg:       [234,244,251] as RGB, dicaBrd:      [41, 128,185] as RGB,
  exemploBg:    [240,250,244] as RGB, exemploBrd:   [30, 132, 73] as RGB,
  esclareceBg:  [245,240,251] as RGB, esclareceBrd: [125, 60,152] as RGB,
  questaoBg:    [250,250,250] as RGB, questaoBrd:   [86, 101,115] as RGB,
  esquemaBg:    [232,240,251] as RGB, esquemaBrd:   [26,  79,138] as RGB,
};

type RGB = [number, number, number];

// ─── Block types ──────────────────────────────────────────────────────────────
type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "bullet"; text: string }
  | { type: "para"; text: string }
  | { type: "hr" }
  | { type: "mdtable"; rows: string[][] }
  | { type: "essencial"|"atencao"|"bizu"|"dica"|"exemplificando"|"esclarecendo"|"questao"|"esquema"; content: string };

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
      // Detect markdown table
      if (l.startsWith("|") && i + 1 < lines.length && /^\|[-| :]+\|/.test(lines[i + 1])) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) tableLines.push(lines[i++]);
        const rows = tableLines
          .filter(r => !/^\|[-| :]+\|/.test(r.trim()))
          .map(r => r.split("|").slice(1, -1).map(c => c.trim()));
        if (rows.length) blocks.push({ type: "mdtable", rows });
        continue;
      }
      if (!l) { i++; continue; }
      if (l === "---" || l === "***" || l === "___") blocks.push({ type: "hr" });
      else if (l.startsWith("#### ") || l.startsWith("### ")) blocks.push({ type: "h3", text: l.replace(/^#{3,4}\s/, "") });
      else if (l.startsWith("## ")) blocks.push({ type: "h2", text: l.slice(3) });
      else if (l.startsWith("# "))  blocks.push({ type: "h1", text: l.slice(2) });
      else if (/^[-•*]\s/.test(l))  blocks.push({ type: "bullet", text: l.replace(/^[-•*]\s*/, "") });
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

// ─── Inline segments ──────────────────────────────────────────────────────────
type Seg = { text: string; bold: boolean; color: RGB };

function parseInline(line: string): Seg[] {
  const segs: Seg[] = [];
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index), bold: false, color: C.body });
    if      (m[1] !== undefined) segs.push({ text: m[1], bold: true,  color: C.azul });
    else if (m[2] !== undefined) segs.push({ text: m[2], bold: true,  color: C.vermelho });
    else if (m[3] !== undefined) segs.push({ text: m[3], bold: true,  color: C.body });
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push({ text: line.slice(last), bold: false, color: C.body });
  return segs.length ? segs : [{ text: line, bold: false, color: C.body }];
}

// ─── PDF builder ──────────────────────────────────────────────────────────────
function buildPdf(blocks: Block[], lessonCode: string, lessonTitle: string, disciplineName: string): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { jsPDF } = require("jspdf");

  const PW = 210, PH = 297, M = 20, CW = PW - M * 2;
  const BODY = 11, LH_MULT = 1.15, GAP = 2;
  const ptMm = (pt: number) => pt * 0.352778;
  const lh = (pt: number) => ptMm(pt) * LH_MULT;

  const doc = new jsPDF({ unit: "mm", format: "a4" }) as any;
  let y = M;
  let pg = 1;

  function checkBreak(need: number) {
    if (y + need > PH - M - 10) { doc.addPage(); pg++; y = M; drawFooter(); }
  }

  function drawFooter() {
    const fy = PH - M + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text("TI TOTAL — TI para Concursos", M, fy);
    doc.text(String(pg), PW - M, fy, { align: "right" });
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.3);
    doc.line(M, PH - M, PW - M, PH - M);
  }

  // ── First-page header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.h2bg);
  doc.text("TI TOTAL", M, y + lh(16) * 0.8);
  y += lh(16) + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  doc.text(`${lessonCode}  ·  ${disciplineName}`, M, y + lh(9) * 0.8);
  y += lh(9) + 1;

  doc.setDrawColor(...C.h2bg);
  doc.setLineWidth(0.6);
  doc.line(M, y, PW - M, y);
  y += 5;

  drawFooter();

  // ── Inline text renderer ──
  function renderInline(text: string, fontSize: number, spaceAfter = GAP, indent = 0) {
    const segs = parseInline(text);
    const lineH = lh(fontSize);
    // estimate height from plain text
    const plain = text.replace(/\[\[(?:AZUL|VERMELHO):(.*?)\]\]|\*\*(.*?)\*\*/g, "$1$2");
    const wrapped: string[] = doc.splitTextToSize(plain, CW - indent);
    checkBreak(wrapped.length * lineH + spaceAfter);

    let cx = M + indent;
    for (const seg of segs) {
      if (!seg.text) continue;
      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(...seg.color);
      const words = seg.text.split(/(\s+)/);
      for (const word of words) {
        const w = doc.getTextWidth(word);
        if (cx + w > PW - M && word.trim()) { y += lineH; cx = M + indent; }
        doc.text(word, cx, y + lineH * 0.8);
        cx += w;
      }
    }
    y += lineH + spaceAfter;
  }

  // ── Blue banner (H1/H2) ──
  function renderBanner(text: string, bg: RGB, fontSize: number) {
    const bh = ptMm(fontSize) * LH_MULT + 6;
    checkBreak(bh + 6);
    doc.setFillColor(...bg);
    doc.rect(M, y, CW, bh, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(255, 255, 255);
    doc.text(text.toUpperCase(), M + 5, y + bh - 3);
    y += bh + 6;
  }

  // ── Bullet ──
  function renderBullet(text: string) {
    const indent = 5;
    const lineH = lh(BODY);
    const plain = "• " + text.replace(/\[\[(?:AZUL|VERMELHO):(.*?)\]\]|\*\*(.*?)\*\*/g, "$1$2");
    const wrapped: string[] = doc.splitTextToSize(plain, CW - indent);
    checkBreak(wrapped.length * lineH + GAP);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY);
    doc.setTextColor(...C.body);
    doc.text("•", M + indent, y + lineH * 0.8);
    renderInline(text, BODY, GAP, indent + 4);
  }

  // ── Box ──
  function renderBox(label: string, content: string, bg: RGB, brd: RGB) {
    const bw = 3, pH = 3, pX = 5;
    const lineH = lh(BODY);
    const labelH = lh(9) + 2;
    let h = pH * 2 + labelH;
    const lines = content.trim().split("\n").filter(l => l.trim());
    for (const line of lines) {
      const plain = ((/^[-•*]\s/.test(line) ? "•  " : "") + line.replace(/^[-•*]\s*/, ""))
        .replace(/\[\[(?:AZUL|VERMELHO):(.*?)\]\]|\*\*(.*?)\*\*/g, "$1$2");
      const ws: string[] = doc.splitTextToSize(plain, CW - bw - pX * 2 - (/^[-•*]\s/.test(line) ? 4 : 0));
      h += ws.length * lineH + GAP;
    }
    checkBreak(h + 4);

    doc.setFillColor(...bg);
    doc.rect(M + bw, y, CW - bw, h, "F");
    doc.setFillColor(...brd);
    doc.rect(M, y, bw, h, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...brd);
    doc.text(label, M + bw + pX, y + pH + lh(9) * 0.8);

    let iy = y + pH + labelH;
    for (const line of lines) {
      const t = line.trimEnd();
      if (!t) continue;
      const isBullet = /^[-•*]\s/.test(t);
      const text = t.replace(/^[-•*]\s*/, "");
      const indent = isBullet ? 4 : 0;
      if (isBullet) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(BODY); doc.setTextColor(...C.body);
        doc.text("•", M + bw + pX + indent, iy + lineH * 0.8);
      }
      let cx = M + bw + pX + indent + (isBullet ? doc.getTextWidth("•  ") : 0);
      const segs = parseInline(text);
      for (const seg of segs) {
        if (!seg.text) continue;
        doc.setFont("helvetica", seg.bold ? "bold" : "normal");
        doc.setFontSize(BODY);
        doc.setTextColor(...seg.color);
        for (const word of seg.text.split(/(\s+)/)) {
          const w = doc.getTextWidth(word);
          if (cx + w > PW - M - pX && word.trim()) { iy += lineH; cx = M + bw + pX + indent + (isBullet ? doc.getTextWidth("•  ") : 0); }
          doc.text(word, cx, iy + lineH * 0.8);
          cx += w;
        }
      }
      iy += lineH + GAP;
    }
    y += h + 4;
  }

  // ── Markdown table ──
  function renderMdTable(rows: string[][]) {
    const cols = rows[0]?.length ?? 1;
    const colW = CW / cols;
    const lineH = lh(BODY);
    const cellPad = 2;

    let totalH = 0;
    const rowHeights: number[] = rows.map((row, ri) => {
      let maxLines = 1;
      for (const cell of row) {
        const plain = cell.replace(/\*\*/g, "");
        const wrapped: string[] = doc.splitTextToSize(plain, colW - cellPad * 2);
        maxLines = Math.max(maxLines, wrapped.length);
      }
      return maxLines * lineH + cellPad * 2;
    });
    totalH = rowHeights.reduce((a, b) => a + b, 0);

    checkBreak(totalH + 4);

    let ry = y;
    for (let ri = 0; ri < rows.length; ri++) {
      const rh = rowHeights[ri];
      for (let ci = 0; ci < rows[ri].length; ci++) {
        const cx = M + ci * colW;
        const fill: RGB = ri === 0 ? C.h2bg : ri % 2 === 0 ? [240,244,250] : [255,255,255];
        doc.setFillColor(...fill);
        doc.rect(cx, ry, colW, rh, "F");
        doc.setDrawColor(...C.rule);
        doc.setLineWidth(0.2);
        doc.rect(cx, ry, colW, rh, "S");

        const cell = rows[ri][ci];
        doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
        doc.setFontSize(BODY - 1);
        doc.setTextColor(...(ri === 0 ? [255,255,255] as RGB : C.body));
        const wrapped: string[] = doc.splitTextToSize(cell.replace(/\*\*/g, ""), colW - cellPad * 2);
        for (let wi = 0; wi < wrapped.length; wi++) {
          doc.text(wrapped[wi], cx + cellPad, ry + cellPad + (wi + 1) * lh(BODY - 1) * 0.9);
        }
      }
      ry += rh;
    }
    y = ry + 4;
  }

  // ── Render ──
  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        y += 4;
        renderBanner(b.text, C.h1bg, 16);
        break;
      case "h2":
        y += 4;
        renderBanner(b.text, C.h2bg, 13);
        break;
      case "h3":
        checkBreak(lh(11) + 5);
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C.h3);
        doc.text(b.text, M, y + lh(11) * 0.8);
        y += lh(11) + 3;
        break;
      case "bullet":
        renderBullet(b.text);
        break;
      case "para":
        if (b.text) renderInline(b.text, BODY);
        break;
      case "hr":
        y += 2;
        doc.setDrawColor(...C.rule);
        doc.setLineWidth(0.3);
        doc.line(M, y, PW - M, y);
        y += 4;
        break;
      case "mdtable":
        renderMdTable(b.rows);
        break;
      case "essencial":   renderBox("★ ESSENCIAL DE PROVA",    b.content, C.essencialBg, C.essencialBrd); break;
      case "atencao":     renderBox("⚠ ATENÇÃO",               b.content, C.atencaoBg,   C.atencaoBrd);   break;
      case "bizu":        renderBox("👉 BIZU",                  b.content, C.bizuBg,      C.bizuBrd);      break;
      case "dica":        renderBox("💡 DICA",                  b.content, C.dicaBg,      C.dicaBrd);      break;
      case "exemplificando": renderBox("📌 EXEMPLIFICANDO",    b.content, C.exemploBg,   C.exemploBrd);   break;
      case "esclarecendo":   renderBox("🔎 ESCLARECENDO",      b.content, C.esclareceBg, C.esclareceBrd); break;
      case "questao":     renderBox("📝 QUESTÃO DE PROVA",     b.content, C.questaoBg,   C.questaoBrd);   break;
      case "esquema":     renderBox("📊 ESQUEMA",              b.content, C.esquemaBg,   C.esquemaBrd);   break;
    }
  }

  return Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
}

// ─── Route ────────────────────────────────────────────────────────────────────
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

    if (!step) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });

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

    if (!outputText) return NextResponse.json({ error: "Nenhum conteúdo para exportar" }, { status: 404 });

    const lesson = step.lesson;
    const buffer = buildPdf(
      parseBlocks(outputText),
      lesson?.code ?? "",
      lesson?.title ?? "",
      lesson?.discipline?.name ?? "",
    );
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    return new Response(ab, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${lesson?.code ?? "teoria"}-teoria.pdf"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/export/pdf/[stepId]:", error);
    return NextResponse.json({ error: "Erro ao gerar PDF" }, { status: 500 });
  }
}
