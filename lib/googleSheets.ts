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

export function invalidateCache(): void {
  _sheetCache.clear();
  _sheetNamesCache = null;
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
  _sheetNamesCache = (meta.data.sheets || []).map((s) => s.properties?.title ?? '').filter(Boolean);
  return _sheetNamesCache;
}

async function getSheetValues(sheetName: string): Promise<string[][]> {
  if (_sheetCache.has(sheetName)) return _sheetCache.get(sheetName)!;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:G300`,
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
    rosstat: cell(rows, 1, 1),
    depr: cell(rows, 2, 1),
    ntu: cell(rows, 3, 1),
    dit: cell(rows, 4, 1),
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
    const conditions = cell(rows, r, 2);
    const strictness = cell(rows, r, 6);
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
      const type = cell(rows, i, 1);
      const headerText = cell(rows, i, 2);
      const hintText = cell(rows, i, 3);
      const defaultValue = cell(rows, i, 4);
      const code = cell(rows, i, 5);
      const nextId = cell(rows, i, 6);
      if (!number && !type && !headerText) continue;
      answers.push({ number, type, headerText, hintText, defaultValue, code, nextId });
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

export async function saveQuestion(sheetName: string, data: Partial<Question>): Promise<void> {
  const q = data as Question;
  const sheets = getSheetsClient();

  // Фиксированные ячейки
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `'${sheetName}'!B2`, values: [[q.approval.rosstat]] },
        { range: `'${sheetName}'!B3`, values: [[q.approval.depr]] },
        { range: `'${sheetName}'!B4`, values: [[q.approval.ntu]] },
        { range: `'${sheetName}'!B5`, values: [[q.approval.dit]] },
        { range: `'${sheetName}'!A7`, values: [[q.title]] },
        { range: `'${sheetName}'!B9`,  values: [[q.card.id]] },
        { range: `'${sheetName}'!B10`, values: [[q.card.abbreviation]] },
        { range: `'${sheetName}'!B11`, values: [[q.card.fillType]] },
        { range: `'${sheetName}'!B12`, values: [[q.card.precondition]] },
        { range: `'${sheetName}'!B13`, values: [[q.card.questionText]] },
        { range: `'${sheetName}'!B14`, values: [[q.card.helpText]] },
      ],
    },
  });

  // Очищаем область контролей и ответов (строки 16–300)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A16:G300`,
  });

  // Строим блок: контроли → заголовок ответов → ответы
  const tableRows: string[][] = [];

  for (const ctrl of q.controls) {
    const row = ['', '', '', '', '', '', ''];
    row[0] = ctrl.id;
    row[1] = ctrl.type;
    row[2] = ctrl.conditions;
    row[6] = ctrl.strictness;
    tableRows.push(row);
  }

  // Заголовок таблицы ответов
  tableRows.push(['№ ответа', 'Тип', 'Текст заголовка', 'Текст подсказки', 'Предустановленное значение', 'Код', 'ID следующего вопроса']);

  for (const ans of q.answers) {
    tableRows.push([ans.number, ans.type, ans.headerText, ans.hintText, ans.defaultValue, ans.code, ans.nextId]);
  }

  if (tableRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A16`,
      valueInputOption: 'RAW',
      requestBody: { values: tableRows },
    });
  }

  // Инвалидируем кэш только этого листа
  _sheetCache.delete(sheetName);
}
