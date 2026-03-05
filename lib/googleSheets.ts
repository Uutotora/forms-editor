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

// Вспомогательная функция: парсим данные листа из gridData API
function extractRowsFromGridData(s: { data?: Array<{ rowData?: Array<{ values?: Array<{ formattedValue?: string | null }> }> }> }): string[][] {
  const rows: string[][] = [];
  for (const gridData of s.data ?? []) {
    for (const rowData of (gridData.rowData ?? []).slice(0, 300)) {
      rows.push(
        (rowData.values ?? []).slice(0, 10).map((c) => (c.formattedValue ?? '').toString())
      );
    }
  }
  return rows;
}

async function getSheetValues(sheetName: string): Promise<string[][]> {
  if (_sheetCache.has(sheetName)) return _sheetCache.get(sheetName)!;
  const sheets = getSheetsClient();
  let values: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1:J300`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    values = (res.data.values ?? []) as string[][];
  } catch {
    // Fallback: листы с точками/спецсимволами ломают парсер диапазонов Google Sheets.
    // Используем spreadsheets.get с includeGridData, ограничивая данные диапазоном A1:J300
    // (без имени листа — применяется ко всем листам геометрически, парсинга имён нет).
    // Попутно кэшируем все остальные листы из того же ответа.
    await getSheetNames(); // убеждаемся что sheetId закэширован
    const sheetId = _sheetIdCache.get(sheetName);
    const fullRes = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
      ranges: ['A1:J300'],
    });
    for (const s of fullRes.data.sheets ?? []) {
      const name = s.properties?.title;
      if (!name) continue;
      if (_sheetCache.has(name)) continue; // не перетираем уже закэшированные
      const rows = extractRowsFromGridData(s as Parameters<typeof extractRowsFromGridData>[0]);
      _sheetCache.set(name, rows);
      if (s.properties?.sheetId === sheetId) values = rows;
    }
  }
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
  const sheets = getSheetsClient();

  // Один запрос: метаданные + строка A7 для каждого листа.
  // ranges без имени листа применяется геометрически ко всем листам —
  // никакого парсинга имён, точки в названиях не ломают запрос.
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    ranges: ['A7:A7'],
  });

  const result: QuestionSummary[] = [];
  for (const s of res.data.sheets ?? []) {
    const sheetName = s.properties?.title;
    const sheetId = s.properties?.sheetId;
    if (!sheetName) continue;

    // Кэшируем sheetId, чтобы не делать лишний getSheetNames() позже
    if (sheetId != null) _sheetIdCache.set(sheetName, sheetId);

    // rowData[0] = строка A7, values[0] = ячейка A (col 0)
    const title = (s.data?.[0]?.rowData?.[0]?.values?.[0]?.formattedValue as string | undefined | null) ?? sheetName;
    result.push({ sheetName, title: title || sheetName, hasChanges: false });
  }

  // Синхронизируем _sheetNamesCache из того же ответа
  if (!_sheetNamesCache) {
    _sheetNamesCache = result.map((q) => q.sheetName);
  }

  return result;
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

  // Читаем "до изменений" из кэша (заполнился при loadQuestion)
  const savedRows = await getSheetValues(sheetName);
  const savedState = parseRows(savedRows);

  // sheetId нужен для всех операций — гарантированно кэшируем
  await getSheetNames();
  const sheetId = _sheetIdCache.get(sheetName);
  if (sheetId == null) throw new Error(`sheetId not found for sheet: ${sheetName}`);

  // ── Все записи через spreadsheets.batchUpdate (GridRange по числовому sheetId) ──
  // Это единственный способ надёжно писать в листы с точками/спецсимволами в названии,
  // т.к. values API парсит строки диапазонов и падает на таких именах.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = [];

  // Вспомогательная функция: UpdateCellsRequest для одной ячейки
  function cellUpdate(rowIndex: number, colIndex: number, value: string) {
    return {
      updateCells: {
        range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
        rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
        fields: 'userEnteredValue',
      },
    };
  }

  // ── 1. Фиксированные ячейки (только изменившиеся) ───────────────────────
  if (current.title !== savedState.title) {
    requests.push(cellUpdate(6, 0, current.title)); // A7
  }

  const approvalKeys = ['rosstat', 'depr', 'ntu', 'dit'] as const;
  approvalKeys.forEach((key, i) => {
    if (current.approval[key] !== savedState.approval[key]) {
      requests.push(cellUpdate(i + 1, 2, current.approval[key])); // C2–C5
    }
  });

  const cardKeys = ['id', 'abbreviation', 'fillType', 'precondition', 'questionText', 'helpText'] as const;
  cardKeys.forEach((key, i) => {
    if (current.card[key] !== savedState.card[key]) {
      requests.push(cellUpdate(i + 8, 1, current.card[key])); // B9–B14
    }
  });

  // ── 2. Таблицы контролей и ответов (если изменились) ────────────────────
  const controlsChanged = JSON.stringify(current.controls) !== JSON.stringify(savedState.controls);
  const answersChanged  = JSON.stringify(current.answers)  !== JSON.stringify(savedState.answers);

  if (controlsChanged || answersChanged) {
    // Очищаем A16:J300 (rowIndex 15–299, colIndex 0–9)
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 15, endRowIndex: 300, startColumnIndex: 0, endColumnIndex: 10 },
        cell: {},
        fields: 'userEnteredValue',
      },
    });

    // Строим таблицу: сначала контроли, потом заголовок ответов, потом ответы
    const tableRows: string[][] = [];

    for (const ctrl of current.controls) {
      const row = Array<string>(9).fill('');
      row[0] = ctrl.id;
      row[1] = ctrl.type;
      row[3] = ctrl.conditions;
      row[8] = ctrl.strictness;
      tableRows.push(row);
    }

    tableRows.push([
      '№ ответа', 'Аббревиатура ответа', 'Тип ответа', 'Тип варианта ответа',
      'Текст заголовка ответа', 'Текст подсказки ответа', 'Предустановленное значение',
      'Код ответа', 'Переход на id',
    ]);

    for (const ans of current.answers) {
      tableRows.push([ans.number, ans.abbreviation, ans.type, ans.variantType, ans.headerText, ans.hintText, ans.defaultValue, ans.code, ans.nextId]);
    }

    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 15, endRowIndex: 15 + tableRows.length, startColumnIndex: 0, endColumnIndex: 9 },
        rows: tableRows.map((row) => ({
          values: row.map((v) => ({ userEnteredValue: { stringValue: v } })),
        })),
        fields: 'userEnteredValue',
      },
    });
  }

  // ── 3. Цвет B2:C5 — только для изменившихся строк утверждения ────────────
  approvalKeys.forEach((key, i) => {
    if (current.approval[key] !== savedState.approval[key]) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: i + 1, endRowIndex: i + 2, startColumnIndex: 1, endColumnIndex: 3 },
          cell: { userEnteredFormat: { backgroundColor: current.approval[key] === 'Да' ? GREEN_BG : RED_BG } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    }
  });

  // ── Один API-вызов на всё ────────────────────────────────────────────────
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  // Инвалидируем кэш листа — следующее чтение подтянет актуальные данные
  _sheetCache.delete(sheetName);
}
