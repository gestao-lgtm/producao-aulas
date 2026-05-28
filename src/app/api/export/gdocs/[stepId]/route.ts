import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

export const maxDuration = 300;

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
  lightGray:   { red: 0.700, green: 0.700, blue: 0.700 },
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
  questaoBg:   { red: 0.976, green: 0.976, blue: 0.976 },
  essencialBrd:{ red: 0.102, green: 0.227, blue: 0.361 },
  atencaoBrd:  { red: 0.769, green: 0.490, blue: 0.055 },
  bizuBrd:     { red: 0.153, green: 0.682, blue: 0.376 },
  dicaBrd:     { red: 0.161, green: 0.502, blue: 0.725 },
  exemploBrd:  { red: 0.118, green: 0.518, blue: 0.286 },
  esclareceBrd:{ red: 0.490, green: 0.235, blue: 0.596 },
  questaoBrd:  { red: 0.237, green: 0.337, blue: 0.451 },
  tocLine:        { red: 0.878, green: 0.906, blue: 0.957 },
  pegadinhaLightBg: { red: 1.000, green: 0.945, blue: 0.945 },
  fluxoBg:         { red: 0.071, green: 0.102, blue: 0.161 },
  orientacoesBg:   { red: 0.945, green: 0.953, blue: 0.973 },
};
type Color = { red: number; green: number; blue: number };

// ─── Preprocess raw AI output to fix common markdown artifacts ────────────────
function preprocessText(text: string): string {
  return text
    .split("\n")
    .map(line => {
      // Fix unbalanced ** bold markers per line
      const boldMarkers = line.match(/\*\*/g) ?? [];
      if (boldMarkers.length % 2 !== 0) {
        line = line.replace(/\*{2,}\s*$/, "").replace(/^\s*\*{2,}/, "");
      }
      // Clean (*term*) → (term)  and  *(term*) → (term)
      line = line.replace(/\(\*([^)]*?)\*?\)/g, "($1)");
      line = line.replace(/\*\(([^)]*?)\*?\)/g, "($1)");
      // Remove orphaned trailing single * not part of a pair
      if ((line.match(/(?<!\*)\*(?!\*)/g) ?? []).length % 2 !== 0) {
        line = line.replace(/\*\s*$/, "");
      }
      return line;
    })
    .join("\n");
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "bullet"; text: string }
  | { type: "para"; text: string }
  | { type: "hr" }
  | { type: "mdtable"; rows: string[][] }
  | { type: "essencial"|"atencao"|"bizu"|"dica"|"exemplificando"|"esclarecendo"|"questao"|"esquema"|"fluxo"|"pegadinha"|"orientacoes"; content: string };

