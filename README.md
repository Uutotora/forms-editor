# Forms Editor — Редактор вопросов Росстат

Веб-приложение для редактирования вопросов анкеты Росстат. Единственный источник данных — Google Sheets. Сервис предоставляет UI для просмотра и редактирования полей вопросов с сохранением изменений напрямую в таблицу.

---

## Стек

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS + shadcn/ui |
| Состояние | Zustand |
| Данные | Google Sheets API v4 (`googleapis`) |
| Язык | TypeScript |

---

## Запуск

```bash
npm run dev
# http://localhost:3000
```

Требования:
1. `data/service-account.json` — JSON-ключ Google Service Account (**не коммитить**, в `.gitignore`)
2. `.env.local`:
   ```
   GOOGLE_SPREADSHEET_ID=13VyG08Ehnayw1066USuEvpPe31HBBosXHlcnGbllR6o
   GOOGLE_CREDENTIALS_PATH=data/service-account.json
   ```
3. Service Account добавлен в доступ к таблице (Sheets → Поделиться → email из JSON-ключа)

---

## Структура файлов

```
forms-editor/
├── app/
│   ├── layout.tsx                        # Корневой layout: Sidebar + диалоги + Toast
│   ├── page.tsx                          # Редирект на первый вопрос из списка
│   ├── questions/[sheetName]/page.tsx    # Страница вопроса: TopBar + QuestionEditor
│   └── api/
│       ├── questions/route.ts            # GET  /api/questions
│       ├── question/[sheetName]/route.ts # GET  /api/question/:name
│       │                                 # PUT  /api/question/:name
│       └── sync/route.ts                 # POST /api/sync
│
├── components/
│   ├── Sidebar.tsx             # Левая панель: список вопросов, поиск, статусы
│   ├── TopBar.tsx              # Верхняя панель: Undo/Redo, Сохранить, Синхронизировать
│   ├── QuestionEditor.tsx      # Форма редактирования (4 секции)
│   ├── AppInitializer.tsx      # Невидимый компонент — performSync при старте
│   ├── UnsavedDialog.tsx       # Диалог при навигации с несохранёнными изменениями
│   ├── SyncWarningDialog.tsx   # Диалог-предупреждение перед синхронизацией
│   ├── SyncProgressOverlay.tsx # Полноэкранный прогресс синхронизации
│   └── Toast.tsx               # Всплывающие уведомления (success / error)
│
├── lib/
│   ├── googleSheets.ts  # Весь I/O с Google Sheets: кэш, парсинг, чтение, запись
│   ├── store.ts         # Zustand store: весь клиентский стейт и async-экшены
│   └── types.ts         # TypeScript-интерфейсы
│
├── data/
│   └── service-account.json  # НЕ коммитить. Ключ Service Account.
│
└── next.config.ts       # serverExternalPackages: ['googleapis'] — обязательно
```

---

## Структура Google Sheets

Каждый лист таблицы = один вопрос. Все листы имеют одинаковый шаблон. Индексы **0-based**:

| Строка | Столбец | Содержимое |
|---|---|---|
| 1 | C (2) | Статус утверждения Росстат ("Да" / "Нет") |
| 2 | C (2) | Статус ДЭПР |
| 3 | C (2) | Статус НТУ |
| 4 | C (2) | Статус ДИТ |
| 6 | A (0) | Заголовок вопроса (title) |
| 8 | B (1) | card.id |
| 9 | B (1) | card.abbreviation |
| 10 | B (1) | card.fillType |
| 11 | B (1) | card.precondition |
| 12 | B (1) | card.questionText |
| 13 | B (1) | card.helpText |
| 14 | — | Заголовок таблицы контролей (не трогать) |
| 15+ | A–I | Контроли: col0=id, col1=type, col3=conditions, col8=strictness |
| ? | A | Ячейка "№ ответа" — маркер начала таблицы ответов (позиция переменная) |
| ?+1+ | A–I | Ответы: col0=number, col1=abbreviation, col2=type, col3=variantType, col4=headerText, col5=hintText, col6=defaultValue, col7=code, col8=nextId |

Цвет B–C строк 2–5: `#D9EAD3` (зелёный) при "Да", `#F4CCCC` (красный) при "Нет" — выставляется автоматически при сохранении.

---

## lib/googleSheets.ts — главный серверный модуль

