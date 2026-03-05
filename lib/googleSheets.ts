import { google } from 'googleapis';
import path from 'path';
import type { Question, QuestionSummary, ControlRow, AnswerRow } from './types';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '13VyG08Ehnayw1066USuEvpPe31HBBosXHlcnGbllR6o';
const CREDENTIALS_PATH = path.join(
  process.cwd(),
  process.env.GOOGLE_CREDENTIALS_PATH || 'data/service-account.json'
);

// ── Кэш ────────────────────────────────────────────────────────────────────
const _sheetCache = new Map<string, string[][]>();
let _sheetNamesCache: string[] | null = null;
const _sheetIdCache = new Map<string, number>();

export function invalidateCache(): void {
  _sheetCache.clear();
  _sheetNamesCache = null;
  _sheetIdCache.clear();
}

// ── Auth ────────────────────────────────────────────────────────────────────
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ── Внутренние функции ──────────────────────────────────────────────────────
async function getSheetNames(): Promise<string[]> {
  if (_sheetNamesCache) return _sheetNamesCache;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  _sheetNamesCache = [];
  for (const s of meta.data.sheets || []) {
    const title = s.properties?.title ?? '';
    if (title) {
      _sheetNamesCache.push(title);
      _sheetIdCache.set(title, s.properties?.sheetId ?? 0);
    }
  }
  return _sheetNamesCache;
}

