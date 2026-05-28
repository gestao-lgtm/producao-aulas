import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const credentials = JSON.parse(raw);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"],
    });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Configure credenciais Google");
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

const C = {
  h1bg:        { red: 0.102, green: 0.227, blue: 0.361 },
  h2bg:        { red: 0.102, green: 0.310, blue: 0.541 },
  h3:          { red: 0.173, green: 0.435, blue: 0.675 },
  white:       { red: 1,     green: 1,     blue: 1     },
  body:        { red: 0.102, green: 0.125, blue: 0.173 },
  azul:        { red: 0.102, green: 0.310, blue: 0.541 },
  vermelho:    { red: 0.753, green: 0.224, blue: 0.169 },
  gray:        { red: 0.400, green: 0.400, blue: 0.400 },
  coverBg:     { red: 0.071, green: 0.102, blue: 0.161 },
  coverAccent: { red: 0.180, green: 0.400, blue: 0.700 },
  ruleBg:      { red: 0.816, green: 0.863, blue: 0.941 },
  tableBg:     { red: 0.945, green: 0.953, blue: 0.973 },
  tableAlt:    { red: 0.980, green: 0.980, blue: 0.985 },
  essencialBg: { red: 0.910, green: 0.941, blue: 0.984 },
  atencaoBg:   { red: 1.000, green: 0.973, blue: 0.902 },
  bizuBg:      { red: 0.918, green: 0.957, blue: 0.918 },
  dicaBg:      { red: 0.918, green: 0.957, blue: 0.984 },
  exemploBg:   { red: 0.941, green: 0.980, blue: 0.957 },
  esclareceBg: { red: 0.957, green: 0.941, blue: 0.984 },
  questaoBg:   { red: 0.980, green: 0.980, blue: 0.980 },
  essencialBrd:{ red: 0.102, green: 0.227, blue: 0.361 },
  atencaoBrd:  { red: 0.769, green: 0.490, blue: 0.055 },
  bizuBrd:     { red: 0.153, green: 0.682, blue: 0.376 },
  dicaBrd:     { red: 0.161, green: 0.502, blue: 0.725 },
  exemploBrd:  { red: 0.118, green: 0.518, blue: 0.286 },
  esclareceBrd:{ red: 0.490, green: 0.235, blue: 0.596 },
  questaoBrd:  { red: 0.337, green: 0.396, blue: 0.451 },
};
type Color = { red: number; green: number; blue: number };

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
      if (l === "---") blocks.push({ type: "hr" });
      else if (/^#{3,4}\s/.test(l)) blocks.push({ type: "h3", text: l.replace(/^#{3,4}\s/, "") });
      else if (l.startsWith("## ")) blocks.push({ type: "h2", text: l.slice(3) });
      else if (l.startsWith("# "))  blocks.push({ type: "h1", text: l.slice(2) });
      else if (/^[-•*]\s/.test(l))  blocks.push({ type: "bullet", text: l.replace(/^[-•*]\s*/, "") });
      else                          blocks.push({ type: "para", text: l.trim() });
      i++;
    }
  };
  let last = 0, m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    blocks.push({ type: TAG_MAP[m[1].toUpperCase()] as any, content: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return blocks;
}

// ─── Inline parser: handles **bold**, *italic*, [[AZUL:]], [[VERMELHO:]] ──────
type Seg = { text: string; bold: boolean; italic: boolean; color: Color };

function cleanRaw(text: string): string {
  return text
    .replace(/^\*(?!\*)/gm, "")   // orphaned leading *
    .replace(/\*{2,}$/gm, "")     // orphaned trailing **
    .trim();
}

function parseInline(raw: string): Seg[] {
  const text = cleanRaw(raw);
  if (!text) return [];
  const segs: Seg[] = [];
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*|\*((?:[^*])+?)\*/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false, italic: false, color: C.body });
    if      (m[1] !== undefined) segs.push({ text: m[1], bold: true,  italic: false, color: C.azul });
    else if (m[2] !== undefined) segs.push({ text: m[2], bold: true,  italic: false, color: C.vermelho });
    else if (m[3] !== undefined) segs.push({ text: m[3], bold: true,  italic: false, color: C.body });
    else if (m[4] !== undefined) segs.push({ text: m[4], bold: false, italic: true,  color: C.gray });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), bold: false, italic: false, color: C.body });
  return segs.length ? segs : [{ text, bold: false, italic: false, color: C.body }];
}