const TAG_RE = /\[(ESSENCIAL_DE_PROVA|ATENCAO|BIZU|DICA|EXEMPLIFICANDO|ESCLARECENDO|QUESTAO|ESQUEMA|FLUXO|PEGADINHA|ORIENTACOES_DA_AULA)\]([\s\S]*?)\[\/\1\]/gi;
const TAG_MAP: Record<string, Block["type"]> = {
  ESSENCIAL_DE_PROVA: "essencial", ATENCAO: "atencao", BIZU: "bizu",
  DICA: "dica", EXEMPLIFICANDO: "exemplificando", ESCLARECENDO: "esclarecendo",
  QUESTAO: "questao", ESQUEMA: "esquema",
  FLUXO: "fluxo", PEGADINHA: "pegadinha", ORIENTACOES_DA_AULA: "orientacoes",
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
      else if (/^[-•]\s/.test(l))   blocks.push({ type: "bullet", text: l.replace(/^[-•]\s*/, "") });
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

// ─── Inline parser: handles **bold**, [[AZUL:]], [[VERMELHO:]] ────────────────
type Seg = { text: string; bold: boolean; italic: boolean; color: Color };

function cleanRaw(text: string): string {
  return text
    .replace(/\*{2,}$/, "")
    .replace(/^\*{2,}/, "")
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
  if (last < text.length) {
    // Strip any remaining orphaned * from plain text
    const remaining = text.slice(last).replace(/(?<!\w)\*(?!\w)/g, "");
    if (remaining) segs.push({ text: remaining, bold: false, italic: false, color: C.body });
  }
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
    if (end <= start) return;
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
      lineSpacing: 120,
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
      indentStart: { magnitude: 10, unit: "PT" },
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
      const cellText = rows[rowIdx].join("   │   ");
      const start = this.index;
      this.insertText(cellText + "\n");
      const end = this.index;
      const bg = isHeader ? C.h2bg : (rowIdx % 2 === 1 ? C.tableBg : C.tableAlt);
      this.stylePara(start, end, {
        spaceBelow: { magnitude: isHeader ? 2 : 1, unit: "PT" },
        spaceAbove: { magnitude: isHeader ? 4 : 0, unit: "PT" },
        indentStart: { magnitude: 8, unit: "PT" },
        indentEnd: { magnitude: 8, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: bg } } },
      }, "spaceBelow,spaceAbove,indentStart,indentEnd,shading");
      this.styleText(start, end - 1, {
        bold: isHeader,
        foregroundColor: { color: { rgbColor: isHeader ? C.white : C.body } },
        fontSize: { magnitude: isHeader ? 10 : 10, unit: "PT" },
        weightedFontFamily: { fontFamily: isHeader ? "Montserrat" : "Arial" },
      }, "bold,foregroundColor,fontSize,weightedFontFamily");
    }
    const sp = this.index;
    this.insertText("\n");
    this.stylePara(sp, this.index, { spaceBelow: { magnitude: 8, unit: "PT" } }, "spaceBelow");
  }

  addBox(label: string, content: string, bg: Color, brdColor: Color, pageBreakBefore = false) {
    const lines = content.trim().split("\n").filter(l => l.trim());

    // Label row
    const labelStart = this.index;
    this.insertText(label + "\n");
    const labelEnd = this.index;
    const labelParaStyle: any = {
      spaceAbove: { magnitude: 10, unit: "PT" },
      spaceBelow: { magnitude: 0, unit: "PT" },
      indentStart: { magnitude: 10, unit: "PT" },
      indentEnd: { magnitude: 10, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: brdColor } } },
    };
    if (pageBreakBefore) labelParaStyle.pageBreakBefore = true;
    this.stylePara(labelStart, labelEnd, labelParaStyle, `spaceAbove,spaceBelow,indentStart,indentEnd,shading${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    this.styleText(labelStart, labelEnd - 1, {
      bold: true, fontSize: { magnitude: 9, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Content lines
    for (const line of lines) {
      const isBullet = /^[-•]\s/.test(line);
      // Only strip bullet prefix chars when line is actually a bullet
      const lineText = isBullet ? line.replace(/^[-•]\s+/, "") : line;
      const segs = parseInline(lineText);
      const lineStart = this.index;
      this.insertText((isBullet ? "• " : "") + segs.map(s => s.text).join("") + "\n");
      const lineEnd = this.index;
      this.stylePara(lineStart, lineEnd, {
        spaceBelow: { magnitude: 3, unit: "PT" },
        spaceAbove: { magnitude: lineStart === labelEnd ? 4 : 0, unit: "PT" },
        indentStart: { magnitude: isBullet ? 22 : 12, unit: "PT" },
        indentEnd: { magnitude: 10, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: bg } } },
      }, "spaceBelow,spaceAbove,indentStart,indentEnd,shading");
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

    // Bottom padding line
    const sp = this.index;
    this.insertText("\n");
    this.stylePara(sp, this.index, {
      spaceBelow: { magnitude: 6, unit: "PT" },
      spaceAbove: { magnitude: 2, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: bg } } },
    }, "spaceBelow,spaceAbove,shading");
  }

  // Special rendering for QUESTÃO blocks with structured sections
  addQuestionBox(content: string, pageBreakBefore = false) {
    const lines = content.trim().split("\n");

    // Box label
    const labelStart = this.index;
    this.insertText("QUESTÃO DE PROVA\n");
    const labelEnd = this.index;
    const labelStyle: any = {
      spaceAbove: { magnitude: 10, unit: "PT" },
      spaceBelow: { magnitude: 0, unit: "PT" },
      indentStart: { magnitude: 10, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.questaoBrd } } },
    };
    if (pageBreakBefore) labelStyle.pageBreakBefore = true;
    this.stylePara(labelStart, labelEnd, labelStyle, `spaceAbove,spaceBelow,indentStart,shading${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    this.styleText(labelStart, labelEnd - 1, {
      bold: true, fontSize: { magnitude: 9, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    let phase: "enunciado" | "resolucao" = "enunciado";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^Resolução:?/i.test(line)) {
        phase = "resolucao";
        const rStart = this.index;
        this.insertText("Resolução:\n");
        const rEnd = this.index;
        this.stylePara(rStart, rEnd, {
          spaceAbove: { magnitude: 5, unit: "PT" },
          spaceBelow: { magnitude: 2, unit: "PT" },
          indentStart: { magnitude: 10, unit: "PT" },
          shading: { backgroundColor: { color: { rgbColor: C.questaoBg } } },
        }, "spaceAbove,spaceBelow,indentStart,shading");
        this.styleText(rStart, rEnd - 1, {
          bold: true, fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: { color: { rgbColor: C.questaoBrd } },
          weightedFontFamily: { fontFamily: "Montserrat" },
        }, "bold,fontSize,foregroundColor,weightedFontFamily");
        continue;
      }

      if (/^Gabarito:/i.test(line)) {
        const gStart = this.index;
        this.insertText(line + "\n");
        const gEnd = this.index;
        this.stylePara(gStart, gEnd, {
          spaceAbove: { magnitude: 4, unit: "PT" },
          spaceBelow: { magnitude: 4, unit: "PT" },
          indentStart: { magnitude: 10, unit: "PT" },
          shading: { backgroundColor: { color: { rgbColor: C.questaoBg } } },
        }, "spaceAbove,spaceBelow,indentStart,shading");
        this.styleText(gStart, gEnd - 1, {
          bold: true, fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: { color: { rgbColor: C.questaoBrd } },
          weightedFontFamily: { fontFamily: "Montserrat" },
        }, "bold,fontSize,foregroundColor,weightedFontFamily");
        continue;
      }

      if (/^📘/.test(line) || /^Teoria:/i.test(line)) {
        const teoriaText = line.replace(/^📘\s*/,"").replace(/^Teoria:\s*/i,"");
        const segs = parseInline(teoriaText);
        const tStart = this.index;
        this.insertText("📘 " + segs.map(s => s.text).join("") + "\n");
        const tEnd = this.index;
        this.stylePara(tStart, tEnd, {
          spaceAbove: { magnitude: 3, unit: "PT" },
          spaceBelow: { magnitude: 2, unit: "PT" },
          indentStart: { magnitude: 10, unit: "PT" },
          shading: { backgroundColor: { color: { rgbColor: C.essencialBg } } },
        }, "spaceAbove,spaceBelow,indentStart,shading");
        this.styleText(tStart, tEnd - 1, {
          bold: false, italic: true, fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: { color: { rgbColor: C.azul } },
          weightedFontFamily: { fontFamily: "Arial" },
        }, "bold,italic,fontSize,foregroundColor,weightedFontFamily");
        continue;
      }

      if (line.startsWith("↺")) {
        const cStart = this.index;
        this.insertText(line + "\n");
        const cEnd = this.index;
        this.stylePara(cStart, cEnd, {
          spaceBelow: { magnitude: 2, unit: "PT" },
          indentStart: { magnitude: 10, unit: "PT" },
          shading: { backgroundColor: { color: { rgbColor: C.questaoBg } } },
        }, "spaceBelow,indentStart,shading");
        this.styleText(cStart, cEnd - 1, {
          bold: false, italic: true, fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: { color: { rgbColor: C.vermelho } },
          weightedFontFamily: { fontFamily: "Arial" },
        }, "bold,italic,fontSize,foregroundColor,weightedFontFamily");
        continue;
      }

      // Normal enunciado or commentary line
      const segs = parseInline(line);
      const lStart = this.index;
      this.insertText(segs.map(s => s.text).join("") + "\n");
      const lEnd = this.index;
      this.stylePara(lStart, lEnd, {
        spaceBelow: { magnitude: 2, unit: "PT" },
        indentStart: { magnitude: 10, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: C.questaoBg } } },
      }, "spaceBelow,indentStart,shading");
      const isEnunciado = phase === "enunciado";
      let pos = lStart;
      for (const seg of segs) {
        if (!seg.text) continue;
        this.styleText(pos, pos + seg.text.length, {
          bold: isEnunciado ? false : seg.bold,
          italic: isEnunciado ? true : seg.italic,
          foregroundColor: { color: { rgbColor: isEnunciado ? C.body : seg.color } },
          fontSize: { magnitude: 10, unit: "PT" },
          weightedFontFamily: { fontFamily: "Arial" },
        }, "bold,italic,foregroundColor,fontSize,weightedFontFamily");
        pos += seg.text.length;
      }
    }

    const sp = this.index;
    this.insertText("\n");
    this.stylePara(sp, this.index, {
      spaceBelow: { magnitude: 8, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.questaoBg } } },
    }, "spaceBelow,shading");
  }

  // Renders a visual process flow: A → B → C → D
  addFlow(content: string) {
    const raw = content.trim().replace(/\n/g, " → ");
    // Split on → or | separators
    const parts = raw.split(/\s*[→|]\s*/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) return;

    const start = this.index;
    const text = parts.join("  →  ") + "\n";
    this.insertText(text);
    const end = this.index;
    this.stylePara(start, end, {
      alignment: "CENTER",
      spaceAbove: { magnitude: 10, unit: "PT" },
      spaceBelow: { magnitude: 10, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.fluxoBg } } },
    }, "alignment,spaceAbove,spaceBelow,shading");
    this.styleText(start, end - 1, {
      bold: true, fontSize: { magnitude: 12, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");
  }

  // Renders the ORIENTAÇÕES DA AULA block (professor's intro note to student)
  addOrientacoes(content: string) {
    const lines = content.trim().split("\n").filter(l => l.trim());

    const labelStart = this.index;
    this.insertText("ORIENTAÇÕES DA AULA\n");
    const labelEnd = this.index;
    this.stylePara(labelStart, labelEnd, {
      spaceAbove: { magnitude: 10, unit: "PT" },
      spaceBelow: { magnitude: 0, unit: "PT" },
      indentStart: { magnitude: 10, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.h2bg } } },
    }, "spaceAbove,spaceBelow,indentStart,shading");
    this.styleText(labelStart, labelEnd - 1, {
      bold: true, fontSize: { magnitude: 9, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    for (const line of lines) {
      const isBullet = /^[-•]\s/.test(line);
      const lineText = isBullet ? line.replace(/^[-•]\s+/, "") : line;
      const segs = parseInline(lineText);
      const lStart = this.index;
      this.insertText((isBullet ? "• " : "") + segs.map(s => s.text).join("") + "\n");
      const lEnd = this.index;
      this.stylePara(lStart, lEnd, {
        spaceBelow: { magnitude: 4, unit: "PT" },
        indentStart: { magnitude: isBullet ? 22 : 12, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: C.orientacoesBg } } },
      }, "spaceBelow,indentStart,shading");
      let pos = lStart + (isBullet ? 2 : 0);
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
    this.stylePara(sp, this.index, {
      spaceBelow: { magnitude: 8, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.orientacoesBg } } },
    }, "spaceBelow,shading");
  }

  addCover(imageUrl?: string) {
    if (imageUrl) {
      // Cover image — fills full content area (A4 minus 70.9pt margins = 453×700pt)
      const imgParaStart = this.index;
      this.requests.push({
        insertInlineImage: {
          location: { index: this.index },
          uri: imageUrl,
          objectSize: {
            width:  { magnitude: 453, unit: "PT" },
            height: { magnitude: 700, unit: "PT" },
          },
        },
      });
      this.index += 1;
      this.insertText("\n");
      this.stylePara(imgParaStart, this.index, {
        spaceAbove: { magnitude: 0, unit: "PT" },
        spaceBelow: { magnitude: 0, unit: "PT" },
        alignment: "CENTER",
      }, "spaceAbove,spaceBelow,alignment");
      return;
    }

    // Fallback: text cover when no image
    const start = this.index;
    this.insertText("\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n");
    this.stylePara(start, this.index, {
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      lineSpacing: 100,
    }, "shading,lineSpacing");

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

    const botStart = this.index;
    this.insertText("\n\n\n\n\n\n\n\n\n\n\n\n");
    this.stylePara(botStart, this.index, {
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "shading");
  }

  // Institutional presentation page (between cover and TOC)
  addPresentationPage(lessonCode: string, lessonTitle: string) {
    // TI TOTAL header — with page break
    const titleStart = this.index;
    this.insertText("TI TOTAL\n");
    const titleEnd = this.index;
    this.stylePara(titleStart, titleEnd, {
      pageBreakBefore: true,
      alignment: "CENTER",
      spaceAbove: { magnitude: 160, unit: "PT" },
      spaceBelow: { magnitude: 6, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "pageBreakBefore,alignment,spaceAbove,spaceBelow,shading");
    this.styleText(titleStart, titleEnd - 1, {
      bold: true, fontSize: { magnitude: 40, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.white } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Tagline
    const tagStart = this.index;
    this.insertText("TI PARA CONCURSOS PÚBLICOS\n");
    const tagEnd = this.index;
    this.stylePara(tagStart, tagEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 50, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(tagStart, tagEnd - 1, {
      bold: false, fontSize: { magnitude: 12, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.coverAccent } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Divider
    const divStart = this.index;
    this.insertText("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    const divEnd = this.index;
    this.stylePara(divStart, divEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 30, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(divStart, divEnd - 1, {
      foregroundColor: { color: { rgbColor: C.coverAccent } },
      fontSize: { magnitude: 12, unit: "PT" },
    }, "foregroundColor,fontSize");

    // Lesson code
    if (lessonCode) {
      const cStart = this.index;
      this.insertText(lessonCode + "\n");
      const cEnd = this.index;
      this.stylePara(cStart, cEnd, {
        alignment: "CENTER",
        spaceBelow: { magnitude: 8, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      }, "alignment,spaceBelow,shading");
      this.styleText(cStart, cEnd - 1, {
        bold: false, fontSize: { magnitude: 11, unit: "PT" },
        foregroundColor: { color: { rgbColor: C.coverAccent } },
        weightedFontFamily: { fontFamily: "Montserrat" },
      }, "bold,fontSize,foregroundColor,weightedFontFamily");
    }

    // Lesson title
    if (lessonTitle) {
      const lStart = this.index;
      this.insertText(lessonTitle + "\n");
      const lEnd = this.index;
      this.stylePara(lStart, lEnd, {
        alignment: "CENTER",
        spaceBelow: { magnitude: 50, unit: "PT" },
        shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      }, "alignment,spaceBelow,shading");
      this.styleText(lStart, lEnd - 1, {
        bold: true, fontSize: { magnitude: 20, unit: "PT" },
        foregroundColor: { color: { rgbColor: C.white } },
        weightedFontFamily: { fontFamily: "Montserrat" },
      }, "bold,fontSize,foregroundColor,weightedFontFamily");
    }

    // Institutional note
    const noteStart = this.index;
    this.insertText("Material Didático Proprietário — Todos os direitos reservados\n");
    const noteEnd = this.index;
    this.stylePara(noteStart, noteEnd, {
      alignment: "CENTER",
      spaceBelow: { magnitude: 0, unit: "PT" },
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
    }, "alignment,spaceBelow,shading");
    this.styleText(noteStart, noteEnd - 1, {
      bold: false, fontSize: { magnitude: 9, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.gray } },
      weightedFontFamily: { fontFamily: "Arial" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    // Fill rest of page
    const fillStart = this.index;
    this.insertText("\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n");
    this.stylePara(fillStart, this.index, {
      shading: { backgroundColor: { color: { rgbColor: C.coverBg } } },
      lineSpacing: 100,
    }, "shading,lineSpacing");
  }

  addTOC(headings: Array<{ level: number; text: string }>, pageBreakBefore = true) {
    const hStart = this.index;
    this.insertText("SUMÁRIO\n");
    const hEnd = this.index;
    const hStyle: any = {
      spaceAbove: { magnitude: 0, unit: "PT" },
      spaceBelow: { magnitude: 18, unit: "PT" },
    };
    if (pageBreakBefore) hStyle.pageBreakBefore = true;
    this.stylePara(hStart, hEnd, hStyle, `spaceAbove,spaceBelow${pageBreakBefore ? ",pageBreakBefore" : ""}`);
    this.styleText(hStart, hEnd - 1, {
      bold: true, fontSize: { magnitude: 22, unit: "PT" },
      foregroundColor: { color: { rgbColor: C.h1bg } },
      weightedFontFamily: { fontFamily: "Montserrat" },
    }, "bold,fontSize,foregroundColor,weightedFontFamily");

    for (const h of headings) {
      const isMain = h.level === 2;
      const isH1 = h.level === 1;
      const start = this.index;
      this.insertText((isMain ? "" : "    ") + h.text + "\n");
      const end = this.index;
      this.stylePara(start, end, {
        spaceBelow: { magnitude: isMain ? 6 : 2, unit: "PT" },
        spaceAbove: { magnitude: isMain ? 4 : 0, unit: "PT" },
        indentStart: { magnitude: isMain ? 0 : 16, unit: "PT" },
      }, "spaceBelow,spaceAbove,indentStart");
      this.styleText(start, end - 1, {
        bold: isMain || isH1,
        fontSize: { magnitude: isMain ? 11 : 10, unit: "PT" },
        foregroundColor: { color: { rgbColor: isMain ? C.h2bg : C.gray } },
        weightedFontFamily: { fontFamily: isMain ? "Montserrat" : "Arial" },
      }, "bold,fontSize,foregroundColor,weightedFontFamily");
    }

    // Spacing after TOC
    const sp = this.index;
    this.insertText("\n");
    this.stylePara(sp, this.index, { spaceBelow: { magnitude: 8, unit: "PT" } }, "spaceBelow");
  }
}

// ─── Reorder blocks ───────────────────────────────────────────────────────────
function reorderBlocks(blocks: Block[]): {
  topicBlocks: Block[];
  tocHeadings: Array<{ level: number; text: string }>;
  glossarioBlocks: Block[];
  essencialFinalBlocks: Block[];
  referenciaBlocks: Block[];
} {
  const CLOSING_KEYWORDS = ["essencial de prova", "glossário", "glossario", "referências", "referencias", "revisão final", "revisao final"];
  const isClosingH2 = (b: Block) =>
    b.type === "h2" && CLOSING_KEYWORDS.some(t => (b as any).text.toLowerCase().includes(t));

  let closingStart = blocks.findIndex(isClosingH2);
  if (closingStart === -1) closingStart = blocks.length;

  const topicBlocks = blocks.slice(0, closingStart);
  const allClosing = blocks.slice(closingStart);

  const glossarioBlocks: Block[] = [];
  const essencialFinalBlocks: Block[] = [];
  const referenciaBlocks: Block[] = [];

  let section: "glossario" | "referencia" | "essencial" | null = null;

  for (const b of allClosing) {
    if (b.type === "h2") {
      const t = (b as any).text.toLowerCase();
      if (t.includes("glossár") || t.includes("glossar")) section = "glossario";
      else if (t.includes("referên") || t.includes("referen")) section = "referencia";
      else section = "essencial";
    }
    if (section === "glossario") glossarioBlocks.push(b);
    else if (section === "referencia") referenciaBlocks.push(b);
    else essencialFinalBlocks.push(b);
  }

  // TOC from all topic headings (not closing sections)
  const tocHeadings: Array<{ level: number; text: string }> = [];
  for (const b of topicBlocks) {
    if (b.type === "h2") tocHeadings.push({ level: 2, text: (b as any).text });
    else if (b.type === "h3") tocHeadings.push({ level: 3, text: (b as any).text });
  }
  // Add closing sections to TOC
  if (essencialFinalBlocks.some(b => b.type === "h2")) {
    const h = essencialFinalBlocks.find(b => b.type === "h2") as any;
    if (h) tocHeadings.push({ level: 2, text: h.text });
  }
  if (referenciaBlocks.some(b => b.type === "h2")) {
    const h = referenciaBlocks.find(b => b.type === "h2") as any;
    if (h) tocHeadings.push({ level: 2, text: h.text });
  }
  if (glossarioBlocks.some(b => b.type === "h2")) {
    const h = glossarioBlocks.find(b => b.type === "h2") as any;
    if (h) tocHeadings.push({ level: 2, text: h.text });
  }

  return { topicBlocks, tocHeadings, glossarioBlocks, essencialFinalBlocks, referenciaBlocks };
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
        const start = builder.index;
        builder.addPara(segs, 4, 0);
        const end = builder.index;
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
      case "essencial":      builder.addBox("★ ESSENCIAL DE PROVA",  b.content, C.essencialBg, C.essencialBrd, pbk); break;
      case "atencao":        builder.addBox("⚠ ATENÇÃO",              b.content, C.atencaoBg,   C.atencaoBrd,   pbk); break;
      case "bizu":           builder.addBox("BIZU",                   b.content, C.bizuBg,      C.bizuBrd,      pbk); break;
      case "dica":           builder.addBox("DICA",                   b.content, C.dicaBg,      C.dicaBrd,      pbk); break;
      case "exemplificando": builder.addBox("EXEMPLIFICANDO",         b.content, C.exemploBg,   C.exemploBrd,   pbk); break;
      case "esclarecendo":   builder.addBox("ESCLARECENDO",           b.content, C.esclareceBg, C.esclareceBrd, pbk); break;
      case "questao":        builder.addQuestionBox(b.content, pbk); break;
      case "fluxo":          builder.addFlow(b.content); break;
      case "pegadinha":      builder.addBox("🚨 PEGADINHA DE PROVA", b.content, C.pegadinhaLightBg, C.vermelho, pbk); break;
      case "orientacoes":    builder.addOrientacoes(b.content); break;
      case "esquema":
        builder.addTable(
          b.content.includes("|")
            ? b.content.split("\n")
                .filter(l => l.trim().startsWith("|") && !/^\|[-| :]+\|/.test(l.trim()))
                .map(l => l.split("|").slice(1, -1).map(c => c.trim()))
            : b.content.split("\n").filter(l => l.trim()).map(l => [l.trim()])
        );
        break;
    }
  }
}

// ─── Upload cover image to Google Drive (cached by filename) ─────────────────
async function getOrUploadCoverImage(driveClient: any): Promise<string | undefined> {
  try {
    const fs = (await import("fs")).default;
    const path = (await import("path")).default;
    const imagePath = path.join(process.cwd(), "public", "capa-ti-total.png");
    if (!fs.existsSync(imagePath)) return undefined;

    const DRIVE_FILE_NAME = "capa-ti-total-producao-aulas.png";

    const search = await driveClient.files.list({
      q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });
    if (search.data.files?.length > 0) {
      const id = search.data.files[0].id;
      return `https://drive.google.com/uc?export=view&id=${id}`;
    }

    const { Readable } = await import("stream");
    const buffer = fs.readFileSync(imagePath);
    const uploaded = await driveClient.files.create({
      requestBody: { name: DRIVE_FILE_NAME, mimeType: "image/png" },
      media: { mimeType: "image/png", body: Readable.from(buffer) },
      fields: "id",
    });
    const fileId = uploaded.data.id!;
    await driveClient.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch (e) {
    console.error("Cover image upload failed:", e);
    return undefined;
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

    // 1. Create document
    const created = await docsClient.documents.create({
      requestBody: { title: `${lesson?.code ?? ""} — ${lesson?.title ?? ""}` },
    });
    const docId = created.data.documentId!;

    // 2. Parse and reorder content
    const cleaned = preprocessText(outputText);
    const allBlocks = parseBlocks(cleaned);
    const { topicBlocks, tocHeadings, glossarioBlocks, essencialFinalBlocks, referenciaBlocks } = reorderBlocks(allBlocks);

    // 3. Build document structure
    const builder = new DocBuilder();

    // Page 1: Cover image only
    const coverImageUrl = await getOrUploadCoverImage(driveClient);
    builder.addCover(coverImageUrl);

    // Page 2: Institutional presentation page
    builder.addPresentationPage(lesson?.code ?? "", lesson?.title ?? "");

    // Page 3: Table of Contents
    if (tocHeadings.length > 0) {
      builder.addTOC(tocHeadings, true);
    }

    // Pages 4+: Main content (topics)
    renderBlocks(builder, topicBlocks, true);

    // Closing: Essencial Final
    if (essencialFinalBlocks.length > 0) {
      renderBlocks(builder, essencialFinalBlocks, false);
    }

    // Closing: Referências
    if (referenciaBlocks.length > 0) {
      renderBlocks(builder, referenciaBlocks, false);
    }

    // Last: Glossário (at end of document, for review/reference)
    if (glossarioBlocks.length > 0) {
      renderBlocks(builder, glossarioBlocks, true);
    }

    // 4. Apply all formatting in chunks
    const CHUNK = 200;
    for (let i = 0; i < builder.requests.length; i += CHUNK) {
      await docsClient.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests: builder.requests.slice(i, i + CHUNK) },
      });
    }

    // 5. Page setup + footer creation
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

    // 6. Footer content (centered TI TOTAL brand)
    const footerReply = docStyleRes.data.replies?.find((r: any) => r.createFooterResponse);
    const footerId = (footerReply as any)?.createFooterResponse?.footerId;
    if (footerId) {
      const footerText = "TI TOTAL — TI para Concursos";
      await docsClient.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { segmentId: footerId, index: 0 },
                text: footerText,
              },
            },
            {
              updateTextStyle: {
                range: { segmentId: footerId, startIndex: 0, endIndex: footerText.length },
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
                range: { segmentId: footerId, startIndex: 0, endIndex: footerText.length },
                paragraphStyle: { alignment: "CENTER" },
                fields: "alignment",
              },
            },
          ],
        },
      });
    }

    // 7. Share document
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
