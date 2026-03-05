'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Search } from 'lucide-react';

function FormIcon() {
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="3" width="14" height="13" rx="2" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.2"/>
        <rect x="6" y="1.5" width="6" height="2.5" rx="1" fill="white"/>
        <line x1="5" y1="8" x2="13" y2="8" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="5" y1="11" x2="13" y2="11" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="5" y1="14" x2="10" y2="14" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// Разделяет "Вопрос 1а" → { prefix: "Вопрос ", code: "1а" }
// Если нет слова "Вопрос" — всё идёт в code
function parseSheetName(sheetName: string): { prefix: string; code: string } {
  const match = sheetName.match(/^(вопрос\s*)/i);
  if (match) {
    return { prefix: sheetName.slice(0, match[0].length), code: sheetName.slice(match[0].length) };
  }
  return { prefix: '', code: sheetName };
}

function splitByMatch(text: string, query: string): { text: string; match: boolean }[] {
  if (!query.trim()) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const lq = query.toLowerCase();
  let last = 0;
  let idx = lower.indexOf(lq, last);
  while (idx !== -1) {
    if (idx > last) parts.push({ text: text.slice(last, idx), match: false });
    parts.push({ text: text.slice(idx, idx + lq.length), match: true });
    last = idx + lq.length;
    idx = lower.indexOf(lq, last);
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

function HighlightedCode({ code, query, isActive }: { code: string; query: string; isActive: boolean }) {
  const parts = splitByMatch(code, query);
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className={`rounded-sm px-0.5 font-semibold not-italic ${
              isActive ? 'bg-amber-300 text-blue-900' : 'bg-amber-200 text-gray-900'
            }`}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

export function Sidebar() {
  const { questions, loadQuestions, isDirty, setPendingNavigation, unsavedQuestions } = useStore();
  const router = useRouter();
  const params = useParams();
  const currentSheet = params?.sheetName
    ? decodeURIComponent(params.sheetName as string)
    : '';
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const q = search.toLowerCase().trim();

  // Ищем только по коду вопроса (без слова "Вопрос")
  const filtered = questions.filter((item) => {
    if (!q) return true;
    const { code } = parseSheetName(item.sheetName);
    return code.toLowerCase().includes(q);
  });

  const handleNavigate = (sheetName: string) => {
    if (sheetName === currentSheet) return;
    const path = `/questions/${encodeURIComponent(sheetName)}`;
    if (isDirty) {
      setPendingNavigation(path);
    } else {
      router.push(path);
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5 mb-4">
          <FormIcon />
          <span className="text-sm font-semibold text-gray-900">Росстат Анкета</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Question list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {filtered.map((item) => {
          const isActive = item.sheetName === currentSheet;
          const isUnsaved = item.sheetName in unsavedQuestions;
          const showGreen = item.hasChanges && !isUnsaved;
          const showYellow = isUnsaved;
          const { prefix, code } = parseSheetName(item.sheetName);

          return (
            <button
              key={item.sheetName}
              onClick={() => handleNavigate(item.sheetName)}
              className={`relative w-full flex items-center gap-2.5 pl-4 pr-3 py-2.5 text-sm transition-all duration-150 text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-500 rounded-full" />
              )}

              <span className="truncate flex-1">
                {/* "Вопрос " — обычный текст, подсветка только в коде */}
                {prefix && <span className="opacity-60">{prefix}</span>}
                <HighlightedCode code={code} query={q} isActive={isActive} />
              </span>

              {showGreen && (
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400" title="Сохранено" />
              )}
              {showYellow && (
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400" title="Есть несохранённые изменения" />
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 px-4 py-4">Ничего не найдено</p>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">{questions.length} вопросов</p>
      </div>
    </aside>
  );
}