type GRequest = Record<string, unknown>;

class DocBuilder {
  requests: GRequest[] = [];
  index = 1;

  insertText(text: string) {
    this.requests.push({ insertText: { location: { index: this.index }, text } });
    this.index += text.length;
  }

  styleText(start: number, end: number, style: Record<string, unknown>, fields: string) {
    if (end <= start) return;
    this.requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: end }, textStyle: style, fields } });
  }

  stylePara(start: number, end: number, style: Record<string, unknown>, fields: string) {
    this.requests.push({ updateParagraphStyle: { range: { startIndex: start, endIndex: end }, paragraphStyle: style, fields } });
  }

  addPara(segs: Seg[], spaceAfter = 6, spaceBefore = 0, pageBreakBefore = false) {
    const start = this.index;
    const fullText = segs.map(s => s.text).join("") + "\n";
    this.insertText(fullText);
    const end = this.index;
    const paraStyle: any = {
      spaceAbove: { magnitude: spaceBefore, unit: "PT" },
      spaceBelow: { magnitude: spaceAfter, unit: "PT" },
      lineSpacing: 115,
    };
    if (pageBreakBefore) paraStyle.pageBreakBefore = true;
    this.stylePara(start, end, paraStyle, `spaceAbove,spaceBelow,lineSpacing${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    let pos = start;
    for (const seg of segs) {
      if (!seg.text) { pos += seg.text.length; continue; }
      const len = seg.text.length;
      if (seg.bold || seg.italic || seg.color !== C.body) {
        this.styleText(pos, pos + len, {
          bold: seg.bold, italic: seg.italic,
          foregroundColor: { color: { rgbColor: seg.color } },
          fontSize: { magnitude: 11, unit: "PT" },
          weightedFontFamily: { fontFamily: "Arial" },
        }, "bold,italic,foregroundColor,fontSize,weightedFontFamily");
      }
      pos += len;
    }
  }

  addBanner(text: string, bg: Color, fontSize: number, spaceAbove = 12, pageBreakBefore = false, headingLevel: 1|2|3|null = null) {
    const start = this.index;
    this.insertText(text + "\n");
    const end = this.index;
    const paraStyle: any = {
      namedStyleType: headingLevel ? `HEADING_${headingLevel}` : "NORMAL_TEXT",
      spaceAbove: { magnitude: spaceAbove, unit: "PT" },
      spaceBelow: { magnitude: 8, unit: "PT" },
      indentStart: { magnitude: 8, unit: "PT" },
      indentEnd: { magnitude: 4, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: bg } } },
    };
    if (pageBreakBefore) paraStyle.pageBreakBefore = true;
    this.stylePara(start, end, paraStyle, `namedStyleType,spaceAbove,spaceBelow,indentStart,indentEnd,shading${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    this.styleText(start, end - 1, {
      bold: true,
      fontSize: { magnitude: fontSize, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");
  }

  addH3(text: string) {
    const segs = parseInline(text);
    const start = this.index;
    this.insertText(segs.map(s => s.text).join("") + "\n");
    const end = this.index;
    this.stylePara(start, end, {
      namedStyleType: "HEADING_3",
      spaceAbove: { magnitude: 10, unit: "PT" },
      spaceBelow: { magnitude: 4, unit: "PT" },
    }, "namedStyleType,spaceAbove,spaceBelow");
    this.styleText(start, end - 1, {
      bold: true, fontSize: { magnitude: 12, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.h3 } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");
  }

  addTable(rows: string[][]) {
    if (!rows.length) return;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const isHeader = rowIdx === 0;
      const cellText = rows[rowIdx].join("   |   ");
      const start = this.index;
      this.insertText(cellText + "\n");
      const end = this.index;
      const bg = isHeader ? C.h2bg : (rowIdx % 2 === 1 ? C.tableBg : C.tableAlt);
      this.stylePara(start, end, {
        spaceBelow: { magnitude: 1, unit: "PT" },
        indentStart: { magnitude: 6, unit: "PT" },
        indentEnd: { magnitude: 6, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: bg } } },
      }, "spaceBelow,indentStart,indentEnd,shading");
      this.styleText(start, end - 1, {
        bold: isHeader,
        foregroundColor: { color: { rgbColor: isHeader ? C.white : C.body } },
        fontSize: { magnitude: 10, unit: "PT" },
        weightedFontFamily: { fontFamily: isHeader ? "Montserrat" : "Arial" },
      }, "bold,foregroundColor,fontSize,weightedFontFamily");
    }
    const sp = this.index;
    this.insertText("\n");
    this.stylePara(sp, this.index, { spaceBelow: { magnitude: 6, unit: "PT" } }, "spaceBelow");
  }

  addBox(label: string, content: string, bg: Color, brdColor: Color, pageBreakBefore = false) {
    const lines = content.trim().split("\n").filter(l => l.trim());
    const labelStart = this.index;
    this.insertText(label + "\n");
    const labelEnd = this.index;
    const paraStyle: any = {
      spaceAbove: { magnitude: 6, unit: "PT" },
      spaceBelow: { magnitude: 2, unit: "PT" },
      indentStart: { magnitude: 10, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: bg } } },
    };
    if (pageBreakBefore) paraStyle.pageBreakBefore = true;
    this.stylePara(labelStart, labelEnd, paraStyle, `spaceAbove,spaceBelow,indentStart,shading${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    this.styleText(labelStart, labelEnd - 1, {
      bold: true, fontSize: { magnitude: 9, unit: "PT" },
      foregroundColor: { color: { rgbColor: brdColor } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    for (const line of lines) {
      const isBullet = /^[-•*]\s/.test(line);
      const lineText = line.replace(/^[-•*]\s*/, "");
      const segs = parseInline(lineText);
      const lineStart = this.index;
      this.insertText((isBullet ? "• " : "") + segs.map(s => s.text).join("") + "\n");
      const lineEnd = this.index;
      this.stylePara(lineStart, lineEnd, {
        spaceBelow: { magnitude: 2, unit: "PT" },
        indentStart: { magnitude: isBullet ? 20 : 10, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: bg } } },
      }, "spaceBelow,indentStart,shading");
      let pos = lineStart + (isBullet ? 2 : 0);
      for (const seg of segs) {
        if (!seg.text) continue;
        this.styleText(pos, pos + seg.text.length, {
          bold: seg.bold, italic: seg.italic,
          foregroundColor: { color: { rgbColor: seg.color } },
          fontSize: { magnitude: 11, unit: "PT" },
          weightedFontFamily: { fontFamily: "Arial" },
        }, "bold,italic,foregroundColor,fontSize,weightedFontFamily");
        pos += seg.text.length;
      }
    }
    const sp = this.index;
    this.insertText("\n");
    this.stylePara(sp, this.index, { spaceBelow: { magnitude: 6, unit: "PT" } }, "spaceBelow");
  }

  addCover(lessonCode: string, lessonTitle: string, imageUrl?: string) {
    if (imageUrl) {
      // Full-page cover image (A4 width = 453pt after 2.5cm margins each side)
      this.requests.push({
        insertInlineImage: {
          location: { index: this.index },
          uri: imageUrl,
          objectSize: {
            width:  { magnitude: 453, unit: "PT" },
            height: { magnitude: 641, unit: "PT" },
          },
        },
      });
      this.index += 1; // image takes 1 structural index
      // Paragraph after image
      const imgParaStart = this.index;
      this.insertText("\n");
      this.stylePara(imgParaStart, this.index, {
        spaceAbove: { magnitude: 0, unit: "PT" },
        spaceBelow: { magnitude: 0, unit: "PT" },
      }, "spaceAbove,spaceBelow");
      // Lesson subtitle under image
      const subStart = this.index;
      this.insertText(`${lessonCode} — ${lessonTitle}\n`);
      const subEnd = this.index;
      this.stylePara(subStart, subEnd, {
        alignment: "CENTER",
        spaceAbove: { magnitude: 12, unit: "PT" },
        spaceBelow: { magnitude: 0, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      }, "alignment,spaceAbove,spaceBelow,shading");
      this.styleText(subStart, subEnd - 1, {
        bold: true, fontSize: { magnitude: 14, unit: "PT" },
        foregroundColor: { color: { rgbColor: C.white } },
        weightedFontFamily: { fontFamily: "Montserrat" },
      }, "bold,fontSize,foregroundColor,weightedFontFamily");
      return;
    }

    // Fallback: dark text cover if no image URL
    const start = this.index;
    // Spacer lines to push content down visually
    this.insertText("\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n");
    const spacerEnd = this.index;
    this.stylePara(start, spacerEnd, {
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      lineSpacing: 100,
    }, "shading,lineSpacing");

    // Accent line
    const accentStart = this.index;
    this.insertText("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    const accentEnd = this.index;
    this.stylePara(accentStart, accentEnd, {
      alignment: "CENTER",
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      spaceBelow: { magnitude: 12, unit: "PT" },
    }, "alignment,shading,spaceBelow");
    this.styleText(accentStart, accentEnd - 1, {
      foregroundColor: { color: { rgbColor: C.coverAccent } },
      fontSize: { magnitude: 14, unit: "PT" },
    }, "foregroundColor,fontSize");

    // TI TOTAL brand
    const brandStart = this.index;
    this.insertText("TI TOTAL\n");
    const brandEnd = this.index;
    this.stylePara(brandStart, brandEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 4, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(brandStart, brandEnd - 1, {
      bold: true, fontSize: { magnitude: 42, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Subtitle
    const subStart = this.index;
    this.insertText("TI PARA CONCURSOS\n");
    const subEnd = this.index;
    this.stylePara(subStart, subEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 24, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(subStart, subEnd - 1, {
      bold: false, fontSize: { magnitude: 13, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.coverAccent } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Lesson code + title
    const codeStart = this.index;
    this.insertText(`${lessonCode}\n`);
    const codeEnd = this.index;
    this.stylePara(codeStart, codeEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 6, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(codeStart, codeEnd - 1, {
      bold: true, fontSize: { magnitude: 14, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.coverAccent } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    const titleStart = this.index;
    this.insertText(lessonTitle + "\n");
    const titleEnd = this.index;
    this.stylePara(titleStart, titleEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 0, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(titleStart, titleEnd - 1, {
      bold: true, fontSize: { magnitude: 20, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Bottom spacer
    const botStart = this.index;
    this.insertText("\n\n\n\n\n\n\n\n\n\n\n\n");
    this.stylePara(botStart, this.index, {
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "shading");
  }

  addTOC(headings: Array<{ level: number; text: string }>, pageBreakBefore = true) {
    // Header
    const hStart = this.index;
    this.insertText("SUMÁRIO\n");
    const hEnd = this.index;
    const hStyle: any = {
      spaceAbove: { magnitude: 0, unit: "PT" },
      spaceBelow: { magnitude: 14, unit: "PT" },
    };
    if (pageBreakBefore) hStyle.pageBreakBefore = true;
    this.stylePara(hStart, hEnd, hStyle, `spaceAbove,spaceBelow${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    this.styleText(hStart, hEnd - 1, {
      bold: true, fontSize: { magnitude: 20, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.h1bg } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    for (const h of headings) {
      const isMain = h.level === 2;
      const start = this.index;
      this.insertText(h.text + "\n");
      const end = this.index;
      this.stylePara(start, end, {
        spaceBelow: { magnitude: isMain ? 5 : 2, unit: "PT" },
        indentStart: { magnitude: isMain ? 0 : 14, unit: "PT" },
      }, "spaceBelow,indentStart");
      this.styleText(start, end - 1, {
        bold: isMain,
        fontSize: { magnitude: isMain ? 11 : 10, unit: "PT" },
        foregroundColor: { color: { rgbColor: isMain ? C.h2bg : C.body } },
        weightedFontFamily: { fontFamily: "Arial" },
      }, "bold,fontSize,foregroundColor,weightedFontFamily");
    }
  }
}

// ─── Reorder blocks: extract closing sections for pre-topic placement ─────────
function reorderBlocks(blocks: Block[]): {
  topicBlocks: Block[];
  tocHeadings: Array<{ level: number; text: string }>;
  glossarioBlocks: Block[];
  closingBlocks: Block[];
} {
  const CLOSING_TITLES = ["essencial de prova", "glossário", "glossario", "referências", "referencias", "revisão final", "revisao final"];
  const isClosingH2 = (b: Block) =>
    b.type === "h2" && CLOSING_TITLES.some(t => b.text.toLowerCase().includes(t));

  // Find first closing H2
  let closingStart = blocks.findIndex(isClosingH2);
  if (closingStart === -1) closingStart = blocks.length;

  const topicBlocks = blocks.slice(0, closingStart);
  const allClosing = blocks.slice(closingStart);

  // Separate glossário from other closing sections
  const glossarioBlocks: Block[] = [];
  const closingBlocks: Block[] = [];
  let inGlossario = false;
  for (const b of allClosing) {
    if (b.type === "h2" && b.text.toLowerCase().includes("glossár")) {
      inGlossario = true;
    } else if (b.type === "h2") {
      inGlossario = false;
    }
    if (inGlossario) glossarioBlocks.push(b);
    else closingBlocks.push(b);
  }

  // Build TOC from H2/H3 in topic blocks
  const tocHeadings: Array<{ level: number; text: string }> = [];
  for (const b of topicBlocks) {
    if (b.type === "h2") tocHeadings.push({ level: 2, text: b.text });
    else if (b.type === "h3") tocHeadings.push({ level: 3, text: b.text });
  }

  return { topicBlocks, tocHeadings, glossarioBlocks, closingBlocks };
}

function renderBlocks(builder: DocBuilder, blocks: Block[], firstBlock = false) {
  let isFirst = firstBlock;
  for (const b of blocks) {
    const pbk = isFirst;
    isFirst = false;
    switch (b.type) {
      case "h1": builder.addBanner(b.text, C.h1bg, 16, 16, pbk, 1); break;
      case "h2": builder.addBanner(b.text, C.h2bg, 13, 12, pbk, 2); break;
      case "h3": builder.addH3(b.text); break;
      case "bullet": {
        const segs = parseInline(b.text);
        builder.addPara(segs);
        const end = builder.index;
        const start = end - b.text.length - 1;
        builder.requests.push({
          createParagraphBullets: {
            range: { startIndex: start, endIndex: end },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          },
        });
        break;
      }
      case "para": if (b.text) builder.addPara(parseInline(b.text)); break;
      case "hr": {
        const start = builder.index;
        builder.insertText("\n");
        builder.stylePara(start, builder.index, {
          borderBottom: {
            color: { color: { rgbColor: C.ruleBg } },
            width: { magnitude: 1, unit: "PT" },
            dashStyle: "SOLID",
            padding: { magnitude: 2, unit: "PT" },
          },
          spaceAbove: { magnitude: 4, unit: "PT" },
          spaceBelow: { magnitude: 4, unit: "PT" },
        }, "borderBottom,spaceAbove,spaceBelow");
        break;
      }
      case "mdtable": builder.addTable(b.rows); break;
      case "essencial":    builder.addBox("★ ESSENCIAL DE PROVA", b.content, C.essencialBg, C.essencialBrd, pbk); break;
      case "atencao":      builder.addBox("⚠ ATENÇÃO",            b.content, C.atencaoBg,   C.atencaoBrd,   pbk); break;
      case "bizu":         builder.addBox("BIZU",                  b.content, C.bizuBg,      C.bizuBrd,      pbk); break;
      case "dica":         builder.addBox("DICA",                  b.content, C.dicaBg,      C.dicaBrd,      pbk); break;
      case "exemplificando": builder.addBox("EXEMPLIFICANDO",      b.content, C.exemploBg,   C.exemploBrd,   pbk); break;
      case "esclarecendo": builder.addBox("ESCLARECENDO",          b.content, C.esclareceBg, C.esclareceBrd, pbk); break;
      case "questao":      builder.addBox("QUESTÃO DE PROVA",      b.content, C.questaoBg,   C.questaoBrd,   pbk); break;
      case "esquema":      builder.addTable(
        // Re-parse ESQUEMA content as table if it has | rows
        b.content.includes("|")
          ? b.content.split("\n")
              .filter(l => l.trim().startsWith("|") && !/^\|[-| :]+\|/.test(l.trim()))
              .map(l => l.split("|").slice(1, -1).map(c => c.trim()))
          : [[b.content]]
      ); break;
    }
  }
}

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
    const auth = getAuth();
    const docsClient = google.docs({ version: "v1", auth });
    const driveClient = google.drive({ version: "v3", auth });

    // 1. Create blank document
    const created = await docsClient.documents.create({
      requestBody: { title: `${lesson?.code ?? ""} — ${lesson?.title ?? ""}` },
    });
    const docId = created.data.documentId!;

    // 2. Parse and reorder blocks
    const allBlocks = parseBlocks(outputText);
    const { topicBlocks, tocHeadings, glossarioBlocks, closingBlocks } = reorderBlocks(allBlocks);

    // 3. Build document
    const builder = new DocBuilder();

    // Cover page — use public image if available
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const coverImageUrl = appUrl ? `${appUrl}/capa-ti-total.png` : undefined;
    builder.addCover(lesson?.code ?? "", lesson?.title ?? "", coverImageUrl);

    // TOC (with page break before)
    if (tocHeadings.length > 0) {
      builder.addTOC(tocHeadings, true);
    }

    // Glossário (with page break before if exists)
    if (glossarioBlocks.length > 0) {
      renderBlocks(builder, glossarioBlocks, true);
    }

    // Main content (with page break before)
    renderBlocks(builder, topicBlocks, true);

    // Closing sections (Essencial Final, Referências)
    if (closingBlocks.length > 0) {
      renderBlocks(builder, closingBlocks, false);
    }

    // 4. Apply all formatting
    const CHUNK = 200;
    for (let i = 0; i < builder.requests.length; i += CHUNK) {
      await docsClient.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests: builder.requests.slice(i, i + CHUNK) },
      });
    }

    // 5. Page size + margins + footer
    const docStyleRes = await docsClient.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            updateDocumentStyle: {
              documentStyle: {
                pageSize: { width: { magnitude: 595, unit: "PT" }, height: { magnitude: 842, unit: "PT" } },
                marginTop:    { magnitude: 70.9, unit: "PT" },
                marginBottom: { magnitude: 70.9, unit: "PT" },
                marginLeft:   { magnitude: 70.9, unit: "PT" },
                marginRight:  { magnitude: 70.9, unit: "PT" },
              },
              fields: "pageSize,marginTop,marginBottom,marginLeft,marginRight",
            },
          },
          { createFooter: { type: "DEFAULT" } },
        ],
      },
    });

    // 6. Add footer text (TI TOTAL | page number)
    const footerReply = docStyleRes.data.replies?.find((r: any) => r.createFooterResponse);
    const footerId = (footerReply as any)?.createFooterResponse?.footerId;
    if (footerId) {
      await docsClient.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { segmentId: footerId, index: 0 },
                text: "TI TOTAL — TI para Concursos",
              },
            },
            {
              updateTextStyle: {
                range: { segmentId: footerId, startIndex: 0, endIndex: 28 },
                textStyle: {
                  bold: true,
                  fontSize: { magnitude: 8, unit: "PT" },
                  foregroundColor: { color: { rgbColor: C.h2bg } },
                  weightedFontFamily: { fontFamily: "Montserrat" },
                },
                fields: "bold,fontSize,foregroundColor,weightedFontFamily",
              },
            },
            {
              updateParagraphStyle: {
                range: { segmentId: footerId, startIndex: 0, endIndex: 28 },
                paragraphStyle: { alignment: "CENTER" },
                fields: "alignment",
              },
            },
          ],
        },
      });
    }

    // 7. Share publicly
    await driveClient.permissions.create({
      fileId: docId,
      requestBody: { role: "writer", type: "anyone" },
    });

    return NextResponse.json({
      url: `https://docs.google.com/document/d/${docId}/edit`,
      docId,
    });

  } catch (error: any) {
    console.error("GET /api/export/gdocs/[stepId]:", error);
    return NextResponse.json({ error: error.message ?? "Erro ao criar Google Doc" }, { status: 500 });
  }
}
