import * as XLSX from 'xlsx';

import { addDays, toDateKey } from './date';

export type ImportedChecklist = {
  title: string;
  durationDays: number;
  startDate: string;
  items: Array<{ title: string; description?: string; reminderTime?: string }>;
};

const taskHeaders = ['viec', 'việc', 'noi dung', 'nội dung', 'task', 'title', 'ten viec', 'tên việc'];
const noteHeaders = ['ghi chu', 'ghi chú', 'mo ta', 'mô tả', 'description', 'note'];

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function cleanCell(value: unknown) {
  return String(value ?? '').trim();
}

function numberFromCell(value: unknown) {
  const parsed = Number.parseInt(cleanCell(value).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateFromCell(value: unknown) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return toDateKey(new Date(parsed.y, parsed.m - 1, parsed.d));
  }

  const text = cleanCell(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return undefined;
  return toDateKey(new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
}

function isMetaLabel(label: string) {
  return [
    'ten thu thach',
    'title',
    'thu thach',
    'thoi luong',
    'so ngay',
    'duration',
    'ngay bat dau',
    'start date',
  ].includes(label);
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): ImportedChecklist | undefined {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const nonEmptyRows = rows.filter((row) => row.some((cell) => cleanCell(cell)));
  if (nonEmptyRows.length === 0) return undefined;

  let title = sheetName.trim() || 'Thử thách mới';
  let durationDays = 100;
  let startDate = toDateKey();

  nonEmptyRows.slice(0, 8).forEach((row) => {
    const label = normalize(row[0]);
    if (['ten thu thach', 'title', 'thu thach'].includes(label) && cleanCell(row[1])) {
      title = cleanCell(row[1]);
    }
    if (['thoi luong', 'so ngay', 'duration'].includes(label)) {
      durationDays = numberFromCell(row[1]) ?? durationDays;
    }
    if (['ngay bat dau', 'start date'].includes(label)) {
      startDate = dateFromCell(row[1]) ?? startDate;
    }
  });

  const headerIndex = nonEmptyRows.findIndex((row) =>
    row.some((cell) => taskHeaders.includes(normalize(cell))),
  );
  const headerRow = headerIndex >= 0 ? nonEmptyRows[headerIndex] : [];
  const taskColumn = headerIndex >= 0
    ? Math.max(0, headerRow.findIndex((cell) => taskHeaders.includes(normalize(cell))))
    : 0;
  const noteColumn = headerIndex >= 0
    ? headerRow.findIndex((cell) => noteHeaders.includes(normalize(cell)))
    : 1;
  const dataRows = headerIndex >= 0 ? nonEmptyRows.slice(headerIndex + 1) : nonEmptyRows;

  const items = dataRows
    .map((row) => {
      const firstLabel = normalize(row[0]);
      const title = cleanCell(row[taskColumn]);
      const description = noteColumn >= 0 ? cleanCell(row[noteColumn]) : cleanCell(row[1]);
      return { title, description, firstLabel };
    })
    .filter((item) => item.title && !isMetaLabel(item.firstLabel) && !taskHeaders.includes(item.firstLabel))
    .map(({ title, description }) => ({ title, ...(description ? { description } : {}) }));

  if (items.length === 0) return undefined;

  const safeDuration = Math.min(365, Math.max(1, durationDays));
  return {
    title,
    durationDays: safeDuration,
    startDate,
    items,
  };
}

export function parseExcelWorkbook(workbook: XLSX.WorkBook): ImportedChecklist[] {
  return workbook.SheetNames.map((sheetName) => parseSheet(workbook.Sheets[sheetName], sheetName)).filter(
    (item): item is ImportedChecklist => Boolean(item),
  );
}

export function getImportedEndDate(item: ImportedChecklist) {
  return addDays(item.startDate, item.durationDays - 1);
}