async function getSheetValues(sheetName: string): Promise<string[][]> {
  if (_sheetCache.has(sheetName)) return _sheetCache.get(sheetName)!;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:J300`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const values = (res.data.values ?? []) as string[][];
  _sheetCache.set(sheetName, values);
  return values;
}

function cell(rows: string[][], row: number, col: number): string {
  return (rows[row]?.[col] ?? '').toString().trim();
}

// ── Парсинг листа ───────────────────────────────────────────────────────────
// Индексы строк (0-based) соответствуют parseXlsx.ts:
// row 1 = Росстат, row 2 = ДЭПР, row 3 = НТУ, row 4 = ДИТ
// row 6 = title, row 8-13 = card fields
// row 14 = controls header (не трогаем), row 15+ = controls data
// "№ ответа" — заголовок таблицы ответов (переменная позиция)

function parseRows(rows: string[][]): Omit<Question, 'sheetName'> {
  const title = cell(rows, 6, 0);

  const approval = {
    rosstat: cell(rows, 1, 2),
    depr: cell(rows, 2, 2),
    ntu: cell(rows, 3, 2),
    dit: cell(rows, 4, 2),
  };

  const card = {
    id: cell(rows, 8, 1),
    abbreviation: cell(rows, 9, 1),
    fillType: cell(rows, 10, 1),
    precondition: cell(rows, 11, 1),
    questionText: cell(rows, 12, 1),
    helpText: cell(rows, 13, 1),
  };

  const controls: ControlRow[] = [];
  let r = 15;
  while (r < rows.length) {
    const id = cell(rows, r, 0);
    const type = cell(rows, r, 1);
    const conditions = cell(rows, r, 3);
    const strictness = cell(rows, r, 8);
    if (!id && !type && !conditions && !strictness) break;
    if (id === '№ ответа' || id === '№') break;
    controls.push({ id, type, conditions, strictness });
    r++;
  }

  let answersHeaderRow = -1;
  for (let i = 14; i < rows.length; i++) {
    const v = cell(rows, i, 0);
    if (v === '№ ответа' || v === '№') {
      answersHeaderRow = i;
      break;
    }
  }

  const answers: AnswerRow[] = [];
  if (answersHeaderRow >= 0) {
    for (let i = answersHeaderRow + 1; i < rows.length; i++) {
      const number = cell(rows, i, 0);
      const abbreviation = cell(rows, i, 1);
      const type = cell(rows, i, 2);
      const variantType = cell(rows, i, 3);
      const headerText = cell(rows, i, 4);
      const hintText = cell(rows, i, 5);
      const defaultValue = cell(rows, i, 6);
      const code = cell(rows, i, 7);
      const nextId = cell(rows, i, 8);
      if (!number && !type && !headerText) continue;
      answers.push({ number, abbreviation, type, variantType, headerText, hintText, defaultValue, code, nextId });
    }
  }

  return { title, approval, card, controls, answers };
}

// ── Публичное API (аналог parseXlsx.ts) ────────────────────────────────────

export async function getQuestionList(): Promise<QuestionSummary[]> {
  const sheetNames = await getSheetNames();
  const sheets = getSheetsClient();

  // Получаем A7 (title) для всех листов за один batchGet
  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: sheetNames.map((name) => `'${name}'!A7`),
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const valueRanges = batchRes.data.valueRanges ?? [];
  return sheetNames.map((sheetName, i) => {
    const title = (valueRanges[i]?.values?.[0]?.[0] as string | undefined) ?? sheetName;
    return { sheetName, title, hasChanges: false };
  });
}

export async function getQuestion(sheetName: string): Promise<Question | null> {
  const sheetNames = await getSheetNames();
  if (!sheetNames.includes(sheetName)) return null;

  const rows = await getSheetValues(sheetName);
  const base = parseRows(rows);
  return { sheetName, ...base };
}

const RED_BG  = { red: 0.957, green: 0.800, blue: 0.800 }; // #F4CCCC
const GREEN_BG = { red: 0.851, green: 0.918, blue: 0.827 }; // #D9EAD3

export async function saveQuestion(sheetName: string, current: Question): Promise<void> {
  const sheets = getSheetsClient();

  // Читаем текущее состояние прямо из кэша (он заполнился при loadQuestion)
  // Это единственный надёжный источник "до изменений"
  const savedRows = await getSheetValues(sheetName);
  const savedState = parseRows(savedRows);

  await getSheetNames(); // убеждаемся что sheetId закэширован
  const sheetId = _sheetIdCache.get(sheetName) ?? 0;

  const approvalKeys = ['rosstat', 'depr', 'ntu', 'dit'] as const;
  const approvalRanges = ['C2', 'C3', 'C4', 'C5'];
  const cardKeys = ['id', 'abbreviation', 'fillType', 'precondition', 'questionText', 'helpText'] as const;
  const cardRanges = ['B9', 'B10', 'B11', 'B12', 'B13', 'B14'];

  // ── 1. Только изменённые фиксированные ячейки ───────────────────────────
  const valueUpdates: { range: string; values: string[][] }[] = [];

  if (current.title !== savedState.title) {
    valueUpdates.push({ range: `'${sheetName}'!A7`, values: [[current.title]] });
  }

  approvalKeys.forEach((key, i) => {
    if (current.approval[key] !== savedState.approval[key]) {
      valueUpdates.push({ range: `'${sheetName}'!${approvalRanges[i]}`, values: [[current.approval[key]]] });
    }
  });

  cardKeys.forEach((key, i) => {
    if (current.card[key] !== savedState.card[key]) {
      valueUpdates.push({ range: `'${sheetName}'!${cardRanges[i]}`, values: [[current.card[key]]] });
    }
  });

  if (valueUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: valueUpdates },
    });
  }

  // ── 2. Таблицы контролей и ответов (если изменились) ────────────────────
  const controlsChanged = JSON.stringify(current.controls) !== JSON.stringify(savedState.controls);
  const answersChanged  = JSON.stringify(current.answers)  !== JSON.stringify(savedState.answers);

  if (controlsChanged || answersChanged) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A16:J300`,
    });

    const tableRows: string[][] = [];

    for (const ctrl of current.controls) {
      const row = ['', '', '', '', '', '', '', '', ''];
      row[0] = ctrl.id;
      row[1] = ctrl.type;
      row[3] = ctrl.conditions;
      row[8] = ctrl.strictness;
      tableRows.push(row);
    }

    tableRows.push(['№ ответа', 'Аббревиатура ответа', 'Тип ответа', 'Тип варианта ответа', 'Текст заголовка ответа', 'Текст подсказки ответа', 'Предустановленное значение', 'Код ответа', 'Переход на id']);

    for (const ans of current.answers) {
      tableRows.push([ans.number, ans.abbreviation, ans.type, ans.variantType, ans.headerText, ans.hintText, ans.defaultValue, ans.code, ans.nextId]);
    }

    if (tableRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A16`,
        valueInputOption: 'RAW',
        requestBody: { values: tableRows },
      });
    }
  }

  // ── 3. Цвет B2:C5 — только для изменившихся строк утверждения ────────────
  const colorRequests = approvalKeys
    .filter((key) => current.approval[key] !== savedState.approval[key])
    .map((key) => {
      const i = approvalKeys.indexOf(key);
      return {
        repeatCell: {
          range: { sheetId, startRowIndex: i + 1, endRowIndex: i + 2, startColumnIndex: 1, endColumnIndex: 3 },
          cell: { userEnteredFormat: { backgroundColor: current.approval[key] === 'Да' ? GREEN_BG : RED_BG } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      };
    });

  if (colorRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: colorRequests },
    });
  }

  // Инвалидируем кэш этого листа — следующий read подтянет свежие данные
  _sheetCache.delete(sheetName);
}
