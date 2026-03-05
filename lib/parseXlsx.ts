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
  const title = getCellValue(ws, 6, 0);

  const approval = {
    rosstat: getCellValue(ws, 1, 1),
    depr: getCellValue(ws, 2, 1),
    ntu: getCellValue(ws, 3, 1),
    dit: getCellValue(ws, 4, 1),
  };

  const card = {
    id: getCellValue(ws, 8, 1),
    abbreviation: getCellValue(ws, 9, 1),
    fillType: getCellValue(ws, 10, 1),
    precondition: getCellValue(ws, 11, 1),
    questionText: getCellValue(ws, 12, 1),
    helpText: getCellValue(ws, 13, 1),
  };

  const controls: ControlRow[] = [];
  let row = 15;
  while (true) {
    const id = getCellValue(ws, row, 0);
    const type = getCellValue(ws, row, 1);
    const conditions = getCellValue(ws, row, 2);
    const strictness = getCellValue(ws, row, 6);
    if (!id && !type && !conditions && !strictness) break;
    if (id === '№ ответа' || id === '№') break;
    controls.push({ id, type, conditions, strictness });
    row++;
  }

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
      const abbreviation = getCellValue(ws, r, 1);
      const type = getCellValue(ws, r, 2);
      const variantType = getCellValue(ws, r, 3);
      const headerText = getCellValue(ws, r, 4);
      const hintText = getCellValue(ws, r, 5);
      const defaultValue = getCellValue(ws, r, 6);
      const code = getCellValue(ws, r, 7);
      const nextId = getCellValue(ws, r, 8);
      if (!number && !type && !headerText) continue;
      answers.push({ number, abbreviation, type, variantType, headerText, hintText, defaultValue, code, nextId });
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

// Сбросить кэш воркбука — используется при синхронизации
export function invalidateCache(): void {
  _workbook = null;
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
