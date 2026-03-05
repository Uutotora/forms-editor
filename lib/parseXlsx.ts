import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import type { Question, QuestionSummary, ControlRow, AnswerRow } from './types';

const FILE_PATH = path.join(process.cwd(), 'data', 'questions.xlsx');
const OVERRIDES_PATH = path.join(process.cwd(), 'data', 'overrides.json');

function getCellValue(ws: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (!cell || cell.v === undefined || cell.v === null) return '';
  return String(cell.v).trim();
}

function parseSheet(ws: XLSX.WorkSheet): Omit<Question, 'sheetName'> {
  // Title at row 6, col 0
  const title = getCellValue(ws, 6, 0);

  // Approval rows 1-4, col 0 (label) and col 1 (value)
  const approval = {
    rosstat: getCellValue(ws, 1, 1),
    depr: getCellValue(ws, 2, 1),
    ntu: getCellValue(ws, 3, 1),
    dit: getCellValue(ws, 4, 1),
  };

  // Card fields rows 8-13, col 0 (label) and col 1 (value)
  const card = {
    id: getCellValue(ws, 8, 1),
    abbreviation: getCellValue(ws, 9, 1),
    fillType: getCellValue(ws, 10, 1),
    precondition: getCellValue(ws, 11, 1),
    questionText: getCellValue(ws, 12, 1),
    helpText: getCellValue(ws, 13, 1),
  };

  // Controls table: row 14 = headers, rows 15+ = data (until next section or empty)
  const controls: ControlRow[] = [];
  let row = 15;
  while (true) {
    const id = getCellValue(ws, row, 0);
    const type = getCellValue(ws, row, 1);
    const conditions = getCellValue(ws, row, 2);
    const strictness = getCellValue(ws, row, 6);
    if (!id && !type && !conditions && !strictness) break;
    // Check if this row looks like a new section header (answers header)
    if (id === '№ ответа' || id === '№') break;
    controls.push({ id, type, conditions, strictness });
    row++;
  }

  // Answers table: find header row dynamically
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  let answersHeaderRow = -1;
  for (let r = 14; r <= range.e.r; r++) {
    const v = getCellValue(ws, r, 0);
    if (v === '№ ответа' || v === '№') {
      answersHeaderRow = r;
      break;
    }
  }

  const answers: AnswerRow[] = [];
  if (answersHeaderRow >= 0) {
    for (let r = answersHeaderRow + 1; r <= range.e.r; r++) {
      const number = getCellValue(ws, r, 0);
      const type = getCellValue(ws, r, 1);
      const headerText = getCellValue(ws, r, 2);
      const hintText = getCellValue(ws, r, 3);
      const defaultValue = getCellValue(ws, r, 4);
      const code = getCellValue(ws, r, 5);
      const nextId = getCellValue(ws, r, 6);
      if (!number && !type && !headerText) continue;
      answers.push({ number, type, headerText, hintText, defaultValue, code, nextId });
    }
  }

  return { title, approval, card, controls, answers };
}

function loadOverrides(): Record<string, Partial<Question>> {
  try {
    if (fs.existsSync(OVERRIDES_PATH)) {
      return JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

export function saveOverrides(overrides: Record<string, Partial<Question>>): void {
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2), 'utf-8');
}

let _workbook: XLSX.WorkBook | null = null;
function getWorkbook(): XLSX.WorkBook {
  if (!_workbook) {
    _workbook = XLSX.readFile(FILE_PATH);
  }
  return _workbook;
}

export function getQuestionList(): QuestionSummary[] {
  const wb = getWorkbook();
  const overrides = loadOverrides();
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const title = getCellValue(ws, 6, 0);
    return {
      sheetName,
      title: title || sheetName,
      hasChanges: !!overrides[sheetName],
    };
  });
}

export function getQuestion(sheetName: string): Question | null {
  const wb = getWorkbook();
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;

  const base = parseSheet(ws);
  const overrides = loadOverrides();
  const override = overrides[sheetName] || {};

  return {
    sheetName,
    ...base,
    ...override,
    approval: { ...base.approval, ...(override.approval || {}) },
    card: { ...base.card, ...(override.card || {}) },
    controls: override.controls ?? base.controls,
    answers: override.answers ?? base.answers,
  };
}

export function saveQuestion(sheetName: string, data: Partial<Question>): void {
  const overrides = loadOverrides();
  overrides[sheetName] = data;
  saveOverrides(overrides);
}
