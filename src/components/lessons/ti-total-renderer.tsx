"use client";

import React from "react";

// ─── Inline parser ─────────────────────────────────────────────────────────
function InlineText({ text }: { text: string }) {
  // Parse [[AZUL:...]], [[VERMELHO:...]], **bold**, *italic*
  const re = /\[\[AZUL:(.*?)\]\]|\[\[VERMELHO:(.*?)\]\]|\*\*(.*?)\*\*|\*((?:[^*])+?)\*/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    }
    if (m[1] !== undefined) {
      parts.push(<strong key={i++} className="font-bold text-blue-700">{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      parts.push(<strong key={i++} className="font-bold text-red-600">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      parts.push(<strong key={i++} className="font-semibold text-gray-900">{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      parts.push(<em key={i++} className="italic text-gray-500">{m[4]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
  return <>{parts.length ? parts : text}</>;
}

// ─── Box components ────────────────────────────────────────────────────────
const BOX_STYLES: Record<string, { label: string; bg: string; border: string; labelBg: string; labelText: string }> = {
  essencial:      { label: "★ ESSENCIAL DE PROVA",  bg: "bg-blue-50",    border: "border-blue-200",  labelBg: "bg-blue-800",    labelText: "text-white" },
  atencao:        { label: "⚠ ATENÇÃO",              bg: "bg-yellow-50",  border: "border-yellow-200",labelBg: "bg-yellow-600",  labelText: "text-white" },
  bizu:           { label: "BIZU",                   bg: "bg-green-50",   border: "border-green-200", labelBg: "bg-green-600",   labelText: "text-white" },
  dica:           { label: "DICA",                   bg: "bg-sky-50",     border: "border-sky-200",   labelBg: "bg-sky-600",     labelText: "text-white" },
  exemplificando: { label: "EXEMPLIFICANDO",         bg: "bg-emerald-50", border: "border-emerald-200",labelBg: "bg-emerald-600",labelText: "text-white" },
  esclarecendo:   { label: "ESCLARECENDO",           bg: "bg-purple-50",  border: "border-purple-200",labelBg: "bg-purple-600",  labelText: "text-white" },
  pegadinha:      { label: "🚨 PEGADINHA DE PROVA",  bg: "bg-red-50",     border: "border-red-200",   labelBg: "bg-red-600",     labelText: "text-white" },
  orientacoes:    { label: "ORIENTAÇÕES DA AULA",    bg: "bg-blue-50",    border: "border-blue-200",  labelBg: "bg-blue-700",    labelText: "text-white" },
};

function Box({ type, content }: { type: string; content: string }) {
  const style = BOX_STYLES[type];
  const lines = content.trim().split("\n").filter(l => l.trim());
  return (
    <div className={`rounded-lg border ${style.border} overflow-hidden my-3`}>
      <div className={`${style.labelBg} ${style.labelText} text-[10px] font-bold tracking-wider px-3 py-1.5`}>
        {style.label}
      </div>
      <div className={`${style.bg} px-4 py-3 space-y-1.5`}>
        {lines.map((line, i) => {
          const isBullet = /^[-•]\s/.test(line);
          const text = isBullet ? line.replace(/^[-•]\s+/, "") : line;
          return (
            <div key={i} className={`flex gap-2 text-sm leading-relaxed text-gray-800 ${isBullet ? "items-start" : ""}`}>
              {isBullet && <span className="mt-1 shrink-0 text-gray-400">•</span>}
              <span><InlineText text={text} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionBox({ content }: { content: string }) {
  const lines = content.trim().split("\n");
  let phase: "enunciado" | "resolucao" = "enunciado";
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden my-3">
      <div className="bg-gray-600 text-white text-[10px] font-bold tracking-wider px-3 py-1.5">
        QUESTÃO DE PROVA
      </div>
      <div className="bg-gray-50 px-4 py-3 space-y-1">
        {lines.map((rawLine, i) => {
          const line = rawLine.trim();
          if (!line) return null;

          if (/^Resolução:?/i.test(line)) {
            phase = "resolucao";
            return (
              <p key={i} className="text-xs font-semibold text-gray-600 pt-2 border-t border-gray-200 mt-2">
                Resolução:
              </p>
            );
          }
          if (/^Gabarito:/i.test(line)) {
            return (
              <p key={i} className="text-sm font-bold text-gray-700 pt-1">
                <InlineText text={line} />
              </p>
            );
          }
          if (/^📘/.test(line) || /^Teoria:/i.test(line)) {
            const text = line.replace(/^📘\s*/,"").replace(/^Teoria:\s*/i,"");
            return (
              <p key={i} className="text-xs italic text-blue-700 bg-blue-50 rounded px-2 py-1 mt-1">
                📘 <InlineText text={text} />
              </p>
            );
          }
          if (line.startsWith("↺")) {
            return (
              <p key={i} className="text-xs italic text-red-600">
                <InlineText text={line} />
              </p>
            );
          }
          return (
            <p key={i} className={`text-sm leading-relaxed ${phase === "enunciado" ? "italic text-gray-700" : "text-gray-700"}`}>
              <InlineText text={line} />
            </p>
          );
        })}
      </div>
    </div>
  );
}

function FlowBox({ content }: { content: string }) {
  const raw = content.trim().replace(/\n/g, " → ");
  const parts = raw.split(/\s*[→|]\s*/).map(p => p.trim()).filter(Boolean);
  return (
    <div className="rounded-lg bg-gray-800 px-4 py-3 my-3 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-white">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-blue-400 mx-1">→</span>}
            <span className="bg-gray-700 rounded px-2 py-0.5">{part}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function SchemaTable({ content }: { content: string }) {
  if (!content.includes("|")) {
    const lines = content.trim().split("\n").filter(l => l.trim());
    return (
      <div className="rounded-lg border border-blue-100 overflow-hidden my-3">
        {lines.map((line, i) => (
          <div key={i} className={`px-4 py-2 text-sm ${i === 0 ? "bg-blue-800 text-white font-semibold" : i % 2 === 0 ? "bg-blue-50" : "bg-white"}`}>
            <InlineText text={line} />
          </div>
        ))}
      </div>
    );
  }
  const rows = content.split("\n")
    .filter(l => l.trim().startsWith("|") && !/^\|[-| :]+\|/.test(l.trim()))
    .map(l => l.split("|").slice(1, -1).map(c => c.trim()));
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-blue-100 overflow-hidden my-3">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri === 0 ? "bg-blue-800 text-white" : ri % 2 === 1 ? "bg-blue-50" : "bg-white"}>
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2 ${ri === 0 ? "font-semibold text-xs" : "text-gray-700"} ${ci < row.length - 1 ? "border-r border-blue-100" : ""}`}>
                  <InlineText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main parser and renderer ──────────────────────────────────────────────
const TAG_RE = /\[(ESSENCIAL_DE_PROVA|ATENCAO|BIZU|DICA|EXEMPLIFICANDO|ESCLARECENDO|QUESTAO|ESQUEMA|FLUXO|PEGADINHA|ORIENTACOES_DA_AULA)\]([\s\S]*?)\[\/\1\]/gi;
const TAG_TYPE: Record<string, string> = {
  ESSENCIAL_DE_PROVA: "essencial", ATENCAO: "atencao", BIZU: "bizu", DICA: "dica",
  EXEMPLIFICANDO: "exemplificando", ESCLARECENDO: "esclarecendo", QUESTAO: "questao",
  ESQUEMA: "esquema", FLUXO: "fluxo", PEGADINHA: "pegadinha",
  ORIENTACOES_DA_AULA: "orientacoes",
};

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "para"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "hr" }
  | { kind: "tag"; type: string; content: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  function pushText(chunk: string) {
    for (const raw of chunk.split("\n")) {
      const l = raw.trimEnd();
      if (!l) continue;
      if (l === "---") { blocks.push({ kind: "hr" }); continue; }
      if (/^#{3,4}\s/.test(l)) { blocks.push({ kind: "h3", text: l.replace(/^#{3,4}\s/, "") }); continue; }
      if (l.startsWith("## ")) { blocks.push({ kind: "h2", text: l.slice(3) }); continue; }
      if (l.startsWith("# ")) { blocks.push({ kind: "h1", text: l.slice(2) }); continue; }
      if (/^[-•]\s/.test(l)) { blocks.push({ kind: "bullet", text: l.replace(/^[-•]\s*/, "") }); continue; }
      blocks.push({ kind: "para", text: l.trim() });
    }
  }

  let last = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    blocks.push({ kind: "tag", type: TAG_TYPE[m[1].toUpperCase()] ?? m[1].toLowerCase(), content: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return blocks;
}

// ─── Public component ──────────────────────────────────────────────────────
export function TITotalRenderer({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  // Group consecutive bullet blocks into lists
  const rendered: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];

    if (b.kind === "bullet") {
      const bulletGroup: string[] = [];
      while (i < blocks.length && blocks[i].kind === "bullet") {
        bulletGroup.push((blocks[i] as { kind: "bullet"; text: string }).text);
        i++;
      }
      rendered.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 pl-4">
          {bulletGroup.map((t, bi) => (
            <li key={bi} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
              <span><InlineText text={t} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (b.kind === "h1") {
      rendered.push(
        <h1 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-2 border-b border-gray-200 pb-2">
          <InlineText text={b.text} />
        </h1>
      );
    } else if (b.kind === "h2") {
      rendered.push(
        <h2 key={i} className="text-base font-bold text-white bg-blue-800 rounded-md px-3 py-2 mt-6 mb-3">
          <InlineText text={b.text} />
        </h2>
      );
    } else if (b.kind === "h3") {
      rendered.push(
        <h3 key={i} className="text-sm font-semibold text-blue-700 mt-4 mb-1.5 border-b border-blue-100 pb-1">
          <InlineText text={b.text} />
        </h3>
      );
    } else if (b.kind === "para" && b.text) {
      rendered.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed my-2">
          <InlineText text={b.text} />
        </p>
      );
    } else if (b.kind === "hr") {
      rendered.push(<hr key={i} className="my-4 border-gray-200" />);
    } else if (b.kind === "tag") {
      if (b.type === "questao") {
        rendered.push(<QuestionBox key={i} content={b.content} />);
      } else if (b.type === "esquema") {
        rendered.push(<SchemaTable key={i} content={b.content} />);
      } else if (b.type === "fluxo") {
        rendered.push(<FlowBox key={i} content={b.content} />);
      } else {
        rendered.push(<Box key={i} type={b.type} content={b.content} />);
      }
    }
    i++;
  }

  return <div className="space-y-0.5">{rendered}</div>;
}
