// CSV exports: building the file and handing it to the browser.

import { localISODate } from "./dates.js";

// Excel and Google Sheets run a cell that starts with = + - @ (or a tab or
// carriage return) as a formula. Names and notes come from the public shop, so
// such cells get a leading apostrophe. Plain numbers like -120 are left alone.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

// Byte order mark: tells Excel the file is UTF-8 (Arabic names, em dashes).
const BOM = String.fromCharCode(0xfeff);

function cell(value) {
  let text = String(value ?? "");
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV text for an array of same-shaped objects, with a BOM so Excel reads it as UTF-8. */
export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return `${BOM}${[cols.join(","), ...rows.map((row) => cols.map((col) => cell(row[col])).join(","))].join("\n")}`;
}

/** "orders" → "orders-2026-11-07.csv" (today, local time). */
export const datedFileName = (name) => `${name}-${localISODate()}.csv`;

/** Hand a Blob to the browser as a download. */
export function saveFile(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking straight away can cancel the download in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download `rows` as name-YYYY-MM-DD.csv. Does nothing for an empty list. */
export function downloadCsv(name, rows) {
  if (!rows.length) return;
  saveFile(
    datedFileName(name),
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
}
