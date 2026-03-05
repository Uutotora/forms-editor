'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Search, CheckCircle2, Circle } from 'lucide-react';

export function Sidebar() {
  const { questions, loadQuestions, isDirty, setPendingNavigation } = useStore();
  const router = useRouter();
  const params = useParams();
  const currentSheet = params?.sheetName
    ? decodeURIComponent(params.sheetName as string)
    : '';
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const filtered = questions.filter((q) =>
    q.sheetName.toLowerCase().includes(search.toLowerCase()) ||
    q.title.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">Р</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">Росстат Анкета</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск вопросов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Question list */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.map((q) => {
          const isActive = q.sheetName === currentSheet;
          return (
            <button
              key={q.sheetName}
              onClick={() => handleNavigate(q.sheetName)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group text-left ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="flex-shrink-0">
                {q.hasChanges ? (
                  <Circle className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ) : (
                  <CheckCircle2 className={`h-3.5 w-3.5 ${isActive ? 'text-blue-400' : 'text-gray-300 group-hover:text-gray-400'}`} />
                )}
              </span>
              <span className="truncate font-medium">{q.sheetName}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 px-3 py-4">Ничего не найдено</p>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          {questions.length} вопросов
        </p>
      </div>
    </aside>
  );
}
