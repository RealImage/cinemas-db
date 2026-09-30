import type { ExportCell, ExportTable } from "@/lib/export";
import type { Column } from "./types";

/** A raw value as plain text: arrays joined, dates as ISO, booleans Yes/No. */
function plain(value: unknown): ExportCell {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(plain).filter((v) => v != null && v !== "").join(", ");
  return null; // objects and React elements have no plain-text form
}

/**
 * The table as export rows, one cell per column with a header: the column's exportValue, else its accessor's value
 * (a function accessor only when it returns text or a number).
 */
export function exportTableData<T>(columns: Column<T>[], rows: T[]): ExportTable {
  const exported = columns.filter((c) => c.header);
  const cell = (column: Column<T>, row: T): ExportCell => {
    if (column.exportValue) return column.exportValue(row);
    if (typeof column.accessor !== "function") return plain(row[column.accessor]);
    const value = column.accessor(row);
    return typeof value === "string" || typeof value === "number" ? value : null;
  };
  return {
    headers: exported.map((c) => c.header),
    rows: rows.map((row) => exported.map((c) => cell(c, row))),
  };
}
