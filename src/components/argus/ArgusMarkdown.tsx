import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * A small, safe markdown renderer for Argus's replies: paragraphs, headings, bullet and numbered lists, tables,
 * code blocks, and inline bold, italic, code and links. It builds React elements (never HTML strings), so model
 * output can't inject markup. Links starting with / are app routes (router Links); http(s) links open in a new
 * tab; anything else is shown as text.
 */
export function ArgusMarkdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="space-y-2 text-sm leading-6 [overflow-wrap:anywhere]">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

type Block =
  | { type: "p"; text: string }
  | { type: "h"; level: number; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.trim().startsWith("```")) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) body.push(lines[i]);
      i++;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].includes("|") && lines[i].trim(); i++) rows.push(cells(lines[i]));
      blocks.push({ type: "table", head, rows });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const type = /^\s*\d/.test(line) ? "ol" : "ul";
      const items: string[] = [];
      for (; i < lines.length && lines[i].trim(); i++) {
        if (LIST_ITEM.test(lines[i])) items.push(lines[i].replace(LIST_ITEM, ""));
        else if (items.length) items[items.length - 1] += ` ${lines[i].trim()}`; // a wrapped item
      }
      blocks.push({ type, items });
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !LIST_ITEM.test(lines[i]) && !/^#{1,4}\s/.test(lines[i]) && !lines[i].trim().startsWith("```"); i++) {
      para.push(lines[i].trim());
    }
    blocks.push({ type: "p", text: para.join("\n") });
  }
  return blocks;
}

function renderBlock(b: Block, key: number): React.ReactNode {
  const inline = (s: string) => renderInline(s);
  switch (b.type) {
    case "h":
      return <p key={key} className={cn("font-semibold", b.level <= 2 && "text-base")}>{inline(b.text)}</p>;
    case "ul":
    case "ol": {
      const List = b.type;
      return (
        <List key={key} className={cn("space-y-1 pl-5", b.type === "ul" ? "list-disc" : "list-decimal")}>
          {b.items.map((item, i) => <li key={i}>{inline(item)}</li>)}
        </List>
      );
    }
    case "code":
      return <pre key={key} className="overflow-x-auto rounded-md bg-grey-50 p-2 font-mono text-xs leading-5">{b.text}</pre>;
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-xs">
            <thead className="bg-grey-50">
              <tr>{b.head.map((h, i) => <th key={i} className="px-2 py-1.5 font-medium">{inline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r} className="border-t">
                  {b.head.map((_, c) => <td key={c} className="px-2 py-1.5 align-top">{inline(row[c] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p key={key} className="whitespace-pre-line">{inline(b.text)}</p>;
  }
}

/** `code`, **bold**, [text](url), *italic* / _italic_. */
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*?\*|\b_[^_\n]+_\b)/g;

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [token] = m;
    const key = `${at}`;
    if (m[1]) {
      out.push(<code key={key} className="rounded bg-grey-50 px-1 py-0.5 font-mono text-xs">{token.slice(1, -1)}</code>);
    } else if (m[2]) {
      out.push(<strong key={key} className="font-semibold">{renderInline(token.slice(2, -2))}</strong>);
    } else if (m[3]) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      out.push(<MarkdownLink key={key} href={href}>{renderInline(label)}</MarkdownLink>);
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LINK_CLASS = "font-medium text-blue-700 underline-offset-2 hover:underline";

function MarkdownLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return <Link to={href} className={LINK_CLASS}>{children}</Link>;
  }
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{children}</a>;
  }
  return <>{children}</>;
}