### Кэш (module-level, живёт между запросами в одном процессе)

```typescript
const _sheetCache   = new Map<string, string[][]>(); // имя листа → строки ячеек
let _sheetNamesCache: string[] | null = null;         // упорядоченный список имён листов
const _sheetIdCache = new Map<string, number>();      // имя листа → числовой sheetId
```

`invalidateCache()` — сбрасывает всё. Вызывается в `POST /api/sync`.

### Критический баг Google Sheets API: листы с точкой в названии

API падает с ошибкой `Unable to parse range: 'Вопрос 37.4'!A1:J300` — это баг на стороне Google при использовании имён листов с точками в range-строках. Решения применены по всему модулю:

- **Чтение (`getSheetValues`)**: сначала пробует обычный `values.get`. При ошибке — fallback: `spreadsheets.get` с `includeGridData: true, ranges: ['A1:J300']` (без имени листа — применяется геометрически ко всем листам, парсинга нет). Кэширует все листы из ответа попутно.
- **Запись (`saveQuestion`)**: использует исключительно `spreadsheets.batchUpdate` с `GridRange` (числовой `sheetId`). Range-строки с именем листа не используются нигде в операциях записи.
- **Список вопросов (`getQuestionList`)**: `spreadsheets.get` с `ranges: ['A7:A7']` без имён листов — один запрос на все листы.

### Логика saveQuestion

1. Читает "состояние до" из серверного кэша (`getSheetValues` → `parseRows`)
2. Сравнивает поле за полем — пишет **только изменившиеся** ячейки
3. Контроли/ответы: если изменились — очищает A16:J300 через `repeatCell`, затем пишет новую таблицу через `updateCells`
4. Цвет утверждения: `repeatCell` с `backgroundColor` только для изменившихся строк
5. Всё выполняется одним `batchUpdate`-запросом
6. Инвалидирует кэш конкретного листа после записи

---

## lib/store.ts — Zustand store

### Стейт

| Поле | Тип | Назначение |
|---|---|---|
| `questions` | `QuestionSummary[]` | Список вопросов для сайдбара |
| `currentQuestion` | `Question \| null` | Открытый вопрос (редактируется в UI) |
| `savedQuestion` | `Question \| null` | Снимок на момент последнего сохранения (для diff-индикации) |
| `isDirty` | `boolean` | Есть несохранённые изменения |
| `history` | `Question[]` | Стек undo/redo (макс. 100 снимков) |
| `historyIndex` | `number` | Текущая позиция в `history` |
| `savedFlash` | `{approval, card, controls, answers: boolean}` | Зелёная подсветка блока после сохранения (1.5 сек) |
| `unsavedQuestions` | `Record<string, Question>` | Несохранённые вопросы при переходе "без сохранения" |
| `isSyncing` | `boolean` | Идёт синхронизация |
| `syncProgress` | `number` | 0–100, для прогресс-бара |
| `syncWarning` | `boolean` | Показать диалог-предупреждение перед sync |

### Экшены

| Экшен | Что делает |
|---|---|
| `loadQuestion(sheetName)` | GET /api/question/:name. Если есть в `unsavedQuestions` — восстанавливает несохранённое состояние |
| `updateQuestion(partial)` | Мерджит partial в `currentQuestion`, ставит `isDirty: true` |
| `commitHistory()` | Добавляет снимок в `history` (вызывается на `onBlur` полей) |
| `undo()` / `redo()` | Перемещение по `history` |
| `saveQuestion()` | PUT /api/question/:name. Вычисляет per-block `savedFlash` сравнивая с `savedQuestion` |
| `sync()` | Если `isDirty` — показывает `syncWarning`. Иначе — `performSync()` |
| `performSync()` | POST /api/sync (сброс кэша), перезагружает список и `currentQuestion` |
| `storeUnsavedQuestion(name, q)` | Сохраняет вопрос в `unsavedQuestions` при навигации "без сохранения" |

---

## lib/types.ts — TypeScript типы

```typescript
interface Question {
  sheetName: string;        // название листа Google Sheets
  title: string;            // A7
  approval: ApprovalStatus; // { rosstat, depr, ntu, dit }  — значения "Да" / "Нет"
  card: CardFields;         // { id, abbreviation, fillType, precondition, questionText, helpText }
  controls: ControlRow[];   // { id, type, conditions, strictness }
  answers: AnswerRow[];     // { number, abbreviation, type, variantType, headerText, hintText, defaultValue, code, nextId }
}

interface QuestionSummary {
  sheetName: string;
  title: string;
  hasChanges: boolean;      // true если в текущей сессии были сохранения (dot в сайдбаре)
}
```

