/** Table export: CSV and Excel (.xlsx) files built in the browser, with no spreadsheet library. */

export type ExportFormat = "csv" | "xlsx";
export type ExportCell = string | number | null;
export interface ExportTable {
  headers: string[];
  rows: ExportCell[][];
}

const MIME: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180 CSV (CRLF line ends, fields quoted when needed), with a UTF-8 BOM so Excel reads accents correctly. */
export function toCsv({ headers, rows }: ExportTable): string {
  const field = (v: ExportCell) => {
    // Text that a spreadsheet would run as a formula gets a leading apostrophe; real numbers are left alone
    const raw = v == null ? "" : String(v);
    const s = typeof v === "string" && /^[=+\-@\t\r]/.test(raw) && !/^-?\d/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// XLSX: one worksheet of inline strings and numbers, zipped by hand
// ---------------------------------------------------------------------------

// Characters XML 1.0 doesn't allow, even escaped
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const xml = (s: string) =>
  s.replace(INVALID_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Spreadsheet column letters: 0 → A, 25 → Z, 26 → AA. */
const columnName = (i: number): string => (i < 26 ? "" : columnName(Math.floor(i / 26) - 1)) + String.fromCharCode(65 + (i % 26));

function sheetXml({ headers, rows }: ExportTable) {
  const row = (cells: ExportCell[], r: number, style: string) =>
    `<row r="${r}">${cells.map((v, i) => {
      const ref = `${columnName(i)}${r}`;
      if (v == null || v === "") return "";
      if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
    }).join("")}</row>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Keep the header row in view while scrolling
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetData>${row(headers, 1, ' s="1"')}${rows.map((r, i) => row(r, i + 2, "")).join("")}</sheetData></worksheet>`;
}

/** The package parts of a one-sheet workbook; the header row is bold (style 1). */
function workbookParts(table: ExportTable, sheetName: string): [string, string][] {
  const name = xml(sheetName.replace(/[[\]:*?/\\\s]+/g, " ").trim().slice(0, 31) || "Sheet1");
  return [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml", sheetXml(table)],
  ];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Raw DEFLATE via the browser's CompressionStream, or null where it isn't available (the entry is then stored). */
async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/** A ZIP archive of the given files (names are ASCII, so no UTF-8 flag is needed). */
async function zip(files: [name: string, content: string][]): Promise<Blob> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const data = encoder.encode(content);
    const nameBytes = encoder.encode(name);
    const packed = await deflate(data);
    const [method, body] = packed ? [8, packed] : [0, data];
    const crc = crc32(data);
    // Fields shared by the local header and the central directory entry: version, flags, method, time, date, crc, sizes
    const common = (view: DataView, at: number) => {
      view.setUint16(at, 20, true);
      view.setUint16(at + 2, 0, true);
      view.setUint16(at + 4, method, true);
      view.setUint16(at + 6, 0, true);
      view.setUint16(at + 8, 0x21, true); // 1980-01-01
      view.setUint32(at + 10, crc, true);
      view.setUint32(at + 14, body.length, true);
      view.setUint32(at + 18, data.length, true);
      view.setUint16(at + 22, nameBytes.length, true);
    };
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    common(lv, 4);
    local.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    common(cv, 6);
    cv.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    chunks.push(local, body);
    central.push(entry);
    offset += local.length + body.length;
  }
  const size = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end] as BlobPart[], { type: MIME.xlsx });
}

/** A one-sheet Excel workbook with a bold, frozen header row. */
export const toXlsx = (table: ExportTable, sheetName = "Sheet1") => zip(workbookParts(table, sheetName));

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/** e.g. "theatres-2026-09-30.csv" (the local date). */
export function exportFileName(name: string | undefined, format: ExportFormat, now = new Date()) {
  const slug = (name ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${slug}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${format}`;
}

/** Build the file and hand it to the browser as a download. */
export async function downloadTable(table: ExportTable, format: ExportFormat, name?: string) {
  const blob = format === "csv" ? new Blob([toCsv(table)], { type: MIME.csv }) : await toXlsx(table, name || "Sheet1");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(name, format);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the URL goes away
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
