import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

// ─── Google auth via service account ─────────────────────────────────────────
function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

// ─── Brand colors (hex without #) ────────────────────────────────────────────
const C = {
  h1bg:        { r: 0.102, g: 0.227, b: 0.361 }, // #1A3A5C
  h2bg:        { r: 0.102, g: 0.310, b: 0.541 }, // #1A4F8A
  h3:          { r: 0.173, g: 0.435, b: 0.675 }, // #2C6FAC
  white:       { r: 1,     g: 1,     b: 1     },
  body:        { r: 0.102, g: 0.125, b: 0.173 }, // #1A202C
  azul:        { r: 0.102, g: 0.310, b: 0.541 }, // #1A4F8A
  vermelho:    { r: 0.753, g: 0.224, b: 0.169 }, // #C0392B
  gray:        { r: 0.443, g: 0.502, b: 0.588 },
  ruleBg:      { r: 0.816, g: 0.863, b: 0.941 }, // #D0DCF0
  // Box backgrounds
  essencialBg: { r: 0.910, g: 0.941, b: 0.984 },
  atencaoBg:   { r: 1.000, g: 0.973, b: 0.902 },
  bizuBg:      { r: 0.918, g: 0.957, b: 0.918 },
  dicaBg:      { r: 0.918, g: 0.957, b: 0.984 },
  exemploBg:   { r: 0.941, g: 0.980, b: 0.957 },
  esclareceBg: { r: 0.957, g: 0.941, b: 0.984 },
  questaoBg:   { r: 0.980, g: 0.980, b: 0.980 },
  // Box border left colors
  essencialBrd:{ r: 0.102, g: 0.227, b: 0.361 },
  atencaoBrd:  { r: 0.769, g: 0.490, b: 0.055 },
  bizuBrd:     { r: 0.153, g: 0.682, b: 0.376 },
  dicaBrd:     { r: 0.161, g: 0.502, b: 0.725 },
  exemploBrd:  { r: 0.118, g: 0.518, b: 0.286 },
  esclareceBrd:{ r: 0.490, g: 0.235, b: 0.596 },
  questaoBrd:  { r: 0.337, g: 0.396, b: 0.451 },
};

type Color = { r: number; g: number; b: number };

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

// ─── Inline segment parser ────────────────────────────────────────────────────
type Seg = { text: string; bold: boolean; color: Color };
function parseInline(text: string): Seg[] {
  const segs: Seg[] = [];
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false, color: C.body });
    if      (m[1] !== undefined) segs.push({ text: m[1], bold: true, color: C.azul });
    else if (m[2] !== undefined) segs.push({ text: m[2], bold: true, color: C.vermelho });
    else if (m[3] !== undefined) segs.push({ text: m[3], bold: true, color: C.body });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), bold: false, color: C.body });
  return segs.length ? segs : [{ text, bold: false, color: C.body }];
}

// ─── Google Docs request builder ─────────────────────────────────────────────
type Request = Record<string, unknown>;

class DocBuilder {
  requests: Request[] = [];
  index = 1; // current end of document

  insertText(text: string) {
    this.requests.push({ insertText: { location: { index: this.index }, text } });
    this.index += text.length;
  }

  styleText(startOffset: number, length: number, style: Record<string, unknown>, fields: string) {
    if (length <= 0) return;
    this.requests.push({
      updateTextStyle: {
        range: { startIndex: this.index - length - startOffset, endIndex: this.index - startOffset },
        textStyle: style,
        fields,
      },
    });
  }