---

## Компонент QuestionEditor

Четыре блока в фиксированном порядке, **всегда отображаются** (даже если пустые):

1. **Статус утверждения** — кнопки-чипы Росстат/ДЭПР/НТУ/ДИТ (toggle Да/Нет). Зеленеет при `savedFlash.approval`.
2. **Карточка вопроса** — поля id, abbreviation, fillType, precondition (read-only серым), questionText, helpText (editable). Зеленеет при `savedFlash.card`.
3. **Контроли** — коллапсируемый `CollapsibleSection`, таблица только для просмотра. Зеленеет при `savedFlash.controls`.
4. **Варианты ответов** — коллапсируемый, карточка на каждый ответ: мета-чипы (6 полей read-only) + textarea для `headerText` и `hintText`. Зеленеет при `savedFlash.answers`.

Поля с изменением относительно `savedQuestion` подсвечиваются жёлтым ("Изменено · не сохранено").

При `count === 0` в коллапсируемых блоках отображается "Нет данных".

---

## Полный поток данных

```
Старт приложения
  └── AppInitializer → performSync()
        └── POST /api/sync → invalidateCache() → getQuestionList()
        └── перезагружает currentQuestion если открыт

Выбор вопроса (Sidebar)
  └── router.push(/questions/:sheetName)
        └── QuestionPage useEffect → loadQuestion(sheetName)
              └── GET /api/question/:name → getSheetValues() → parseRows()
              └── store: currentQuestion = serverData, savedQuestion = serverData

Редактирование поля
  └── onChange → updateQuestion(partial)    — isDirty = true, currentQuestion обновляется
  └── onBlur  → commitHistory()             — снимок добавляется в history

Сохранение (кнопка или Ctrl+S)
  └── saveQuestion()
        └── PUT /api/question/:name (body: currentQuestion)
        └── сервер: сравнивает с кэшем, пишет только diff → batchUpdate → инвалидирует кэш листа
        └── клиент: savedFlash per-block на 1.5 сек, isDirty = false, toast "Изменения сохранены"

Синхронизация (кнопка)
  └── sync()
        ├── isDirty → syncWarning диалог (подтвердить / отмена)
        └── иначе → performSync()
              └── POST /api/sync → invalidateCache() → getQuestionList()
              └── перезагружает currentQuestion с сервера
              └── toast "Синхронизация выполнена"

Навигация с несохранёнными изменениями
  └── Sidebar handleNavigate → isDirty → setPendingNavigation(path)
        └── UnsavedDialog:
              "Сохранить и перейти"      → saveQuestion() → router.push
              "Перейти без сохранения"   → storeUnsavedQuestion(name, current) → router.push
              "Отмена"                   → закрыть диалог
        └── При повторном открытии loadQuestion восстановит unsaved из памяти
```

---

## API Routes

| Метод | URL | Тело / Ответ |
|---|---|---|
| GET | `/api/questions` | `{ questions: QuestionSummary[] }` |
| GET | `/api/question/:sheetName` | `{ question: Question }` |
| PUT | `/api/question/:sheetName` | body: `Question`, ответ: `{ success: true }` |
| POST | `/api/sync` | `{ questions: QuestionSummary[] }` |

Имена листов с кириллицей передаются через `encodeURIComponent` в URL и декодируются на сервере.

---

## Известные особенности и решения

| Проблема | Решение |
|---|---|
| Google Sheets API: `Unable to parse range` на листах с точками (`Вопрос 37.4`) | Fallback в `getSheetValues` через `spreadsheets.get + includeGridData`. Вся запись через `batchUpdate` с числовым `sheetId` |
| `googleapis` не работает с Turbopack | `serverExternalPackages: ['googleapis']` в `next.config.ts` |
| Кэш устаревает после ручных правок в таблице | Инвалидируется: по листу — после каждого save; полностью — при sync |
| При навигации теряются несохранённые изменения | `storeUnsavedQuestion` сохраняет в памяти, `loadQuestion` восстанавливает |
| `service-account.json` попал в git | Удалён из истории: `git rm --cached`, добавлен в `.gitignore` |