  styleParagraph(startIndex: number, endIndex: number, style: Record<string, unknown>, fields: string) {
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: style,
        fields,
      },
    });
  }

  // Insert a paragraph with inline segments
  addPara(segs: Seg[], namedStyle = "NORMAL_TEXT", spaceAfter = 6, spaceBefore = 0) {
    const start = this.index;
    const fullText = segs.map(s => s.text).join("") + "\n";
    this.insertText(fullText);
    const end = this.index;

    // Style whole paragraph
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          namedStyleType: namedStyle,
          spaceAbove: { magnitude: spaceBefore, unit: "PT" },
          spaceBelow: { magnitude: spaceAfter, unit: "PT" },
          lineSpacing: 115,
        },
        fields: "namedStyleType,spaceAbove,spaceBelow,lineSpacing",
      },
    });

    // Style inline segments
    let pos = start;
    for (const seg of segs) {
      if (!seg.text) continue;
      const len = seg.text.length;
      if (seg.bold || seg.color !== C.body) {
        this.requests.push({
          updateTextStyle: {
            range: { startIndex: pos, endIndex: pos + len },
            textStyle: {
              bold: seg.bold,
              foregroundColor: { color: { rgbColor: seg.color } },
              fontSize: { magnitude: 11, unit: "PT" },
              weightedFontFamily: { fontFamily: "Arial" },
            },
            fields: "bold,foregroundColor,fontSize,weightedFontFamily",
          },
        });
      }
      pos += len;
    }
    return { start, end };
  }

  // Heading with blue banner (table cell with background)
  addBanner(text: string, bg: Color, fontSize: number, spaceAbove = 12) {
    const start = this.index;
    this.insertText(text.toUpperCase() + "\n");
    const end = this.index;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: {
          spaceAbove: { magnitude: spaceAbove, unit: "PT" },
          spaceBelow: { magnitude: 8, unit: "PT" },
          indentStart: { magnitude: 8, unit: "PT" },
          indentEnd: { magnitude: 4, unit: "PT" },
          shading: { backgroundColor: { color: { rgbColor: bg } } },
        },
        fields: "spaceAbove,spaceBelow,indentStart,indentEnd,shading",
      },
    });
    this.requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end - 1 },
        textStyle: {
          bold: true,
          fontSize: { magnitude: fontSize, unit: "PT" },
          foregroundColor: { color: { rgbColor: C.white } },
          weightedFontFamily: { fontFamily: "Montserrat" },
        },
        fields: "bold,fontSize,foregroundColor,weightedFontFamily",
      },
    });
  }

  // H3 subheading
  addH3(text: string) {
    const start = this.index;
    this.insertText(text + "\n");
    const end = this.index;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { spaceAbove: { magnitude: 10, unit: "PT" }, spaceBelow: { magnitude: 4, unit: "PT" } },
        fields: "spaceAbove,spaceBelow",
      },
    });
    this.requests.push({
      updateTextStyle: {
        range: { startIndex: start, endIndex: end - 1 },
        textStyle: {
          bold: true,
          fontSize: { magnitude: 12, unit: "PT" },
          foregroundColor: { color: { rgbColor: C.h3 } },
          weightedFontFamily: { fontFamily: "Montserrat" },
        },
        fields: "bold,fontSize,foregroundColor,weightedFontFamily",
      },
    });
  }

  // Box (colored background + label)
  addBox(label: string, content: string, bg: Color, brdColor: Color) {
    const lines = content.trim().split("\n").filter(l => l.trim());

    // Label line
    const labelStart = this.index;
    this.insertText(label + "\n");
    const labelEnd = this.index;
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: labelStart, endIndex: labelEnd },
        paragraphStyle: {
          spaceAbove: { magnitude: 6, unit: "PT" },
          spaceBelow: { magnitude: 2, unit: "PT" },
          indentStart: { magnitude: 10, unit: "PT" },
          shading: { backgroundColor: { color: { rgbColor: bg } } },
        },
        fields: "spaceAbove,spaceBelow,indentStart,shading",
      },
    });
    this.requests.push({
      updateTextStyle: {
        range: { startIndex: labelStart, endIndex: labelEnd - 1 },
        textStyle: {
          bold: true,
          fontSize: { magnitude: 9, unit: "PT" },
          foregroundColor: { color: { rgbColor: brdColor } },
          weightedFontFamily: { fontFamily: "Montserrat" },
        },
        fields: "bold,fontSize,foregroundColor,weightedFontFamily",
      },
    });

    // Content lines
    for (const line of lines) {
      const isBullet = /^[-•*]\s/.test(line);
      const text = line.replace(/^[-•*]\s*/, "");
      const segs = parseInline(text);
      const lineStart = this.index;
      const fullText = (isBullet ? "• " : "") + segs.map(s => s.text).join("") + "\n";
      this.insertText(fullText);
      const lineEnd = this.index;

      this.requests.push({
        updateParagraphStyle: {
          range: { startIndex: lineStart, endIndex: lineEnd },
          paragraphStyle: {
            spaceBelow: { magnitude: 2, unit: "PT" },
            indentStart: { magnitude: isBullet ? 20 : 10, unit: "PT" },
            shading: { backgroundColor: { color: { rgbColor: bg } } },
          },
          fields: "spaceBelow,indentStart,shading",
        },
      });

      // Style inline segments
      let pos = lineStart + (isBullet ? 2 : 0);
      for (const seg of segs) {
        if (!seg.text) continue;
        this.requests.push({
          updateTextStyle: {
            range: { startIndex: pos, endIndex: pos + seg.text.length },
            textStyle: {
              bold: seg.bold,
              foregroundColor: { color: { rgbColor: seg.color } },
              fontSize: { magnitude: 11, unit: "PT" },
              weightedFontFamily: { fontFamily: "Arial" },
            },
            fields: "bold,foregroundColor,fontSize,weightedFontFamily",
          },
        });
        pos += seg.text.length;
      }
    }

    // Closing spacer
    const spStart = this.index;
    this.insertText("\n");
    this.requests.push({
      updateParagraphStyle: {
        range: { startIndex: spStart, endIndex: this.index },
        paragraphStyle: { spaceBelow: { magnitude: 6, unit: "PT" } },
        fields: "spaceBelow",
      },
    });
  }
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
    const auth = getAuth();
    const docsClient = google.docs({ version: "v1", auth });
    const driveClient = google.drive({ version: "v3", auth });

    // 1. Create blank document
    const created = await docsClient.documents.create({
      requestBody: { title: `${lesson?.code ?? "Teoria"} — ${lesson?.title ?? ""}` },
    });
    const docId = created.data.documentId!;

    // 2. Build content requests
    const builder = new DocBuilder();
    const blocks = parseBlocks(outputText);

    for (const b of blocks) {
      switch (b.type) {
        case "h1":
          builder.addBanner(b.text, C.h1bg, 16, 16);
          break;
        case "h2":
          builder.addBanner(b.text, C.h2bg, 13, 12);
          break;
        case "h3":
          builder.addH3(b.text);
          break;
        case "bullet": {
          const segs = parseInline(b.text);
          builder.addPara(segs);
          // Convert to Google Docs bullet list
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
        case "para":
          if (b.text) builder.addPara(parseInline(b.text));
          break;
        case "hr": {
          const start = builder.index;
          builder.insertText("\n");
          builder.requests.push({
            updateParagraphStyle: {
              range: { startIndex: start, endIndex: builder.index },
              paragraphStyle: {
                borderBottom: {
                  color: { color: { rgbColor: C.ruleBg } },
                  width: { magnitude: 1, unit: "PT" },
                  dashStyle: "SOLID",
                  padding: { magnitude: 2, unit: "PT" },
                },
                spaceAbove: { magnitude: 4, unit: "PT" },
                spaceBelow: { magnitude: 4, unit: "PT" },
              },
              fields: "borderBottom,spaceAbove,spaceBelow",
            },
          });
          break;
        }
        case "mdtable": {
          // Insert as plain text table representation (Docs API tables are complex)
          for (const row of b.rows) {
            const isHeader = b.rows.indexOf(row) === 0;
            const line = row.join("  |  ");
            const start = builder.index;
            builder.insertText(line + "\n");
            const end = builder.index;
            if (isHeader) {
              builder.requests.push({
                updateTextStyle: {
                  range: { startIndex: start, endIndex: end - 1 },
                  textStyle: {
                    bold: true,
                    foregroundColor: { color: { rgbColor: C.h2bg } },
                    fontSize: { magnitude: 11, unit: "PT" },
                  },
                  fields: "bold,foregroundColor,fontSize",
                },
              });
            }
          }
          break;
        }
        case "essencial":   builder.addBox("★ ESSENCIAL DE PROVA", b.content, C.essencialBg, C.essencialBrd); break;
        case "atencao":     builder.addBox("⚠ ATENÇÃO",            b.content, C.atencaoBg,   C.atencaoBrd);   break;
        case "bizu":        builder.addBox("BIZU",                  b.content, C.bizuBg,      C.bizuBrd);      break;
        case "dica":        builder.addBox("DICA",                  b.content, C.dicaBg,      C.dicaBrd);      break;
        case "exemplificando": builder.addBox("EXEMPLIFICANDO",     b.content, C.exemploBg,   C.exemploBrd);   break;
        case "esclarecendo":   builder.addBox("ESCLARECENDO",       b.content, C.esclareceBg, C.esclareceBrd); break;
        case "questao":     builder.addBox("QUESTÃO DE PROVA",      b.content, C.questaoBg,   C.questaoBrd);   break;
        case "esquema":     builder.addBox("ESQUEMA",               b.content, C.essencialBg, C.essencialBrd); break;
      }
    }

    // 3. Apply all formatting in one batchUpdate
    if (builder.requests.length > 0) {
      // Split into chunks of 200 requests (API limit)
      const CHUNK = 200;
      for (let i = 0; i < builder.requests.length; i += CHUNK) {
        await docsClient.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: builder.requests.slice(i, i + CHUNK) },
        });
      }
    }

    // 4. Set page margins (A4, 2.5cm)
    await docsClient.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          updateDocumentStyle: {
            documentStyle: {
              pageSize: { width: { magnitude: 595, unit: "PT" }, height: { magnitude: 842, unit: "PT" } },
              marginTop:    { magnitude: 70.9, unit: "PT" }, // ~2.5cm
              marginBottom: { magnitude: 70.9, unit: "PT" },
              marginLeft:   { magnitude: 70.9, unit: "PT" },
              marginRight:  { magnitude: 70.9, unit: "PT" },
            },
            fields: "pageSize,marginTop,marginBottom,marginLeft,marginRight",
          },
        }],
      },
    });

    // 5. Make document accessible via link
    await driveClient.permissions.create({
      fileId: docId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    return NextResponse.json({ url: docUrl, docId });

  } catch (error: any) {
    console.error("GET /api/export/gdocs/[stepId]:", error);
    return NextResponse.json({ error: error.message ?? "Erro ao criar Google Doc" }, { status: 500 });
  }
}
